import express from 'express';
import { config } from './config';
import { mockSuppliers } from './mockSuppliers';
import { redis, hasCity, filterByPrice } from './redis';
import { runHotelWorkflow } from './temporal/client';

const app = express();
app.use(mockSuppliers); // the two fake suppliers from earlier

// Turn "5000" into 5000. Missing value -> undefined. Not a number -> NaN.
function parsePrice(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

app.get('/api/hotels', async (req, res) => {
  const city = String(req.query.city ?? '').trim().toLowerCase();
  if (!city) {
    res.status(400).json({ error: 'city is required, e.g. ?city=delhi' });
    return;
  }

  const min = parsePrice(req.query.minPrice);
  const max = parsePrice(req.query.maxPrice);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    res.status(400).json({ error: 'minPrice and maxPrice must be numbers' });
    return;
  }
  if (min !== undefined && max !== undefined && min > max) {
    res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    return;
  }

  try {
    // No price filter: run the Temporal workflow (it also saves the result to Redis)
    if (min === undefined && max === undefined) {
      res.json(await runHotelWorkflow(city));
      return;
    }

    // Price filter: ask Redis. If Redis has nothing saved yet, fill it first.
    if (!(await hasCity(city))) {
      await runHotelWorkflow(city);
    }
    res.json(await filterByPrice(city, min, max));
  } catch (err) {
    console.error('Failed to fetch hotels:', err);
    res.status(502).json({ error: 'Could not fetch hotel offers' });
  }
});

// Health check: are both suppliers and Redis alive?
async function checkSupplier(id: 'A' | 'B'): Promise<'up' | 'down'> {
  try {
    const r = await fetch(`${config.supplierBaseUrl}/supplier${id}/hotels?city=delhi`, {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

app.get('/health', async (_req, res) => {
  const [a, b, redisStatus] = await Promise.all([
    checkSupplier('A'),
    checkSupplier('B'),
    redis.ping().then(() => 'up', () => 'down'),
  ]);
  const healthy = a === 'up' && b === 'up' && redisStatus === 'up';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    suppliers: { supplierA: a, supplierB: b },
    redis: redisStatus,
  });
});

app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`));