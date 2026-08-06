declare global {
  interface Window {
    __LOCALES__?: string[];
  }
}

export const FALLBACK_REGION = "CH";

const injected =
  typeof window !== "undefined" && Array.isArray(window.__LOCALES__)
    ? window.__LOCALES__
    : [];

const fromNavigator =
  typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? [...navigator.languages]
      : navigator.language
        ? [navigator.language]
        : [];

export const HOST_LOCALES: string[] = injected.length ? injected : fromNavigator;

function regionOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).region;
  } catch {
    return undefined;
  }
}

function languageOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).language;
  } catch {
    return undefined;
  }
}

export function resolveRegion(
  language: string,
  hostLocales: string[] = HOST_LOCALES
): string {
  const sameLanguage = hostLocales.find(
    (tag) => languageOf(tag) === languageOf(language)
  );
  const source = sameLanguage ?? hostLocales[0];
  return (source ? regionOf(source) : undefined) ?? FALLBACK_REGION;
}
