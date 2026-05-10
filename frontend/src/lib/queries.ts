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
import { and, between, getTableColumns, gte, inArray, lte, or, sql, SQL } from "drizzle-orm";
import { db, isSqlite, qoqaOrders, qoqaSubuniverses, qoqaUniverses } from "./db";
import type { OrderStats, MonthlySpending, SubuniverseOption, UniverseOption, YearlySpending } from "@/types/order";
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

/**
 * Builds a WHERE clause that filters by universe AND/OR subuniverse.
 * Returns undefined when both lists are empty (no filter).
 *
 * - universes: filter orders where universe IN [...]
 * - subuniverses: filter orders where subuniverse IN [...]
 * - If both are provided, the clauses are OR-combined.
 */
function buildUniverseWhereClause(
  universes: string[],
  subuniverses: string[]
): SQL | undefined {
  const parts: SQL[] = [];
  if (universes.length > 0) parts.push(inArray(qoqaOrders.universe, universes) as SQL);
  if (subuniverses.length > 0) parts.push(inArray(qoqaOrders.subuniverse, subuniverses) as SQL);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return or(...parts) as SQL;
}

// ── Query functions ───────────────────────────────────────────────────────────

/**
 * Returns universe options present in existing orders, in hierarchical form.
 * Only universes/sub-universes that appear in qoqa_orders are included.
 * Names come from the lookup tables; raw identifiers are used as fallback.
 */
export async function fetchUniverses(): Promise<UniverseOption[]> {
  const [universeRows, subRows] = await Promise.all([
    db
      .select({
        identifier: sql<string>`${qoqaOrders.universe}`,
        name: sql<string | null>`${qoqaUniverses.name}`,
      })
      .from(qoqaOrders)
      .leftJoin(
        qoqaUniverses,
        sql`${qoqaOrders.universe} = ${qoqaUniverses.universe_tracking_identifier}`
      )
      .where(sql`${qoqaOrders.universe} IS NOT NULL`)
      .groupBy(sql`${qoqaOrders.universe}`, sql`${qoqaUniverses.name}`)
      .orderBy(sql`COALESCE(${qoqaUniverses.name}, ${qoqaOrders.universe})`),
    db
      .select({
        identifier: sql<string>`${qoqaOrders.subuniverse}`,
        name: sql<string | null>`${qoqaSubuniverses.name}`,
        universe_tracking_identifier: sql<string>`${qoqaOrders.universe}`,
      })
      .from(qoqaOrders)
      .leftJoin(
        qoqaSubuniverses,
        sql`${qoqaOrders.subuniverse} = ${qoqaSubuniverses.identifier}`
      )
      .where(sql`${qoqaOrders.subuniverse} IS NOT NULL AND ${qoqaOrders.universe} IS NOT NULL`)
      .groupBy(
        sql`${qoqaOrders.subuniverse}`,
        sql`${qoqaSubuniverses.name}`,
        sql`${qoqaOrders.universe}`
      )
      .orderBy(sql`COALESCE(${qoqaSubuniverses.name}, ${qoqaOrders.subuniverse})`),
  ]);

  const subsByUniverse = new Map<string, SubuniverseOption[]>();
  for (const sub of subRows) {
    const uid = sub.universe_tracking_identifier as string;
    if (!subsByUniverse.has(uid)) subsByUniverse.set(uid, []);
    subsByUniverse.get(uid)!.push({
      identifier: sub.identifier as string,
      name: (sub.name as string) ?? (sub.identifier as string),
    });
  }

  return universeRows.map((u) => ({
    identifier: u.identifier as string,
    name: (u.name as string) ?? (u.identifier as string),
    subuniverses: subsByUniverse.get(u.identifier as string) ?? [],
  }));
}

