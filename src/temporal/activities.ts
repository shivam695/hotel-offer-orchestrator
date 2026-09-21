import { log } from '@temporalio/activity';
import { config } from '../config';
import { saveHotels } from '../redis';
import type { Hotel, SupplierHotel, SupplierId } from '../types';

// Job 1: ask one supplier for its hotel list
export async function fetchSupplier(supplier: SupplierId, city: string): Promise<SupplierHotel[]> {
  const url = `${config.supplierBaseUrl}/supplier${supplier}/hotels?city=${encodeURIComponent(city)}`;
  log.info('Calling supplier', { supplier, city });

  const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) {
    log.error('Supplier returned an error', { supplier, status: res.status });
    throw new Error(`Supplier ${supplier} responded with ${res.status}`);
  }

  const hotels = (await res.json()) as SupplierHotel[];
  log.info('Supplier responded', { supplier, count: hotels.length });
  return hotels;
}

// Job 2: save the final list into Redis
export async function saveHotelsToRedis(city: string, hotels: Hotel[]): Promise<void> {
  await saveHotels(city, hotels);
  log.info('Saved hotels to Redis', { city, count: hotels.length });
}