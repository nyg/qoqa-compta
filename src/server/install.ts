import fs from "fs";
import path from "path";
import type { InstallInfo, InstallPlatform } from "../shared/types";

const CASK_TOKEN = "qoqa-compta";
const SCOOP_APPS_PATH = /[\\/]scoop[\\/]apps[\\/]/i;
const HOMEBREW_PREFIXES = ["/opt/homebrew", "/usr/local"];

function currentPlatform(): InstallPlatform {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "other";
}

function hasHomebrewCaskEntry(): boolean {
  const prefixes = [process.env.HOMEBREW_PREFIX, ...HOMEBREW_PREFIXES].filter(
    (prefix): prefix is string => Boolean(prefix)
  );

  return prefixes.some((prefix) =>
    fs.existsSync(path.join(prefix, "Caskroom", CASK_TOKEN))
  );
}

function detect(desktop: boolean): InstallInfo {
  const platform = currentPlatform();

  if (!desktop) return { platform, method: "web" };
  if (platform === "windows" && SCOOP_APPS_PATH.test(process.execPath)) {
    return { platform, method: "scoop" };
  }
  if (platform === "macos" && hasHomebrewCaskEntry()) {
    return { platform, method: "homebrew" };
  }
  return { platform, method: "manual" };
}

let cached: InstallInfo | null = null;

export function installInfo(desktop: boolean): InstallInfo {
  if (!cached) cached = detect(desktop);
  return cached;
}
