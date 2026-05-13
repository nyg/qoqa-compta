/// <reference types="bun-types" />
import { Hono } from "hono";
import { existsSync, statSync } from "fs";
import path from "path";
import { initDb } from "./db";
import { bootstrapSchema } from "./schema-bootstrap";
import dashboardRoutes from "./routes/dashboard";
import ordersRoutes from "./routes/orders";
import syncRoutes from "./routes/sync";
import settingsRoutes from "./routes/settings";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const IS_PROD = process.env.NODE_ENV === "production";

const app = new Hono();

// ── API routes ─────────────────────────────────────────────────────────────────

app.route("/api", dashboardRoutes);
app.route("/api", ordersRoutes);
app.route("/api", syncRoutes);
app.route("/api", settingsRoutes);

// ── Static file serving (production only) ─────────────────────────────────────
// Vite builds to ./dist; fall back to index.html for SPA client-side routing.

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
    fetch: app.fetch,
    idleTimeout: 0, // SSE streams must not be closed by idle timeout
  });

  console.log(`✓ Server listening on http://localhost:${PORT}`);
}

main();
