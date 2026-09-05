import { existsSync, statSync } from "fs";
import path from "path";
import { allowEnvironmentOverrides } from "./environment";
import { migrateSecretsToCredentialStore } from "./secrets";
import { prepareDatabase } from "./startup";
import { createApp } from "./app";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const IS_PROD = process.env.NODE_ENV === "production";

const app = createApp();

// ── Static file serving (web production only) ─────────────────────────────────
// Vite builds to ./dist; fall back to index.html for SPA client-side routing.
// In desktop mode the SPA is served via views:// by ElectroBun instead.

if (IS_PROD) {
  const DIST = path.resolve("./dist");

  app.get("*", (c) => {
    const url = new URL(c.req.url);
    const filePath = path.join(DIST, url.pathname);

    // Serve the file if it exists and is a regular file (not a directory)
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath));
    }

    // SPA fallback — let the client router handle the path
    return new Response(Bun.file(path.join(DIST, "index.html")));
  });
}

// ── Startup ────────────────────────────────────────────────────────────────────

async function main() {
  allowEnvironmentOverrides();

  await migrateSecretsToCredentialStore();

  await prepareDatabase();

  Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: app.fetch,
    idleTimeout: 0, // SSE streams must not be closed by idle timeout
  });

  console.log(`✓ Server listening on http://${HOST}:${PORT}`);
}

main();
