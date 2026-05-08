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
  partner_name: text("partner_name"),
  pdf_filename: text("pdf_filename"),
  raw_text: text("raw_text"),
  created_at: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

/** PostgreSQL version of qoqa_orders */
export const qoqaOrdersPg = pgTable("qoqa_orders", {
  id: serial("id").primaryKey(),
  order_number: varchar("order_number", { length: 64 }).notNull(),
  order_date: pgText("order_date").notNull(),
  amount_chf: pgNumeric("amount_chf", { precision: 10, scale: 2 }).notNull(),
  partner_name: varchar("partner_name", { length: 255 }),
  pdf_filename: varchar("pdf_filename", { length: 255 }),
  raw_text: pgText("raw_text"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QoqaOrderSqlite = typeof qoqaOrdersSqlite.$inferSelect;
export type QoqaOrderPg = typeof qoqaOrdersPg.$inferSelect;
