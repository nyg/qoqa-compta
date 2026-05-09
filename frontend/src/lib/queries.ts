/**
 * All database query functions used by page.tsx and /api/orders.
 *
 * Each function runs the same logical query but emits dialect-appropriate SQL
 * depending on whether we're talking to SQLite or PostgreSQL.
 *
 * SQLite caveats vs PostgreSQL:
 *  - LIKE instead of ILIKE (case-insensitive for ASCII only)
 *  - strftime() instead of TO_CHAR() / EXTRACT()
 *  - date('now', '-24 months') instead of NOW() - INTERVAL '24 months'
 *  - No ::float / ::int casts — CAST(x AS REAL/INTEGER) used instead
 */
import { and, between, gte, inArray, lte, or, sql, SQL } from "drizzle-orm";
import { db, isSqlite, qoqaOrders } from "./db";
import type { OrderStats, MonthlySpending, YearlySpending } from "@/types/order";
import type { QoqaOrder } from "@/types/order";

// ── Helpers ──────────────────────────────────────────────────────────────────

function asFloat(col: SQL): SQL<number> {
  return isSqlite
    ? sql<number>`CAST(${col} AS REAL)`
    : sql<number>`(${col})::float`;
}

function asInt(col: SQL): SQL<number> {
  return isSqlite
    ? sql<number>`CAST(${col} AS INTEGER)`
    : sql<number>`(${col})::int`;
}

function yearMonth(col: SQL): SQL<string> {
  return isSqlite
    ? sql<string>`strftime('%Y-%m', ${col})`
    : sql<string>`TO_CHAR(${col}, 'YYYY-MM')`;
}

function yearOf(col: SQL): SQL<number> {
  return isSqlite
    ? sql<number>`CAST(strftime('%Y', ${col}) AS INTEGER)`
    : sql<number>`EXTRACT(YEAR FROM ${col})::int`;
}

function monthsAgo24(): SQL<string> {
  return isSqlite
    ? sql<string>`date('now', '-24 months')`
    : sql<string>`CURRENT_DATE - INTERVAL '24 months'`;
}

// ── Query functions ───────────────────────────────────────────────────────────

/** Returns distinct, non-null offer_category values sorted alphabetically. */
export async function fetchCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: qoqaOrders.offer_category })
    .from(qoqaOrders)
    .where(sql`${qoqaOrders.offer_category} IS NOT NULL`)
    .orderBy(qoqaOrders.offer_category);
  return rows.map((r) => r.category as string);
}

export async function fetchStats(categories: string[] = []): Promise<OrderStats> {
  const col = qoqaOrders.amount_chf;
  const where = categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;
  const [row] = await db
    .select({
      total_spent: asFloat(sql`COALESCE(SUM(${col}), 0)`),
      order_count: asInt(sql`COUNT(*)`),
      average_per_order: asFloat(sql`COALESCE(AVG(${col}), 0)`),
    })
    .from(qoqaOrders)
    .where(where);
  return row as OrderStats;
}

export async function fetchMonthlySpending(categories: string[] = []): Promise<MonthlySpending[]> {
  const month = yearMonth(sql`${qoqaOrders.order_date}`);
  const catClause = categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;
  return db
    .select({
      month,
      total: asFloat(sql`SUM(${qoqaOrders.amount_chf})`),
      count: asInt(sql`COUNT(*)`),
    })
    .from(qoqaOrders)
    .where(and(sql`${qoqaOrders.order_date} >= ${monthsAgo24()}`, catClause))
    .groupBy(month)
    .orderBy(month) as Promise<MonthlySpending[]>;
}

export async function fetchYearlySpending(categories: string[] = []): Promise<YearlySpending[]> {
  const year = yearOf(sql`${qoqaOrders.order_date}`);
  const where = categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;
  return db
    .select({
      year,
      total: asFloat(sql`SUM(${qoqaOrders.amount_chf})`),
      count: asInt(sql`COUNT(*)`),
    })
    .from(qoqaOrders)
    .where(where)
    .groupBy(year)
    .orderBy(year) as Promise<YearlySpending[]>;
}

