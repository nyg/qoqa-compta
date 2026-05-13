import { Hono } from "hono";
import { readSettings, writeSettings } from "../settings";
import { reinitDb } from "../db";
import { bootstrapSchema } from "../schema-bootstrap";
import { dropAllTables } from "../schema-bootstrap";
import type { AppSettings } from "../../shared/types";

const router = new Hono();

function maskSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    qoqaPassword: settings.qoqaPassword ? "*****" : null,
  };
}

// GET /api/settings
router.get("/settings", (c) => {
  return c.json(maskSettings(readSettings()));
});

// PUT /api/settings
router.put("/settings", async (c) => {
  try {
    const body = (await c.req.json()) as Partial<AppSettings>;

    const currentSettings = readSettings();
    const dbUrlChanged =
      "databaseUrl" in body && body.databaseUrl !== currentSettings.databaseUrl;

    // Don't overwrite a real password with the mask placeholder
    if (body.qoqaPassword === "*****") {
      delete body.qoqaPassword;
    }

    writeSettings(body);

    if (dbUrlChanged) {
      await reinitDb(body.databaseUrl ?? undefined);
      await bootstrapSchema();
    }

    return c.json(maskSettings(readSettings()));
  } catch (err) {
    console.error("[settings PUT]", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// DELETE /api/settings/database — reset (drop + recreate) all tables
router.delete("/settings/database", async (c) => {
  try {
    await dropAllTables();
    await bootstrapSchema();
    return c.json({ ok: true });
  } catch (err) {
    console.error("[settings/database DELETE]", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default router;
