/**
 * TypeScript type definitions for QoQa orders.
 * Mirrors the qoqa_orders PostgreSQL table.
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
  offer_category: string | null;
  offer_subcategory: string | null;
  item_description: string | null;
  invoice_number: string | null;
  pdf_filename: string | null;
  created_at: string;
  updated_at: string;
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
