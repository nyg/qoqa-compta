import { getRawLibsqlClient, getRawNeonExecutor, isDbSqlite } from "./db";

// ── SQLite DDL ─────────────────────────────────────────────────────────────────

const SQLITE_ORDERS = `
CREATE TABLE IF NOT EXISTS qoqa_orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT    NOT NULL,
  order_date       TEXT    NOT NULL,
  amount_chf       NUMERIC NOT NULL,
  status           TEXT,
  subtotal_chf     NUMERIC,
  discount_chf     NUMERIC,
  vat_chf          NUMERIC,
  delivery_on      TEXT,
  offer_id         TEXT,
  offer_title      TEXT,
  offer_subtitle   TEXT,
  universe         TEXT,
  subuniverse      TEXT,
  item_description TEXT,
  invoice_number   TEXT,
  pdf_filename     TEXT,
  pdf_data         BLOB,
  raw_json         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const SQLITE_UNIVERSES = `
CREATE TABLE IF NOT EXISTS qoqa_universes (
  id                            INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_tracking_identifier  TEXT NOT NULL,
  name_fr                       TEXT,
  name_de                       TEXT,
  updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const SQLITE_SUBUNIVERSES = `
CREATE TABLE IF NOT EXISTS qoqa_subuniverses (
  id                            INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier                    TEXT NOT NULL,
  name_fr                       TEXT,
  name_de                       TEXT,
  universe_tracking_identifier  TEXT NOT NULL,
  updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const SQLITE_IDX_ORDERS = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_orders_order_number
  ON qoqa_orders(order_number)`;

const SQLITE_IDX_UNIVERSES = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_universes_identifier
  ON qoqa_universes(universe_tracking_identifier)`;

const SQLITE_IDX_SUBUNIVERSES = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_subuniverses_identifier
  ON qoqa_subuniverses(identifier)`;

// ── PostgreSQL DDL ─────────────────────────────────────────────────────────────

const PG_ORDERS = `
CREATE TABLE IF NOT EXISTS qoqa_orders (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number     TEXT          NOT NULL,
  order_date       TEXT          NOT NULL,
  amount_chf       NUMERIC(10,2) NOT NULL,
  status           TEXT,
  subtotal_chf     NUMERIC(10,2),
  discount_chf     NUMERIC(10,2),
  vat_chf          NUMERIC(10,2),
  delivery_on      TEXT,
  offer_id         TEXT,
  offer_title      TEXT,
  offer_subtitle   TEXT,
  universe         TEXT,
  subuniverse      TEXT,
  item_description TEXT,
  invoice_number   TEXT,
  pdf_filename     TEXT,
  pdf_data         BYTEA,
  raw_json         TEXT,
  created_at       TEXT NOT NULL DEFAULT NOW(),
  updated_at       TEXT NOT NULL DEFAULT NOW()
)`;

const PG_UNIVERSES = `
CREATE TABLE IF NOT EXISTS qoqa_universes (
  id                            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  universe_tracking_identifier  TEXT NOT NULL,
  name_fr                       TEXT,
  name_de                       TEXT,
  updated_at                    TEXT NOT NULL DEFAULT NOW()
)`;

const PG_SUBUNIVERSES = `
CREATE TABLE IF NOT EXISTS qoqa_subuniverses (
  id                            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier                    TEXT NOT NULL,
  name_fr                       TEXT,
  name_de                       TEXT,
  universe_tracking_identifier  TEXT NOT NULL,
  updated_at                    TEXT NOT NULL DEFAULT NOW()
)`;

const PG_IDX_ORDERS = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_orders_order_number
  ON qoqa_orders(order_number)`;

const PG_IDX_UNIVERSES = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_universes_identifier
  ON qoqa_universes(universe_tracking_identifier)`;

const PG_IDX_SUBUNIVERSES = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_subuniverses_identifier
  ON qoqa_subuniverses(identifier)`;

// ── Public API ─────────────────────────────────────────────────────────────────

export async function bootstrapSchema(): Promise<void> {
  if (isDbSqlite()) {
    const client = getRawLibsqlClient();
    if (!client) throw new Error("No libsql client available");
    // PRAGMAs must run outside a transaction
    await client.execute("PRAGMA journal_mode=WAL");
    await client.execute("PRAGMA busy_timeout=5000");
    await client.batch([
      { sql: SQLITE_ORDERS, args: [] },
      { sql: SQLITE_UNIVERSES, args: [] },
      { sql: SQLITE_SUBUNIVERSES, args: [] },
      { sql: SQLITE_IDX_ORDERS, args: [] },
      { sql: SQLITE_IDX_UNIVERSES, args: [] },
      { sql: SQLITE_IDX_SUBUNIVERSES, args: [] },
    ]);
  } else {
    const exec = getRawNeonExecutor();
    if (!exec) throw new Error("No neon executor available");
    await exec(PG_ORDERS);
    await exec(PG_UNIVERSES);
    await exec(PG_SUBUNIVERSES);
    await exec(PG_IDX_ORDERS);
    await exec(PG_IDX_UNIVERSES);
    await exec(PG_IDX_SUBUNIVERSES);
  }
}

export async function dropAllTables(): Promise<void> {
  if (isDbSqlite()) {
    const client = getRawLibsqlClient();
    if (!client) throw new Error("No libsql client available");
    await client.batch([
      { sql: "DROP TABLE IF EXISTS qoqa_orders", args: [] },
      { sql: "DROP TABLE IF EXISTS qoqa_universes", args: [] },
      { sql: "DROP TABLE IF EXISTS qoqa_subuniverses", args: [] },
    ]);
  } else {
    const exec = getRawNeonExecutor();
    if (!exec) throw new Error("No neon executor available");
    await exec("DROP TABLE IF EXISTS qoqa_orders");
    await exec("DROP TABLE IF EXISTS qoqa_universes");
    await exec("DROP TABLE IF EXISTS qoqa_subuniverses");
  }
}
