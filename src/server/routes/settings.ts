import { Hono } from "hono";
import path from "path";
import { readSettings, writeSettings, type StoredSettings } from "../settings";
import { credentialStore, readPassword, writePassword } from "../secrets";
import { reinitDb, getDbFilePath } from "../db";
import { runMigrations, dropAllTables } from "../migrate";
import type { AppSettings } from "../../shared/types";

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

  function maskSettings(settings: StoredSettings, password: string | null): AppSettings {
    return { ...settings, qoqaPassword: password ? "*****" : null };
  }

  async function currentSettingsResponse(): Promise<AppSettings> {
    return maskSettings(readSettings(), await readPassword());
  }

  // GET /api/settings
  router.get("/settings", async (c) => {
    return c.json(await currentSettingsResponse());
  });

  // PUT /api/settings
  router.put("/settings", async (c) => {
    try {
      const { qoqaPassword, ...updates } = (await c.req.json()) as Partial<AppSettings>;

      const currentSettings = readSettings();
      const dbUrlChanged =
        "databaseUrl" in updates && updates.databaseUrl !== currentSettings.databaseUrl;

      // Don't overwrite a real password with the mask placeholder
      if (qoqaPassword !== undefined && qoqaPassword !== "*****") {
        await writePassword(qoqaPassword);
      }

      writeSettings(updates);

      if (dbUrlChanged) {
        await reinitDb(updates.databaseUrl ?? undefined);
        await runMigrations();
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

  // GET /api/settings/credential-store — where the QoQa password is actually kept
  router.get("/settings/credential-store", async (c) => {
    return c.json(await credentialStore());
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
