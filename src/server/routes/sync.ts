import { Hono } from "hono";
import {
  startSync,
  cancelSync,
  getSyncStatus,
  getSyncEvents,
  subscribeToEvents,
} from "../sync-job";
import { readSettings } from "../settings";
import { readPassword } from "../secrets";
import type { SyncProgressEvent } from "../../shared/types";
import type { SyncOptions } from "../sync";

const router = new Hono();

// POST /api/sync — start a sync job
router.post("/sync", async (c) => {
  const settings = readSettings();
  const password = await readPassword();

  if (!settings.qoqaEmail || !password) {
    return c.json({ error: "QoQa credentials are not configured in settings" }, 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "full" ? "full" : "update";

  const options: SyncOptions = {
    email: settings.qoqaEmail,
    password,
    locale: settings.syncLocale,
    mode,
  };

  const result = startSync(options);
  if (!result.ok) {
    return c.json({ error: result.error }, 409);
  }

  return c.json({ ok: true, mode });
});

// DELETE /api/sync — cancel running sync
router.delete("/sync", (c) => {
  cancelSync();
  return c.json({ ok: true });
});

// GET /api/sync/status
router.get("/sync/status", (c) => {
  return c.json(getSyncStatus());
});

// GET /api/sync/stream — SSE stream of sync progress events
router.get("/sync/stream", () => {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(event: SyncProgressEvent) {
        // Use plain `data:` (no named event type) so EventSource.onmessage fires
        // for every event. The type is embedded in the JSON payload.
        const line = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      function close() {
        cleanup?.();
        cleanup = null;
        try { controller.close(); } catch { /* already closed */ }
      }

      // Replay the ring buffer for new subscribers
      for (const event of getSyncEvents()) {
        enqueue(event);
      }

      // Keep the connection alive every 30 seconds
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(keepAliveTimer);
        }
      }, 30_000);

      // Subscribe to live events
      const unsubscribe = subscribeToEvents((event) => {
        try {
          enqueue(event);
          if (event.type === "done" || event.type === "cancelled" || event.type === "error") {
            close();
          }
        } catch {
          close();
        }
      });

      cleanup = () => {
        clearInterval(keepAliveTimer);
        unsubscribe();
      };
    },
    cancel() {
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export default router;
