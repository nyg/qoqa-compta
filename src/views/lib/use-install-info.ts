import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { InstallInfo } from "../../shared/types";

let cached: InstallInfo | null = null;
let pending: Promise<InstallInfo> | null = null;

export function useInstallInfo(): InstallInfo | null {
  const [info, setInfo] = useState<InstallInfo | null>(cached);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;
    pending ??= apiClient.getInstallInfo();
    pending
      .then((resolved) => {
        cached = resolved;
        if (!cancelled) setInfo(resolved);
      })
      .catch(() => {
        pending = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
