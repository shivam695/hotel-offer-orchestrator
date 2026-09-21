import { proxyActivities, log, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from './activities';
import { pickBestOffers } from '../dedupe';
import type { Hotel, SupplierId, SupplierResult } from '../types';

const { fetchSupplier } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 2, initialInterval: '500ms' },
});

const { saveHotelsToRedis } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 3 },
});

export async function hotelOffersWorkflow(city: string): Promise<Hotel[]> {
  const suppliers: SupplierId[] = ['A', 'B'];

  // Call both suppliers at the same time. allSettled means one failure won't cancel the other.
  const settled = await Promise.allSettled(suppliers.map((s) => fetchSupplier(s, city)));

  const results: SupplierResult[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      results.push({ supplier: `Supplier ${suppliers[i]}`, hotels: r.value });
    } else {
      log.warn(`Supplier ${suppliers[i]} failed, continuing without it`, { error: String(r.reason) });
    }
  });

  if (results.length === 0) {
    throw ApplicationFailure.nonRetryable('All suppliers failed', 'AllSuppliersDown');
  }

  const hotels = pickBestOffers(results); // the logic from Step 7
  await saveHotelsToRedis(city, hotels);
  return hotels;
}