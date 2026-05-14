import { Database } from "bun:sqlite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleBunSqlite, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { mkdirSync } from "fs";
import path from "path";
import os from "os";
import * as schema from "./schema";
import { readSettings } from "./settings";

// A simple callable type for the neon query function used in schema-bootstrap
export type NeonExecutor = (sql: string, params?: unknown[]) => Promise<unknown>;

type AnyDb = BunSQLiteDatabase<typeof schema>;

let _db: AnyDb | null = null;
let _isSqlite = true;
let _bunDb: Database | null = null;
let _neonExecutor: NeonExecutor | null = null;

function getDefaultSqlitePath(): string {
  const platform = process.platform;
  let dir: string;
  if (platform === "darwin") {
    dir = path.join(os.homedir(), "Library", "Application Support", "qoqa-compta");
  } else if (platform === "win32") {
    dir = path.join(process.env.APPDATA ?? os.homedir(), "qoqa-compta");
  } else {
    dir = path.join(
      process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
      "qoqa-compta"
    );
  }
  return path.join(dir, "qoqa.db");
}

export async function initDb(databaseUrl?: string): Promise<void> {
  const rawUrl = databaseUrl ?? readSettings().databaseUrl ?? undefined;
  _isSqlite = !rawUrl || rawUrl.startsWith("file:") || rawUrl.startsWith("sqlite");

  if (_isSqlite) {
    const filePath = rawUrl
      ? rawUrl.replace(/^(file:|sqlite:\/\/\/)/, "")
      : getDefaultSqlitePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    _bunDb = new Database(filePath, { create: true });
    _neonExecutor = null;
    _db = drizzleBunSqlite(_bunDb, { schema }) as unknown as AnyDb;
  } else {
    const neonFn = neon(rawUrl!);
    _neonExecutor = neonFn as unknown as NeonExecutor;
    _bunDb = null;
    _db = drizzleNeon(neonFn, { schema }) as unknown as AnyDb;
  }
}

export async function reinitDb(databaseUrl?: string): Promise<void> {
  if (_bunDb) {
    _bunDb.close();
    _bunDb = null;
  }
  _db = null;
  _neonExecutor = null;
  await initDb(databaseUrl);
}

export function getDb(): AnyDb {
  if (!_db) throw new Error("Database not initialised — call initDb() first.");
  return _db;
}

export function isDbSqlite(): boolean {
  return _isSqlite;
}

export function getRawBunDb(): Database | null {
  return _bunDb;
}

export function getRawNeonExecutor(): NeonExecutor | null {
  return _neonExecutor;
}