export async function fetchStats(
  universes: string[] = [],
  subuniverses: string[] = []
): Promise<OrderStats> {
  const col = qoqaOrders.amount_chf;
  const where = buildUniverseWhereClause(universes, subuniverses);
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

export async function fetchMonthlySpending(
  universes: string[] = [],
  subuniverses: string[] = []
): Promise<MonthlySpending[]> {
  const month = yearMonth(sql`${qoqaOrders.order_date}`);
  const catClause = buildUniverseWhereClause(universes, subuniverses);
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

export async function fetchYearlySpending(
  universes: string[] = [],
  subuniverses: string[] = []
): Promise<YearlySpending[]> {
  const year = yearOf(sql`${qoqaOrders.order_date}`);
  const where = buildUniverseWhereClause(universes, subuniverses);
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
  universes?: string[];
  subuniverses?: string[];
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
    universes = [],
    subuniverses = [],
  } = filter;

  const searchPattern = `%${search}%`;

  const searchClause = or(
    sql`${qoqaOrders.order_number} LIKE ${searchPattern}`,
    sql`${qoqaOrders.offer_title} LIKE ${searchPattern}`,
    sql`${qoqaOrders.item_description} LIKE ${searchPattern}`
  )!;

  const universeClause = buildUniverseWhereClause(universes, subuniverses);

  return and(
    searchClause,
    gte(qoqaOrders.amount_chf, String(minAmount)),
    lte(qoqaOrders.amount_chf, String(maxAmount)),
    between(qoqaOrders.order_date, from, to),
    universeClause
  );
}

export async function fetchOrders(
  filter: OrdersFilter = {}
): Promise<QoqaOrder[]> {
  const { page = 1, pageSize = 20 } = filter;
  const offset = (page - 1) * pageSize;
  const where = buildWhere(filter);

  const rows = await db
    .select({
      // Cast required: qoqaOrders is a SQLite|PG union type; spread would produce
      // mixed column types that TypeScript rejects. Runtime values are correct.
      ...(getTableColumns(qoqaOrders) as unknown as Record<string, SQL<unknown>>),
      universe_name: sql<string | null>`${qoqaUniverses.name}`,
      subuniverse_name: sql<string | null>`${qoqaSubuniverses.name}`,
    })
    .from(qoqaOrders)
    .leftJoin(
      qoqaUniverses,
      sql`${qoqaOrders.universe} = ${qoqaUniverses.universe_tracking_identifier}`
    )
    .leftJoin(
      qoqaSubuniverses,
      sql`${qoqaOrders.subuniverse} = ${qoqaSubuniverses.identifier}`
    )
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

export async function fetchInitialOrders(
  universes: string[] = [],
  subuniverses: string[] = []
): Promise<QoqaOrder[]> {
  const where = buildUniverseWhereClause(universes, subuniverses);
  const rows = await db
    .select({
      ...(getTableColumns(qoqaOrders) as unknown as Record<string, SQL<unknown>>),
      universe_name: sql<string | null>`${qoqaUniverses.name}`,
      subuniverse_name: sql<string | null>`${qoqaSubuniverses.name}`,
    })
    .from(qoqaOrders)
    .leftJoin(
      qoqaUniverses,
      sql`${qoqaOrders.universe} = ${qoqaUniverses.universe_tracking_identifier}`
    )
    .leftJoin(
      qoqaSubuniverses,
      sql`${qoqaOrders.subuniverse} = ${qoqaSubuniverses.identifier}`
    )
    .where(where)
    .orderBy(sql`${qoqaOrders.order_date} DESC`)
    .limit(20);
  return rows.map(normalizeOrder);
}

export async function fetchTotalCount(
  universes: string[] = [],
  subuniverses: string[] = []
): Promise<number> {
  const where = buildUniverseWhereClause(universes, subuniverses);
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
    universe: row.universe != null ? String(row.universe) : null,
    subuniverse: row.subuniverse != null ? String(row.subuniverse) : null,
    universe_name: row.universe_name != null ? String(row.universe_name) : null,
    subuniverse_name: row.subuniverse_name != null ? String(row.subuniverse_name) : null,
    item_description: row.item_description != null ? String(row.item_description) : null,
    invoice_number: row.invoice_number != null ? String(row.invoice_number) : null,
    pdf_filename: row.pdf_filename != null ? String(row.pdf_filename) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
