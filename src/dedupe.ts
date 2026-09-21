import type { Hotel, SupplierResult } from './types';

export function pickBestOffers(results: SupplierResult[]): Hotel[] {
  const best = new Map<string, Hotel>();

  for (const { supplier, hotels } of results) {
    for (const h of hotels) {
      const key = h.name.trim().toLowerCase();
      const candidate: Hotel = {
        name: h.name,
        price: h.price,
        supplier,
        commissionPct: h.commissionPct,
      };

      const current = best.get(key);
      const isBetter =
        !current ||
        candidate.price < current.price ||
        (candidate.price === current.price && candidate.commissionPct > current.commissionPct);

      if (isBetter) best.set(key, candidate);
    }
  }

  return [...best.values()].sort((a, b) => a.price - b.price);
}