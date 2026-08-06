import { sql } from "drizzle-orm";
import {
  integer,
  numeric,
  text,
  blob,
  index,
  sqliteTable,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  integer as pgInteger,
  numeric as pgNumeric,
  text as pgText,
  pgTable,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

// Custom PostgreSQL BYTEA type
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

// ── SQLite schema ──────────────────────────────────────────────────────────────

export const qoqaOrdersSqlite = sqliteTable(
  "qoqa_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    order_number: text("order_number").notNull(),
    order_date: text("order_date").notNull(),
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
    pdf_data: blob("pdf_data", { mode: "buffer" }),
    raw_json: text("raw_json"),
    created_at: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updated_at: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("idx_qoqa_orders_order_number").on(t.order_number)]
);

export const qoqaUniversesSqlite = sqliteTable(
  "qoqa_universes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    universe_tracking_identifier: text("universe_tracking_identifier").notNull(),
    name_fr: text("name_fr"),
    name_de: text("name_de"),
    updated_at: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_qoqa_universes_identifier").on(
      t.universe_tracking_identifier
    ),
  ]
);

export const qoqaSubuniversesSqlite = sqliteTable(
  "qoqa_subuniverses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    name_fr: text("name_fr"),
    name_de: text("name_de"),
    universe_tracking_identifier: text("universe_tracking_identifier").notNull(),
    updated_at: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("idx_qoqa_subuniverses_identifier").on(t.identifier)]
);

export const qoqaOrderSubuniversesSqlite = sqliteTable(
  "qoqa_order_subuniverses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    order_number: text("order_number").notNull(),
    subuniverse: text("subuniverse").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("idx_qoqa_order_subuniverses_pair").on(t.order_number, t.subuniverse),
    index("idx_qoqa_order_subuniverses_sub").on(t.subuniverse),
  ]
);

// ── PostgreSQL schema ──────────────────────────────────────────────────────────

export const qoqaOrdersPg = pgTable(
  "qoqa_orders",
  {
    id: pgInteger("id").primaryKey().generatedAlwaysAsIdentity(),
    order_number: pgText("order_number").notNull(),
    order_date: pgText("order_date").notNull(),
    amount_chf: pgNumeric("amount_chf", { precision: 10, scale: 2 }).notNull(),
    status: pgText("status"),
    subtotal_chf: pgNumeric("subtotal_chf", { precision: 10, scale: 2 }),
    discount_chf: pgNumeric("discount_chf", { precision: 10, scale: 2 }),
    vat_chf: pgNumeric("vat_chf", { precision: 10, scale: 2 }),
    delivery_on: pgText("delivery_on"),
    offer_id: pgText("offer_id"),
    offer_title: pgText("offer_title"),
    offer_subtitle: pgText("offer_subtitle"),
    universe: pgText("universe"),
    subuniverse: pgText("subuniverse"),
    item_description: pgText("item_description"),
    invoice_number: pgText("invoice_number"),
    pdf_filename: pgText("pdf_filename"),
    pdf_data: bytea("pdf_data"),
    raw_json: pgText("raw_json"),
    created_at: pgText("created_at").notNull().default(sql`NOW()`),
    updated_at: pgText("updated_at").notNull().default(sql`NOW()`),
  },
  (t) => [pgUniqueIndex("idx_qoqa_orders_order_number").on(t.order_number)]
);

export const qoqaUniversesPg = pgTable(
  "qoqa_universes",
  {
    id: pgInteger("id").primaryKey().generatedAlwaysAsIdentity(),
    universe_tracking_identifier: pgText("universe_tracking_identifier").notNull(),
    name_fr: pgText("name_fr"),
    name_de: pgText("name_de"),
    updated_at: pgText("updated_at").notNull().default(sql`NOW()`),
  },
  (t) => [
    pgUniqueIndex("idx_qoqa_universes_identifier").on(
      t.universe_tracking_identifier
    ),
  ]
);

export const qoqaSubuniversesPg = pgTable(
  "qoqa_subuniverses",
  {
    id: pgInteger("id").primaryKey().generatedAlwaysAsIdentity(),
    identifier: pgText("identifier").notNull(),
    name_fr: pgText("name_fr"),
    name_de: pgText("name_de"),
    universe_tracking_identifier: pgText("universe_tracking_identifier").notNull(),
    updated_at: pgText("updated_at").notNull().default(sql`NOW()`),
  },
  (t) => [pgUniqueIndex("idx_qoqa_subuniverses_identifier").on(t.identifier)]
);

export const qoqaOrderSubuniversesPg = pgTable(
  "qoqa_order_subuniverses",
  {
    id: pgInteger("id").primaryKey().generatedAlwaysAsIdentity(),
    order_number: pgText("order_number").notNull(),
    subuniverse: pgText("subuniverse").notNull(),
    position: pgInteger("position").notNull(),
  },
  (t) => [
    pgUniqueIndex("idx_qoqa_order_subuniverses_pair").on(t.order_number, t.subuniverse),
    pgIndex("idx_qoqa_order_subuniverses_sub").on(t.subuniverse),
  ]
);
