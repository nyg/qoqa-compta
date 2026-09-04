import { afterAll, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

const SECRETS_MODULE = path.join(import.meta.dir, "secrets.ts");
const SETTINGS_MODULE = path.join(import.meta.dir, "settings.ts");
const ENVIRONMENT_MODULE = path.join(import.meta.dir, "environment.ts");
const SERVICE = `io.github.nyg.qoqa-compta.test.${process.pid}`;
const NAMES = ["qoqa-password", "database-url"];

const CHILD = `
require("os").homedir = () => process.env.TEST_HOME;

if (process.env.TEST_BREAK_CREDENTIAL_STORE) {
  const unavailable = async () => {
    throw new Error("no credential store");
  };
  Bun.secrets = { get: unavailable, set: unavailable, delete: unavailable };
}

const secrets = await import(process.env.TEST_SECRETS_MODULE);
const settings = await import(process.env.TEST_SETTINGS_MODULE);
const environment = await import(process.env.TEST_ENVIRONMENT_MODULE);
const out = {};

for (const step of JSON.parse(process.env.TEST_STEPS)) {
  if (step.op === "webMode") environment.allowEnvironmentOverrides();
  if (step.op === "seed") {
    const settingsPath = settings.getSettingsPath();
    require("fs").mkdirSync(require("path").dirname(settingsPath), { recursive: true });
    require("fs").writeFileSync(settingsPath, JSON.stringify(step.value, null, 2));
  }
  if (step.op === "write") {
    await (step.secret === "databaseUrl" ? secrets.writeDatabaseUrl : secrets.writePassword)(
      step.value ?? null
    );
  }
  if (step.op === "read") {
    out.read = await (step.secret === "databaseUrl"
      ? secrets.readDatabaseUrl()
      : secrets.readPassword());
  }
  if (step.op === "migrate") await secrets.migrateSecretsToCredentialStore();
  if (step.op === "writeSettings") settings.writeSettings(step.value);
  if (step.op === "readEmail") out.email = settings.readSettings().qoqaEmail;
}

const settingsPath = settings.getSettingsPath();
out.file = require("fs").existsSync(settingsPath)
  ? JSON.parse(require("fs").readFileSync(settingsPath, "utf-8"))
  : null;

console.log(JSON.stringify(out));
`;

const roots: string[] = [];

function tempHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "qoqa-secrets-"));
  roots.push(home);
  return home;
}

function seed(value: Record<string, unknown>): Step {
  return { op: "seed", value };
}

type SecretName = "qoqaPassword" | "databaseUrl";

type Step =
  | { op: "seed"; value: Record<string, unknown> }
  | { op: "write"; value: string | null; secret?: SecretName }
  | { op: "read"; secret?: SecretName }
  | { op: "readEmail" }
  | { op: "migrate" }
  | { op: "webMode" }
  | { op: "writeSettings"; value: Record<string, unknown> };

type Result = {
  read?: string | null;
  email?: string | null;
  file: Record<string, unknown> | null;
};

