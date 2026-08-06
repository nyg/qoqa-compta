import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { SyncProgressEvent } from "../../shared/types";

export type SyncMode = "full" | "update";

export interface SyncLogEntry {
  type: SyncProgressEvent["type"];
  message: string;
  timestamp: string;
}

export interface SyncStats {
  synced: number;
  skipped: number;
  withPdf: number;
  errors: number;
}

const EMPTY_STATS: SyncStats = { synced: 0, skipped: 0, withPdf: 0, errors: 0 };

/**
 * Drives a sync job and its progress stream. A single instance is shared by the
 * header shortcut and the settings dialog so both show the same run.
 */
export function useSyncRunner(onComplete?: () => void) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [stats, setStats] = useState<SyncStats>(EMPTY_STATS);
  const esRef = useRef<EventSource | null>(null);
  // Mirrors `running` so the callbacks below keep a stable identity.
  const runningRef = useRef(false);

  // Keep the callback fresh without restarting the stream.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setDone(true);
  }, []);

  const start = useCallback(
    async (mode: SyncMode) => {
      if (runningRef.current) return;

      runningRef.current = true;
      setRunning(true);
      setDone(false);
      setLog([]);
      setStats(EMPTY_STATS);

      try {
        await apiClient.startSync(mode);
      } catch (e) {
        setLog([
          {
            type: "error",
            message: e instanceof Error ? e.message : String(e),
            timestamp: new Date().toISOString(),
          },
        ]);
        runningRef.current = false;
        setRunning(false);
        setDone(true);
        return;
      }

      const es = apiClient.createSyncEventSource();
      esRef.current = es;

      es.onmessage = (event) => {
        let parsed: SyncProgressEvent;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }

        setLog((prev) => [
          ...prev,
          { type: parsed.type, message: parsed.message, timestamp: parsed.timestamp },
        ]);

        if (parsed.type === "order_synced") {
          setStats((prev) => ({
            ...prev,
            synced: prev.synced + 1,
            withPdf: prev.withPdf + (parsed.data?.hasPdf ? 1 : 0),
          }));
        } else if (parsed.type === "order_skipped") {
          setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
        } else if (parsed.type === "order_error") {
          setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
        }

        if (parsed.type === "done" || parsed.type === "error" || parsed.type === "cancelled") {
          // Prefer the authoritative final stats from the server payload
          if (parsed.data && "synced" in parsed.data) {
            setStats({
              synced: Number(parsed.data.synced ?? 0),
              withPdf: Number(parsed.data.withPdf ?? 0),
              skipped: Number(parsed.data.skipped ?? 0),
              errors: Number(parsed.data.errors ?? 0),
            });
          }
          closeStream();
          if (parsed.type === "done") onCompleteRef.current?.();
        }
      };

      es.onerror = closeStream;
    },
    [closeStream]
  );

  const cancel = useCallback(async () => {
    try {
      await apiClient.cancelSync();
    } catch (e) {
      console.error(e);
    } finally {
      closeStream();
    }
  }, [closeStream]);

  return { running, done, log, stats, start, cancel };
}

export type SyncRunner = ReturnType<typeof useSyncRunner>;
