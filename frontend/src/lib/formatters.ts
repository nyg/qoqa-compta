/**
 * Locale-aware formatters for the Qoqa Compta dashboard.
 *
 * On the server the locale is derived from the Accept-Language header.
 * On the client the same value is reused via FormatterContext so that
 * SSR and hydration always match.
 */

const DEFAULT_LOCALE = "fr-CH";

/**
 * Parse an Accept-Language header and return the preferred locale.
 * Falls back to DEFAULT_LOCALE if the header is missing or empty.
 */
export function parseAcceptLanguage(header: string | null): string {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",")[0];
  const locale = first.split(";")[0].trim();
  return locale || DEFAULT_LOCALE;
}

/** Create a set of locale-bound formatter functions. */
export function createFormatters(locale: string) {
  const chf = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // 0-decimal CHF used for compact chart axis ticks
  const chfAxis = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const decimal = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const monthYearFormatter = new Intl.DateTimeFormat(locale, {
    year: "2-digit",
    month: "short",
  });

  return {
    /** Full CHF amount with 2 decimal places (e.g. "CHF 1'299.00" or "1 299,00 CHF"). */
    formatCHF: (amount: number) => chf.format(amount),

    /** CHF amount rounded to 0 decimals for chart Y-axis ticks. */
    formatCHFAxis: (amount: number) => chfAxis.format(amount),

    /** Locale-formatted integer (no fractions) — used for order-count axis. */
    formatDecimal: (value: number) => decimal.format(value),

    /** ISO date string → locale short date (e.g. "4 mai 2026" or "May 4, 2026"). */
    formatDate: (isoDate: string) =>
      dateFormatter.format(new Date(isoDate)).replace(" ", "\u00A0"),

    /** "YYYY-MM" string → short month + year label (e.g. "mai 26" or "May 26"). */
    formatMonth: (ym: string) => {
      const [year, month] = ym.split("-");
      return monthYearFormatter
        .format(new Date(parseInt(year), parseInt(month) - 1, 1))
        .replace(" ", "\u00A0");
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
