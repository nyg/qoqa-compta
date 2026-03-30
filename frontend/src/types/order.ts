/**
 * TypeScript type definitions for Qoqa orders.
 * Mirrors the qoqa_orders PostgreSQL table.
 */
export interface QoqaOrder {
  id: number;
  order_number: string;
  order_date: string; // ISO date string "YYYY-MM-DD"
  amount_chf: string; // Decimal string from PostgreSQL
  partner_name: string | null;
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
