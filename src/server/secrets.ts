import {
  getSettingsPath,
  readStoredSecret,
  writeStoredSecret,
  type SecretKey,
} from "./settings";
import type {
  CredentialStore,
  CredentialStoreKind,
  CredentialStores,
} from "../shared/types";

const SERVICE = process.env.QOQA_KEYCHAIN_SERVICE ?? "io.github.nyg.qoqa-compta";

interface Secret {
  key: SecretKey;
  name: string;
  variable: string;
  label: string;
}

const PASSWORD: Secret = {
  key: "qoqaPassword",
  name: "qoqa-password",
  variable: "QOQA_PASSWORD",
  label: "QoQa password",
};

const DATABASE_URL: Secret = {
  key: "databaseUrl",
  name: "database-url",
  variable: "DATABASE_URL",
  label: "database URL",
};

let reportedUnavailable = false;

function reportUnavailable(action: string, secret: Secret, error: unknown): void {
  if (reportedUnavailable) return;
  reportedUnavailable = true;
  console.warn(
    `Could not ${action} the ${secret.label} in the OS credential store, using settings.json instead:`,
    error instanceof Error ? error.message : error
  );
}

function fromEnvironment(secret: Secret): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  return process.env[secret.variable] || null;
}

async function read(secret: Secret): Promise<string | null> {
  const fromEnv = fromEnvironment(secret);
  if (fromEnv) return fromEnv;

  try {
    const stored = await Bun.secrets.get({ service: SERVICE, name: secret.name });
    if (stored) return stored;
  } catch (error) {
    reportUnavailable("read", secret, error);
  }

  return readStoredSecret(secret.key);
}

async function write(secret: Secret, value: string | null): Promise<void> {
  try {
    if (value === null) {
      await Bun.secrets.delete({ service: SERVICE, name: secret.name });
    } else {
      await Bun.secrets.set({ service: SERVICE, name: secret.name, value });
    }
  } catch (error) {
    reportUnavailable("store", secret, error);
    writeStoredSecret(secret.key, value);
    return;
  }

  writeStoredSecret(secret.key, null);
}

async function migrate(secret: Secret): Promise<void> {
  try {
    const stored = readStoredSecret(secret.key);
    if (!stored) return;

    await Bun.secrets.set({ service: SERVICE, name: secret.name, value: stored });
    writeStoredSecret(secret.key, null);
  } catch (error) {
    reportUnavailable("store", secret, error);
  }
}

function nativeStoreKind(): CredentialStoreKind {
  if (process.platform === "darwin") return "keychain";
  if (process.platform === "win32") return "credential-manager";
  return "keyring";
}

async function storeOf(secret: Secret): Promise<CredentialStore> {
  if (fromEnvironment(secret)) {
    return { kind: "env", path: null, variable: secret.variable };
  }

  const inFile: CredentialStore = {
    kind: "file",
    path: getSettingsPath(),
    variable: null,
  };
  const native: CredentialStore = {
    kind: nativeStoreKind(),
    path: null,
    variable: null,
  };

  try {
    if (await Bun.secrets.get({ service: SERVICE, name: secret.name })) return native;
  } catch {
    return inFile;
  }

  return readStoredSecret(secret.key) === null ? native : inFile;
}

export function readPassword(): Promise<string | null> {
  return read(PASSWORD);
}

export function writePassword(value: string | null): Promise<void> {
  return write(PASSWORD, value);
}

export function readDatabaseUrl(): Promise<string | null> {
  return read(DATABASE_URL);
}

export function writeDatabaseUrl(value: string | null): Promise<void> {
  return write(DATABASE_URL, value);
}

export async function migrateSecretsToCredentialStore(): Promise<void> {
  await migrate(PASSWORD);
  await migrate(DATABASE_URL);
}

export async function credentialStores(): Promise<CredentialStores> {
  const [qoqaPassword, databaseUrl] = await Promise.all([
    storeOf(PASSWORD),
    storeOf(DATABASE_URL),
  ]);
  return { qoqaPassword, databaseUrl };
}
