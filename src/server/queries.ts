import { sql, eq, inArray, ilike, and, or, gte, lte, isNotNull, type SQL } from "drizzle-orm";
import { getDb, isDbSqlite } from "./db";
import {
  qoqaOrdersSqlite,
  qoqaOrdersPg,
  qoqaUniversesSqlite,
  qoqaUniversesPg,
  qoqaSubuniversesSqlite,
  qoqaSubuniversesPg,
  qoqaOrderSubuniversesSqlite,
  qoqaOrderSubuniversesPg,
} from "./schema";
import type {
  QoqaOrder,
  SubuniverseOption,
  UniverseOption,
  OrderStats,
  MonthlySpending,
  YearlySpending,
  SpendingByGroup,
} from "../shared/types";
import { parseSubuniverseKey } from "../shared/filters";
import { cleanSubuniverseIdentifier } from "./api";

// ── Types for write operations ─────────────────────────────────────────────────

export interface NewOrderData {
  order_number: string;
  order_date: string;
  amount_chf: string;
  status?: string | null;
  subtotal_chf?: string | null;
  discount_chf?: string | null;
  vat_chf?: string | null;
  delivery_on?: string | null;
  offer_id?: string | null;
  offer_title?: string | null;
  offer_subtitle?: string | null;
  universe?: string | null;
  subuniverse?: string | null;
  subuniverses?: string[];
  item_description?: string | null;
  invoice_number?: string | null;
  pdf_filename?: string | null;
  pdf_data?: Uint8Array | Buffer | null;
  raw_json?: string | null;
}

// ── Table accessor ─────────────────────────────────────────────────────────────
// Evaluated lazily (called at query time) so it works after initDb().

function t() {
  const sqlite = isDbSqlite();
  return {
    orders: (sqlite ? qoqaOrdersSqlite : qoqaOrdersPg) as unknown as typeof qoqaOrdersSqlite,
    universes: (sqlite ? qoqaUniversesSqlite : qoqaUniversesPg) as unknown as typeof qoqaUniversesSqlite,
    subuniverses: (sqlite ? qoqaSubuniversesSqlite : qoqaSubuniversesPg) as unknown as typeof qoqaSubuniversesSqlite,
    orderSubuniverses: (sqlite
      ? qoqaOrderSubuniversesSqlite
      : qoqaOrderSubuniversesPg) as unknown as typeof qoqaOrderSubuniversesSqlite,
  };
}

// ── Dialect-safe expression helpers ───────────────────────────────────────────

function asFloat(col: unknown): SQL<unknown> {
  return (isDbSqlite() ? sql`CAST(${col} AS REAL)` : col) as SQL<unknown>;
}

function yearMonth(col: unknown): SQL<unknown> {
  return (isDbSqlite()
    ? sql`substr(${col}, 1, 7)`
    : sql`to_char(${col}::date, 'YYYY-MM')`) as SQL<unknown>;
}

function yearOf(col: unknown): SQL<unknown> {
  return (isDbSqlite()
    ? sql`CAST(substr(${col}, 1, 4) AS INTEGER)`
    : sql`EXTRACT(YEAR FROM ${col}::date)`) as SQL<unknown>;
}

// SQLite uses LIKE (case-insensitive for ASCII by default); PostgreSQL uses ILIKE.
function ilikeCompat(col: unknown, value: string): SQL<unknown> {
  if (isDbSqlite()) {
    return sql`LOWER(${col}) LIKE LOWER(${value})` as SQL<unknown>;
  }
  return sql`${col} ILIKE ${value}` as SQL<unknown>;
}

// ── Effective universe ────────────────────────────────────────────────────────

/**
 * The universe an order belongs to in QoQa's *current* taxonomy: the parent of
 * its sub-universe, falling back to the universe stored on the order.
 *
 * The two sources disagree. An order stores the universe its offer carried at
 * sync time (`offer.universe_tracking_identifier`) and is never asked again,
 * while the sub-universe tree comes from the alerts endpoint and is refreshed
 * on every sync. QoQa is also re-tagging offers one by one rather than at a
 * cutover — mid-2026 orders arrive under `alcohol` and `wine-and-spirits`
 * interleaved, though the alerts tree files spirits/wine/winegrandcru under
 * `wine-and-spirits`. Grouping on the stored value therefore lists the same
 * sub-universe under two parents and splits its totals; grouping on the current
 * parent keeps one entry per sub-universe.
 */
