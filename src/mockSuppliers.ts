import { Router } from 'express';
import type { SupplierHotel } from './types';

const data: Record<'A' | 'B', SupplierHotel[]> = {
  A: [
    { hotelId: 'a1', name: 'Holtin',     price: 6000,  city: 'delhi',  commissionPct: 10 },
    { hotelId: 'a2', name: 'Radison',    price: 5900,  city: 'delhi',  commissionPct: 13 },
    { hotelId: 'a3', name: 'Leela',      price: 9500,  city: 'delhi',  commissionPct: 12 },
    { hotelId: 'a4', name: 'Taj Palace', price: 12000, city: 'delhi',  commissionPct: 15 },
    { hotelId: 'a5', name: 'Trident',    price: 8000,  city: 'mumbai', commissionPct: 14 },
  ],
  B: [
    { hotelId: 'b1', name: 'Holtin',  price: 5340,  city: 'delhi',  commissionPct: 20 },
    { hotelId: 'b2', name: 'Radison', price: 6100,  city: 'delhi',  commissionPct: 11 },
    { hotelId: 'b3', name: 'Leela',   price: 9800,  city: 'delhi',  commissionPct: 9 },
    { hotelId: 'b4', name: 'Oberoi',  price: 14000, city: 'delhi',  commissionPct: 18 },
    { hotelId: 'b5', name: 'Trident', price: 7500,  city: 'mumbai', commissionPct: 16 },
  ],
};

// Lets us pretend a supplier is broken, to test error handling later
const down = { A: false, B: false };

export const mockSuppliers = Router();

for (const id of ['A', 'B'] as const) {
  mockSuppliers.get(`/supplier${id}/hotels`, (req, res) => {
    if (down[id]) {
      res.status(503).json({ error: `Supplier ${id} is down` });
      return;
    }
    const city = String(req.query.city ?? '').toLowerCase();
    res.json(city ? data[id].filter((h) => h.city === city) : data[id]);
  });

  mockSuppliers.post(`/supplier${id}/down`, (_req, res) => {
    down[id] = true;
    res.json({ supplier: id, down: true });
  });

  mockSuppliers.post(`/supplier${id}/up`, (_req, res) => {
    down[id] = false;
    res.json({ supplier: id, down: false });
  });
}