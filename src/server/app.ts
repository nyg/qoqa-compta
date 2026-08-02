/// <reference types="bun-types" />
import { Hono } from "hono";
import { cors } from "hono/cors";
import dashboardRoutes from "./routes/dashboard";
import ordersRoutes from "./routes/orders";
import syncRoutes from "./routes/sync";
import settingsRoutes from "./routes/settings";

// ── Factory ────────────────────────────────────────────────────────────────────
// In desktop mode pass corsOrigins so the views:// WebView can reach the local
// API server. In web mode the SPA and API share the same origin so CORS is not
// needed. `desktop` also enables the routes that save files to the local
// Downloads folder, which only make sense when server and user share a machine.

export function createApp(opts?: { corsOrigins?: string[]; desktop?: boolean }) {
  const app = new Hono();

  if (opts?.corsOrigins?.length) {
    app.use(
      "/api/*",
      cors({
        origin: (origin) =>
          opts.corsOrigins!.some((o) =>
            o.endsWith("://") ? origin.startsWith(o) : origin === o,
          )
            ? origin
            : null,
      }),
    );
  }

  // ── Request logging ──────────────────────────────────────────────────────────

  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    const status = c.res.status;
    const color = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(`${color}${c.req.method} ${new URL(c.req.url).pathname} → ${status}${reset} (${ms}ms)`);
  });

  // ── API routes ───────────────────────────────────────────────────────────────

  app.route("/api", dashboardRoutes);
  app.route("/api", ordersRoutes({ desktop: opts?.desktop }));
  app.route("/api", syncRoutes);
  app.route("/api", settingsRoutes);

  return app;
}
