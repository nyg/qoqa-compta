/**
 * Drizzle ORM database client — supports SQLite (local) and PostgreSQL.
 *
 * The database is selected from DATABASE_URL:
 *   sqlite:////absolute/path/to/qoqa.db  → local SQLite via @libsql/client
 *   postgresql://...                      → PostgreSQL via @neondatabase/serverless
 *
 * If DATABASE_URL is unset, defaults to SQLite at the XDG data home:
 *   $XDG_DATA_HOME/qoqa-compta/qoqa.db  (~/.local/share/qoqa-compta/qoqa.db)
 */
import os from "os";
import { createClient } from "@libsql/client";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleLibsql, LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";

import { qoqaOrdersPg, qoqaOrdersSqlite } from "./schema";

const XDG_DATA_HOME =
  process.env.XDG_DATA_HOME ??
  `${os.homedir()}/.local/share`;

const DEFAULT_DATABASE_URL = `sqlite:///${XDG_DATA_HOME}/qoqa-compta/qoqa.db`;

const rawUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

/** True when using a local SQLite database. */
export const isSqlite = rawUrl.startsWith("sqlite:///");

// The two Drizzle DB types share the same query API; cast to unify them
function createDb(): LibSQLDatabase<any> {
  if (isSqlite) {
    // @libsql/client uses "file:" scheme; convert from SQLAlchemy "sqlite:///" scheme
    const filePath = rawUrl.slice("sqlite:///".length);
    const client = createClient({ url: `file:${filePath}` });
    return drizzleLibsql(client, { schema: { qoqaOrders: qoqaOrdersSqlite } });
  }

  const sql = neon(rawUrl);
  return drizzleNeon(sql, {
    schema: { qoqaOrders: qoqaOrdersPg },
  }) as unknown as LibSQLDatabase<any>;
}

export const db = createDb();

/** Convenience re-export: use the correct table reference for the active dialect. */
export const qoqaOrders = isSqlite ? qoqaOrdersSqlite : qoqaOrdersPg;


