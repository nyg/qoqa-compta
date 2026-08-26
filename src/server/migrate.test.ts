import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { neonConfig } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, getRawBunDb, reinitDb } from "./db";
import { dropAllTables, runMigrations } from "./migrate";
import { pgMigrations, sqliteMigrations } from "./migrations.generated";
import { qoqaOrdersSqlite } from "./schema";

const LEGACY_BOOTSTRAP_DDL = [
  `CREATE TABLE IF NOT EXISTS qoqa_orders (
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
  )`,
  `CREATE TABLE IF NOT EXISTS qoqa_universes (
    id                            INTEGER PRIMARY KEY AUTOINCREMENT,
    universe_tracking_identifier  TEXT NOT NULL,
    name_fr                       TEXT,
    name_de                       TEXT,
    updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS qoqa_subuniverses (
    id                            INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier                    TEXT NOT NULL,
    name_fr                       TEXT,
    name_de                       TEXT,
    universe_tracking_identifier  TEXT NOT NULL,
    updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS qoqa_order_subuniverses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number  TEXT    NOT NULL,
    subuniverse   TEXT    NOT NULL,
    position      INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_orders_order_number
     ON qoqa_orders(order_number)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_universes_identifier
     ON qoqa_universes(universe_tracking_identifier)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_subuniverses_identifier
     ON qoqa_subuniverses(identifier)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_qoqa_order_subuniverses_pair
     ON qoqa_order_subuniverses(order_number, subuniverse)`,
  `CREATE INDEX IF NOT EXISTS idx_qoqa_order_subuniverses_sub
     ON qoqa_order_subuniverses(subuniverse)`,
];

const APP_TABLES = [
  "qoqa_order_subuniverses",
  "qoqa_orders",
  "qoqa_subuniverses",
  "qoqa_universes",
];

const roots: string[] = [];

function tempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qoqa-migrate-"));
  roots.push(root);
  return path.join(root, "qoqa.db");
}

async function openAt(filePath: string): Promise<void> {
  await reinitDb(`file:${filePath}`);
}

function seedLegacyDatabase(filePath: string, orderNumbers: string[]): void {
  const db = new Database(filePath, { create: true });
  db.exec("PRAGMA journal_mode=WAL");
  for (const statement of LEGACY_BOOTSTRAP_DDL) db.exec(statement);
  for (const orderNumber of orderNumbers) {
    db.query(
      "INSERT INTO qoqa_orders (order_number, order_date, amount_chf) VALUES (?, ?, ?)"
    ).run(orderNumber, "2026-01-01", "42.50");
  }
  db.close();
}

function tableNames(): string[] {
  const rows = getRawBunDb()
    ?.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )
    .all();
  return (rows ?? []).map((row) => row.name);
}

function journalRows(): { hash: string; created_at: number }[] {
  return (
    getRawBunDb()
      ?.query<{ hash: string; created_at: number }, []>(
        "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at"
      )
      .all() ?? []
  );
}

function orderNumbers(): string[] {
  const rows = getRawBunDb()
    ?.query<{ order_number: string }, []>(
      "SELECT order_number FROM qoqa_orders ORDER BY order_number"
    )
    .all();
  return (rows ?? []).map((row) => row.order_number);
}

function insertOrder(orderNumber: string): void {
  getRawBunDb()
    ?.query(
      "INSERT INTO qoqa_orders (order_number, order_date, amount_chf) VALUES (?, ?, ?)"
    )
    .run(orderNumber, "2026-02-02", "19.90");
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await reinitDb(`file:${path.join(os.tmpdir(), "qoqa-migrate-teardown.db")}`);
});

