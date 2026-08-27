export interface SubuniverseOption {
  identifier: string;
  name: string;
}

export interface UniverseOption {
  identifier: string;
  name: string;
  subuniverses: SubuniverseOption[];
}

export interface QoqaOrder {
  id: number;
  order_number: string;
  order_date: string;
  /** CHF amount as decimal string */
  amount_chf: string;
  status: string | null;
  subtotal_chf: string | null;
  discount_chf: string | null;
  vat_chf: string | null;
  offer_id: string | null;
  offer_title: string | null;
  offer_subtitle: string | null;
  universe: string | null;
  universe_name: string | null;
  subuniverse: string | null;
  subuniverse_name: string | null;
  /** Every sub-universe the offer was tagged with, primary first */
  subuniverses: SubuniverseOption[];
  item_description: string | null;
  invoice_number: string | null;
  pdf_filename: string | null;
  has_pdf: boolean;
}

export interface OrderStats {
  total_spent: number;
  order_count: number;
  average_per_order: number;
}

export interface MonthlySpending {
  /** Format: YYYY-MM */
  month: string;
  total: number;
  count: number;
}

export interface YearlySpending {
  year: number;
  total: number;
  count: number;
}

export interface SpendingByGroup {
  identifier: string;
  name: string;
  total: number;
  count: number;
}

export const DEFAULT_PAGE_SIZE = 10;

export const SECRET_MASK = "*****";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardData {
  stats: OrderStats;
  monthly: MonthlySpending[];
  yearly: YearlySpending[];
  orders: QoqaOrder[];
  pagination: Pagination;
  universes: UniverseOption[];
  pieData: SpendingByGroup[] | null;
  pieMode: "universe" | "subuniverse" | null;
  syncLocale: "fr" | "de";
}

export interface OrdersResponse {
  orders: QoqaOrder[];
  pagination: Pagination;
}

export type SyncEventType =
  | "start"
  | "db_ready"
  | "auth_ok"
  | "auth_error"
  | "universes_ok"
  | "universes_error"
  | "purchases_fetched"
  | "info"
  | "order_synced"
  | "order_skipped"
  | "order_error"
  | "done"
  | "cancelled"
  | "error";

export interface SyncProgressEvent {
  type: SyncEventType;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface SyncStatus {
  running: boolean;
  startedAt?: string;
  mode?: "full" | "update";
}

export interface AppSettings {
  databaseUrl: string | null;
  qoqaEmail: string | null;
  qoqaPassword: string | null;
  syncLocale: "fr" | "de";
}

export interface LatestRelease {
  version: string;
  url: string;
  checkedAt: string;
}

export type InstallMethod = "homebrew" | "scoop" | "manual" | "web";

export type InstallPlatform = "macos" | "windows" | "linux" | "other";

export interface InstallInfo {
  platform: InstallPlatform;
  method: InstallMethod;
}

export type CredentialStoreKind =
  | "keychain"
  | "credential-manager"
  | "keyring"
  | "file"
  | "env";

export interface CredentialStore {
  kind: CredentialStoreKind;
  path: string | null;
  variable: string | null;
}

export interface CredentialStores {
  qoqaPassword: CredentialStore;
  databaseUrl: CredentialStore;
}
