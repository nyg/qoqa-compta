import { Hono } from "hono";
import path from "path";
import { readSettings, writeSettings, type StoredSettings } from "../settings";
import {
  credentialStores,
  readDatabaseUrl,
  readPassword,
  writeDatabaseUrl,
  writePassword,
} from "../secrets";
import { maskDatabaseUrl, unmaskDatabaseUrl } from "../database-url";
import { reinitDb, getDbFilePath, probeDatabaseUrl } from "../db";
import { runMigrations, dropAllTables } from "../migrate";
import { SECRET_MASK, type AppSettings } from "../../shared/types";

function revealWithSystemFileManager(filePath: string): void {
  const commands: Record<string, string[]> = {
    darwin: ["/usr/bin/open", "-R", filePath],
    win32: ["explorer.exe", `/select,${filePath}`],
  };
  const command = commands[process.platform] ?? ["xdg-open", path.dirname(filePath)];
  Bun.spawnSync({ cmd: command, stdout: "ignore", stderr: "ignore" });
}

export default function settingsRoutes(opts?: {
  revealInFileManager?: (filePath: string) => void;
}) {
  const router = new Hono();

  function maskSettings(
    settings: StoredSettings,
    password: string | null,
    databaseUrl: string | null
  ): AppSettings {
    return {
      ...settings,
      qoqaPassword: password ? SECRET_MASK : null,
      databaseUrl: maskDatabaseUrl(databaseUrl),
    };
  }

  async function currentSettingsResponse(): Promise<AppSettings> {
    const [password, databaseUrl] = await Promise.all([
      readPassword(),
      readDatabaseUrl(),
    ]);
    return maskSettings(readSettings(), password, databaseUrl);
  }

  // GET /api/settings
  router.get("/settings", async (c) => {
    return c.json(await currentSettingsResponse());
  });

  // PUT /api/settings
  router.put("/settings", async (c) => {
    try {
      const { qoqaPassword, databaseUrl, ...updates } =
        (await c.req.json()) as Partial<AppSettings>;

      const storedDatabaseUrl = await readDatabaseUrl();
      const nextDatabaseUrl =
        databaseUrl === undefined
          ? storedDatabaseUrl
          : unmaskDatabaseUrl(databaseUrl, storedDatabaseUrl);
      const dbUrlChanged = nextDatabaseUrl !== storedDatabaseUrl;

      if (dbUrlChanged) {
        try {
          await probeDatabaseUrl(nextDatabaseUrl);
        } catch (err) {
          return c.json({ error: (err as Error).message }, 400);
        }
      }

      // Don't overwrite a real password with the mask placeholder
      if (qoqaPassword !== undefined && qoqaPassword !== SECRET_MASK) {
        await writePassword(qoqaPassword);
      }

      writeSettings(updates);

      if (dbUrlChanged) {
        await writeDatabaseUrl(nextDatabaseUrl);
        await reinitDb(nextDatabaseUrl ?? undefined);
      }

      return c.json(await currentSettingsResponse());
    } catch (err) {
      console.error("[settings PUT]", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // DELETE /api/settings/database — reset (drop + recreate) all tables
  router.delete("/settings/database", async (c) => {
    try {
      await dropAllTables();
      await runMigrations();
      return c.json({ ok: true });
    } catch (err) {
      console.error("[settings/database DELETE]", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // GET /api/settings/db-path — returns current SQLite file path (null for Postgres)
  router.get("/settings/db-path", (c) => {
    return c.json({ path: getDbFilePath() });
  });

  // GET /api/settings/credential-store — where each secret is actually kept
  router.get("/settings/credential-store", async (c) => {
    return c.json(await credentialStores());
  });

  // POST /api/settings/reveal-db — reveal the SQLite file in the system file manager
  router.post("/settings/reveal-db", (c) => {
    const filePath = getDbFilePath();
    if (!filePath) {
      return c.json({ error: "Not using local SQLite" }, 400);
    }

    try {
      if (opts?.revealInFileManager) {
        opts.revealInFileManager(filePath);
      } else {
        revealWithSystemFileManager(filePath);
      }
    } catch (err) {
      console.error("[settings/reveal-db]", err);
      return c.json({ error: (err as Error).message }, 500);
    }

    return c.json({ ok: true });
  });

  return router;
}