describe("runMigrations on SQLite", () => {
  test("creates the full schema on a fresh database", async () => {
    await openAt(tempDbPath());
    await runMigrations();

    const tables = tableNames();
    for (const table of APP_TABLES) expect(tables).toContain(table);
    expect(tables).toContain("__drizzle_migrations");
    expect(getDb().dialect).toBe("sqlite");
  });

  test("supports a sync-shaped insert and read through Drizzle", async () => {
    await openAt(tempDbPath());
    await runMigrations();

    const handle = getDb();
    if (handle.dialect !== "sqlite") throw new Error("expected a SQLite handle");

    await handle.db.insert(qoqaOrdersSqlite).values({
      order_number: "QO-1",
      order_date: "2026-02-02",
      amount_chf: "19.90",
      universe: "wine",
      pdf_data: Buffer.from("%PDF-1.4"),
    });

    const rows = await handle.db
      .select({
        order_number: qoqaOrdersSqlite.order_number,
        amount_chf: qoqaOrdersSqlite.amount_chf,
        universe: qoqaOrdersSqlite.universe,
        pdf_data: qoqaOrdersSqlite.pdf_data,
      })
      .from(qoqaOrdersSqlite);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.order_number).toBe("QO-1");
    expect(Number(rows[0]!.amount_chf)).toBe(19.9);
    expect(rows[0]!.universe).toBe("wine");
    expect(rows[0]!.pdf_data?.toString()).toBe("%PDF-1.4");
  });

  test("keeps the PRAGMAs the old bootstrap applied", async () => {
    await openAt(tempDbPath());
    await runMigrations();

    const journalMode = getRawBunDb()
      ?.query<{ journal_mode: string }, []>("PRAGMA journal_mode")
      .get();
    const busyTimeout = getRawBunDb()
      ?.query<{ timeout: number }, []>("PRAGMA busy_timeout")
      .get();
    expect(journalMode?.journal_mode).toBe("wal");
    expect(busyTimeout?.timeout).toBe(5000);
  });

  test("baselines a pre-migrations database instead of re-creating its tables", async () => {
    const filePath = tempDbPath();
    seedLegacyDatabase(filePath, ["QO-100", "QO-101", "QO-102"]);

    await openAt(filePath);
    expect(tableNames()).not.toContain("__drizzle_migrations");

    await runMigrations();

    expect(orderNumbers()).toEqual(["QO-100", "QO-101", "QO-102"]);

    const journal = journalRows();
    const baseline = sqliteMigrations[0]!;
    expect(journal).toHaveLength(1);
    expect(journal[0]!.created_at).toBe(baseline.when);
    expect(journal[0]!.hash).toBe(
      createHash("sha256").update(baseline.sql).digest("hex")
    );
  });

  test("does not baseline a fresh database", async () => {
    await openAt(tempDbPath());
    await runMigrations();
    expect(journalRows()).toHaveLength(sqliteMigrations.length);
  });

  test("is idempotent across repeated startups", async () => {
    const filePath = tempDbPath();
    await openAt(filePath);
    await runMigrations();
    insertOrder("QO-7");

    await openAt(filePath);
    await runMigrations();
    await openAt(filePath);
    await runMigrations();

    expect(journalRows()).toHaveLength(sqliteMigrations.length);
    expect(orderNumbers()).toEqual(["QO-7"]);
  });

  test("is idempotent across repeated startups on a baselined database", async () => {
    const filePath = tempDbPath();
    seedLegacyDatabase(filePath, ["QO-200"]);

    await openAt(filePath);
    await runMigrations();
    await openAt(filePath);
    await runMigrations();

    expect(journalRows()).toHaveLength(1);
    expect(orderNumbers()).toEqual(["QO-200"]);
  });

  test("dropAllTables clears the journal so a reset rebuilds the schema", async () => {
    const filePath = tempDbPath();
    await openAt(filePath);
    await runMigrations();
    insertOrder("QO-9");

    await dropAllTables();
    const dropped = tableNames();
    for (const table of APP_TABLES) expect(dropped).not.toContain(table);
    expect(dropped).not.toContain("__drizzle_migrations");

    await runMigrations();

    const rebuilt = tableNames();
    for (const table of APP_TABLES) expect(rebuilt).toContain(table);
    expect(rebuilt).toContain("__drizzle_migrations");
    expect(orderNumbers()).toEqual([]);
    expect(journalRows()).toHaveLength(sqliteMigrations.length);
  });
});

describe("embedded migrations", () => {
  const repoRoot = path.resolve(import.meta.dir, "..", "..");

  const dialects = [
    { dir: "drizzle/sqlite", migrations: sqliteMigrations },
    { dir: "drizzle/pg", migrations: pgMigrations },
  ] as const;

  test("match the generated drizzle directories", () => {
    for (const { dir, migrations } of dialects) {
      const journal = JSON.parse(
        fs.readFileSync(path.join(repoRoot, dir, "meta", "_journal.json"), "utf-8")
      ) as { entries: { idx: number; when: number; tag: string }[] };
      const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

      expect(migrations.map((m) => m.tag)).toEqual(entries.map((e) => e.tag));
      expect(migrations.map((m) => m.when)).toEqual(entries.map((e) => e.when));

      for (const migration of migrations) {
        const onDisk = fs.readFileSync(
          path.join(repoRoot, dir, `${migration.tag}.sql`),
          "utf-8"
        );
        expect(migration.sql).toBe(onDisk);
      }
    }
  });

  test("are ordered by ascending timestamp", () => {
    for (const { migrations } of dialects) {
      const timestamps = migrations.map((m) => m.when);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    }
  });
});

describe("runMigrations on PostgreSQL", () => {
  const PG_URL = "postgresql://user:pass@ep-test-123.eu-central-1.aws.neon.tech/qoqa";

  function interceptWire(): string[] {
    const statements: string[] = [];
    (neonConfig as unknown as { fetchFunction: unknown }).fetchFunction = async (
      _url: string,
      options: { body: string }
    ) => {
      const { query } = JSON.parse(options.body) as { query: string };
      statements.push(query);
      return {
        ok: true,
        status: 200,
        json: async () => ({ rows: [], fields: [] }),
        text: async () => "",
      };
    };
    return statements;
  }

  afterEach(() => {
    (neonConfig as unknown as { fetchFunction: unknown }).fetchFunction = undefined;
  });

  test("creates every application table on an empty database", async () => {
    const statements = interceptWire();
    await reinitDb(PG_URL);
    await runMigrations();

    const created = statements
      .filter((s) => s.startsWith("CREATE TABLE"))
      .map((s) => s.match(/CREATE TABLE "([^"]+)"/)?.[1])
      .filter(Boolean);

    expect(created).toEqual(
      expect.arrayContaining([
        "qoqa_orders",
        "qoqa_universes",
        "qoqa_subuniverses",
        "qoqa_order_subuniverses",
      ])
    );
    expect(statements[0]).toContain("CREATE SCHEMA IF NOT EXISTS");
    expect(statements.filter((s) => s.startsWith("CREATE UNIQUE INDEX"))).not.toBeEmpty();
    expect(statements.some((s) => s.includes("__drizzle_migrations"))).toBe(true);
  });

  test("drops the application tables and the journal on reset", async () => {
    const statements = interceptWire();
    await reinitDb(PG_URL);
    await dropAllTables();

    for (const table of [
      "qoqa_orders",
      "qoqa_universes",
      "qoqa_subuniverses",
      "qoqa_order_subuniverses",
    ]) {
      expect(statements.some((s) => s === `DROP TABLE IF EXISTS ${table}`)).toBe(true);
    }
    expect(statements.some((s) => s.includes("__drizzle_migrations"))).toBe(true);
  });
});
