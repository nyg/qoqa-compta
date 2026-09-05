import { describe, expect, test } from "bun:test";
import { authFailureMessage } from "./auth";

const REJECTED_LOGIN = JSON.stringify({
  errors: [
    {
      code: 4,
      title: "Il y a eu un problème",
      detail: "Login ou mot de passe incorrect.",
      meta: null,
    },
  ],
});

describe("the message a failed login carries", () => {
  test("is the sentence QoQa wrote, not the response around it", () => {
    expect(authFailureMessage(401, REJECTED_LOGIN)).toBe(
      "Login ou mot de passe incorrect."
    );
  });

  test("falls back to the error title when there is no detail", () => {
    const body = JSON.stringify({ errors: [{ title: "Il y a eu un problème" }] });
    expect(authFailureMessage(401, body)).toBe("Il y a eu un problème");
  });

  test("keeps the response when it is not the documented error shape", () => {
    expect(authFailureMessage(502, "<html>Bad gateway</html>")).toBe(
      "HTTP 502 — <html>Bad gateway</html>"
    );
    expect(authFailureMessage(500, JSON.stringify({ errors: [] }))).toBe(
      'HTTP 500 — {"errors":[]}'
    );
  });

  test("names the status alone when the body is empty", () => {
    expect(authFailureMessage(503, "   ")).toBe("HTTP 503");
  });

  test("truncates a response long enough to flood the sync log", () => {
    expect(authFailureMessage(500, "x".repeat(5000))).toHaveLength(
      "HTTP 500 — ".length + 200
    );
  });
});
