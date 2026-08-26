import { afterEach, describe, expect, test } from "bun:test";
import { neonConfig } from "@neondatabase/serverless";
import fs from "fs";
import os from "os";
import path from "path";
import { getRawNeonExecutor, getDbFilePath, initDb, isDbSqlite } from "./db";

const PG_URL = "postgresql://user:pass@ep-test-123.eu-central-1.aws.neon.tech/qoqa";

type WireCall = { query: string; params: unknown[] };

function interceptWire(): WireCall[] {
  const calls: WireCall[] = [];
  (neonConfig as unknown as { fetchFunction: unknown }).fetchFunction = async (
    _url: string,
    options: { body: string }
  ) => {
    calls.push(JSON.parse(options.body) as WireCall);
    return {
      ok: true,
      status: 200,
      json: async () => ({ rows: [], fields: [] }),
      text: async () => "",
    };
  };
  return calls;
}

afterEach(() => {
  (neonConfig as unknown as { fetchFunction: unknown }).fetchFunction = undefined;
});

describe("the raw PostgreSQL executor", () => {
  test("sends the statement and its parameters through to the server", async () => {
    const calls = interceptWire();
    await initDb(PG_URL);

    const exec = getRawNeonExecutor();
    expect(exec).not.toBeNull();

    await exec!("SELECT to_regclass($1) AS relation", ["qoqa_orders"]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      query: "SELECT to_regclass($1) AS relation",
      params: ["qoqa_orders"],
    });
  });

  test("runs a parameterless DDL statement, the first thing a migration does", async () => {
    const calls = interceptWire();
    await initDb(PG_URL);

    await getRawNeonExecutor()!(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);

    expect(calls[0]?.query).toBe(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  });

  test("forgets the SQLite file after switching to PostgreSQL", async () => {
    const sqliteFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "qoqa-db-")),
      "qoqa.db"
    );
    await initDb(`file:${sqliteFile}`);
    expect(isDbSqlite()).toBe(true);
    expect(getDbFilePath()).toBe(sqliteFile);

    await initDb(PG_URL);
    expect(isDbSqlite()).toBe(false);
    expect(getDbFilePath()).toBeNull();

    fs.rmSync(path.dirname(sqliteFile), { recursive: true, force: true });
  });
});
