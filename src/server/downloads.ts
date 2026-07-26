/// <reference types="bun-types" />
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The user's Downloads folder, falling back to the home directory when it does
 * not exist (some Linux setups, localised Windows profiles).
 */
export function downloadsDir(): string {
  const dir = path.join(os.homedir(), "Downloads");
  if (existsSync(dir)) return dir;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** `report.csv` → `report (1).csv` when the name is already taken. */
function uniquePath(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);

  let candidate = path.join(dir, filename);
  for (let i = 1; existsSync(candidate); i++) {
    candidate = path.join(dir, `${stem} (${i})${ext}`);
  }
  return candidate;
}

/**
 * Writes a file to the Downloads folder without prompting, never overwriting an
 * existing file. Returns the path it was saved to.
 */
export async function saveToDownloads(
  filename: string,
  contents: string | Uint8Array
): Promise<string> {
  const filePath = uniquePath(downloadsDir(), filename);
  await Bun.write(filePath, contents);
  return filePath;
}
