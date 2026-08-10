import fs from "fs";
import path from "path";
import { resolveConfigDir } from "./paths";
import type { AppSettings } from "../shared/types";

const DEFAULTS: AppSettings = {
  databaseUrl: null,
  qoqaEmail: null,
  qoqaPassword: null,
  syncLocale: "fr",
};

export function getSettingsPath(): string {
  return path.join(resolveConfigDir(), "settings.json");
}

// The interface language moved to the view. A file written by an earlier version still
// carries it, and spreading the file over DEFAULTS would keep serving it forever, so
// the response shape would depend on how old the install is.
const RETIRED_KEYS = ["uiLocale"];

export function readSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  let stored: Partial<AppSettings> = {};

  try {
    if (fs.existsSync(settingsPath)) {
      stored = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch {
    // Corrupt or unreadable settings file — fall back to defaults
  }

  for (const key of RETIRED_KEYS) {
    delete (stored as Record<string, unknown>)[key];
  }

  const settings: AppSettings = { ...DEFAULTS, ...stored };

  // In development, env vars take precedence over the settings file
  if (process.env.NODE_ENV === "development") {
    if (process.env.DATABASE_URL) settings.databaseUrl = process.env.DATABASE_URL;
    if (process.env.QOQA_EMAIL) settings.qoqaEmail = process.env.QOQA_EMAIL;
    if (process.env.QOQA_PASSWORD) settings.qoqaPassword = process.env.QOQA_PASSWORD;
  }

  return settings;
}

export function writeSettings(updates: Partial<AppSettings>): void {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const merged: AppSettings = { ...readSettings(), ...updates };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf-8");
}
