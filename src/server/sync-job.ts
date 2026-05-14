import { syncOrders, type SyncOptions } from "./sync";
import type { SyncProgressEvent, SyncStatus } from "../shared/types";

const MAX_EVENTS = 200;

// ── Internal state ─────────────────────────────────────────────────────────────

let _running = false;
let _startedAt: string | undefined;
let _mode: "full" | "update" | undefined;
let _abortController: AbortController | null = null;

const _eventBuffer: SyncProgressEvent[] = [];
const _subscribers = new Set<(event: SyncProgressEvent) => void>();

// ── Helpers ────────────────────────────────────────────────────────────────────

function addEvent(event: SyncProgressEvent): void {
  _eventBuffer.push(event);
  // Evict oldest when buffer is full
  if (_eventBuffer.length > MAX_EVENTS) {
    _eventBuffer.shift();
  }
  for (const sub of _subscribers) {
    try { sub(event); } catch { /* subscriber errors must not crash the job */ }
  }
}

function onJobEnd(): void {
  _running = false;
  _abortController = null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSyncStatus(): SyncStatus {
  return { running: _running, startedAt: _startedAt, mode: _mode };
}

export function getSyncEvents(): SyncProgressEvent[] {
  return [..._eventBuffer];
}

/**
 * Subscribe to new sync events.
 * Returns an unsubscribe function.
 */
export function subscribeToEvents(
  callback: (event: SyncProgressEvent) => void
): () => void {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

/**
 * Start a sync job. Returns `{ ok: false, error }` if one is already running
 * or if options are invalid; otherwise starts the job and returns `{ ok: true }`.
 */
export function startSync(options: SyncOptions): { ok: boolean; error?: string } {
  if (_running) {
    return { ok: false, error: "A sync job is already running" };
  }

  console.log(`[sync] Starting job (mode=${options.mode})`);
  _running = true;
  _startedAt = new Date().toISOString();
  _mode = options.mode;
  _abortController = new AbortController();
  // Clear stale events from any previous sync so new subscribers don't see
  // an old "done" event and close the stream prematurely.
  _eventBuffer.length = 0;

  // Run async; do not await here so the caller gets a response immediately
  syncOrders(options, addEvent, _abortController.signal)
    .then(() => {
      console.log(`[sync] Job finished (mode=${options.mode})`);
    })
    .catch((err) => {
      console.error("[sync] Job error:", err);
      addEvent({
        type: "error",
        message: `Sync failed: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
      });
    })
    .finally(onJobEnd);

  return { ok: true };
}

export function cancelSync(): void {
  _abortController?.abort();
}
