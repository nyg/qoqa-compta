/// <reference types="bun-types" />
import { BrowserWindow, app } from "electrobun/bun";
import { createApp } from "../server/app";
import { initDb } from "../server/db";
import { bootstrapSchema } from "../server/schema-bootstrap";

const PORT = 3001;
const DEV_SERVER_URL = "http://localhost:3000";
const VIEWS_URL = "views://main/index.html";

async function resolveUrl(): Promise<string> {
  if (app.channel !== "dev") {
    return VIEWS_URL;
  }
  try {
    await fetch(`${DEV_SERVER_URL}/`, { signal: AbortSignal.timeout(1000) });
    return DEV_SERVER_URL;
  } catch {
    return VIEWS_URL;
  }
}

async function main() {
  const url = await resolveUrl();

  const honoApp = createApp({ corsOrigins: ["views://", "http://localhost:3000"] });

  try {
    await initDb();
    await bootstrapSchema();
    console.log("✓ Database ready");
  } catch (err) {
    console.error("✗ Database initialisation failed:", err);
    process.exit(1);
  }

  Bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    fetch: honoApp.fetch,
    idleTimeout: 0,
  });

  console.log(`✓ API server listening on http://127.0.0.1:${PORT}`);

  const win = new BrowserWindow({ title: "QoQa Compta", url, frame: { x: 0, y: 0, width: 1280, height: 900 } });
  win.maximize();
}

main();
