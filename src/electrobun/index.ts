/// <reference types="bun-types" />
import { BrowserWindow, BuildConfig, Utils } from "electrobun/main";
import { createApp } from "../server/app";
import { initDb } from "../server/db";
import { bootstrapSchema } from "../server/schema-bootstrap";
import { backfillOrderSubuniverses } from "../server/queries";
import { installApplicationMenu, type ApplicationMenuController } from "./menu";
import { systemLocales } from "./locale";
import { resolveInitialWindowState, trackWindowState } from "./window-state";

const PORT = 3001;
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

  let menu: ApplicationMenuController | null = null;

  const honoApp = createApp({
    corsOrigins: ["views://", "http://localhost:3000"],
    desktop: true,
    onMenuBarVisibility: (visible) => menu?.setMenuBarVisible(visible),
  });

  try {
    await initDb();
    await bootstrapSchema();
    await backfillOrderSubuniverses();
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

  const locales = systemLocales();
  const insetTitleBar = process.platform === "darwin";
  const toggleableMenuBar = process.platform !== "darwin";
  const preload =
    [
      locales.length ? `window.__LOCALES__ = ${JSON.stringify(locales)};` : null,
      insetTitleBar ? "window.__INSET_TITLEBAR__ = true;" : null,
      toggleableMenuBar ? "window.__TOGGLEABLE_MENU_BAR__ = true;" : null,
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
  (win.webview as any).on("new-window-open", (event: any) => {
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

  menu = installApplicationMenu(win);
}

main();
