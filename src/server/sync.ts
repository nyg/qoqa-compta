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

// ── Field extraction ───────────────────────────────────────────────────────────

function extractOrderFields(detail: OrderDetailData): NewOrderData {
  const orderNumber = detail.reference ?? String(detail.id ?? "");
  const amount = parseFloat(String(detail.total ?? 0));

  const offer = (detail.offer ?? {}) as NonNullable<OrderDetailData["offer"]>;
  const universe = offer.universe_tracking_identifier ?? null;

  let subuniverse: string | null = null;
  const subIds = offer.sub_universe_tracking_identifiers;
  if (subIds && subIds.length > 0) {
    subuniverse = cleanSubuniverseIdentifier(subIds[0]);
  }

  const createdAt = detail.created_at ?? "";
  const orderDate = createdAt.length >= 10 ? createdAt.slice(0, 10) : createdAt;

  const items = detail.order_items ?? [];
  const itemDescription = items.length > 0 ? (items[0].full_name ?? null) : null;
  const vatCentimes = items.reduce((sum, item) => sum + (item.vat_amount_to_centimes ?? 0), 0);
  const vatChf = vatCentimes > 0 ? String(vatCentimes / 100) : null;

  // Invoice number from accounting_documents[0].title (e.g. "Facture 12345")
  const docs = detail.accounting_documents ?? [];
  let invoiceNumber: string | null = null;
  if (docs.length > 0) {
    const docTitle = docs[0].title ?? "";
    invoiceNumber = docTitle.replace(/^Facture\s*/i, "").trim() || null;
  }

  return {
    order_number: orderNumber,
    order_date: orderDate,
    amount_chf: isNaN(amount) ? "0" : String(amount),
    status: detail.status ?? null,
    subtotal_chf: detail.subtotal != null ? String(parseFloat(String(detail.subtotal))) : null,
    discount_chf: detail.discount_amount_to_centimes
      ? String(detail.discount_amount_to_centimes / 100)
      : null,
    vat_chf: vatChf,
    delivery_on: detail.delivery_on ?? null,
    offer_id: offer.id != null ? String(offer.id) : null,
    offer_title: offer.title ?? null,
    offer_subtitle: offer.subtitle ?? null,
    universe,
    subuniverse,
    item_description: itemDescription,
    invoice_number: invoiceNumber,
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
    console.log("[sync] Authenticating…");
    token = await authenticate(email, password);
    console.log("[sync] Auth OK");
    emit(makeEvent("auth_ok", "Authenticated successfully"));
  } catch (err) {
    console.error("[sync] Auth failed:", err);
    emit(makeEvent("auth_error", `Authentication failed: ${(err as Error).message}`));
    throw err;
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled")); return; }

  // 2. Fetch and upsert universes
  try {
    console.log("[sync] Fetching universes…");
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
    console.log(`[sync] Universes OK (${universesData.length})`);
  } catch (err) {
    console.error("[sync] Universes error:", err);
    emit(makeEvent("universes_error", `Failed to sync universes: ${(err as Error).message}`));
    // Non-fatal: continue with order sync
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled")); return; }

  // 3. Fetch all purchases
  let purchases: Awaited<ReturnType<typeof fetchPurchases>>;
  try {
    console.log("[sync] Fetching purchases…");
    purchases = await fetchPurchases(token, locale);
    console.log(`[sync] Purchases fetched: ${purchases.length}`);
    emit(makeEvent("purchases_fetched", `Found ${purchases.length} orders`, { count: purchases.length }));
  } catch (err) {
    console.error("[sync] Failed to fetch purchases:", err);
    emit(makeEvent("error", `Failed to fetch purchases: ${(err as Error).message}`));
    throw err;
  }

  // 4. Process each purchase
  let consecutiveUnchanged = 0;
  let syncedCount = 0;
  let skippedCount = 0;
  let pdfCount = 0;
  let errorCount = 0;

  for (const purchase of purchases) {
    if (signal.aborted) {
      emit(makeEvent("cancelled", "Sync cancelled", { synced: syncedCount, withPdf: pdfCount, skipped: skippedCount, errors: errorCount }));
      return;
    }

    const orderId = String(purchase.id ?? "");
    // reference is the human-readable order number (e.g. "QO-12345") stored in DB
    const orderReference = purchase.reference ? String(purchase.reference) : orderId;

    if (mode === "update") {
      const existing = await getOrderByNumber(orderReference);
      if (existing !== null) {
        consecutiveUnchanged++;
        skippedCount++;
        emit(makeEvent("order_skipped", `Skipped already-synced order ${orderReference}`));
        if (consecutiveUnchanged >= 5) {
          emit(makeEvent("done", `Reached already-synced orders — ${syncedCount} synced, ${pdfCount} with PDF`, { synced: syncedCount, withPdf: pdfCount, skipped: skippedCount, errors: errorCount }));
          return;
        }
        continue;
      }
      consecutiveUnchanged = 0;
    }

    try {
      const detail = await fetchOrderDetail(token, orderId, locale);
      const orderData = extractOrderFields(detail);

      // PDF URL: accounting_documents[0].pdf_link, fallback to invoice_link
      let hasPdf = false;
      const pdfUrl = detail.accounting_documents?.[0]?.pdf_link ?? detail.invoice_link;
      if (pdfUrl) {
        const pdfBytes = await downloadPdf(pdfUrl);
        if (pdfBytes) {
          hasPdf = true;
          pdfCount++;
          orderData.pdf_data = pdfBytes;
        }
      }

      await upsertOrder(orderData);
      syncedCount++;
      emit(makeEvent("order_synced", `Synced order ${orderData.order_number}${hasPdf ? " (with PDF)" : ""}`, { hasPdf }));
    } catch (err) {
      errorCount++;
      emit(makeEvent("order_error", `Error syncing order ${orderReference}: ${(err as Error).message}`));
    }
  }

  emit(makeEvent("done", `Sync complete — ${syncedCount} synced, ${pdfCount} with PDF`, { synced: syncedCount, withPdf: pdfCount, skipped: skippedCount, errors: errorCount }));
}