function effectiveUniverse(orders: typeof qoqaOrdersSqlite): SQL<string> {
  return sql<string>`COALESCE((SELECT su.universe_tracking_identifier FROM qoqa_subuniverses su WHERE su.identifier = ${orders.subuniverse}), ${orders.universe})`;
}

// ── Column subset for list queries ────────────────────────────────────────────

function orderListColumns(orders: typeof qoqaOrdersSqlite) {
  return {
    id: orders.id,
    order_number: orders.order_number,
    order_date: orders.order_date,
    amount_chf: orders.amount_chf,
    status: orders.status,
    subtotal_chf: orders.subtotal_chf,
    discount_chf: orders.discount_chf,
    vat_chf: orders.vat_chf,
    offer_id: orders.offer_id,
    offer_title: orders.offer_title,
    offer_subtitle: orders.offer_subtitle,
    universe: orders.universe,
    subuniverse: orders.subuniverse,
    item_description: orders.item_description,
    invoice_number: orders.invoice_number,
    pdf_filename: orders.pdf_filename,
    has_pdf: sql<number>`CASE WHEN ${orders.pdf_data} IS NOT NULL THEN 1 ELSE 0 END`.as("has_pdf"),
  };
}

/** List columns plus the universe/sub-universe display names. */
function orderListSelection(
  orders: typeof qoqaOrdersSqlite,
  universesT: typeof qoqaUniversesSqlite,
  subuniversesT: typeof qoqaSubuniversesSqlite
) {
  return {
    ...orderListColumns(orders),
    universe: sql<string | null>`${effectiveUniverse(orders)}`.as("universe"),
    universe_name: sql<string | null>`${universesT.name_fr}`.as("universe_name"),
    subuniverse_name: sql<string | null>`${subuniversesT.name_fr}`.as("subuniverse_name"),
  };
}

// ── Row normaliser ─────────────────────────────────────────────────────────────

function normalizeOrder(row: Record<string, unknown>): QoqaOrder {
  return {
    id: Number(row.id),
    order_number: String(row.order_number ?? ""),
    order_date: String(row.order_date ?? ""),
    amount_chf: String(row.amount_chf ?? "0"),
    status: row.status ? String(row.status) : null,
    subtotal_chf: row.subtotal_chf ? String(row.subtotal_chf) : null,
    discount_chf: row.discount_chf ? String(row.discount_chf) : null,
    vat_chf: row.vat_chf ? String(row.vat_chf) : null,
    offer_id: row.offer_id ? String(row.offer_id) : null,
    offer_title: row.offer_title ? String(row.offer_title) : null,
    offer_subtitle: row.offer_subtitle ? String(row.offer_subtitle) : null,
    universe: row.universe ? String(row.universe) : null,
    universe_name: row.universe_name ? String(row.universe_name) : null,
    subuniverse: row.subuniverse ? String(row.subuniverse) : null,
    subuniverse_name: row.subuniverse_name ? String(row.subuniverse_name) : null,
    item_description: row.item_description ? String(row.item_description) : null,
    invoice_number: row.invoice_number ? String(row.invoice_number) : null,
    pdf_filename: row.pdf_filename ? String(row.pdf_filename) : null,
    has_pdf: Number(row.has_pdf ?? 0) === 1,
    subuniverses: [],
  };
}

async function withSubuniverseTags(orderRows: QoqaOrder[]): Promise<QoqaOrder[]> {
  if (orderRows.length === 0) return orderRows;

  const { subuniverses: subuniversesT, orderSubuniverses } = t();
  const orderNumbers = orderRows.map((o) => o.order_number);

  const tags = (await getDb()
    .select({
      order_number: orderSubuniverses.order_number,
      identifier: orderSubuniverses.subuniverse,
      name: subuniversesT.name_fr,
    })
    .from(orderSubuniverses)
    .leftJoin(subuniversesT, eq(subuniversesT.identifier, orderSubuniverses.subuniverse))
    .where(inArray(orderSubuniverses.order_number, orderNumbers))
    .orderBy(orderSubuniverses.position)) as unknown as {
    order_number: string;
    identifier: string;
    name: string | null;
  }[];

  const byOrder = new Map<string, SubuniverseOption[]>();
  for (const tag of tags) {
    const list = byOrder.get(tag.order_number) ?? [];
    list.push({ identifier: tag.identifier, name: tag.name ?? tag.identifier });
    byOrder.set(tag.order_number, list);
  }

  for (const order of orderRows) {
    order.subuniverses = byOrder.get(order.order_number) ?? [];
  }

  return orderRows;
}

