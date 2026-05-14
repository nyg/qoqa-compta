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
  /** Human-readable order reference, e.g. "QO-12345" */
  reference?: string;
  [key: string]: unknown;
}

export interface OrderDetailData {
  id?: number | string;
  /** Human-readable order reference stored as order_number in DB */
  reference?: string;
  /** Total order amount */
  total?: string | number;
  status?: string;
  subtotal?: string | number;
  /** Discount in centimes (divide by 100 for CHF) */
  discount_amount_to_centimes?: number;
  delivery_on?: string;
  created_at?: string;
  offer?: {
    id?: string | number;
    title?: string;
    subtitle?: string;
    universe_tracking_identifier?: string;
    sub_universe_tracking_identifiers?: string[];
  };
  order_items?: Array<{
    full_name?: string;
    /** VAT in centimes */
    vat_amount_to_centimes?: number;
  }>;
  /** Primary source for PDF URL and invoice number */
  accounting_documents?: Array<{
    pdf_link?: string;
    /** e.g. "Facture 12345" */
    title?: string;
  }>;
  /** Fallback PDF URL when accounting_documents is absent */
  invoice_link?: string;
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

  // Response: { alerts: [{ universes: [{ identifier, name, push_topics: [{ identifier, name }] }] }] }
  for (const alert of (data.alerts as Record<string, unknown>[] | undefined) ?? []) {
    for (const u of (alert.universes as Record<string, unknown>[] | undefined) ?? []) {
      const uid = (u.identifier as string) ?? "";
      if (!uid) continue;

      const subuniverses: SubuniverseData[] = [];
      for (const sub of (u.push_topics as Record<string, unknown>[] | undefined) ?? []) {
        const rawSid = (sub.identifier as string) ?? "";
        if (!rawSid) continue;
        subuniverses.push({
          identifier: cleanSubuniverseIdentifier(rawSid),
          name: (sub.name as string) ?? "",
        });
      }

      universes.push({ identifier: uid, name: (u.name as string) ?? "", subuniverses });
    }
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
    // Response: { purchases: [...], meta: { is_last_page: bool } }
    const batch = (data.purchases as PurchaseSummary[] | undefined) ?? [];
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

  // Response is the raw order detail object (not wrapped in { order: ... })
  return (await resp.json()) as OrderDetailData;
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
