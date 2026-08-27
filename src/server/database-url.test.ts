import { describe, expect, test } from "bun:test";
import { maskDatabaseUrl, unmaskDatabaseUrl } from "./database-url";

const REAL = "postgresql://user:s3cret@ep-x.eu-central-1.aws.neon.tech/qoqa?sslmode=require";
const MASKED = "postgresql://user:*****@ep-x.eu-central-1.aws.neon.tech/qoqa?sslmode=require";

describe("maskDatabaseUrl", () => {
  test("hides the password and leaves the rest of the URL readable", () => {
    expect(maskDatabaseUrl(REAL)).toBe(MASKED);
  });

  test("leaves a URL without a password alone", () => {
    expect(maskDatabaseUrl("postgresql://user@host/db")).toBe("postgresql://user@host/db");
  });

  test("passes a value it cannot parse through untouched", () => {
    expect(maskDatabaseUrl("not a url")).toBe("not a url");
  });

  test("has nothing to mask when no database is configured", () => {
    expect(maskDatabaseUrl(null)).toBeNull();
  });
});

describe("unmaskDatabaseUrl", () => {
  test("restores the stored password when the mask comes back unedited", () => {
    expect(unmaskDatabaseUrl(MASKED, REAL)).toBe(REAL);
  });

  test("keeps the stored password when only the host was edited", () => {
    expect(
      unmaskDatabaseUrl("postgresql://user:*****@other.host/qoqa", REAL)
    ).toBe("postgresql://user:s3cret@other.host/qoqa");
  });

  test("takes a retyped password as the new one", () => {
    expect(unmaskDatabaseUrl("postgresql://user:new@host/db", REAL)).toBe(
      "postgresql://user:new@host/db"
    );
  });

  test("keeps the mask verbatim when nothing is stored to restore from", () => {
    expect(unmaskDatabaseUrl(MASKED, null)).toBe(MASKED);
  });

  test("passes through a cleared URL and an unparsable one", () => {
    expect(unmaskDatabaseUrl(null, REAL)).toBeNull();
    expect(unmaskDatabaseUrl("not a url", REAL)).toBe("not a url");
  });
});
