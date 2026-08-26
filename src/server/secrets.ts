import { getSettingsPath, readStoredPassword, writeStoredPassword } from "./settings";
import type { CredentialStore, CredentialStoreKind } from "../shared/types";

const SERVICE = process.env.QOQA_KEYCHAIN_SERVICE ?? "io.github.nyg.qoqa-compta";
const NAME = "qoqa-password";

let reportedUnavailable = false;

function reportUnavailable(action: string, error: unknown): void {
  if (reportedUnavailable) return;
  reportedUnavailable = true;
  console.warn(
    `Could not ${action} the QoQa password in the OS credential store, using settings.json instead:`,
    error instanceof Error ? error.message : error
  );
}

export async function readPassword(): Promise<string | null> {
  if (process.env.NODE_ENV === "development" && process.env.QOQA_PASSWORD) {
    return process.env.QOQA_PASSWORD;
  }

  try {
    const stored = await Bun.secrets.get({ service: SERVICE, name: NAME });
    if (stored) return stored;
  } catch (error) {
    reportUnavailable("read", error);
  }

  return readStoredPassword();
}

export async function writePassword(value: string | null): Promise<void> {
  try {
    if (value === null) {
      await Bun.secrets.delete({ service: SERVICE, name: NAME });
    } else {
      await Bun.secrets.set({ service: SERVICE, name: NAME, value });
    }
  } catch (error) {
    reportUnavailable("store", error);
    writeStoredPassword(value);
    return;
  }

  writeStoredPassword(null);
}

export async function migratePasswordToKeychain(): Promise<void> {
  try {
    const stored = readStoredPassword();
    if (!stored) return;

    await Bun.secrets.set({ service: SERVICE, name: NAME, value: stored });
    writeStoredPassword(null);
  } catch (error) {
    reportUnavailable("store", error);
  }
}

function nativeStoreKind(): CredentialStoreKind {
  if (process.platform === "darwin") return "keychain";
  if (process.platform === "win32") return "credential-manager";
  return "keyring";
}

export async function credentialStore(): Promise<CredentialStore> {
  if (process.env.NODE_ENV === "development" && process.env.QOQA_PASSWORD) {
    return { kind: "env", path: null };
  }

  const inFile: CredentialStore = { kind: "file", path: getSettingsPath() };

  try {
    if (await Bun.secrets.get({ service: SERVICE, name: NAME })) {
      return { kind: nativeStoreKind(), path: null };
    }
  } catch {
    return inFile;
  }

  return readStoredPassword() === null ? { kind: nativeStoreKind(), path: null } : inFile;
}
