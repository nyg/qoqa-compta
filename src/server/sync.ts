import { authenticate } from "./auth";
import { ensureDb } from "./db";
import { runMigrations } from "./migrate";
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
  fetchOrderNumbersMissingPdf,
  fetchStaleOrderNumbers,
  type NewOrderData,
} from "./queries";
import type {
  SyncEventType,
  SyncMessageKey,
  SyncMessageParams,
  SyncProgressEvent,
} from "../shared/types";

/**
 * QoQa keeps editing an offer's universe after the sale, and the tags only
 * exist on the per-order endpoint — the purchases list carries none of them —
 * so keeping stored details current costs one call per order. An update sync
 * therefore refreshes only the oldest few, and only once they have aged past
 * the interval: a fresh database settles down instead of re-fetching forever,
 * and a large one converges over a handful of syncs. A full sync still
 * refreshes everything at once.
 */
const REFRESH_BATCH_SIZE = 20;
const REFRESH_INTERVAL_DAYS = 7;

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

  const subuniverses = [
    ...new Set(
      (offer.sub_universe_tracking_identifiers ?? []).map(cleanSubuniverseIdentifier)
    ),
  ].filter(Boolean);
  const subuniverse = subuniverses[0] ?? null;

  const createdAt = detail.created_at ?? "";
  const orderDate = createdAt.length >= 10 ? createdAt.slice(0, 10) : createdAt;

  const items = detail.order_items ?? [];
  const itemDescription = items[0]?.full_name ?? null;
  const vatCentimes = items.reduce((sum, item) => sum + (item.vat_amount_to_centimes ?? 0), 0);
  const vatChf = vatCentimes > 0 ? String(vatCentimes / 100) : null;

  // Invoice number from accounting_documents[0].title (e.g. "Facture 12345")
  const docs = detail.accounting_documents ?? [];
  const docTitle = docs[0]?.title ?? "";
  const invoiceNumber = docTitle.replace(/^Facture\s*/i, "").trim() || null;

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
    subuniverses,
    item_description: itemDescription,
    invoice_number: invoiceNumber,
    raw_json: JSON.stringify(detail),
  };
}

// ── Main sync function ─────────────────────────────────────────────────────────

function makeEvent(
  type: SyncEventType,
  message: string,
  extra?: {
    key?: SyncMessageKey;
    params?: SyncMessageParams;
    data?: Record<string, unknown>;
  }
): SyncProgressEvent {
  return {
    type,
    message,
    messageKey: extra?.key,
    messageParams: extra?.params,
    data: extra?.data,
    timestamp: new Date().toISOString(),
  };
}

