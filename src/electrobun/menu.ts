/// <reference types="bun-types" />
import { ApplicationMenu } from "electrobun/main";
import type { ApplicationMenuItemConfig, BrowserWindow } from "electrobun/main";

const APP_NAME = "QoQa Compta";
const ABOUT_ACTION = "show-about";
const SHOW_ABOUT_JS =
  "window.dispatchEvent(new CustomEvent('qoqa:show-about'))";

const HAS_APPLICATION_MENU = process.platform === "darwin";

function macMenu(): ApplicationMenuItemConfig[] {
  return [
    {
      label: APP_NAME,
      submenu: [
        { label: `About ${APP_NAME}`, action: ABOUT_ACTION },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit", accelerator: "CommandOrControl+Q" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "close", accelerator: "CommandOrControl+W" },
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  ];
}

function showAbout(win: BrowserWindow): void {
  try {
    win.webview.executeJavascript(SHOW_ABOUT_JS);
  } catch (err) {
    console.error("✗ Could not open the About dialog:", err);
  }
}

export function installApplicationMenu(win: BrowserWindow): void {
  if (!HAS_APPLICATION_MENU) {
    return;
  }

  ApplicationMenu.on("application-menu-clicked", (event) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action === ABOUT_ACTION) {
      showAbout(win);
    }
  });

  ApplicationMenu.setApplicationMenu(macMenu());
}