// ── Universe/date filter builder ──────────────────────────────────────────────

function hasAnySubuniverse(
  orders: typeof qoqaOrdersSqlite,
  subs: string[]
): SQL<unknown> {
  return sql`EXISTS (SELECT 1 FROM qoqa_order_subuniverses os WHERE os.order_number = ${orders.order_number} AND os.subuniverse IN (${sql.join(
    subs.map((s) => sql`${s}`),
    sql`, `
  )}))` as SQL<unknown>;
}

/**
 * Sub-universe selections are `universe:subuniverse` pairs, so a sub-universe
 * only matches orders filed under the universe it was picked from. Bare
 * identifiers (no universe prefix) match on the sub-universe alone.
 */
function subuniverseConditions(
  orders: typeof qoqaOrdersSqlite,
  keys: string[]
): SQL<unknown>[] {
  const byUniverse = new Map<string, string[]>();
  const bare: string[] = [];

  for (const key of keys) {
    const { universe, subuniverse } = parseSubuniverseKey(key);
    if (!subuniverse) continue;
    if (universe === null) {
      bare.push(subuniverse);
      continue;
    }
    const subs = byUniverse.get(universe);
    if (subs) subs.push(subuniverse);
    else byUniverse.set(universe, [subuniverse]);
  }

  const parts: SQL<unknown>[] = [];
  for (const [universe, subs] of byUniverse) {
    parts.push(
      and(
        eq(effectiveUniverse(orders), universe),
        hasAnySubuniverse(orders, subs)
      ) as SQL<unknown>
    );
  }
  if (bare.length > 0) parts.push(hasAnySubuniverse(orders, bare));
  return parts;
}

