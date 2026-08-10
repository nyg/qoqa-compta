import { useState, useCallback, useEffect, useRef } from "react";
import { Download, Globe, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderPdfDialog } from "@/components/order-pdf-dialog";
import { useFormatter } from "@/lib/formatter-context";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { fileName, saveFile } from "@/lib/downloads";
import { selectionParams, type UniverseSelection } from "../../shared/filters";
import { DEFAULT_PAGE_SIZE, type QoqaOrder, type Pagination } from "../../shared/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SEARCH_DEBOUNCE_MS = 250;

function subuniverseLabels(
  order: QoqaOrder,
  subuniverseNames: Record<string, string>
): string[] {
  const tags =
    order.subuniverses.length > 0
      ? order.subuniverses.map((s) => s.name || subuniverseNames[s.identifier] || s.identifier)
      : [
          order.subuniverse_name ??
            (order.subuniverse ? subuniverseNames[order.subuniverse] : null) ??
            order.subuniverse,
        ];

  return tags.filter((label): label is string => Boolean(label));
}

interface OrdersTableProps {
  initialOrders: QoqaOrder[];
  initialPagination: Pagination;
  selection: UniverseSelection;
  subuniverseNames: Record<string, string>;
  syncLocale: "fr" | "de";
  from?: string;
  to?: string;
}

export function OrdersTable({
  initialOrders,
  initialPagination,
  selection,
  subuniverseNames,
  syncLocale,
  from,
  to,
}: OrdersTableProps) {
  const [orders, setOrders] = useState<QoqaOrder[]>(initialOrders);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    initialPagination.pageSize ?? DEFAULT_PAGE_SIZE
  );
  const { formatCHF, formatDate } = useFormatter();
  const { t } = useTranslation("OrdersTable");

  const latestRequest = useRef(0);
  const pendingSearch = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSearch = useCallback(() => {
    if (pendingSearch.current === null) return;
    clearTimeout(pendingSearch.current);
    pendingSearch.current = null;
  }, []);

  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const fetchOrders = useCallback(
    async (newSearch: string, page: number, newPageSize?: number) => {
      const ps = newPageSize ?? pageSize;
      const requestId = ++latestRequest.current;
      setLoading(true);
      try {
        const data = await apiClient.getOrders({
          search: newSearch || undefined,
          page,
          pageSize: ps,
          ...selectionParams(selection),
          from: from || undefined,
          to: to || undefined,
        });
        if (requestId !== latestRequest.current) return;
        setOrders(data.orders ?? []);
        setPagination(data.pagination ?? { page, pageSize: ps, total: 0, totalPages: 0 });
      } catch (e) {
        if (requestId === latestRequest.current) console.error(e);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [pageSize, selection, from, to]
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearch(value);
      setCurrentPage(1);
      cancelPendingSearch();
      pendingSearch.current = setTimeout(() => {
        pendingSearch.current = null;
        fetchOrders(value, 1);
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelPendingSearch, fetchOrders]
  );

  const handlePage = useCallback(
    (page: number) => {
      cancelPendingSearch();
      setCurrentPage(page);
      fetchOrders(search, page);
    },
    [cancelPendingSearch, fetchOrders, search]
  );

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = parseInt(e.target.value, 10);
      cancelPendingSearch();
      setPageSize(newSize);
      setCurrentPage(1);
      fetchOrders(search, 1, newSize);
    },
    [cancelPendingSearch, fetchOrders, search]
  );

  const csvUrl = apiClient.getCsvUrl({
    ...selectionParams(selection),
    from: from || undefined,
    to: to || undefined,
  });

  const [csvDownloading, setCsvDownloading] = useState(false);
  const [csvSavedPath, setCsvSavedPath] = useState<string | null>(null);

  const handleCsvDownload = useCallback(async () => {
    setCsvDownloading(true);
    setCsvSavedPath(null);
    try {
      const path = await saveFile({
        save: () =>
          apiClient.saveCsv({
            ...selectionParams(selection),
            from: from || undefined,
            to: to || undefined,
          }),
        url: csvUrl,
        filename: "qoqa-orders.csv",
      });
      if (path) {
        setCsvSavedPath(path);
        setTimeout(() => setCsvSavedPath(null), 5000);
      }
    } catch (e) {
      console.error("CSV download failed:", e);
    } finally {
      setCsvDownloading(false);
    }
  }, [csvUrl, selection, from, to]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {t("title", { count: pagination.total })}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-9"
                value={search}
                onChange={handleSearch}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                aria-label={t("pageSize")}
                className="h-7 rounded-md border border-input bg-background px-2 py-0 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} {t("pageSize")}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={handleCsvDownload} disabled={csvDownloading}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("csvExport")}
              </Button>
              {csvSavedPath && (
                <span className="text-xs text-muted-foreground truncate max-w-48" title={csvSavedPath}>
                  {t("savedTo", { file: fileName(csvSavedPath) })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {t("colOrderNumber")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {t("colDate")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("colUniverse")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("colOffer")}
                </th>
                <th className="w-full px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("colItem")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                  {t("colAmount")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                  <span className="sr-only">{t("colInvoice")}</span>
                </th>
              </tr>
            </thead>
            <tbody
              aria-busy={loading}
              className={cn(
                "transition-opacity duration-150",
                loading && "opacity-50"
              )}
            >
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {loading ? t("loading") : t("noOrders")}
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(order.order_date)}
                  </td>
                  <td className="px-4 py-3">
                    {order.universe ? (
                      <div className="flex flex-nowrap gap-1">
                        <Badge variant="outline" className="font-normal text-xs">
                          {order.universe_name ?? order.universe}
                        </Badge>
                        {subuniverseLabels(order, subuniverseNames).map(
                          (label) => (
                            <Badge
                              key={label}
                              variant="outline"
                              className="font-normal text-xs"
                            >
                              {label}
                            </Badge>
                          )
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.offer_title ? (
                      <Badge variant="secondary" className="font-normal">
                        {order.offer_title}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate">
                    {order.item_description ?? (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatCHF(parseFloat(order.amount_chf))}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <OrderPdfDialog orderNumber={order.order_number} disabled={!order.has_pdf} />
                      {order.offer_id && (
                        <a
                          href={`https://www.qoqa.ch/${syncLocale}/offers/${order.offer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("viewOnQoqa")}
                          aria-label={t("viewOnQoqa")}
                          className="inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        >
                          <Globe className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {t("pagination", {
                current: currentPage,
                total: pagination.totalPages,
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-md border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                {t("prevPage")}
              </button>
              <button
                onClick={() => handlePage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                className="rounded-md border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                {t("nextPage")}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
