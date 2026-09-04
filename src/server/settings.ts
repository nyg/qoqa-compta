import fs from "fs";
import path from "path";
import { environmentOverridesEnabled } from "./environment";
import { resolveConfigDir } from "./paths";
import type { AppSettings } from "../shared/types";

export type SecretKey = "qoqaPassword" | "databaseUrl";

export type StoredSettings = Omit<AppSettings, SecretKey>;

const SECRET_KEYS: SecretKey[] = ["qoqaPassword", "databaseUrl"];

const DEFAULTS: StoredSettings = {
  qoqaEmail: null,
  syncLocale: "fr",
};

export function getSettingsPath(): string {
  return path.join(resolveConfigDir(), "settings.json");
}

// The interface language moved to the view. A file written by an earlier version still
// carries it, and spreading the file over DEFAULTS would keep serving it forever, so
// the response shape would depend on how old the install is.
const RETIRED_KEYS = ["uiLocale"];

function readFile(): Record<string, unknown> {
  const settingsPath = getSettingsPath();

  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    // Corrupt or unreadable settings file — fall back to defaults
  }

  return {};
}

function writeFile(contents: Record<string, unknown>): void {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(contents, null, 2), "utf-8");
}

export function readSettings(): StoredSettings {
  const stored = readFile();

  for (const key of [...RETIRED_KEYS, ...SECRET_KEYS]) {
    delete stored[key];
  }

  const settings: StoredSettings = { ...DEFAULTS, ...(stored as Partial<StoredSettings>) };

  if (environmentOverridesEnabled()) {
    if (process.env.QOQA_EMAIL) settings.qoqaEmail = process.env.QOQA_EMAIL;
  }

  return settings;
}

export function writeSettings(updates: Partial<StoredSettings>): void {
  const stored = readFile();

  for (const key of RETIRED_KEYS) {
    delete stored[key];
  }

  writeFile({ ...stored, ...readSettings(), ...updates });
}

export function readStoredSecret(key: SecretKey): string | null {
  const value = readFile()[key];
  return typeof value === "string" && value ? value : null;
}

export function writeStoredSecret(key: SecretKey, value: string | null): void {
  const stored = readFile();

  if (value === null) {
    if (!(key in stored)) return;
    delete stored[key];
  } else {
    stored[key] = value;
  }

  writeFile(stored);
}
