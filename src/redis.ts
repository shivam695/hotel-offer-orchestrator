import Redis from 'ioredis';
import { config } from './config';
import type { Hotel } from './types';

export const redis = new Redis(config.redisUrl);

const keyFor = (city: string) => `hotels:${city}`;

// Save the hotel list. Price is used as the "score" so Redis can sort and filter by it.
export async function saveHotels(city: string, hotels: Hotel[]) {
  const tx = redis.multi().del(keyFor(city)); // clear the old list first
  if (hotels.length > 0) {
    tx.zadd(keyFor(city), ...hotels.flatMap((h) => [h.price, JSON.stringify(h)]));
    tx.expire(keyFor(city), 300); // forget it after 5 minutes
  }
  await tx.exec();
}

// Ask Redis for hotels between min and max price. Redis does the filtering.
export async function filterByPrice(city: string, min?: number, max?: number): Promise<Hotel[]> {
  const raw = await redis.zrangebyscore(keyFor(city), min ?? '-inf', max ?? '+inf');
  return raw.map((item) => JSON.parse(item) as Hotel);
}

// Is there already a saved list for this city?
export async function hasCity(city: string): Promise<boolean> {
  return (await redis.exists(keyFor(city))) === 1;
}