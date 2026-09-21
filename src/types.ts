// What a supplier sends us
export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

// What we send to the customer (the final, cleaned-up hotel)
export interface Hotel {
  name: string;
  price: number;
  supplier: string; // "Supplier A" or "Supplier B"
  commissionPct: number;
}

// One supplier's full list, labelled with who sent it
export interface SupplierResult {
  supplier: string;
  hotels: SupplierHotel[];
}

export type SupplierId = 'A' | 'B';