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
// Landing page
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hotel Offer Orchestrator</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; line-height: 1.6; color: #1a1a1a; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
    a { color: #0b5fff; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <h1>Hotel Offer Orchestrator</h1>
  <p>Fetches hotel offers from two mock suppliers <strong>in parallel</strong> using a Temporal workflow,
     removes duplicates by hotel name, keeps the cheapest offer per hotel, and stores the result in Redis
     so it can be filtered by price range.</p>

  <h2>Try it</h2>
  <ul>
    <li><a href="/api/hotels?city=delhi">/api/hotels?city=delhi</a> : best offer per hotel</li>
    <li><a href="/api/hotels?city=delhi&minPrice=5000&maxPrice=6000">/api/hotels?city=delhi&amp;minPrice=5000&amp;maxPrice=6000</a> : price filter (done inside Redis)</li>
    <li><a href="/api/hotels?city=paris">/api/hotels?city=paris</a> : city with no results</li>
    <li><a href="/health">/health</a> : health of both suppliers and Redis</li>
    <li><a href="/supplierA/hotels?city=delhi">/supplierA/hotels</a> and <a href="/supplierB/hotels?city=delhi">/supplierB/hotels</a> : the mock suppliers</li>
  </ul>

  <h2>Stack</h2>
  <p>Node.js (TypeScript), Express, Temporal, Redis, Docker Compose.</p>

  <p><a href="https://github.com/shivam695/hotel-offer-orchestrator">Source code and README on GitHub</a></p>
</body>
</html>`);
});

app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`));