function buildUniverseFilter(
  orders: typeof qoqaOrdersSqlite,
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
) {
  const conditions: SQL<unknown>[] = [];

  const parts: SQL<unknown>[] = [];
  if (universes.length > 0)
    parts.push(inArray(effectiveUniverse(orders), universes) as SQL<unknown>);
  parts.push(...subuniverseConditions(orders, subuniverses));
  if (parts.length > 0) conditions.push(or(...parts) as SQL<unknown>);

  if (from) conditions.push(gte(orders.order_date, from) as SQL<unknown>);
  if (to) conditions.push(lte(orders.order_date, to) as SQL<unknown>);

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ── Read queries ───────────────────────────────────────────────────────────────

export async function fetchStats(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<OrderStats> {
  const { orders } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const [row] = await getDb()
    .select({
      total_spent: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      order_count: sql<number>`COUNT(*)`,
      average_per_order: sql<number>`AVG(${asFloat(orders.amount_chf)})`,
    })
    .from(orders)
    .where(where);

  return {
    total_spent: Number(row?.total_spent ?? 0),
    order_count: Number(row?.order_count ?? 0),
    average_per_order: Number(row?.average_per_order ?? 0),
  };
}

export async function fetchMonthlySpending(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<MonthlySpending[]> {
  const { orders } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  return getDb()
    .select({
      month: yearMonth(orders.order_date),
      total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(where)
    .groupBy(yearMonth(orders.order_date))
    .orderBy(yearMonth(orders.order_date)) as unknown as MonthlySpending[];
}

export async function fetchYearlySpending(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<YearlySpending[]> {
  const { orders } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  return getDb()
    .select({
      year: yearOf(orders.order_date),
      total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(where)
    .groupBy(yearOf(orders.order_date))
    .orderBy(yearOf(orders.order_date)) as unknown as YearlySpending[];
}

export async function fetchTotalCount(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<number> {
  const { orders } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const [row] = await getDb()
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(where);
  return Number(row?.count ?? 0);
}

export async function fetchInitialOrders(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string,
  pageSize = 20
): Promise<QoqaOrder[]> {
  const { orders, universes: universesT, subuniverses: subuniversesT } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const rows = await getDb()
    .select(orderListSelection(orders, universesT, subuniversesT))
    .from(orders)
    .leftJoin(universesT, eq(universesT.universe_tracking_identifier, effectiveUniverse(orders)))
    .leftJoin(subuniversesT, eq(subuniversesT.identifier, orders.subuniverse!))
    .where(where)
    .orderBy(sql`${orders.order_date} DESC`)
    .limit(pageSize) as unknown as Record<string, unknown>[];

  return withSubuniverseTags(rows.map(normalizeOrder));
}

export async function fetchOrders(
  universes: string[],
  subuniverses: string[],
  search: string,
  page: number,
  pageSize: number,
  from?: string,
  to?: string
): Promise<{ orders: QoqaOrder[]; total: number }> {
  const { orders, universes: universesT, subuniverses: subuniversesT } = t();
  const filter = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const searchCondition = search
    ? or(
        ilikeCompat(orders.order_number, `%${search}%`),
        ilikeCompat(orders.offer_title, `%${search}%`),
        ilikeCompat(orders.item_description, `%${search}%`)
      )
    : undefined;

  const where =
    filter && searchCondition
      ? and(filter, searchCondition)
      : (filter ?? searchCondition);

  const [{ count }] = await getDb()
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(where);

  const rows = await getDb()
    .select(orderListSelection(orders, universesT, subuniversesT))
    .from(orders)
    .leftJoin(universesT, eq(universesT.universe_tracking_identifier, effectiveUniverse(orders)))
    .leftJoin(subuniversesT, eq(subuniversesT.identifier, orders.subuniverse!))
    .where(where)
    .orderBy(sql`${orders.order_date} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize) as unknown as Record<string, unknown>[];

  return {
    orders: await withSubuniverseTags(rows.map(normalizeOrder)),
    total: Number(count ?? 0),
  };
}

export async function fetchAllOrders(params: {
  universes?: string[];
  subuniverses?: string[];
  from?: string;
  to?: string;
}): Promise<QoqaOrder[]> {
  const { orders, universes: universesT, subuniverses: subuniversesT } = t();

  const where = buildUniverseFilter(
    orders,
    params.universes ?? [],
    params.subuniverses ?? [],
    params.from,
    params.to
  );

  const rows = await getDb()
    .select(orderListSelection(orders, universesT, subuniversesT))
    .from(orders)
    .leftJoin(universesT, eq(universesT.universe_tracking_identifier, effectiveUniverse(orders)))
    .leftJoin(subuniversesT, eq(subuniversesT.identifier, orders.subuniverse!))
    .where(where)
    .orderBy(sql`${orders.order_date} DESC`) as unknown as Record<string, unknown>[];

  return withSubuniverseTags(rows.map(normalizeOrder));
}

export async function fetchUniverses(): Promise<UniverseOption[]> {
  const { orders, universes, subuniverses, orderSubuniverses } = t();

  // The tree is derived from the universe/sub-universe pairs the orders actually
  // carry, each mapped to the universe its sub-universe belongs to today — see
  // effectiveUniverse(). Every tag of an order is listed, not only its primary,
  // so a secondary tag can still be picked in the filter.
  const pairs = (await getDb()
    .select({ universe: effectiveUniverse(orders), subuniverse: orderSubuniverses.subuniverse })
    .from(orders)
    .leftJoin(orderSubuniverses, eq(orderSubuniverses.order_number, orders.order_number))
    .where(isNotNull(orders.universe))
    .groupBy(effectiveUniverse(orders), orderSubuniverses.subuniverse)) as unknown as {
    universe: string | null;
    subuniverse: string | null;
  }[];

  const tree = new Map<string, Set<string>>();
  for (const { universe, subuniverse } of pairs) {
    if (!universe) continue;
    const subs = tree.get(universe) ?? new Set<string>();
    if (subuniverse) subs.add(subuniverse);
    tree.set(universe, subs);
  }

  if (tree.size === 0) return [];

  const usedUniverseIds = [...tree.keys()];
  const usedSubuniverseIds = [...new Set([...tree.values()].flatMap((subs) => [...subs]))];

  const [universesRows, subuniversesRows] = await Promise.all([
    getDb()
      .select()
      .from(universes)
      .where(inArray(universes.universe_tracking_identifier, usedUniverseIds)),
    usedSubuniverseIds.length > 0
      ? getDb().select().from(subuniverses).where(inArray(subuniverses.identifier, usedSubuniverseIds))
      : Promise.resolve([]),
  ]);

  const universeNames = new Map(
    universesRows.map((u) => [u.universe_tracking_identifier, u.name_fr as string | null])
  );
  const subuniverseNames = new Map(
    subuniversesRows.map((s) => [s.identifier, s.name_fr as string | null])
  );
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return [...tree.entries()]
    .map(([identifier, subs]) => ({
      identifier,
      name: universeNames.get(identifier) ?? identifier,
      subuniverses: [...subs]
        .map((id) => ({ identifier: id, name: subuniverseNames.get(id) ?? id }))
        .sort(byName),
    }))
    .sort(byName);
}

export async function fetchSpendingByGroup(
  mode: "universe" | "subuniverse",
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<SpendingByGroup[]> {
  const { orders } = t();
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);
  const groupCol =
    mode === "universe" ? effectiveUniverse(orders) : orders.subuniverse;

  const nameSubquery =
    mode === "universe"
      ? sql<string>`(SELECT name_fr FROM qoqa_universes WHERE universe_tracking_identifier = ${groupCol})`
      : sql<string>`(SELECT name_fr FROM qoqa_subuniverses WHERE identifier = ${groupCol})`;

  const rows = await getDb()
    .select({
      identifier: groupCol,
      name: nameSubquery,
      total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(where, isNotNull(groupCol)))
    .groupBy(groupCol)
    .orderBy(sql`SUM(${asFloat(orders.amount_chf)}) DESC`) as unknown as SpendingByGroup[];

  return rows.map((r) => ({
    ...r,
    name: (r.name as string | null) ?? (r.identifier as string),
    total: Number(r.total),
    count: Number(r.count),
  }));
}

export async function fetchOrderPdf(orderNumber: string): Promise<Buffer | null> {
  const { orders } = t();
  const [row] = await getDb()
    .select({ pdf_data: orders.pdf_data })
    .from(orders)
    .where(sql`${orders.order_number} = ${orderNumber}`);

  if (!row?.pdf_data) return null;
  const data = row.pdf_data as Buffer | Uint8Array | ArrayBuffer;
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
}

// ── Write queries ──────────────────────────────────────────────────────────────

export async function getOrderByNumber(orderNumber: string): Promise<QoqaOrder | null> {
  const { orders } = t();
  const rows = await getDb()
    .select(orderListColumns(orders))
    .from(orders)
    .where(sql`${orders.order_number} = ${orderNumber}`)
    .limit(1) as unknown as Record<string, unknown>[];

  return rows.length > 0 ? normalizeOrder(rows[0]) : null;
}

/**
 * Order numbers last written before `cutoff`, oldest first. QoQa re-tags offers
 * after the fact (an order filed under `alcohol` comes back as
 * `wine-and-spirits` months later), so stored details go stale; refreshing the
 * oldest few per sync converges without re-fetching every order every time.
 */
export async function fetchStaleOrderNumbers(cutoff: string, limit: number): Promise<string[]> {
  const { orders } = t();
  const rows = await getDb()
    .select({ order_number: orders.order_number })
    .from(orders)
    .where(sql`${orders.updated_at} < ${cutoff}`)
    .orderBy(sql`${orders.updated_at} ASC`)
    .limit(limit);

  return rows.map((r) => String(r.order_number));
}

/** Order numbers stored without an invoice PDF — candidates for a later retry. */
export async function fetchOrderNumbersMissingPdf(): Promise<string[]> {
  const { orders } = t();
  const rows = await getDb()
    .select({ order_number: orders.order_number })
    .from(orders)
    .where(sql`${orders.pdf_data} IS NULL`);

  return rows.map((r) => String(r.order_number));
}

export async function upsertOrder(data: NewOrderData): Promise<void> {
  const now = new Date().toISOString();
  const pdfBuf = data.pdf_data
    ? data.pdf_data instanceof Buffer
      ? data.pdf_data
      : Buffer.from(data.pdf_data)
    : null;

  const values = {
    order_number: data.order_number,
    order_date: data.order_date,
    amount_chf: data.amount_chf,
    status: data.status ?? null,
    subtotal_chf: data.subtotal_chf ?? null,
    discount_chf: data.discount_chf ?? null,
    vat_chf: data.vat_chf ?? null,
    delivery_on: data.delivery_on ?? null,
    offer_id: data.offer_id ?? null,
    offer_title: data.offer_title ?? null,
    offer_subtitle: data.offer_subtitle ?? null,
    universe: data.universe ?? null,
    subuniverse: data.subuniverse ?? null,
    item_description: data.item_description ?? null,
    invoice_number: data.invoice_number ?? null,
    pdf_filename: data.pdf_filename ?? null,
    pdf_data: pdfBuf,
    raw_json: data.raw_json ?? null,
    updated_at: now,
  };

  const db = getDb() as unknown as ReturnType<typeof import("drizzle-orm/bun-sqlite").drizzle>;

  // A failed PDF download must not wipe a PDF already stored for this order.
  const { pdf_data: _pdf, pdf_filename: _name, ...rest } = values;
  const set = pdfBuf ? values : rest;

  if (isDbSqlite()) {
    await (db as any)
      .insert(qoqaOrdersSqlite)
      .values(values)
      .onConflictDoUpdate({ target: qoqaOrdersSqlite.order_number, set });
  } else {
    await (db as any)
      .insert(qoqaOrdersPg)
      .values(values)
      .onConflictDoUpdate({ target: qoqaOrdersPg.order_number, set });
  }

  if (data.subuniverses) {
    await replaceOrderSubuniverses(data.order_number, data.subuniverses);
  }
}

async function replaceOrderSubuniverses(
  orderNumber: string,
  subuniverses: string[]
): Promise<void> {
  const { orderSubuniverses } = t();

  await getDb().delete(orderSubuniverses).where(eq(orderSubuniverses.order_number, orderNumber));

  if (subuniverses.length === 0) return;

  await (getDb() as any).insert(orderSubuniverses).values(
    subuniverses.map((subuniverse, position) => ({
      order_number: orderNumber,
      subuniverse,
      position,
    }))
  );
}

export async function backfillOrderSubuniverses(): Promise<number> {
  const { orders, orderSubuniverses } = t();

  const [existing] = await getDb()
    .select({ count: sql<number>`COUNT(*)` })
    .from(orderSubuniverses);
  if (Number(existing?.count ?? 0) > 0) return 0;

  const rows = await getDb()
    .select({
      order_number: orders.order_number,
      subuniverse: orders.subuniverse,
      raw_json: orders.raw_json,
    })
    .from(orders);

  const values: { order_number: string; subuniverse: string; position: number }[] = [];

  for (const row of rows) {
    const orderNumber = String(row.order_number);
    const tags = subuniverseTagsFromRaw(row.raw_json as string | null);
    const list = tags.length > 0 ? tags : row.subuniverse ? [String(row.subuniverse)] : [];
    list.forEach((subuniverse, position) =>
      values.push({ order_number: orderNumber, subuniverse, position })
    );
  }

  if (values.length === 0) return 0;

  for (let i = 0; i < values.length; i += 200) {
    await (getDb() as any).insert(orderSubuniverses).values(values.slice(i, i + 200));
  }

  return values.length;
}

function subuniverseTagsFromRaw(rawJson: string | null): string[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson) as {
      offer?: { sub_universe_tracking_identifiers?: unknown };
    };
    const ids = parsed.offer?.sub_universe_tracking_identifiers;
    if (!Array.isArray(ids)) return [];
    return [
      ...new Set(
        ids
          .filter((id): id is string => typeof id === "string")
          .map(cleanSubuniverseIdentifier)
      ),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

export async function upsertUniverse(data: {
  identifier: string;
  nameFr?: string;
  nameDe?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const values = {
    universe_tracking_identifier: data.identifier,
    name_fr: data.nameFr ?? null,
    name_de: data.nameDe ?? null,
    updated_at: now,
  };
  const set = { name_fr: values.name_fr, name_de: values.name_de, updated_at: now };

  if (isDbSqlite()) {
    await (getDb() as any)
      .insert(qoqaUniversesSqlite)
      .values(values)
      .onConflictDoUpdate({ target: qoqaUniversesSqlite.universe_tracking_identifier, set });
  } else {
    await (getDb() as any)
      .insert(qoqaUniversesPg)
      .values(values)
      .onConflictDoUpdate({ target: qoqaUniversesPg.universe_tracking_identifier, set });
  }
}

export async function upsertSubuniverse(data: {
  identifier: string;
  nameFr?: string;
  nameDe?: string;
  universeIdentifier: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const values = {
    identifier: data.identifier,
    name_fr: data.nameFr ?? null,
    name_de: data.nameDe ?? null,
    universe_tracking_identifier: data.universeIdentifier,
    updated_at: now,
  };
  const set = {
    name_fr: values.name_fr,
    name_de: values.name_de,
    universe_tracking_identifier: values.universe_tracking_identifier,
    updated_at: now,
  };

  if (isDbSqlite()) {
    await (getDb() as any)
      .insert(qoqaSubuniversesSqlite)
      .values(values)
      .onConflictDoUpdate({ target: qoqaSubuniversesSqlite.identifier, set });
  } else {
    await (getDb() as any)
      .insert(qoqaSubuniversesPg)
      .values(values)
      .onConflictDoUpdate({ target: qoqaSubuniversesPg.identifier, set });
  }
}
