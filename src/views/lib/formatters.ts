export const LOCALES = ["fr", "de", "it", "rm", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const RM_INTL_LOCALE = "de-CH"; // Romansh falls back to de-CH for Intl

export type Formatters = {
  formatCHF: (value: number) => string;
  formatCHFAxis: (value: number) => string;
  formatDecimal: (value: number) => string;
  formatDate: (value: string | Date) => string;
  formatMonth: (yearMonth: string) => string;
};

export function createFormatters(locale: string): Formatters {
  const intlLocale = locale === "rm" ? RM_INTL_LOCALE : locale;
  const currencyFmt = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 2,
  });
  const axisFmt = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "CHF",
    notation: "compact",
    maximumFractionDigits: 0,
  });
  const decimalFmt = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 1,
  });
  const dateFmt = new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const monthFmt = new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
  });
  return {
    formatCHF: (v) => currencyFmt.format(v),
    formatCHFAxis: (v) => axisFmt.format(v),
    formatDecimal: (v) => decimalFmt.format(v),
    formatDate: (v) =>
      dateFmt.format(typeof v === "string" ? new Date(v + "T00:00:00") : v),
    formatMonth: (ym) => {
      const [y, m] = ym.split("-");
      return monthFmt.format(new Date(Number(y), Number(m) - 1, 1));
    },
  };
}
