import { afterAll, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

const PATHS_MODULE = path.join(import.meta.dir, "paths.ts");

const CHILD = `
require("os").homedir = () => process.env.TEST_HOME;

Object.defineProperty(process, "platform", {
  value: process.env.TEST_PLATFORM,
  configurable: true,
});
const paths = await import(process.env.TEST_MODULE);
const resolved = {};
for (const call of process.env.TEST_CALLS.split(",")) {
  resolved[call] =
    call === "config" ? paths.resolveConfigDir() : paths.resolveDataDir();
}
console.log(JSON.stringify(resolved));
`;

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    fs.chmodSync(root, 0o755);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qoqa-paths-"));
  roots.push(root);
  return root;
}

function resolveIn(
  platform: string,
  home: string,
  env: Record<string, string | undefined> = {},
  calls = "config,data"
): { config: string; data: string } {
  const child = Bun.spawnSync({
    cmd: [process.execPath, "-e", CHILD],
    env: {
      ...process.env,
      APPDATA: undefined,
      XDG_CONFIG_HOME: undefined,
      XDG_DATA_HOME: undefined,
      ...env,
      TEST_HOME: home,
      TEST_PLATFORM: platform,
      TEST_MODULE: PATHS_MODULE,
      TEST_CALLS: calls,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString()) as {
    config: string;
    data: string;
  };
}

function appSupport(home: string): string {
  return path.join(home, "Library", "Application Support");
}

function blockRename(support: string, legacy: string): () => void {
  if (process.platform === "win32") {
    const handle = fs.openSync(path.join(legacy, "settings.json"), "r");
    return () => fs.closeSync(handle);
  }

  fs.chmodSync(support, 0o555);
  return () => fs.chmodSync(support, 0o755);
}

describe("where the app keeps its data on each platform", () => {
  test("names the macOS folder after the app, under Application Support", () => {
    const home = tempRoot();
    const { config, data } = resolveIn("darwin", home);
    expect(config).toBe(path.join(appSupport(home), "QoQa Compta"));
    expect(data).toBe(config);
  });

  test("names the Windows folder after the app, under APPDATA", () => {
    const appdata = tempRoot();
    const { config, data } = resolveIn("win32", appdata, { APPDATA: appdata });
    expect(config).toBe(path.join(appdata, "QoQa Compta"));
    expect(data).toBe(config);
  });

  test("keeps the Windows folder under the home directory when APPDATA is unset", () => {
    const home = tempRoot();
    const { config } = resolveIn("win32", home, {}, "config");
    expect(config).toBe(path.join(home, "QoQa Compta"));
  });

  test("uses the machine-readable name and separate XDG roots on Linux", () => {
    const root = tempRoot();
    const configHome = path.join(root, "config");
    const dataHome = path.join(root, "data");
    const { config, data } = resolveIn("linux", root, {
      XDG_CONFIG_HOME: configHome,
      XDG_DATA_HOME: dataHome,
    });
    expect(config).toBe(path.join(configHome, "qoqa-compta"));
    expect(data).toBe(path.join(dataHome, "qoqa-compta"));
    expect(data).not.toBe(config);
  });

  test("falls back to the XDG default roots when neither variable is set", () => {
    const home = tempRoot();
    const { config, data } = resolveIn("linux", home);
    expect(config).toBe(path.join(home, ".config", "qoqa-compta"));
    expect(data).toBe(path.join(home, ".local", "share", "qoqa-compta"));
  });
});

describe("upgrading from the pre-rename directory", () => {
  test("carries the settings and the database across on macOS", () => {
    const home = tempRoot();
    const legacy = path.join(appSupport(home), "qoqa-compta");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "settings.json"), "kept");
    fs.writeFileSync(path.join(legacy, "qoqa.db"), "kept too");

    const { config, data } = resolveIn("darwin", home);

    expect(config).toBe(path.join(appSupport(home), "QoQa Compta"));
    expect(data).toBe(config);
    expect(fs.readFileSync(path.join(config, "settings.json"), "utf8")).toBe(
      "kept"
    );
    expect(fs.readFileSync(path.join(data, "qoqa.db"), "utf8")).toBe(
      "kept too"
    );
    expect(fs.existsSync(legacy)).toBe(false);
  });

  test("carries the database across on Windows too", () => {
    const appdata = tempRoot();
    const legacy = path.join(appdata, "qoqa-compta");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "qoqa.db"), "kept");

    const { data } = resolveIn("win32", appdata, { APPDATA: appdata });

    expect(data).toBe(path.join(appdata, "QoQa Compta"));
    expect(fs.readFileSync(path.join(data, "qoqa.db"), "utf8")).toBe("kept");
    expect(fs.existsSync(legacy)).toBe(false);
  });

  test("never overwrites a directory the current version already wrote", () => {
    const home = tempRoot();
    const legacy = path.join(appSupport(home), "qoqa-compta");
    const current = path.join(appSupport(home), "QoQa Compta");
    fs.mkdirSync(legacy, { recursive: true });
    fs.mkdirSync(current, { recursive: true });
    fs.writeFileSync(path.join(legacy, "settings.json"), "stale");
    fs.writeFileSync(path.join(current, "settings.json"), "current");

    const { config } = resolveIn("darwin", home, {}, "config");

    expect(config).toBe(current);
    expect(fs.readFileSync(path.join(current, "settings.json"), "utf8")).toBe(
      "current"
    );
    expect(fs.existsSync(legacy)).toBe(true);
  });

  test("moves nothing on Linux, where both names are already the same", () => {
    const root = tempRoot();
    const configHome = path.join(root, "config");
    const dir = path.join(configHome, "qoqa-compta");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "settings.json"), "kept");

    const { config } = resolveIn("linux", root, { XDG_CONFIG_HOME: configHome }, "config");

    expect(config).toBe(dir);
    expect(fs.readFileSync(path.join(config, "settings.json"), "utf8")).toBe(
      "kept"
    );
  });

  test("keeps using the old location rather than losing data it cannot move", () => {
    const home = tempRoot();
    const support = appSupport(home);
    const legacy = path.join(support, "qoqa-compta");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "settings.json"), "kept");
    const unblock = blockRename(support, legacy);

    try {
      const { config } = resolveIn("darwin", home, {}, "config");
      expect(config).toBe(legacy);
      expect(fs.readFileSync(path.join(config, "settings.json"), "utf8")).toBe(
        "kept"
      );
    } finally {
      unblock();
    }
  });
});
