/**
 * TypeScript type definitions for QoQa orders, universes, and sub-universes.
 * Mirrors the qoqa_orders, qoqa_universes, and qoqa_subuniverses PostgreSQL tables.
 */
export interface QoqaOrder {
  id: number;
  order_number: string;
  order_date: string; // ISO date string "YYYY-MM-DD"
  amount_chf: string; // Decimal string from PostgreSQL / SQLite
  status: string | null;
  subtotal_chf: string | null;
  discount_chf: string | null;
  vat_chf: string | null;
  delivery_on: string | null; // ISO date string "YYYY-MM-DD"
  offer_id: string | null;
  offer_title: string | null;
  offer_subtitle: string | null;
  universe: string | null;
  subuniverse: string | null; // cleaned identifier (e.g. "beer")
  universe_name: string | null;
  subuniverse_name: string | null;
  item_description: string | null;
  invoice_number: string | null;
  pdf_filename: string | null;
  /** True when the row has a stored PDF blob available for download/preview. */
  has_pdf: boolean;
  created_at: string;
  updated_at: string;
}

export interface QoqaUniverse {
  universe_tracking_identifier: string;
  name: string | null;
}

/** A sub-universe with its display name. */
export interface SubuniverseOption {
  identifier: string;
  name: string;
}

/** A universe with its localized display name and nested sub-universes. */
export interface UniverseOption {
  identifier: string;
  name: string;
  subuniverses: SubuniverseOption[];
}

export interface OrderStats {
  total_spent: number;
  order_count: number;
  average_per_order: number;
}

export interface MonthlySpending {
  month: string; // "YYYY-MM"
  total: number;
  count: number;
}

export interface YearlySpending {
  year: number;
  total: number;
  count: number;
}
