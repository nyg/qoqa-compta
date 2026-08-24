import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// This hook runs after Electrobun assembles the self-extracting .app bundle,
// before the DMG is created. We apply an ad-hoc signature so macOS does not
// report the app as "damaged" when Gatekeeper encounters a linker-signed
// binary inside an otherwise unsigned bundle.
//
// This is only a local/ad-hoc signature. For notarized distribution, set
// `build.mac.codesign = true` and provide ELECTROBUN_DEVELOPER_ID.

const os = process.env.ELECTROBUN_OS;
if (os !== "macos") {
  process.exit(0);
}

const bundlePath = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
if (!bundlePath || !existsSync(bundlePath)) {
  console.error(`postwrap: bundle not found at ${bundlePath ?? "(unset)"}`);
  process.exit(1);
}

const plistPath = join(bundlePath, "Contents", "Info.plist");
const autocloseKey = "LSEnvironment.ELECTROBUN_INSTALLER_UI_AUTOCLOSE";

function plutil(args: string[]) {
  return spawnSync("plutil", args, { encoding: "utf-8" });
}

console.log(`postwrap: setting ${autocloseKey} in ${plistPath}`);

const inserted = plutil([
  "-insert",
  "LSEnvironment",
  "-json",
  '{"ELECTROBUN_INSTALLER_UI_AUTOCLOSE":"1"}',
  "--",
  plistPath,
]);

if (inserted.error) {
  console.error("postwrap: could not run plutil:", inserted.error.message);
  process.exit(1);
}

if (inserted.status !== 0) {
  const replaced = plutil(["-replace", autocloseKey, "-string", "1", "--", plistPath]);

  if (replaced.error) {
    console.error("postwrap: could not run plutil:", replaced.error.message);
    process.exit(1);
  }

  if (replaced.status !== 0) {
    console.error(
      `postwrap: could not set ${autocloseKey}:`,
      (inserted.stderr || "").trim(),
      (replaced.stderr || "").trim()
    );
    process.exit(replaced.status ?? 1);
  }
}

const extracted = plutil([
  "-extract",
  autocloseKey,
  "raw",
  "-expect",
  "string",
  "--",
  plistPath,
]);

if (extracted.status !== 0 || (extracted.stdout || "").trim() !== "1") {
  console.error(
    `postwrap: ${autocloseKey} did not survive the edit:`,
    (extracted.stdout || "").trim() || (extracted.stderr || "").trim()
  );
  process.exit(1);
}

console.log(`postwrap: ad-hoc signing ${bundlePath}`);

const { status, error } = spawnSync(
  "codesign",
  ["--sign", "-", "--deep", "--force", bundlePath],
  { stdio: "inherit" }
);

if (error) {
  console.error("postwrap: could not run codesign:", error.message);
  process.exit(1);
}

if (status !== 0) {
  process.exit(status ?? 1);
}

console.log("postwrap: signing complete");