export async function syncOrders(
  options: SyncOptions,
  emit: (event: SyncProgressEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const { email, password, locale, mode } = options;

  emit(makeEvent("start", "Starting sync…", { key: "starting" }));

  // 1. Prepare the database schema
  try {
    console.log("[sync] Preparing database schema…");
    ensureDb();
    const { applied, baselined } = await runMigrations();
    const migrations = applied.join(", ");
    const message =
      applied.length > 0
        ? `Database schema updated (${migrations})`
        : baselined
        ? "Database schema recorded as up to date"
        : "Database schema up to date";
    const key: SyncMessageKey =
      applied.length > 0
        ? "schemaUpdated"
        : baselined
        ? "schemaBaselined"
        : "schemaUpToDate";
    console.log(`[sync] ${message}`);
    emit(makeEvent("db_ready", message, { key, params: { migrations } }));
  } catch (err) {
    const reason = (err as Error).message;
    console.error("[sync] Database preparation failed:", err);
    emit(
      makeEvent("error", `Database preparation failed: ${reason}`, {
        key: "dbPrepFailed",
        params: { error: reason },
      })
    );
    return;
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled", { key: "cancelled" })); return; }

  // 2. Authenticate
  let token: string;
  try {
    console.log("[sync] Authenticating…");
    token = await authenticate(email, password);
    console.log("[sync] Auth OK");
    emit(makeEvent("auth_ok", "Authenticated successfully", { key: "authOk" }));
  } catch (err) {
    console.error("[sync] Auth failed:", err);
    emit(
      makeEvent("auth_error", `Authentication failed: ${(err as Error).message}`, {
        key: "authFailed",
        params: { error: (err as Error).message },
      })
    );
    return;
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled", { key: "cancelled" })); return; }

  // 3. Fetch and upsert universes
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
    emit(
      makeEvent("universes_ok", `Synced ${universesData.length} universes`, {
        key: "universesOk",
        params: { total: universesData.length },
      })
    );
    console.log(`[sync] Universes OK (${universesData.length})`);
  } catch (err) {
    console.error("[sync] Universes error:", err);
    emit(
      makeEvent("universes_error", `Failed to sync universes: ${(err as Error).message}`, {
        key: "universesFailed",
        params: { error: (err as Error).message },
      })
    );
    // Non-fatal: continue with order sync
  }

  if (signal.aborted) { emit(makeEvent("cancelled", "Sync cancelled", { key: "cancelled" })); return; }

  // 4. Fetch all purchases
  let purchases: Awaited<ReturnType<typeof fetchPurchases>>;
  try {
    console.log("[sync] Fetching purchases…");
    purchases = await fetchPurchases(token, locale);
    console.log(`[sync] Purchases fetched: ${purchases.length}`);
    emit(
      makeEvent("purchases_fetched", `Found ${purchases.length} orders`, {
        key: "purchasesFetched",
        params: { total: purchases.length },
        data: { count: purchases.length },
      })
    );
  } catch (err) {
    console.error("[sync] Failed to fetch purchases:", err);
    emit(
      makeEvent("error", `Failed to fetch purchases: ${(err as Error).message}`, {
        key: "purchasesFailed",
        params: { error: (err as Error).message },
      })
    );
    return;
  }

  // 5. Process each purchase
  //
  // An invoice is not always issued by the time an order is first synced, so
  // orders stored without a PDF are revisited on every update sync — including
  // the ones behind the "already synced" cut-off — until the PDF is available.
  const missingPdf = new Set(mode === "update" ? await fetchOrderNumbersMissingPdf() : []);

  const refreshCutoff = new Date(
    Date.now() - REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const stale = new Set(
    mode === "update" ? await fetchStaleOrderNumbers(refreshCutoff, REFRESH_BATCH_SIZE) : []
  );
  if (stale.size > 0) {
    emit(
      makeEvent(
        "info",
        `Refreshing ${stale.size} order(s) not updated in ${REFRESH_INTERVAL_DAYS} days`,
        { key: "refreshing", params: { total: stale.size, days: REFRESH_INTERVAL_DAYS } }
      )
    );
  }

  let consecutiveUnchanged = 0;
  let reachedKnownOrders = false;
  let syncedCount = 0;
  let skippedCount = 0;
  let pdfCount = 0;
  let errorCount = 0;

  for (const purchase of purchases) {
    if (signal.aborted) {
      emit(
        makeEvent("cancelled", "Sync cancelled", {
          key: "cancelled",
          data: { synced: syncedCount, withPdf: pdfCount, skipped: skippedCount, errors: errorCount },
        })
      );
      return;
    }

    const orderId = String(purchase.id ?? "");
    // reference is the human-readable order number (e.g. "QO-12345") stored in DB
    const orderReference = purchase.reference ? String(purchase.reference) : orderId;

    const awaitingPdf = missingPdf.has(orderReference);
    const needsRefresh = stale.has(orderReference);
    let alreadyStored = false;

    if (mode === "update") {
      if (reachedKnownOrders) {
        // Everything from here on is already synced — only orders waiting for
        // their invoice or due a refresh are worth another round-trip.
        alreadyStored = true;
        if (!awaitingPdf && !needsRefresh) continue;
      } else {
        const existing = await getOrderByNumber(orderReference);
        alreadyStored = existing !== null;
        if (!alreadyStored) {
          consecutiveUnchanged = 0;
        } else {
          consecutiveUnchanged++;
          if (consecutiveUnchanged >= 5) {
            reachedKnownOrders = true;
            emit(
              makeEvent(
                "info",
                "Reached already-synced orders — checking for pending invoices and refreshes only",
                { key: "reachedKnown" }
              )
            );
          }
          if (!awaitingPdf && !needsRefresh) {
            skippedCount++;
            emit(
              makeEvent("order_skipped", `Skipped already-synced order ${orderReference}`, {
                key: "orderSkipped",
                params: { order: orderReference },
              })
            );
            continue;
          }
        }
      }
    }

    // A refresh only re-reads the order's details; its invoice is already stored.
    const keepStoredPdf = alreadyStored && !awaitingPdf;

    try {
      const detail = await fetchOrderDetail(token, orderId, locale);
      const orderData = extractOrderFields(detail);

      // PDF URL: accounting_documents[0].pdf_link, fallback to invoice_link
      let hasPdf = false;
      const pdfUrl = detail.accounting_documents?.[0]?.pdf_link ?? detail.invoice_link;
      if (pdfUrl && !keepStoredPdf) {
        const pdfBytes = await downloadPdf(pdfUrl);
        if (pdfBytes) {
          hasPdf = true;
          pdfCount++;
          orderData.pdf_data = pdfBytes;
        }
      }

      await upsertOrder(orderData);
      syncedCount++;
      const order = orderData.order_number;
      const [orderKey, orderMessage]: [SyncMessageKey, string] = awaitingPdf
        ? hasPdf
          ? ["orderPdfDownloaded", `Downloaded pending invoice for order ${order}`]
          : ["orderPdfPending", `Invoice not available yet for order ${order}`]
        : keepStoredPdf
        ? ["orderRefreshed", `Refreshed order ${order}`]
        : hasPdf
        ? ["orderSyncedWithPdf", `Synced order ${order} (with PDF)`]
        : ["orderSynced", `Synced order ${order}`];
      emit(
        makeEvent("order_synced", orderMessage, {
          key: orderKey,
          params: { order },
          data: { hasPdf },
        })
      );
    } catch (err) {
      errorCount++;
      emit(
        makeEvent("order_error", `Error syncing order ${orderReference}: ${(err as Error).message}`, {
          key: "orderFailed",
          params: { order: orderReference, error: (err as Error).message },
        })
      );
    }
  }

  emit(
    makeEvent("done", `Sync complete — ${syncedCount} synced, ${pdfCount} with PDF`, {
      key: "done",
      params: { synced: syncedCount, withPdf: pdfCount },
      data: { synced: syncedCount, withPdf: pdfCount, skipped: skippedCount, errors: errorCount },
    })
  );
}
