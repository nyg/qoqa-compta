import { createHash } from "node:crypto";
import type { Database } from "bun:sqlite";
import { getRawBunDb, getRawNeonExecutor, isDbSqlite, type NeonExecutor } from "./db";
import {
  pgMigrations,
  sqliteMigrations,
  type EmbeddedMigration,
} from "./migrations.generated";

const MIGRATIONS_TABLE = "__drizzle_migrations";
const PG_MIGRATIONS_SCHEMA = "drizzle";
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

const PRE_MIGRATIONS_TABLE = "qoqa_orders";

const APP_TABLES = [
  "qoqa_orders",
  "qoqa_universes",
  "qoqa_subuniverses",
  "qoqa_order_subuniverses",
];

export interface MigrationReport {
  applied: string[];
  baselined: boolean;
}

function dialect(): string {
  return isDbSqlite() ? "sqlite" : "pg";
}

function logApplying(migration: EmbeddedMigration): void {
  console.log(`[db] Applying migration ${migration.tag} (${dialect()})`);
}

function logBaseline(migration: EmbeddedMigration): void {
  console.log(
    `[db] Baselining pre-migrations database at ${migration.tag} (${dialect()})`
  );
}

function hashOf(migration: EmbeddedMigration): string {
  return createHash("sha256").update(migration.sql).digest("hex");
}

function statementsOf(migration: EmbeddedMigration): string[] {
  return migration.sql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function pendingAfter(
  migrations: EmbeddedMigration[],
  lastAppliedAt: number | null
): EmbeddedMigration[] {
  return migrations.filter(
    (migration) => lastAppliedAt === null || lastAppliedAt < migration.when
  );
}

function sqliteHasTable(db: Database, name: string): boolean {
  const row = db
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(name);
  return row != null;
}

function sqliteLastAppliedAt(db: Database): number | null {
  const row = db
    .query<{ created_at: number | null }, []>(
      `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`
    )
    .get();
  if (!row || row.created_at == null) return null;
  return Number(row.created_at);
}

function sqliteRecord(db: Database, migration: EmbeddedMigration): void {
  db.query(
    `INSERT INTO ${MIGRATIONS_TABLE} ("hash", "created_at") VALUES (?, ?)`
  ).run(hashOf(migration), migration.when);
}

function migrateSqlite(): MigrationReport {
  const db = getRawBunDb();
  if (!db) throw new Error("No bun:sqlite database available");

  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA busy_timeout=5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  let lastAppliedAt = sqliteLastAppliedAt(db);

  const baseline =
    lastAppliedAt === null && sqliteHasTable(db, PRE_MIGRATIONS_TABLE)
      ? sqliteMigrations[0]
      : undefined;

  if (baseline) lastAppliedAt = baseline.when;

  const pending = pendingAfter(sqliteMigrations, lastAppliedAt);
  if (!baseline && pending.length === 0) return { applied: [], baselined: false };

  db.exec("BEGIN");
  try {
    if (baseline) {
      logBaseline(baseline);
      sqliteRecord(db, baseline);
    }
    for (const migration of pending) {
      logApplying(migration);
      for (const statement of statementsOf(migration)) {
        db.exec(statement);
      }
      sqliteRecord(db, migration);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { applied: pending.map((migration) => migration.tag), baselined: baseline != null };
}

function pgRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

async function pgHasTable(exec: NeonExecutor, name: string): Promise<boolean> {
  const rows = pgRows(await exec("SELECT to_regclass($1) AS relation", [name]));
  return rows[0]?.relation != null;
}

async function pgLastAppliedAt(exec: NeonExecutor): Promise<number | null> {
  const rows = pgRows(
    await exec(
      `SELECT created_at FROM "${PG_MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`
    )
  );
  const value = rows[0]?.created_at;
  if (value == null) return null;
  return Number(value);
}

async function pgRecord(
  exec: NeonExecutor,
  migration: EmbeddedMigration
): Promise<void> {
  await exec(
    `INSERT INTO "${PG_MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
    [hashOf(migration), migration.when]
  );
}

async function migratePg(): Promise<MigrationReport> {
  const exec = getRawNeonExecutor();
  if (!exec) throw new Error("No neon executor available");

  await exec(`CREATE SCHEMA IF NOT EXISTS "${PG_MIGRATIONS_SCHEMA}"`);
  await exec(`
    CREATE TABLE IF NOT EXISTS "${PG_MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  let lastAppliedAt = await pgLastAppliedAt(exec);

  const baseline =
    lastAppliedAt === null && (await pgHasTable(exec, PRE_MIGRATIONS_TABLE))
      ? pgMigrations[0]
      : undefined;

  if (baseline) {
    lastAppliedAt = baseline.when;
    logBaseline(baseline);
    await pgRecord(exec, baseline);
  }

  const pending = pendingAfter(pgMigrations, lastAppliedAt);
  for (const migration of pending) {
    logApplying(migration);
    for (const statement of statementsOf(migration)) {
      await exec(statement);
    }
    await pgRecord(exec, migration);
  }

  return { applied: pending.map((migration) => migration.tag), baselined: baseline != null };
}

export async function runMigrations(): Promise<MigrationReport> {
  return isDbSqlite() ? migrateSqlite() : await migratePg();
}

export async function isSchemaReady(): Promise<boolean> {
  if (isDbSqlite()) {
    const db = getRawBunDb();
    return db != null && sqliteHasTable(db, PRE_MIGRATIONS_TABLE);
  }

  const exec = getRawNeonExecutor();
  return exec != null && (await pgHasTable(exec, PRE_MIGRATIONS_TABLE));
}

export async function dropAllTables(): Promise<void> {
  if (isDbSqlite()) {
    const db = getRawBunDb();
    if (!db) throw new Error("No bun:sqlite database available");
    for (const table of APP_TABLES) {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    db.exec(`DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}`);
  } else {
    const exec = getRawNeonExecutor();
    if (!exec) throw new Error("No neon executor available");
    for (const table of APP_TABLES) {
      await exec(`DROP TABLE IF EXISTS ${table}`);
    }
    await exec(
      `DROP TABLE IF EXISTS "${PG_MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`
    );
  }
}
