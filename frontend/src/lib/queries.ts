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
import { and, between, eq, getTableColumns, gte, inArray, lte, or, sql, SQL } from "drizzle-orm";
import { db, isSqlite, qoqaOrders, qoqaSubuniverses, qoqaUniverses } from "./db";
import type { OrderStats, MonthlySpending, SpendingByGroup, SubuniverseOption, UniverseOption, YearlySpending } from "@/types/order";
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
 * Returns TRUE (no filter) when both lists are empty, i.e. "show everything".
 *
 * - universes: filter orders where universe IN [...]
 * - subuniverses: filter orders where subuniverse IN [...]
 * - If both are provided, the clauses are OR-combined.
 */
function buildUniverseWhereClause(
  universes: string[],
  subuniverses: string[]
): SQL {
  const parts: SQL[] = [];
  if (universes.length > 0) parts.push(inArray(qoqaOrders.universe, universes) as SQL);
  if (subuniverses.length > 0) parts.push(inArray(qoqaOrders.subuniverse, subuniverses) as SQL);
  if (parts.length === 0) return sql`TRUE`;
  if (parts.length === 1) return parts[0];
  return or(...parts) as SQL;
}

/**
 * Returns the column projection used when listing orders.
 *
 * Crucially, this **omits** ``pdf_data`` (BLOB / bytea) so list queries don't
 * pay the cost of pulling potentially-large invoice PDFs. A ``has_pdf``
 * boolean is added in its place via ``pdf_data IS NOT NULL``.
 */
function orderListColumns() {
  // Strip pdf_data from the column projection: we never want to fetch the
  // bytes when listing rows.
  const { pdf_data, ...rest } = getTableColumns(qoqaOrders);
  void pdf_data;
  return {
    ...(rest as unknown as Record<string, SQL<unknown>>),
    has_pdf: sql<number>`CASE WHEN ${qoqaOrders.pdf_data} IS NOT NULL THEN 1 ELSE 0 END`,
    universe_name: sql<string | null>`${qoqaUniverses.name}`,
    subuniverse_name: sql<string | null>`${qoqaSubuniverses.name}`,
  };
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

/**
 * Returns spending totals grouped by universe or subuniverse for the pie chart.
 *
 * - mode "universe":    one row per universe, useful when multiple universes are selected
 * - mode "subuniverse": one row per subuniverse, useful when a single universe is in scope
 *
 * The WHERE clause is the same as other queries (universe IN [...] OR subuniverse IN [...]).
 * Results are ordered by total descending (largest slice first).
 */
export async function fetchSpendingByGroup(
  mode: "universe" | "subuniverse",
  universes: string[],
  subuniverses: string[]
): Promise<SpendingByGroup[]> {
  const where = buildUniverseWhereClause(universes, subuniverses);

  if (mode === "subuniverse") {
    const rows = await db
      .select({
        identifier: sql<string>`${qoqaOrders.subuniverse}`,
        name: sql<string>`COALESCE(${qoqaSubuniverses.name}, ${qoqaOrders.subuniverse})`,
        total: asFloat(sql`SUM(${qoqaOrders.amount_chf})`),
      })
      .from(qoqaOrders)
      .leftJoin(
        qoqaSubuniverses,
        sql`${qoqaOrders.subuniverse} = ${qoqaSubuniverses.identifier}`
      )
      .where(and(where, sql`${qoqaOrders.subuniverse} IS NOT NULL`))
      .groupBy(sql`${qoqaOrders.subuniverse}`, sql`${qoqaSubuniverses.name}`)
      .orderBy(sql`SUM(${qoqaOrders.amount_chf}) DESC`);
    return rows as SpendingByGroup[];
  }

  const rows = await db
    .select({
      identifier: sql<string>`${qoqaOrders.universe}`,
      name: sql<string>`COALESCE(${qoqaUniverses.name}, ${qoqaOrders.universe})`,
      total: asFloat(sql`SUM(${qoqaOrders.amount_chf})`),
    })
    .from(qoqaOrders)
    .leftJoin(
      qoqaUniverses,
      sql`${qoqaOrders.universe} = ${qoqaUniverses.universe_tracking_identifier}`
    )
    .where(and(where, sql`${qoqaOrders.universe} IS NOT NULL`))
    .groupBy(sql`${qoqaOrders.universe}`, sql`${qoqaUniverses.name}`)
    .orderBy(sql`SUM(${qoqaOrders.amount_chf}) DESC`);
  return rows as SpendingByGroup[];
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
    .select(orderListColumns())
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
    .select(orderListColumns())
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

/**
 * Fetch the stored PDF bytes (and filename) for one order.
 *
 * Returns ``null`` when no order exists for ``orderNumber`` *or* when the row
 * has no ``pdf_data`` blob. The bytes are returned as a ``Uint8Array`` so
 * route handlers can stream them directly via ``new Response(...)``.
 */
export async function fetchOrderPdf(
  orderNumber: string
): Promise<{ filename: string; bytes: Uint8Array } | null> {
  // qoqaOrders is a SQLite|PG union type; the spread is fine at runtime but
  // TypeScript can't cope with the column union, so we cast the projection.
  const projection = {
    pdf_filename: qoqaOrders.pdf_filename,
    pdf_data: qoqaOrders.pdf_data,
  } as unknown as Record<string, SQL<unknown>>;

  const rows = (await db
    .select(projection)
    .from(qoqaOrders)
    .where(eq(qoqaOrders.order_number, orderNumber))
    .limit(1)) as Array<{ pdf_filename: string | null; pdf_data: unknown }>;

  const row = rows[0];
  if (!row || row.pdf_data == null) return null;

  let bytes: Uint8Array;
  if (row.pdf_data instanceof Uint8Array) {
    bytes = row.pdf_data;
  } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(row.pdf_data)) {
    bytes = new Uint8Array(
      row.pdf_data.buffer,
      row.pdf_data.byteOffset,
      row.pdf_data.byteLength
    );
  } else if (typeof row.pdf_data === "string") {
    // Some drivers return BYTEA as a hex string ("\\x..."); decode if so.
    const hex = row.pdf_data.startsWith("\\x")
      ? row.pdf_data.slice(2)
      : row.pdf_data;
    const len = hex.length / 2;
    bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
  } else {
    return null;
  }

  const filename = row.pdf_filename ?? `${orderNumber}.pdf`;
  return { filename, bytes };
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
    has_pdf: Boolean(row.has_pdf) && Number(row.has_pdf) !== 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
