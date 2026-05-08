import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { parseAcceptLanguage } from "@/lib/formatters";

const SUPPORTED_LOCALES = ["en", "de", "fr", "it", "rm"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Extract the base language tag from a full locale string.
 * e.g. "fr-CH" → "fr", "de-DE" → "de", "rm" → "rm"
 */
function extractLanguage(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

/**
 * Map a raw locale string to the nearest supported locale tag.
 * Falls back to "en" if no match is found.
 */
export function resolveLocale(rawLocale: string): SupportedLocale {
  const lang = extractLanguage(rawLocale);
  if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
    return lang as SupportedLocale;
  }
  return "en";
}

export default getRequestConfig(async () => {
  const hdrs = await headers();
  const rawLocale = parseAcceptLanguage(hdrs.get("accept-language"));
  const locale = resolveLocale(rawLocale);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