export interface OrdersFilter {
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  categories?: string[];
  page?: number;
  pageSize?: number;
}

function buildWhere(filter: OrdersFilter): SQL | undefined {
  const {
    search = "",
    minAmount = 0,
    maxAmount = Number.MAX_SAFE_INTEGER,
    from = "2000-01-01",
    to = "2099-12-31",
    categories = [],
  } = filter;

  const searchPattern = `%${search}%`;

  const searchClause = or(
    sql`${qoqaOrders.order_number} LIKE ${searchPattern}`,
    sql`${qoqaOrders.offer_title} LIKE ${searchPattern}`,
    sql`${qoqaOrders.item_description} LIKE ${searchPattern}`
  )!;

  const categoryClause =
    categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;

  return and(
    searchClause,
    gte(qoqaOrders.amount_chf, String(minAmount)),
    lte(qoqaOrders.amount_chf, String(maxAmount)),
    between(qoqaOrders.order_date, from, to),
    categoryClause
  );
}

export async function fetchOrders(
  filter: OrdersFilter = {}
): Promise<QoqaOrder[]> {
  const { page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;
  const where = buildWhere(filter);

  const rows = await db
    .select()
    .from(qoqaOrders)
    .where(where)
    .orderBy(sql`${qoqaOrders.order_date} DESC`)
    .limit(pageSize)
    .offset(offset);

  return rows.map(normalizeOrder);
}

export async function fetchOrdersCount(filter: OrdersFilter = {}): Promise<number> {
  const where = buildWhere(filter);
  const [row] = await db
    .select({ total: asInt(sql`COUNT(*)`) })
    .from(qoqaOrders)
    .where(where);
  return row.total;
}

export async function fetchInitialOrders(categories: string[] = []): Promise<QoqaOrder[]> {
  const where = categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;
  const rows = await db
    .select()
    .from(qoqaOrders)
    .where(where)
    .orderBy(sql`${qoqaOrders.order_date} DESC`)
    .limit(20);
  return rows.map(normalizeOrder);
}

export async function fetchTotalCount(categories: string[] = []): Promise<number> {
  const where = categories.length > 0 ? inArray(qoqaOrders.offer_category, categories) : undefined;
  const [row] = await db.select({ total: asInt(sql`COUNT(*)`) }).from(qoqaOrders).where(where);
  return row.total;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/** Coerce a DB row into the shape expected by the frontend components. */
function normalizeOrder(row: Record<string, unknown>): QoqaOrder {
  return {
    id: Number(row.id),
    order_number: String(row.order_number),
    order_date: String(row.order_date),
    amount_chf: String(row.amount_chf),
    status: row.status != null ? String(row.status) : null,
    subtotal_chf: row.subtotal_chf != null ? String(row.subtotal_chf) : null,
    discount_chf: row.discount_chf != null ? String(row.discount_chf) : null,
    vat_chf: row.vat_chf != null ? String(row.vat_chf) : null,
    delivery_on: row.delivery_on != null ? String(row.delivery_on) : null,
    offer_id: row.offer_id != null ? String(row.offer_id) : null,
    offer_title: row.offer_title != null ? String(row.offer_title) : null,
    offer_subtitle: row.offer_subtitle != null ? String(row.offer_subtitle) : null,
    offer_category: row.offer_category != null ? String(row.offer_category) : null,
    offer_subcategory: row.offer_subcategory != null ? String(row.offer_subcategory) : null,
    item_description: row.item_description != null ? String(row.item_description) : null,
    invoice_number: row.invoice_number != null ? String(row.invoice_number) : null,
    pdf_filename: row.pdf_filename != null ? String(row.pdf_filename) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
