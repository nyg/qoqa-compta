import fs from "fs";
import path from "path";
import os from "os";

// macOS and Windows name application data folders after the app as the user sees
// it; the XDG spec wants a lowercase, machine-readable name. Both used to be
// "qoqa-compta", which migrateLegacyDir moves away from on macOS and Windows.
const APP_DIR_NAME =
  process.platform === "darwin" || process.platform === "win32"
    ? "QoQa Compta"
    : "qoqa-compta";

const LEGACY_DIR_NAME = "qoqa-compta";

// Both directory helpers are parameterized by name so the legacy location
// resolves through the same platform switch as the current one.
function configDirIn(name: string): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", name);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), name);
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    name
  );
}

function dataDirIn(name: string): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", name);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), name);
  }
  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
    name
  );
}

// Move the pre-rename directory across, so an upgrade keeps the synced orders and
// saved settings instead of silently starting from an empty database. Returns
// the directory to use: the legacy one if it exists but could not be moved
// (read-only parent, open handle, separate volume) — losing the data would be
// worse than an unfashionable path.
function migrateLegacyDir(dir: string, legacy: string): string {
  // Under XDG both names are already "qoqa-compta", so there is nothing to move.
  if (legacy === dir || fs.existsSync(dir) || !fs.existsSync(legacy)) {
    return dir;
  }
  try {
    fs.renameSync(legacy, dir);
    return dir;
  } catch (error) {
    console.warn(
      `Could not move ${legacy} to ${dir}, keeping the old location:`,
      error instanceof Error ? error.message : error
    );
    return legacy;
  }
}

// On macOS and Windows these two resolve to the same directory, so whichever runs
// first performs the single rename that carries settings.json and qoqa.db across;
// the other then sees the new directory already there and returns it.
export function resolveConfigDir(): string {
  return migrateLegacyDir(
    configDirIn(APP_DIR_NAME),
    configDirIn(LEGACY_DIR_NAME)
  );
}

export function resolveDataDir(): string {
  return migrateLegacyDir(dataDirIn(APP_DIR_NAME), dataDirIn(LEGACY_DIR_NAME));
}
