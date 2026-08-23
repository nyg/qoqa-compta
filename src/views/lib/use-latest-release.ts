import { useEffect, useState } from "react";
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

let pending: Promise<LatestRelease> | null = null;

export interface LatestReleaseState {
  release: LatestRelease | null;
  loading: boolean;
  failed: boolean;
  updateAvailable: boolean;
}

export function useLatestRelease(): LatestReleaseState {
  const [state, setState] = useState<Omit<LatestReleaseState, "updateAvailable">>({
    release: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;

    if (!pending) {
      pending = apiClient.getLatestRelease();
    }

    pending
      .then((release) => {
        if (!cancelled) setState({ release, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ release: null, loading: false, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ...state,
    updateAvailable: state.release
      ? isNewer(state.release.version, APP_VERSION)
      : false,
  };
}
