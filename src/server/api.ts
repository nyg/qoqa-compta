const API_BASE = "https://api.qoqa.ch/v2";

// ── Exported types ─────────────────────────────────────────────────────────────

export interface SubuniverseData {
  identifier: string;
  name: string;
}

export interface UniverseData {
  identifier: string;
  name: string;
  subuniverses: SubuniverseData[];
}

export interface PurchaseSummary {
  id: number | string;
  order_number?: string;
  [key: string]: unknown;
}

export interface OrderDetailData {
  id?: number | string;
  order_number?: string;
  amount_chf?: string | number;
  total_amount?: string | number;
  status?: string;
  subtotal_amount?: string | number;
  discount_amount?: string | number;
  vat_amount?: string | number;
  delivery_on?: string;
  created_at?: string;
  invoice_url?: string;
  pdf_url?: string;
  invoice_number?: string;
  campaign?: {
    id?: string | number;
    title?: string;
    subtitle?: string;
    universe?: {
      tracking_identifier?: string;
      sub_universe?: {
        tracking_identifier?: string;
      };
    };
  };
  items?: Array<{ description?: string }>;
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Strips the `subuniverse_` prefix, a leading `q`, and a trailing `qoqach`
 * from a raw sub-universe tracking identifier.
 */
export function cleanSubuniverseIdentifier(identifier: string): string {
  if (identifier.startsWith("subuniverse_")) {
    identifier = identifier.slice("subuniverse_".length);
  }
  identifier = identifier.replace(/^q/, "");
  identifier = identifier.replace(/qoqach$/, "");
  return identifier;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Token bearer=${token}` };
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function fetchUniverses(
  token: string,
  locale = "fr"
): Promise<UniverseData[]> {
  const url = new URL(`${API_BASE}/alerts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("sub_universe", "true");

  const resp = await fetch(url.toString(), { headers: authHeader(token) });
  if (!resp.ok) {
    throw new Error(`Failed to fetch universes: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const universes: UniverseData[] = [];

  for (const item of (data.universes as Record<string, unknown>[] | undefined) ?? []) {
    const uid = (item.tracking_identifier as string) ?? "";
    const name = (item.name as string) ?? "";
    const subuniverses: SubuniverseData[] = [];

    for (const sub of (item.sub_universes as Record<string, unknown>[] | undefined) ?? []) {
      const rawSid = (sub.tracking_identifier as string) ?? "";
      subuniverses.push({
        identifier: cleanSubuniverseIdentifier(rawSid),
        name: (sub.name as string) ?? "",
      });
    }

    universes.push({ identifier: uid, name, subuniverses });
  }

  return universes;
}

export async function fetchPurchases(
  token: string,
  locale = "fr"
): Promise<PurchaseSummary[]> {
  const orders: PurchaseSummary[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${API_BASE}/users/me/purchases`);
    url.searchParams.set("locale", locale);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "50");
    url.searchParams.set("with_campaign", "false");

    const resp = await fetch(url.toString(), { headers: authHeader(token) });
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch purchases page ${page}: ${resp.status} ${await resp.text()}`
      );
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const batch = (data.orders as PurchaseSummary[] | undefined) ?? [];
    orders.push(...batch);

    const meta = (data.meta as Record<string, unknown> | undefined) ?? {};
    if (meta.is_last_page !== false) break;
    page++;
  }

  return orders;
}

export async function fetchOrderDetail(
  token: string,
  orderId: string,
  locale = "fr"
): Promise<OrderDetailData> {
  const url = new URL(`${API_BASE}/users/me/orders/${orderId}`);
  url.searchParams.set("locale", locale);

  const resp = await fetch(url.toString(), { headers: authHeader(token) });
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch order ${orderId}: ${resp.status} ${await resp.text()}`
    );
  }

  const data = (await resp.json()) as Record<string, unknown>;
  return ((data.order as OrderDetailData | undefined) ?? {}) as OrderDetailData;
}

export async function downloadPdf(pdfUrl: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(pdfUrl, { redirect: "follow" });
    if (resp.ok) {
      return new Uint8Array(await resp.arrayBuffer());
    }
  } catch {
    // PDF download is best-effort; swallow errors
  }
  return null;
}
