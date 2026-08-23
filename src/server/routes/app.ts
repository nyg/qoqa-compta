import { Hono } from "hono";
import type { LatestRelease } from "../../shared/types";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/nyg/qoqa-compta/releases/latest";
const RELEASES_URL = "https://github.com/nyg/qoqa-compta/releases/latest";
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

interface CacheEntry {
  expiresAt: number;
  release?: LatestRelease;
  error?: string;
}

let cached: CacheEntry | null = null;

async function fetchLatestRelease(): Promise<LatestRelease> {
  const res = await fetch(LATEST_RELEASE_URL, {
    headers: { accept: "application/vnd.github+json", "user-agent": "qoqa-compta" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`GitHub answered ${res.status}`);
  }

  const release = (await res.json()) as { tag_name?: string; html_url?: string };
  const version = String(release.tag_name ?? "").replace(/^v/, "");

  if (!version) {
    throw new Error("the latest release has no tag name");
  }

  return { version, url: release.html_url || RELEASES_URL };
}

export default function appRouter() {
  const router = new Hono();

  router.get("/app/latest-release", async (c) => {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.release
        ? c.json(cached.release)
        : c.json({ error: cached.error }, 502);
    }

    try {
      const release = await fetchLatestRelease();
      cached = { release, expiresAt: Date.now() + SUCCESS_TTL_MS };
      return c.json(release);
    } catch (err) {
      console.warn("[app/latest-release]", (err as Error).message);
      cached = {
        error: "Could not check for updates.",
        expiresAt: Date.now() + FAILURE_TTL_MS,
      };
      return c.json({ error: cached.error }, 502);
    }
  });

  return router;
}
