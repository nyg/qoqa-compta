import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The user's Downloads folder, created when it does not exist yet (some Linux
 * setups, freshly provisioned profiles).
 */
export function downloadsDir(): string {
  const dir = path.join(os.homedir(), "Downloads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

// JXA reaches Foundation, which AppleScript cannot. `com.apple.DownloadFileFinished`
// is the notification browsers post after a download: it makes the Downloads
// stack in the Dock bounce and adds the file to its recent items. The path is
// passed as an argument rather than interpolated into the script.
const DOCK_BOUNCE_JXA =
  'function run(argv) { ObjC.import("Foundation"); ' +
  "$.NSDistributedNotificationCenter.defaultCenter." +
  'postNotificationNameObject("com.apple.DownloadFileFinished", argv[0]); }';

/**
 * Tells the OS a download finished, so the user gets the feedback they would
 * get from a browser. macOS only — Windows toasts need a registered
 * AppUserModelID, so there the in-app "Saved to …" indicator stands alone.
 *
 * Best effort: the file is already written, so a failure here is not worth
 * failing the request over.
 */
function notifyDownloadFinished(filePath: string): void {
  if (process.platform !== "darwin") return;
  try {
    Bun.spawn(["osascript", "-l", "JavaScript", "-e", DOCK_BOUNCE_JXA, filePath], {
      stdout: "ignore",
      stderr: "ignore",
    });
  } catch (err) {
    console.error("[downloads] could not notify the Dock:", err);
  }
}

/**
 * Writes a file to the Downloads folder without prompting, never overwriting an
 * existing file, and notifies the OS. Returns the path it was saved to.
 */
export async function saveToDownloads(
  filename: string,
  contents: string | Uint8Array
): Promise<string> {
  const filePath = uniquePath(downloadsDir(), filename);
  await Bun.write(filePath, contents);
  notifyDownloadFinished(filePath);
  return filePath;
}
