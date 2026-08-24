import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiClient } from "@/lib/api-client";
import type { LatestRelease } from "../../shared/types";

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "";

function segments(version: string): number[] {
  return version
    .split("-")[0]
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
}

export function isNewer(candidate: string, current: string): boolean {
  if (!candidate || !current) return false;

  const left = segments(candidate);
  const right = segments(current);

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference > 0;
  }

  return !candidate.includes("-") && current.includes("-");
}

export interface LatestReleaseState {
  release: LatestRelease | null;
  loading: boolean;
  failed: boolean;
  updateAvailable: boolean;
  checkedAt: string | null;
}

const INITIAL: LatestReleaseState = {
  release: null,
  loading: false,
  failed: false,
  updateAvailable: false,
  checkedAt: null,
};

let state = INITIAL;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<LatestReleaseState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): LatestReleaseState {
  return state;
}

function check(refresh: boolean): Promise<void> {
  if (inFlight) return inFlight;

  publish({ loading: true });
  inFlight = apiClient
    .getLatestRelease(refresh)
    .then((release) => {
      publish({
        release,
        loading: false,
        failed: false,
        updateAvailable: isNewer(release.version, APP_VERSION),
        checkedAt: release.checkedAt,
      });
    })
    .catch(() => {
      publish({
        release: null,
        loading: false,
        failed: true,
        updateAvailable: false,
        checkedAt: new Date().toISOString(),
      });
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export interface LatestReleaseHandle extends LatestReleaseState {
  check: () => void;
}

export function useLatestRelease(): LatestReleaseHandle {
  const current = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    if (!state.checkedAt && !state.loading) void check(false);
  }, []);

  const recheck = useCallback(() => {
    void check(true);
  }, []);

  return { ...current, check: recheck };
}
