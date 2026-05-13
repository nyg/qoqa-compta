import { authenticate } from "./auth";
import {
  fetchUniverses,
  fetchPurchases,
  fetchOrderDetail,
  downloadPdf,
  cleanSubuniverseIdentifier,
  type OrderDetailData,
} from "./api";
import {
  upsertOrder,
  upsertUniverse,
  upsertSubuniverse,
  getOrderByNumber,
  type NewOrderData,
} from "./queries";
import type { SyncProgressEvent, SyncEventType } from "../shared/types";

export interface SyncOptions {
  email: string;
  password: string;
  locale: "fr" | "de";
  mode: "full" | "update";
}

// ── PDF invoice number extraction ─────────────────────────────────────────────
// Basic heuristic — replace with a proper PDF library (e.g. pdf-parse) for
// reliable extraction.

function parseInvoice(pdfBytes: Uint8Array): { invoice_number: string | null } {
  try {
    // Many QoQa PDFs embed text as latin-1; look for common invoice number patterns
    const text = new TextDecoder("latin-1").decode(pdfBytes);
    const match =
      text.match(/facture\s+(?:n[o°]?[\s.]*)?(\d{5,})/i) ??
      text.match(/invoice\s+(?:n[o°]?[\s.]*)?(\d{5,})/i) ??
      text.match(/(?:^|\s)(\d{7,})\s/m);
    if (match) return { invoice_number: match[1] };
  } catch {
    // ignore decode errors
  }
  return { invoice_number: null };
}

// ── Field extraction ───────────────────────────────────────────────────────────

function extractOrderFields(detail: OrderDetailData): NewOrderData {
  const orderNumber = detail.order_number ?? String(detail.id ?? "");
  const amount = parseFloat(String(detail.amount_chf ?? detail.total_amount ?? 0));

  const campaign = (detail.campaign ?? {}) as NonNullable<OrderDetailData["campaign"]>;
  const universeInfo = campaign.universe ?? {};
  const universe = universeInfo.tracking_identifier ?? null;

  let subuniverse: string | null = null;
  const rawSub = universeInfo.sub_universe?.tracking_identifier;
  if (rawSub) {
    subuniverse = cleanSubuniverseIdentifier(rawSub);
  }

  const createdAt = detail.created_at ?? "";
  const orderDate = createdAt.length >= 10 ? createdAt.slice(0, 10) : createdAt;

  const items = detail.items ?? [];
  const itemDescription = items.length > 0 ? (items[0].description ?? null) : null;

  return {
    order_number: orderNumber,
    order_date: orderDate,
    amount_chf: isNaN(amount) ? "0" : String(amount),
    status: detail.status ?? null,
    subtotal_chf:
      detail.subtotal_amount != null
        ? String(parseFloat(String(detail.subtotal_amount)))
        : null,
    discount_chf:
      detail.discount_amount != null
        ? String(parseFloat(String(detail.discount_amount)))
        : null,
    vat_chf:
      detail.vat_amount != null
        ? String(parseFloat(String(detail.vat_amount)))
        : null,
    delivery_on: detail.delivery_on ?? null,
    offer_id: campaign.id != null ? String(campaign.id) : null,
    offer_title: campaign.title ?? null,
    offer_subtitle: campaign.subtitle ?? null,
    universe,
    subuniverse,
    item_description: itemDescription,
    invoice_number: detail.invoice_number ?? null,
    raw_json: JSON.stringify(detail),
  };
}

// ── Main sync function ─────────────────────────────────────────────────────────

function makeEvent(type: SyncEventType, message: string, data?: Record<string, unknown>): SyncProgressEvent {
  return { type, message, data, timestamp: new Date().toISOString() };
}

export async function syncOrders(
  options: SyncOptions,
  emit: (event: SyncProgressEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const { email, password, locale, mode } = options;

  emit(makeEvent("start", "Starting sync…"));

  // 1. Authenticate
  let token: string;
  try {
    token = await authenticate(email, password);
    emit(makeEvent("auth_ok", "Authenticated successfully"));
  } catch (err) {
    emit(makeEvent("auth_error", `Authentication failed: ${(err as Error).message}`));
    throw err;
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled")); return; }

  // 2. Fetch and upsert universes
  try {
    const universesData = await fetchUniverses(token, locale);
    for (const u of universesData) {
      await upsertUniverse({ identifier: u.identifier, nameFr: u.name, nameDe: undefined });
      for (const sub of u.subuniverses) {
        await upsertSubuniverse({
          identifier: sub.identifier,
          nameFr: sub.name,
          universeIdentifier: u.identifier,
        });
      }
    }
    emit(makeEvent("universes_ok", `Synced ${universesData.length} universes`));
  } catch (err) {
    emit(makeEvent("universes_error", `Failed to sync universes: ${(err as Error).message}`));
    // Non-fatal: continue with order sync
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled")); return; }

  // 3. Fetch all purchases
  let purchases: Awaited<ReturnType<typeof fetchPurchases>>;
  try {
    purchases = await fetchPurchases(token, locale);
    emit(makeEvent("purchases_fetched", `Found ${purchases.length} orders`, { count: purchases.length }));
  } catch (err) {
    emit(makeEvent("error", `Failed to fetch purchases: ${(err as Error).message}`));
    throw err;
  }

  // 4. Process each purchase
  let consecutiveUnchanged = 0;

  for (const purchase of purchases) {
    if (signal.aborted) {
      emit(makeEvent("cancelled", "Sync cancelled"));
      return;
    }

    const orderNumber = String(purchase.order_number ?? purchase.id ?? "");

    if (mode === "update") {
      const existing = await getOrderByNumber(orderNumber);
      if (existing !== null) {
        consecutiveUnchanged++;
        emit(makeEvent("order_skipped", `Skipped already-synced order ${orderNumber}`));
        if (consecutiveUnchanged >= 5) {
          emit(makeEvent("done", "Reached already-synced orders, stopping early"));
          return;
        }
        continue;
      }
      consecutiveUnchanged = 0;
    }

    try {
      const orderId = String(purchase.id ?? "");
      const detail = await fetchOrderDetail(token, orderId, locale);
      const orderData = extractOrderFields(detail);

      // Download PDF if URL is present
      const pdfUrl = (detail.invoice_url ?? detail.pdf_url) as string | undefined;
      if (pdfUrl) {
        const pdfBytes = await downloadPdf(pdfUrl);
        if (pdfBytes) {
          orderData.pdf_data = pdfBytes;
          const parsed = parseInvoice(pdfBytes);
          if (parsed.invoice_number) {
            orderData.invoice_number = parsed.invoice_number;
          }
        }
      }

      await upsertOrder(orderData);
      emit(makeEvent("order_synced", `Synced order ${orderNumber}`));
    } catch (err) {
      // Log per-order errors but continue
      emit(makeEvent("error", `Error syncing order ${orderNumber}: ${(err as Error).message}`));
    }
  }

  emit(makeEvent("done", `Sync complete — processed ${purchases.length} orders`));
}
