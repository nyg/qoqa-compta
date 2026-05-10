/**
 * Drizzle ORM schema — mirrors the qoqa_orders and qoqa_universes tables
 * created by the crawler.
 *
 * This file is the TypeScript source of truth for column names and types.
 * Schema migrations are owned by the crawler (SQLAlchemy create_all).
 */
import { sql } from "drizzle-orm";
import { blob, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  customType,
  numeric as pgNumeric,
  pgTable,
  serial,
  text as pgText,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL ``bytea`` column. drizzle-orm's pg-core doesn't ship a built-in
 * bytea type, so we declare one via ``customType``. Returned as a Node Buffer
 * by the driver — convert to ``Uint8Array`` at the boundary when needed.
 */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/** SQLite version of qoqa_orders */
export const qoqaOrdersSqlite = sqliteTable("qoqa_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_number: text("order_number").notNull(),
  order_date: text("order_date").notNull(), // stored as "YYYY-MM-DD"
  amount_chf: numeric("amount_chf").notNull(),
  status: text("status"),
  subtotal_chf: numeric("subtotal_chf"),
  discount_chf: numeric("discount_chf"),
  vat_chf: numeric("vat_chf"),
  delivery_on: text("delivery_on"),
  offer_id: text("offer_id"),
  offer_title: text("offer_title"),
  offer_subtitle: text("offer_subtitle"),
  universe: text("universe"),
  subuniverse: text("subuniverse"),
  item_description: text("item_description"),
  invoice_number: text("invoice_number"),
  pdf_filename: text("pdf_filename"),
  // SQLite BLOB. Never select this in list queries — use `pdf_data IS NOT NULL`
  // to expose a `has_pdf` boolean instead, and only read the bytes via the
  // dedicated /api/orders/[orderNumber]/pdf route.
  pdf_data: blob("pdf_data", { mode: "buffer" }),
  raw_json: text("raw_json"),
  created_at: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

/** SQLite version of qoqa_universes */
export const qoqaUniversesSqlite = sqliteTable("qoqa_universes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universe_tracking_identifier: text("universe_tracking_identifier").notNull(),
  name: text("name"),
  updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

/** SQLite version of qoqa_subuniverses */
export const qoqaSubuniversesSqlite = sqliteTable("qoqa_subuniverses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identifier: text("identifier").notNull(),
  name: text("name"),
  universe_tracking_identifier: text("universe_tracking_identifier").notNull(),
  updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

/** PostgreSQL version of qoqa_orders */
export const qoqaOrdersPg = pgTable("qoqa_orders", {
  id: serial("id").primaryKey(),
  order_number: varchar("order_number", { length: 64 }).notNull(),
  order_date: pgText("order_date").notNull(),
  amount_chf: pgNumeric("amount_chf", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }),
  subtotal_chf: pgNumeric("subtotal_chf", { precision: 10, scale: 2 }),
  discount_chf: pgNumeric("discount_chf", { precision: 10, scale: 2 }),
  vat_chf: pgNumeric("vat_chf", { precision: 10, scale: 2 }),
  delivery_on: pgText("delivery_on"),
  offer_id: varchar("offer_id", { length: 32 }),
  offer_title: varchar("offer_title", { length: 255 }),
  offer_subtitle: varchar("offer_subtitle", { length: 255 }),
  universe: varchar("universe", { length: 64 }),
  subuniverse: varchar("subuniverse", { length: 64 }),
  item_description: pgText("item_description"),
  invoice_number: varchar("invoice_number", { length: 64 }),
  pdf_filename: varchar("pdf_filename", { length: 255 }),
  // PostgreSQL BYTEA. Same caveat as the SQLite version — never select in lists.
  pdf_data: bytea("pdf_data"),
  raw_json: pgText("raw_json"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** PostgreSQL version of qoqa_universes */
export const qoqaUniversesPg = pgTable("qoqa_universes", {
  id: serial("id").primaryKey(),
  universe_tracking_identifier: varchar("universe_tracking_identifier", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** PostgreSQL version of qoqa_subuniverses */
export const qoqaSubuniversesPg = pgTable("qoqa_subuniverses", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }),
  universe_tracking_identifier: varchar("universe_tracking_identifier", { length: 64 }).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QoqaOrderSqlite = typeof qoqaOrdersSqlite.$inferSelect;
export type QoqaOrderPg = typeof qoqaOrdersPg.$inferSelect;
