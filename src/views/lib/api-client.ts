import type {
  CredentialStores,
  DashboardData,
  InstallInfo,
  LatestRelease,
  OrdersResponse,
  SyncStatus,
  AppSettings,
} from "../../shared/types";

declare global {
  interface Window {
    __API_PORT__?: number;
  }
}

// In desktop production the SPA is loaded from views://main/index.html and
// needs an absolute URL to reach the local Hono server, whose port is picked at
// startup and injected by the preload. In web mode (dev or production) the SPA
// and API share the same origin so a relative path works.
const API_BASE =
  window.location.protocol === "views:"
    ? `http://127.0.0.1:${window.__API_PORT__ ?? 3001}`
    : "";

function errorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed.error === "string" && parsed.error ? parsed.error : null;
  } catch {
    return null;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(errorMessage(text) ?? `${res.status} ${text}`);
  }
  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  getDashboard(params: {
    universes?: string[];
    subuniverses?: string[];
    from?: string;
    to?: string;
  }): Promise<DashboardData> {
    const p = new URLSearchParams();
    if (params.universes?.length) p.set("universes", params.universes.join(","));
    if (params.subuniverses?.length)
      p.set("subuniverses", params.subuniverses.join(","));
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    const qs = p.toString();
    return request<DashboardData>(`${API_BASE}/api/dashboard${qs ? `?${qs}` : ""}`);
  },

  getOrders(params: {
    universes?: string[];
    subuniverses?: string[];
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<OrdersResponse> {
    const p = new URLSearchParams();
    if (params.universes?.length) p.set("universes", params.universes.join(","));
    if (params.subuniverses?.length)
      p.set("subuniverses", params.subuniverses.join(","));
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    if (params.search) p.set("search", params.search);
    if (params.page != null) p.set("page", params.page.toString());
    if (params.pageSize != null) p.set("pageSize", params.pageSize.toString());
    const qs = p.toString();
    return request<OrdersResponse>(`${API_BASE}/api/orders${qs ? `?${qs}` : ""}`);
  },

  getPdfUrl(orderNumber: string): string {
    return `${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/pdf`;
  },

  getCsvUrl(params: {
    universes?: string[];
    subuniverses?: string[];
    from?: string;
    to?: string;
  }): string {
    const p = new URLSearchParams();
    if (params.universes?.length) p.set("universes", params.universes.join(","));
    if (params.subuniverses?.length)
      p.set("subuniverses", params.subuniverses.join(","));
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    const qs = p.toString();
    return `${API_BASE}/api/orders/csv${qs ? `?${qs}` : ""}`;
  },

  /** Desktop only — writes the export to the user's Downloads folder. */
  saveCsv(params: {
    universes?: string[];
    subuniverses?: string[];
    from?: string;
    to?: string;
  }): Promise<{ path: string }> {
    const p = new URLSearchParams();
    if (params.universes?.length) p.set("universes", params.universes.join(","));
    if (params.subuniverses?.length)
      p.set("subuniverses", params.subuniverses.join(","));
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    const qs = p.toString();
    return request<{ path: string }>(
      `${API_BASE}/api/orders/csv-save${qs ? `?${qs}` : ""}`,
      { method: "POST" }
    );
  },

  /** Desktop only — writes the invoice to the user's Downloads folder. */
  savePdf(orderNumber: string): Promise<{ path: string }> {
    return request<{ path: string }>(
      `${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/pdf-save`,
      { method: "POST" }
    );
  },

  startSync(mode: "full" | "update"): Promise<{ ok: boolean; error?: string }> {
    return request<{ ok: boolean; error?: string }>(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  },

  cancelSync(): Promise<void> {
    return request<void>(`${API_BASE}/api/sync`, { method: "DELETE" });
  },

  getSyncStatus(): Promise<SyncStatus> {
    return request<SyncStatus>(`${API_BASE}/api/sync/status`);
  },

  createSyncEventSource(): EventSource {
    return new EventSource(`${API_BASE}/api/sync/stream`);
  },

  getSettings(): Promise<AppSettings> {
    return request<AppSettings>(`${API_BASE}/api/settings`);
  },

  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return request<AppSettings>(`${API_BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  },

  resetDatabase(): Promise<void> {
    return request<void>(`${API_BASE}/api/settings/database`, { method: "DELETE" });
  },

  getDbPath(): Promise<{ path: string | null }> {
    return request<{ path: string | null }>(`${API_BASE}/api/settings/db-path`);
  },

  getCredentialStore(): Promise<CredentialStores> {
    return request<CredentialStores>(`${API_BASE}/api/settings/credential-store`);
  },

  revealDbInFinder(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`${API_BASE}/api/settings/reveal-db`, { method: "POST" });
  },

  getLatestRelease(refresh = false): Promise<LatestRelease> {
    return request<LatestRelease>(
      `${API_BASE}/api/app/latest-release${refresh ? "?refresh=1" : ""}`
    );
  },

  getInstallInfo(): Promise<InstallInfo> {
    return request<InstallInfo>(`${API_BASE}/api/app/install`);
  },
};
