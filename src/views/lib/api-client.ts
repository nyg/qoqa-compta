import type {
  DashboardData,
  OrdersResponse,
  SyncStatus,
  AppSettings,
} from "../../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
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
    return request<DashboardData>(`/api/dashboard${qs ? `?${qs}` : ""}`);
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
    return request<OrdersResponse>(`/api/orders${qs ? `?${qs}` : ""}`);
  },

  getPdfUrl(orderNumber: string): string {
    return `/api/orders/${encodeURIComponent(orderNumber)}/pdf`;
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
    return `/api/orders/csv${qs ? `?${qs}` : ""}`;
  },

  startSync(mode: "full" | "update"): Promise<{ ok: boolean; error?: string }> {
    return request<{ ok: boolean; error?: string }>("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  },

  cancelSync(): Promise<void> {
    return request<void>("/api/sync", { method: "DELETE" });
  },

  getSyncStatus(): Promise<SyncStatus> {
    return request<SyncStatus>("/api/sync/status");
  },

  createSyncEventSource(): EventSource {
    return new EventSource("/api/sync/stream");
  },

  getSettings(): Promise<AppSettings> {
    return request<AppSettings>("/api/settings");
  },

  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return request<AppSettings>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  },

  resetDatabase(): Promise<void> {
    return request<void>("/api/settings/database", { method: "DELETE" });
  },
};
