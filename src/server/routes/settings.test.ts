import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../app";
import { closeDb, ensureDb, initDb } from "../db";
import { runMigrations } from "../migrate";

const app = createApp();

const roots: string[] = [];

function tempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qoqa-settings-"));
  roots.push(root);
  return path.join(root, "qoqa.db");
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

afterEach(() => {
  closeDb();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("GET /api/settings/db-path", () => {
  test("reports the path of a SQLite file that does not exist yet", async () => {
    const filePath = tempDbPath();
    await initDb(`file:${filePath}`);

    const body = await json(await app.request("/api/settings/db-path"));

    expect(body).toEqual({ path: filePath, exists: false });
  });

  test("reports the file once a sync has created it", async () => {
    const filePath = tempDbPath();
    await initDb(`file:${filePath}`);
    ensureDb();

    const body = await json(await app.request("/api/settings/db-path"));

    expect(body).toEqual({ path: filePath, exists: true });
  });
});

describe("the destructive database endpoints", () => {
  test("refuse to clear a database whose file does not exist yet", async () => {
    await initDb(`file:${tempDbPath()}`);

    const res = await app.request("/api/settings/database", { method: "DELETE" });

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "No database file yet" });
  });

  test("refuse to delete a file that does not exist yet", async () => {
    await initDb(`file:${tempDbPath()}`);

    const res = await app.request("/api/settings/database/file", { method: "DELETE" });

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "No database file yet" });
  });

  test("refuse to reveal a file that does not exist yet", async () => {
    await initDb(`file:${tempDbPath()}`);

    const res = await app.request("/api/settings/reveal-db", { method: "POST" });

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "No database file yet" });
  });

  test("clearing empties the tables and keeps the file", async () => {
    const filePath = tempDbPath();
    await initDb(`file:${filePath}`);
    ensureDb();
    await runMigrations();

    const res = await app.request("/api/settings/database", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(await json(await app.request("/api/settings/db-path"))).toEqual({
      path: filePath,
      exists: true,
    });
  });

  test("deleting removes the file and leaves nothing to reveal", async () => {
    const filePath = tempDbPath();
    await initDb(`file:${filePath}`);
    ensureDb();
    await runMigrations();

    const res = await app.request("/api/settings/database/file", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(await json(await app.request("/api/settings/db-path"))).toEqual({
      path: filePath,
      exists: false,
    });
  });
});
