/// <reference types="bun-types" />
import { ApplicationMenu } from "electrobun/main";
import type { ApplicationMenuItemConfig, BrowserWindow } from "electrobun/main";

const APP_NAME = "QoQa Compta";
const ABOUT_ACTION = "show-about";
const SHOW_ABOUT_JS =
  "window.dispatchEvent(new CustomEvent('qoqa:show-about'))";

const HAS_NATIVE_APP_MENU = process.platform === "darwin";

export interface ApplicationMenuController {
  setMenuBarVisible(visible: boolean): void;
}

function aboutItem(): ApplicationMenuItemConfig {
  return { label: `About ${APP_NAME}`, action: ABOUT_ACTION };
}

function macMenu(): ApplicationMenuItemConfig[] {
  return [
    {
      label: APP_NAME,
      submenu: [
        aboutItem(),
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

function toggleableMenu(): ApplicationMenuItemConfig[] {
  return [
    {
      label: "File",
      submenu: [{ role: "quit", label: "Exit", accelerator: "CommandOrControl+Q" }],
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
        { role: "minimize" },
        { role: "zoom" },
        { role: "close", accelerator: "CommandOrControl+W" },
      ],
    },
    {
      label: "Help",
      submenu: [aboutItem()],
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

export function installApplicationMenu(win: BrowserWindow): ApplicationMenuController {
  const menu = HAS_NATIVE_APP_MENU ? macMenu() : toggleableMenu();

  const setMenuBarVisible = (visible: boolean) => {
    ApplicationMenu.setApplicationMenu(visible ? menu : []);
  };

  ApplicationMenu.on("application-menu-clicked", (event) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action !== ABOUT_ACTION) {
      return;
    }
    showAbout(win);
    if (!HAS_NATIVE_APP_MENU) {
      setMenuBarVisible(false);
    }
  });

  setMenuBarVisible(HAS_NATIVE_APP_MENU);

  return {
    setMenuBarVisible: HAS_NATIVE_APP_MENU ? () => {} : setMenuBarVisible,
  };
}
