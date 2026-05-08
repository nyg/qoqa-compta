/**
 * Drizzle ORM schema — mirrors the qoqa_orders table created by the crawler.
 *
 * This file is the TypeScript source of truth for column names and types.
 * Schema migrations are owned by the crawler (SQLAlchemy create_all).
 */
import { sql } from "drizzle-orm";
import { integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  numeric as pgNumeric,
  pgTable,
  serial,
  text as pgText,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

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
  offer_category: text("offer_category"),
  offer_subcategory: text("offer_subcategory"),
  item_description: text("item_description"),
  invoice_number: text("invoice_number"),
  pdf_filename: text("pdf_filename"),
  raw_json: text("raw_json"),
  created_at: text("created_at").default(sql`(datetime('now'))`).notNull(),
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
  offer_category: varchar("offer_category", { length: 64 }),
  offer_subcategory: varchar("offer_subcategory", { length: 64 }),
  item_description: pgText("item_description"),
  invoice_number: varchar("invoice_number", { length: 64 }),
  pdf_filename: varchar("pdf_filename", { length: 255 }),
  raw_json: pgText("raw_json"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QoqaOrderSqlite = typeof qoqaOrdersSqlite.$inferSelect;
export type QoqaOrderPg = typeof qoqaOrdersPg.$inferSelect;