function run(
  home: string,
  steps: Step[],
  env: Record<string, string | undefined> = {}
): Result {
  const child = Bun.spawnSync({
    cmd: [process.execPath, "-e", CHILD],
    env: {
      ...process.env,
      NODE_ENV: undefined,
      QOQA_PASSWORD: undefined,
      QOQA_EMAIL: undefined,
      DATABASE_URL: undefined,
      APPDATA: undefined,
      XDG_CONFIG_HOME: undefined,
      XDG_DATA_HOME: undefined,
      ...env,
      TEST_HOME: home,
      QOQA_KEYCHAIN_SERVICE: SERVICE,
      TEST_SECRETS_MODULE: SECRETS_MODULE,
      TEST_SETTINGS_MODULE: SETTINGS_MODULE,
      TEST_ENVIRONMENT_MODULE: ENVIRONMENT_MODULE,
      TEST_STEPS: JSON.stringify(steps),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString()) as Result;
}

async function credentialStoreWorks(): Promise<boolean> {
  try {
    await Bun.secrets.set({ service: SERVICE, name: "probe", value: "probe" });
    await Bun.secrets.delete({ service: SERVICE, name: "probe" });
    return true;
  } catch {
    return false;
  }
}

const hasCredentialStore = await credentialStoreWorks();

afterAll(async () => {
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  try {
    for (const name of NAMES) {
      await Bun.secrets.delete({ service: SERVICE, name });
    }
    await Bun.secrets.delete({ service: SERVICE, name: "probe" });
  } catch {
    // Nothing to clean up on a host without a credential store
  }
});

describe.skipIf(!hasCredentialStore)("with an OS credential store", () => {
  test("saves the password to the store and keeps it out of settings.json", () => {
    const home = tempHome();
    const { read, file } = run(home, [
      seed({ qoqaEmail: "user@example.com" }),
      { op: "write", value: "s3cret" },
      { op: "read" },
    ]);
    expect(read).toBe("s3cret");
    expect(file).toEqual({ qoqaEmail: "user@example.com" });
  });

  test("moves a password left in settings.json by an earlier version", () => {
    const home = tempHome();
    const { read, file } = run(home, [
      seed({ qoqaEmail: "user@example.com", qoqaPassword: "legacy" }),
      { op: "migrate" },
      { op: "read" },
    ]);
    expect(read).toBe("legacy");
    expect(file).not.toHaveProperty("qoqaPassword");
    expect(file).toMatchObject({ qoqaEmail: "user@example.com" });
  });

  test("clearing the password removes it from the store", () => {
    const home = tempHome();
    const { read } = run(home, [
      { op: "write", value: "s3cret" },
      { op: "write", value: null },
      { op: "read" },
    ]);
    expect(read).toBeNull();
  });

  test("keeps the PostgreSQL URL out of settings.json too", () => {
    const home = tempHome();
    const { read, file } = run(home, [
      seed({ qoqaEmail: "user@example.com" }),
      { op: "write", secret: "databaseUrl", value: "postgresql://u:p@host/db" },
      { op: "read", secret: "databaseUrl" },
    ]);
    expect(read).toBe("postgresql://u:p@host/db");
    expect(file).toEqual({ qoqaEmail: "user@example.com" });
  });

  test("moves both secrets left in settings.json by an earlier version", () => {
    const home = tempHome();
    const { file } = run(home, [
      seed({
        qoqaEmail: "user@example.com",
        qoqaPassword: "legacy",
        databaseUrl: "postgresql://u:p@host/db",
      }),
      { op: "migrate" },
    ]);
    expect(file).toEqual({ qoqaEmail: "user@example.com" });

    expect(run(home, [{ op: "read" }]).read).toBe("legacy");
    expect(run(home, [{ op: "read", secret: "databaseUrl" }]).read).toBe(
      "postgresql://u:p@host/db"
    );
  });

  test("switching back to local SQLite clears the stored URL", () => {
    const home = tempHome();
    const { read } = run(home, [
      { op: "write", secret: "databaseUrl", value: "postgresql://u:p@host/db" },
      { op: "write", secret: "databaseUrl", value: null },
      { op: "read", secret: "databaseUrl" },
    ]);
    expect(read).toBeNull();
  });

  test("saving other settings before the migration runs keeps the password", () => {
    const home = tempHome();
    const { read, file } = run(home, [
      seed({ qoqaEmail: "old@example.com", qoqaPassword: "legacy" }),
      { op: "writeSettings", value: { qoqaEmail: "new@example.com" } },
      { op: "migrate" },
      { op: "read" },
    ]);
    expect(read).toBe("legacy");
    expect(file).toMatchObject({ qoqaEmail: "new@example.com" });
    expect(file).not.toHaveProperty("qoqaPassword");
  });
});

describe("without an OS credential store", () => {
  const broken = { TEST_BREAK_CREDENTIAL_STORE: "1" };

  test("falls back to settings.json so the app keeps working", () => {
    const home = tempHome();
    const { read, file } = run(
      home,
      [seed({ qoqaEmail: "user@example.com" }), { op: "write", value: "s3cret" }, { op: "read" }],
      broken
    );
    expect(read).toBe("s3cret");
    expect(file).toMatchObject({ qoqaPassword: "s3cret" });
  });

  test("leaves a password waiting in settings.json rather than losing it", () => {
    const home = tempHome();
    const { read, file } = run(
      home,
      [seed({ qoqaPassword: "legacy" }), { op: "migrate" }, { op: "read" }],
      broken
    );
    expect(read).toBe("legacy");
    expect(file).toMatchObject({ qoqaPassword: "legacy" });
  });

  test("falls back to settings.json for the PostgreSQL URL as well", () => {
    const home = tempHome();
    const { read, file } = run(
      home,
      [
        { op: "write", secret: "databaseUrl", value: "postgresql://u:p@host/db" },
        { op: "read", secret: "databaseUrl" },
      ],
      broken
    );
    expect(read).toBe("postgresql://u:p@host/db");
    expect(file).toMatchObject({ databaseUrl: "postgresql://u:p@host/db" });
  });

  test("clearing the password removes it from settings.json", () => {
    const home = tempHome();
    const { read, file } = run(
      home,
      [seed({ qoqaPassword: "legacy" }), { op: "write", value: null }, { op: "read" }],
      broken
    );
    expect(read).toBeNull();
    expect(file).not.toHaveProperty("qoqaPassword");
  });
});

describe("the development environment override", () => {
  test("QOQA_PASSWORD wins over anything stored", () => {
    const home = tempHome();
    const { read } = run(home, [seed({ qoqaPassword: "stored" }), { op: "read" }], {
      NODE_ENV: "development",
      QOQA_PASSWORD: "from-env",
      TEST_BREAK_CREDENTIAL_STORE: "1",
    });
    expect(read).toBe("from-env");
  });

  test("DATABASE_URL wins over anything stored", () => {
    const home = tempHome();
    const { read } = run(
      home,
      [seed({ databaseUrl: "postgresql://stored/db" }), { op: "read", secret: "databaseUrl" }],
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://from-env/db",
        TEST_BREAK_CREDENTIAL_STORE: "1",
      }
    );
    expect(read).toBe("postgresql://from-env/db");
  });

  test("is ignored outside development", () => {
    const home = tempHome();
    const { read } = run(home, [seed({ qoqaPassword: "stored" }), { op: "read" }], {
      NODE_ENV: "production",
      QOQA_PASSWORD: "from-env",
      TEST_BREAK_CREDENTIAL_STORE: "1",
    });
    expect(read).toBe("stored");
  });
});

describe("the web entry point in production", () => {
  const production = {
    NODE_ENV: "production",
    QOQA_EMAIL: "env@example.com",
    QOQA_PASSWORD: "from-env",
    DATABASE_URL: "postgresql://from-env/db",
  };

  test("takes the password from the environment once web mode is on", () => {
    const home = tempHome();
    const { read } = run(
      home,
      [seed({ qoqaPassword: "stored" }), { op: "webMode" }, { op: "read" }],
      production
    );
    expect(read).toBe("from-env");
  });

  test("takes the database URL from the environment as well", () => {
    const home = tempHome();
    const { read } = run(
      home,
      [{ op: "webMode" }, { op: "read", secret: "databaseUrl" }],
      production
    );
    expect(read).toBe("postgresql://from-env/db");
  });

  test("takes the email from the environment, over the settings file", () => {
    const home = tempHome();
    const { email } = run(
      home,
      [seed({ qoqaEmail: "file@example.com" }), { op: "webMode" }, { op: "readEmail" }],
      production
    );
    expect(email).toBe("env@example.com");
  });

  test("wins over a password the app has already saved", () => {
    const home = tempHome();
    const { read } = run(
      home,
      [{ op: "write", value: "in-the-store" }, { op: "webMode" }, { op: "read" }],
      production
    );
    expect(read).toBe("from-env");
  });

  test("leaves the desktop shell reading what is stored", () => {
    const home = tempHome();
    const { read, email } = run(
      home,
      [
        seed({ qoqaEmail: "file@example.com", qoqaPassword: "stored" }),
        { op: "read" },
        { op: "readEmail" },
      ],
      { ...production, TEST_BREAK_CREDENTIAL_STORE: "1" }
    );
    expect(read).toBe("stored");
    expect(email).toBe("file@example.com");
  });
});
