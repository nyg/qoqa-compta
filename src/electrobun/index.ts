import {
  BrowserWindow,
  BuildConfig,
  Utils,
  type BrowserView,
  type ElectrobunEvent,
} from "electrobun/main";
import { createApp } from "../server/app";
import { initDb } from "../server/db";
import { runMigrations } from "../server/migrate";
import { backfillOrderSubuniverses } from "../server/queries";
import { installApplicationMenu } from "./menu";
import { systemLocales } from "./locale";
import { resolveInitialWindowState, trackWindowState } from "./window-state";

type NewWindowOpenEvent = ElectrobunEvent<
  { detail?: string | { url?: string } },
  unknown
>;

type NewWindowOpenEmitter = BrowserView & {
  on(
    name: "new-window-open",
    handler: (event: NewWindowOpenEvent) => void
  ): void;
};

const DEV_API_PORT = 3001;
const DEV_SERVER_URL = "http://localhost:3000";
const VIEWS_URL = "views://main/index.html";

async function resolveUrl(): Promise<string> {
  if (BuildConfig.getSync().channel !== "dev") {
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

  const honoApp = createApp({
    corsOrigins: ["views://", "http://localhost:3000"],
    desktop: true,
  });

  try {
    await initDb();
    await runMigrations();
    await backfillOrderSubuniverses();
    console.log("✓ Database ready");
  } catch (err) {
    console.error("✗ Database initialisation failed:", err);
    process.exit(1);
  }

  const server = Bun.serve({
    port: url === DEV_SERVER_URL ? DEV_API_PORT : 0,
    hostname: "127.0.0.1",
    fetch: honoApp.fetch,
    idleTimeout: 0,
  });

  console.log(`✓ API server listening on http://127.0.0.1:${server.port}`);

  const locales = systemLocales();
  const insetTitleBar = process.platform === "darwin";
  const preload =
    [
      `window.__API_PORT__ = ${server.port};`,
      locales.length ? `window.__LOCALES__ = ${JSON.stringify(locales)};` : null,
      insetTitleBar ? "window.__INSET_TITLEBAR__ = true;" : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  const initialWindowState = resolveInitialWindowState();
  const maximizeBeforeShow = process.platform !== "win32";

  const win = new BrowserWindow({
    title: "QoQa Compta",
    url,
    preload,
    frame: initialWindowState.frame,
    hidden: true,
    titleBarStyle: insetTitleBar ? "hiddenInset" : "default",
  });

  // Open target="_blank" links in the default system browser instead of the WebView.
  const webviewEvents = win.webview as NewWindowOpenEmitter;
  webviewEvents.on("new-window-open", (event) => {
    const detail = event?.data?.detail;
    const href: string | undefined = typeof detail === "string" ? detail : detail?.url;
    if (href) {
      Utils.openExternal(href);
    }
  });

  trackWindowState(win, initialWindowState);

  const restoreMaximized = () => {
    try {
      if (initialWindowState.maximized && !win.isMaximized()) {
        win.maximize();
      }
    } catch (err) {
      console.error("✗ Could not restore the maximized window state:", err);
    }
  };

  if (!maximizeBeforeShow) {
    win.show();
    restoreMaximized();
  } else {
    restoreMaximized();
    win.show();
  }

  installApplicationMenu(win);
}

main();
