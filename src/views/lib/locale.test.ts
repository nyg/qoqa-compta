import { describe, expect, test } from "bun:test";
import { FALLBACK_REGION, resolveRegion } from "./locale";
import { LOCALES, createFormatters, documentLocale } from "./formatters";

const A_DAY = "2024-03-05";

describe("resolving the formatting region from the host", () => {
  test("takes the region from the host locale speaking the interface language", () => {
    expect(resolveRegion("de", ["fr-CA", "de-CH", "en-US"])).toBe("CH");
  });

  test("prefers the language match over the host's first choice", () => {
    expect(resolveRegion("it", ["fr-CA", "it-CH"])).toBe("CH");
  });

  test("matches on language when the interface locale already names a region", () => {
    expect(resolveRegion("de-DE", ["fr-CA", "de-CH"])).toBe("CH");
  });

  test("falls back to the host's first locale when none speaks that language", () => {
    expect(resolveRegion("en", ["fr-CA", "de-DE"])).toBe("CA");
  });

  test("falls back to Switzerland when the host names no region", () => {
    expect(FALLBACK_REGION).toBe("CH");
    expect(resolveRegion("fr", [])).toBe(FALLBACK_REGION);
    expect(resolveRegion("fr", ["fr"])).toBe(FALLBACK_REGION);
  });

  test("falls back to Switzerland rather than throwing on a malformed tag", () => {
    expect(resolveRegion("fr", ["not a language tag"])).toBe(FALLBACK_REGION);
  });
});

describe("Romansh, which Intl has no data the app can use for", () => {
  test("formats money and dates exactly as German does", () => {
    const romansh = createFormatters("rm");
    const german = createFormatters("de");
    expect(romansh.formatDate(A_DAY)).toBe(german.formatDate(A_DAY));
    expect(romansh.formatCHF(1234.5)).toBe(german.formatCHF(1234.5));
    expect(romansh.formatMonth("2024-03")).toBe(german.formatMonth("2024-03"));
  });

  test("borrows German rather than any other shipped language", () => {
    const romansh = createFormatters("rm");
    for (const other of ["fr", "it", "en"]) {
      expect(romansh.formatDate(A_DAY)).not.toBe(
        createFormatters(other).formatDate(A_DAY)
      );
    }
  });

  test("still labels the document Romansh, not German", () => {
    const tag = new Intl.Locale(documentLocale("rm"));
    expect(tag.language).toBe("rm");
    expect(tag.region).toBe(resolveRegion("rm"));
  });
});

describe("formatters for every shipped locale", () => {
  test("reads a YYYY-MM-DD date as that day, whatever the host time zone", () => {
    const formatted = createFormatters("en").formatDate("2024-01-01");
    expect(formatted).toContain("Jan");
    expect(formatted).toContain("2024");
    expect(formatted).not.toContain("Dec");
    expect(formatted).not.toContain("2023");
  });

  test("reads a YYYY-MM month without shifting it", () => {
    const formatted = createFormatters("en").formatMonth("2024-03");
    expect(formatted).toContain("Mar");
    expect(formatted).toContain("2024");
    expect(formatted).not.toContain("Feb");
    expect(formatted).not.toContain("Apr");
  });

  test("gives the calendar a first weekday react-day-picker accepts", () => {
    for (const locale of LOCALES) {
      const { weekStartsOn } = createFormatters(locale).calendar;
      expect(weekStartsOn).toBeGreaterThanOrEqual(0);
      expect(weekStartsOn).toBeLessThanOrEqual(6);
    }
  });

  test("produces every formatter without falling over on any locale", () => {
    for (const locale of LOCALES) {
      const formatters = createFormatters(locale);
      expect(formatters.formatCHF(1234.5)).toContain("CHF");
      expect(formatters.formatPercent(0.25)).toContain("25");
      expect(formatters.formatPercentPrecise(0.256)).toContain("25");
      expect(formatters.formatDecimal(1234.56)).toMatch(/234[.,]6/);
      expect(formatters.formatDateTime("2024-03-05T14:30:00")).toContain(
        "2024"
      );
      expect(
        formatters.calendar.formatters.formatCaption(new Date(2024, 2, 5))
      ).toContain("2024");
    }
  });
});
