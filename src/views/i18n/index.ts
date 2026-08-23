import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./messages/en.json";
import fr from "./messages/fr.json";
import de from "./messages/de.json";
import it from "./messages/it.json";
import rm from "./messages/rm.json";

const NAMESPACES = [
  "Dashboard",
  "StatsCards",
  "OrdersTable",
  "PdfDialog",
  "UniversePicker",
  "SpendingChart",
  "DateRangePicker",
  "Settings",
  "About",
] as const;

type MessageFile = typeof en;

const resources = Object.fromEntries(
  (
    [
      ["en", en],
      ["fr", fr],
      ["de", de],
      ["it", it],
      ["rm", rm],
    ] as [string, MessageFile][]
  ).map(([lang, msgs]) => [
    lang,
    Object.fromEntries(
      NAMESPACES.map((ns) => [ns, (msgs as Record<string, unknown>)[ns] ?? {}])
    ),
  ])
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "fr", "de", "it", "rm"],
    defaultNS: "Dashboard",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "qoqa-compta-language",
    },
  });

export default i18n;
export type SupportedLocale = "en" | "fr" | "de" | "it" | "rm";
export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "fr", "de", "it", "rm"];
