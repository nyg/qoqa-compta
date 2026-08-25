import {
  sql,
  eq,
  inArray,
  and,
  or,
  gte,
  lte,
  isNotNull,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { getDb, isDbSqlite, type PgDatabase, type SqliteDatabase } from "./db";
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
import {
  DEFAULT_PAGE_SIZE,
  type QoqaOrder,
  type SubuniverseOption,
  type UniverseOption,
  type OrderStats,
  type MonthlySpending,
  type YearlySpending,
  type SpendingByGroup,
} from "../shared/types";
import { NO_UNIVERSE_FILTER, parseSubuniverseKey } from "../shared/filters";
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

type OrdersTable = typeof qoqaOrdersSqlite | typeof qoqaOrdersPg;
type UniversesTable = typeof qoqaUniversesSqlite | typeof qoqaUniversesPg;
type SubuniversesTable = typeof qoqaSubuniversesSqlite | typeof qoqaSubuniversesPg;

interface SqliteContext {
  dialect: "sqlite";
  db: SqliteDatabase;
  orders: typeof qoqaOrdersSqlite;
  universes: typeof qoqaUniversesSqlite;
  subuniverses: typeof qoqaSubuniversesSqlite;
  orderSubuniverses: typeof qoqaOrderSubuniversesSqlite;
}

interface PgContext {
  dialect: "pg";
  db: PgDatabase;
  orders: typeof qoqaOrdersPg;
  universes: typeof qoqaUniversesPg;
  subuniverses: typeof qoqaSubuniversesPg;
  orderSubuniverses: typeof qoqaOrderSubuniversesPg;
}

type QueryContext = SqliteContext | PgContext;

function ctx(): QueryContext {
  const handle = getDb();
  return handle.dialect === "sqlite"
    ? {
        dialect: "sqlite",
        db: handle.db,
        orders: qoqaOrdersSqlite,
        universes: qoqaUniversesSqlite,
        subuniverses: qoqaSubuniversesSqlite,
        orderSubuniverses: qoqaOrderSubuniversesSqlite,
      }
    : {
        dialect: "pg",
        db: handle.db,
        orders: qoqaOrdersPg,
        universes: qoqaUniversesPg,
        subuniverses: qoqaSubuniversesPg,
        orderSubuniverses: qoqaOrderSubuniversesPg,
      };
}

// ── Dialect-safe expression helpers ───────────────────────────────────────────

function asFloat(col: SQLWrapper): SQLWrapper {
  return isDbSqlite() ? sql`CAST(${col} AS REAL)` : col;
}

function yearMonth(col: SQLWrapper): SQL<string> {
  return isDbSqlite()
    ? sql<string>`substr(${col}, 1, 7)`
    : sql<string>`to_char(${col}::date, 'YYYY-MM')`;
}

function yearOf(col: SQLWrapper): SQL<number> {
  return isDbSqlite()
    ? sql<number>`CAST(substr(${col}, 1, 4) AS INTEGER)`
    : sql<number>`EXTRACT(YEAR FROM ${col}::date)`;
}

// SQLite uses LIKE (case-insensitive for ASCII by default); PostgreSQL uses ILIKE.
function ilikeCompat(col: SQLWrapper, value: string): SQL<unknown> {
  if (isDbSqlite()) {
    return sql`LOWER(${col}) LIKE LOWER(${value})`;
  }
  return sql`${col} ILIKE ${value}`;
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
function effectiveUniverse(orders: OrdersTable): SQL<string> {
  return sql<string>`COALESCE((SELECT su.universe_tracking_identifier FROM qoqa_subuniverses su WHERE su.identifier = ${orders.subuniverse}), ${orders.universe})`;
}

// ── Column subset for list queries ────────────────────────────────────────────

type SharedOrderColumnKey =
  | "id"
  | "order_number"
  | "order_date"
  | "amount_chf"
  | "status"
  | "subtotal_chf"
  | "discount_chf"
  | "vat_chf"
  | "offer_id"
  | "offer_title"
  | "offer_subtitle"
  | "subuniverse"
  | "item_description"
  | "invoice_number"
  | "pdf_filename";

type OrderColumnSelection<T extends OrdersTable> = Pick<
  T,
  SharedOrderColumnKey | "universe"
> & { has_pdf: SQL.Aliased<number> };

type OrderListSelection<T extends OrdersTable> = Pick<T, SharedOrderColumnKey> & {
  has_pdf: SQL.Aliased<number>;
  universe: SQL.Aliased<string | null>;
  universe_name: SQL.Aliased<string | null>;
  subuniverse_name: SQL.Aliased<string | null>;
};

function orderListColumns<T extends OrdersTable>(orders: T): OrderColumnSelection<T> {
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
function orderListSelection<T extends OrdersTable>(
  orders: T,
  universesT: UniversesTable,
  subuniversesT: SubuniversesTable
): OrderListSelection<T> {
  return {
    ...orderListColumns(orders),
    universe: sql<string | null>`${effectiveUniverse(orders)}`.as("universe"),
    universe_name: sql<string | null>`${universesT.name_fr}`.as("universe_name"),
    subuniverse_name: sql<string | null>`${subuniversesT.name_fr}`.as("subuniverse_name"),
  };
}

// ── Order list queries ────────────────────────────────────────────────────────

function sqliteOrderListQuery(c: SqliteContext, where: SQL<unknown> | undefined) {
  const { orders, universes, subuniverses } = c;
  return c.db
    .select(orderListSelection(orders, universes, subuniverses))
    .from(orders)
    .leftJoin(universes, eq(universes.universe_tracking_identifier, effectiveUniverse(orders)))
    .leftJoin(subuniverses, eq(subuniverses.identifier, orders.subuniverse))
    .where(where)
    .orderBy(sql`${orders.order_date} DESC`);
}

function pgOrderListQuery(c: PgContext, where: SQL<unknown> | undefined) {
  const { orders, universes, subuniverses } = c;
  return c.db
    .select(orderListSelection(orders, universes, subuniverses))
    .from(orders)
    .leftJoin(universes, eq(universes.universe_tracking_identifier, effectiveUniverse(orders)))
    .leftJoin(subuniverses, eq(subuniverses.identifier, orders.subuniverse))
    .where(where)
    .orderBy(sql`${orders.order_date} DESC`);
}

type OrderListRow = Awaited<ReturnType<typeof sqliteOrderListQuery>>[number];

async function selectOrderList(
  c: QueryContext,
  where: SQL<unknown> | undefined,
  limit?: number,
  offset?: number
): Promise<OrderListRow[]> {
  const base =
    c.dialect === "sqlite" ? sqliteOrderListQuery(c, where) : pgOrderListQuery(c, where);
  if (limit === undefined) return base;
  if (offset === undefined) return base.limit(limit);
  return base.limit(limit).offset(offset);
}

// ── Row normaliser ─────────────────────────────────────────────────────────────

type OrderNameKey = "universe_name" | "subuniverse_name";

type NormalizableOrderRow = Omit<OrderListRow, OrderNameKey> &
  Partial<Pick<OrderListRow, OrderNameKey>>;

function normalizeOrder(row: NormalizableOrderRow): QoqaOrder {
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

  const c = ctx();
  const orderNumbers = orderRows.map((o) => o.order_number);

  const tags =
    c.dialect === "sqlite"
      ? await c.db
          .select({
            order_number: c.orderSubuniverses.order_number,
            identifier: c.orderSubuniverses.subuniverse,
            name: c.subuniverses.name_fr,
          })
          .from(c.orderSubuniverses)
          .leftJoin(
            c.subuniverses,
            eq(c.subuniverses.identifier, c.orderSubuniverses.subuniverse)
          )
          .where(inArray(c.orderSubuniverses.order_number, orderNumbers))
          .orderBy(c.orderSubuniverses.position)
      : await c.db
          .select({
            order_number: c.orderSubuniverses.order_number,
            identifier: c.orderSubuniverses.subuniverse,
            name: c.subuniverses.name_fr,
          })
          .from(c.orderSubuniverses)
          .leftJoin(
            c.subuniverses,
            eq(c.subuniverses.identifier, c.orderSubuniverses.subuniverse)
          )
          .where(inArray(c.orderSubuniverses.order_number, orderNumbers))
          .orderBy(c.orderSubuniverses.position);

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

function hasAnySubuniverse(orders: OrdersTable, subs: string[]): SQL<unknown> {
  return sql`EXISTS (SELECT 1 FROM qoqa_order_subuniverses os WHERE os.order_number = ${orders.order_number} AND os.subuniverse IN (${sql.join(
    subs.map((s) => sql`${s}`),
    sql`, `
  )}))`;
}

/**
 * Sub-universe selections are `universe:subuniverse` pairs, so a sub-universe
 * only matches orders filed under the universe it was picked from. Bare
 * identifiers (no universe prefix) match on the sub-universe alone.
 */
function subuniverseConditions(
  orders: OrdersTable,
  keys: string[]
): (SQL<unknown> | undefined)[] {
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

  const parts: (SQL<unknown> | undefined)[] = [];
  for (const [universe, subs] of byUniverse) {
    parts.push(
      and(eq(effectiveUniverse(orders), universe), hasAnySubuniverse(orders, subs))
    );
  }
  if (bare.length > 0) parts.push(hasAnySubuniverse(orders, bare));
  return parts;
}

function buildUniverseFilter(
  orders: OrdersTable,
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): SQL<unknown> | undefined {
  if (universes.includes(NO_UNIVERSE_FILTER)) {
    return sql`1 = 0`;
  }

  const conditions: (SQL<unknown> | undefined)[] = [];

  const parts: (SQL<unknown> | undefined)[] = [];
  if (universes.length > 0) parts.push(inArray(effectiveUniverse(orders), universes));
  parts.push(...subuniverseConditions(orders, subuniverses));
  if (parts.length > 0) conditions.push(or(...parts));

  if (from) conditions.push(gte(orders.order_date, from));
  if (to) conditions.push(lte(orders.order_date, to));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildSearchFilter(orders: OrdersTable, search: string): SQL<unknown> | undefined {
  const pattern = `%${search}%`;
  const like = (col: SQLWrapper) => ilikeCompat(col, pattern);
  const universe = effectiveUniverse(orders);

  return or(
    like(orders.order_number),
    like(orders.invoice_number),
    like(orders.offer_title),
    like(orders.offer_subtitle),
    like(orders.item_description),
    like(orders.status),
    like(orders.order_date),
    like(sql`CAST(${orders.amount_chf} AS TEXT)`),
    like(universe),
    like(
      sql`(SELECT u.name_fr FROM qoqa_universes u WHERE u.universe_tracking_identifier = ${universe})`
    ),
    like(
      sql`(SELECT u.name_de FROM qoqa_universes u WHERE u.universe_tracking_identifier = ${universe})`
    ),
    sql`EXISTS (SELECT 1 FROM qoqa_order_subuniverses os LEFT JOIN qoqa_subuniverses su ON su.identifier = os.subuniverse WHERE os.order_number = ${orders.order_number} AND (${like(
      sql`os.subuniverse`
    )} OR ${like(sql`su.name_fr`)} OR ${like(sql`su.name_de`)}))`
  );
}

// ── Read queries ───────────────────────────────────────────────────────────────

export async function fetchStats(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<OrderStats> {
  const c = ctx();
  const { orders } = c;
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const selection = {
    total_spent: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
    order_count: sql<number>`COUNT(*)`,
    average_per_order: sql<number>`AVG(${asFloat(orders.amount_chf)})`,
  };

  const [row] =
    c.dialect === "sqlite"
      ? await c.db.select(selection).from(c.orders).where(where)
      : await c.db.select(selection).from(c.orders).where(where);

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
  const c = ctx();
  const { orders } = c;
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);
  const month = yearMonth(orders.order_date);

  const selection = {
    month,
    total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
    count: sql<number>`COUNT(*)`,
  };

  return c.dialect === "sqlite"
    ? c.db.select(selection).from(c.orders).where(where).groupBy(month).orderBy(month)
    : c.db.select(selection).from(c.orders).where(where).groupBy(month).orderBy(month);
}

export async function fetchYearlySpending(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<YearlySpending[]> {
  const c = ctx();
  const { orders } = c;
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);
  const year = yearOf(orders.order_date);

  const selection = {
    year,
    total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
    count: sql<number>`COUNT(*)`,
  };

  return c.dialect === "sqlite"
    ? c.db.select(selection).from(c.orders).where(where).groupBy(year).orderBy(year)
    : c.db.select(selection).from(c.orders).where(where).groupBy(year).orderBy(year);
}

export async function fetchTotalCount(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<number> {
  const c = ctx();
  const { orders } = c;
  const where = buildUniverseFilter(orders, universes, subuniverses, from, to);
  const selection = { count: sql<number>`COUNT(*)` };

  const [row] =
    c.dialect === "sqlite"
      ? await c.db.select(selection).from(c.orders).where(where)
      : await c.db.select(selection).from(c.orders).where(where);
  return Number(row?.count ?? 0);
}

export async function fetchInitialOrders(
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<QoqaOrder[]> {
  const c = ctx();
  const where = buildUniverseFilter(c.orders, universes, subuniverses, from, to);

  const rows = await selectOrderList(c, where, pageSize);

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
  const c = ctx();
  const { orders } = c;
  const filter = buildUniverseFilter(orders, universes, subuniverses, from, to);

  const searchCondition = search ? buildSearchFilter(orders, search) : undefined;

  const where =
    filter && searchCondition
      ? and(filter, searchCondition)
      : (filter ?? searchCondition);

  const countSelection = { count: sql<number>`COUNT(*)` };
  const countRows =
    c.dialect === "sqlite"
      ? await c.db.select(countSelection).from(c.orders).where(where)
      : await c.db.select(countSelection).from(c.orders).where(where);

  const rows = await selectOrderList(c, where, pageSize, (page - 1) * pageSize);

  return {
    orders: await withSubuniverseTags(rows.map(normalizeOrder)),
    total: Number(countRows[0]?.count ?? 0),
  };
}

export async function fetchAllOrders(params: {
  universes?: string[];
  subuniverses?: string[];
  from?: string;
  to?: string;
}): Promise<QoqaOrder[]> {
  const c = ctx();

  const where = buildUniverseFilter(
    c.orders,
    params.universes ?? [],
    params.subuniverses ?? [],
    params.from,
    params.to
  );

  const rows = await selectOrderList(c, where);

  return withSubuniverseTags(rows.map(normalizeOrder));
}

type UniverseRow = typeof qoqaUniversesSqlite.$inferSelect;
type SubuniverseRow = typeof qoqaSubuniversesSqlite.$inferSelect;

export async function fetchUniverses(): Promise<UniverseOption[]> {
  const c = ctx();
  const universeExpr = effectiveUniverse(c.orders);

  // The tree is derived from the universe/sub-universe pairs the orders actually
  // carry, each mapped to the universe its sub-universe belongs to today — see
  // effectiveUniverse(). Every tag of an order is listed, not only its primary,
  // so a secondary tag can still be picked in the filter.
  const pairs =
    c.dialect === "sqlite"
      ? await c.db
          .select({ universe: universeExpr, subuniverse: c.orderSubuniverses.subuniverse })
          .from(c.orders)
          .leftJoin(
            c.orderSubuniverses,
            eq(c.orderSubuniverses.order_number, c.orders.order_number)
          )
          .where(isNotNull(c.orders.universe))
          .groupBy(universeExpr, c.orderSubuniverses.subuniverse)
      : await c.db
          .select({ universe: universeExpr, subuniverse: c.orderSubuniverses.subuniverse })
          .from(c.orders)
          .leftJoin(
            c.orderSubuniverses,
            eq(c.orderSubuniverses.order_number, c.orders.order_number)
          )
          .where(isNotNull(c.orders.universe))
          .groupBy(universeExpr, c.orderSubuniverses.subuniverse);

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

  const universesQuery: PromiseLike<UniverseRow[]> =
    c.dialect === "sqlite"
      ? c.db
          .select()
          .from(c.universes)
          .where(inArray(c.universes.universe_tracking_identifier, usedUniverseIds))
      : c.db
          .select()
          .from(c.universes)
          .where(inArray(c.universes.universe_tracking_identifier, usedUniverseIds));

  const subuniversesQuery: PromiseLike<SubuniverseRow[]> =
    usedSubuniverseIds.length > 0
      ? c.dialect === "sqlite"
        ? c.db
            .select()
            .from(c.subuniverses)
            .where(inArray(c.subuniverses.identifier, usedSubuniverseIds))
        : c.db
            .select()
            .from(c.subuniverses)
            .where(inArray(c.subuniverses.identifier, usedSubuniverseIds))
      : Promise.resolve([]);

  const [universesRows, subuniversesRows] = await Promise.all([
    universesQuery,
    subuniversesQuery,
  ]);

  const universeNames = new Map(
    universesRows.map((u) => [u.universe_tracking_identifier, u.name_fr])
  );
  const subuniverseNames = new Map(subuniversesRows.map((s) => [s.identifier, s.name_fr]));
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

type SpendingGroupMode = "universe" | "subuniverse";

function spendingGroupColumn<T extends OrdersTable>(
  mode: SpendingGroupMode,
  orders: T
): SQL<string> | T["subuniverse"] {
  return mode === "universe" ? effectiveUniverse(orders) : orders.subuniverse;
}

function spendingGroupName(mode: SpendingGroupMode, groupCol: SQLWrapper): SQL<string | null> {
  return mode === "universe"
    ? sql<
        string | null
      >`(SELECT name_fr FROM qoqa_universes WHERE universe_tracking_identifier = ${groupCol})`
    : sql<string | null>`(SELECT name_fr FROM qoqa_subuniverses WHERE identifier = ${groupCol})`;
}

function sqliteSpendingByGroup(
  c: SqliteContext,
  mode: SpendingGroupMode,
  where: SQL<unknown> | undefined
) {
  const { orders } = c;
  const groupCol = spendingGroupColumn(mode, orders);
  return c.db
    .select({
      identifier: groupCol,
      name: spendingGroupName(mode, groupCol),
      total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(where, isNotNull(groupCol)))
    .groupBy(groupCol)
    .orderBy(sql`SUM(${asFloat(orders.amount_chf)}) DESC`);
}

function pgSpendingByGroup(
  c: PgContext,
  mode: SpendingGroupMode,
  where: SQL<unknown> | undefined
) {
  const { orders } = c;
  const groupCol = spendingGroupColumn(mode, orders);
  return c.db
    .select({
      identifier: groupCol,
      name: spendingGroupName(mode, groupCol),
      total: sql<number>`SUM(${asFloat(orders.amount_chf)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(where, isNotNull(groupCol)))
    .groupBy(groupCol)
    .orderBy(sql`SUM(${asFloat(orders.amount_chf)}) DESC`);
}

type SpendingGroupRow = Awaited<ReturnType<typeof sqliteSpendingByGroup>>[number];

export async function fetchSpendingByGroup(
  mode: SpendingGroupMode,
  universes: string[],
  subuniverses: string[],
  from?: string,
  to?: string
): Promise<SpendingByGroup[]> {
  const c = ctx();
  const where = buildUniverseFilter(c.orders, universes, subuniverses, from, to);

  const rows: SpendingGroupRow[] =
    c.dialect === "sqlite"
      ? await sqliteSpendingByGroup(c, mode, where)
      : await pgSpendingByGroup(c, mode, where);

  return rows.map((r) => {
    const identifier = r.identifier as string;
    return {
      identifier,
      name: r.name ?? identifier,
      total: Number(r.total),
      count: Number(r.count),
    };
  });
}

export async function fetchOrderPdf(orderNumber: string): Promise<Buffer | null> {
  const c = ctx();

  const [row] =
    c.dialect === "sqlite"
      ? await c.db
          .select({ pdf_data: c.orders.pdf_data })
          .from(c.orders)
          .where(sql`${c.orders.order_number} = ${orderNumber}`)
      : await c.db
          .select({ pdf_data: c.orders.pdf_data })
          .from(c.orders)
          .where(sql`${c.orders.order_number} = ${orderNumber}`);

  if (!row?.pdf_data) return null;
  const data = row.pdf_data as Buffer | Uint8Array | ArrayBuffer;
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
}

// ── Write queries ──────────────────────────────────────────────────────────────

export async function getOrderByNumber(orderNumber: string): Promise<QoqaOrder | null> {
  const c = ctx();

  const rows =
    c.dialect === "sqlite"
      ? await c.db
          .select(orderListColumns(c.orders))
          .from(c.orders)
          .where(sql`${c.orders.order_number} = ${orderNumber}`)
          .limit(1)
      : await c.db
          .select(orderListColumns(c.orders))
          .from(c.orders)
          .where(sql`${c.orders.order_number} = ${orderNumber}`)
          .limit(1);

  const [row] = rows;
  return row ? normalizeOrder(row) : null;
}

type OrderNumberRow = Pick<typeof qoqaOrdersSqlite.$inferSelect, "order_number">;

/**
 * Order numbers last written before `cutoff`, oldest first. QoQa re-tags offers
 * after the fact (an order filed under `alcohol` comes back as
 * `wine-and-spirits` months later), so stored details go stale; refreshing the
 * oldest few per sync converges without re-fetching every order every time.
 */
export async function fetchStaleOrderNumbers(cutoff: string, limit: number): Promise<string[]> {
  const c = ctx();

  const rows: OrderNumberRow[] =
    c.dialect === "sqlite"
      ? await c.db
          .select({ order_number: c.orders.order_number })
          .from(c.orders)
          .where(sql`${c.orders.updated_at} < ${cutoff}`)
          .orderBy(sql`${c.orders.updated_at} ASC`)
          .limit(limit)
      : await c.db
          .select({ order_number: c.orders.order_number })
          .from(c.orders)
          .where(sql`${c.orders.updated_at} < ${cutoff}`)
          .orderBy(sql`${c.orders.updated_at} ASC`)
          .limit(limit);

  return rows.map((r) => String(r.order_number));
}

/** Order numbers stored without an invoice PDF — candidates for a later retry. */
export async function fetchOrderNumbersMissingPdf(): Promise<string[]> {
  const c = ctx();

  const rows: OrderNumberRow[] =
    c.dialect === "sqlite"
      ? await c.db
          .select({ order_number: c.orders.order_number })
          .from(c.orders)
          .where(sql`${c.orders.pdf_data} IS NULL`)
      : await c.db
          .select({ order_number: c.orders.order_number })
          .from(c.orders)
          .where(sql`${c.orders.pdf_data} IS NULL`);

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

  const c = ctx();

  // A failed PDF download must not wipe a PDF already stored for this order.
  const { pdf_data: _pdf, pdf_filename: _name, ...rest } = values;
  const set = pdfBuf ? values : rest;

  if (c.dialect === "sqlite") {
    await c.db
      .insert(c.orders)
      .values(values)
      .onConflictDoUpdate({ target: c.orders.order_number, set });
  } else {
    await c.db
      .insert(c.orders)
      .values(values)
      .onConflictDoUpdate({ target: c.orders.order_number, set });
  }

  if (data.subuniverses) {
    await replaceOrderSubuniverses(data.order_number, data.subuniverses);
  }
}

async function replaceOrderSubuniverses(
  orderNumber: string,
  subuniverses: string[]
): Promise<void> {
  const c = ctx();

  if (c.dialect === "sqlite") {
    await c.db
      .delete(c.orderSubuniverses)
      .where(eq(c.orderSubuniverses.order_number, orderNumber));
  } else {
    await c.db
      .delete(c.orderSubuniverses)
      .where(eq(c.orderSubuniverses.order_number, orderNumber));
  }

  if (subuniverses.length === 0) return;

  const values = subuniverses.map((subuniverse, position) => ({
    order_number: orderNumber,
    subuniverse,
    position,
  }));

  if (c.dialect === "sqlite") {
    await c.db.insert(c.orderSubuniverses).values(values);
  } else {
    await c.db.insert(c.orderSubuniverses).values(values);
  }
}

export async function backfillOrderSubuniverses(): Promise<number> {
  const c = ctx();
  const countSelection = { count: sql<number>`COUNT(*)` };

  const [existing] =
    c.dialect === "sqlite"
      ? await c.db.select(countSelection).from(c.orderSubuniverses)
      : await c.db.select(countSelection).from(c.orderSubuniverses);
  if (Number(existing?.count ?? 0) > 0) return 0;

  const rows =
    c.dialect === "sqlite"
      ? await c.db
          .select({
            order_number: c.orders.order_number,
            subuniverse: c.orders.subuniverse,
            raw_json: c.orders.raw_json,
          })
          .from(c.orders)
      : await c.db
          .select({
            order_number: c.orders.order_number,
            subuniverse: c.orders.subuniverse,
            raw_json: c.orders.raw_json,
          })
          .from(c.orders);

  const values: { order_number: string; subuniverse: string; position: number }[] = [];

  for (const row of rows) {
    const orderNumber = String(row.order_number);
    const tags = subuniverseTagsFromRaw(row.raw_json);
    const list = tags.length > 0 ? tags : row.subuniverse ? [String(row.subuniverse)] : [];
    list.forEach((subuniverse, position) =>
      values.push({ order_number: orderNumber, subuniverse, position })
    );
  }

  if (values.length === 0) return 0;

  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    if (c.dialect === "sqlite") {
      await c.db.insert(c.orderSubuniverses).values(chunk);
    } else {
      await c.db.insert(c.orderSubuniverses).values(chunk);
    }
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

  const c = ctx();

  if (c.dialect === "sqlite") {
    await c.db
      .insert(c.universes)
      .values(values)
      .onConflictDoUpdate({ target: c.universes.universe_tracking_identifier, set });
  } else {
    await c.db
      .insert(c.universes)
      .values(values)
      .onConflictDoUpdate({ target: c.universes.universe_tracking_identifier, set });
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

  const c = ctx();

  if (c.dialect === "sqlite") {
    await c.db
      .insert(c.subuniverses)
      .values(values)
      .onConflictDoUpdate({ target: c.subuniverses.identifier, set });
  } else {
    await c.db
      .insert(c.subuniverses)
      .values(values)
      .onConflictDoUpdate({ target: c.subuniverses.identifier, set });
  }
}
