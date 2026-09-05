import { describe, expect, test } from "bun:test";
import { SYNC_MESSAGE_KEYS } from "../../shared/types";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import de from "./messages/de.json";
import it from "./messages/it.json";
import rm from "./messages/rm.json";

const TRANSLATIONS = { fr, de, it, rm };

type Namespaces = Record<string, Record<string, string>>;

function namespaces(file: unknown): Namespaces {
  return file as Namespaces;
}

describe("the message files", () => {
  test("carry every sync log key the server can emit", () => {
    for (const [language, file] of Object.entries({ en, ...TRANSLATIONS })) {
      const syncLog = namespaces(file).SyncLog ?? {};
      const missing = SYNC_MESSAGE_KEYS.filter((key) => !(key in syncLog));
      expect(`${language}: ${missing.join(", ")}`).toBe(`${language}: `);
    }
  });

  test("hold the same keys in every language", () => {
    const reference = namespaces(en);

    for (const [language, file] of Object.entries(TRANSLATIONS)) {
      const translated = namespaces(file);
      expect(Object.keys(translated).sort()).toEqual(Object.keys(reference).sort());

      for (const [namespace, messages] of Object.entries(reference)) {
        expect({
          language,
          namespace,
          keys: Object.keys(translated[namespace] ?? {}).sort(),
        }).toEqual({ language, namespace, keys: Object.keys(messages).sort() });
      }
    }
  });
});
