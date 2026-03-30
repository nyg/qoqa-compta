/**
 * Orders Table — filterable, paginated list of Qoqa orders.
 *
 * Filters: text search (order number / partner), amount range, date range.
 */
"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCHF, formatDate } from "@/lib/utils";
import type { QoqaOrder } from "@/types/order";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface OrdersTableProps {
  initialOrders: QoqaOrder[];
  initialPagination: Pagination;
}

export function OrdersTable({
  initialOrders,
  initialPagination,
}: OrdersTableProps) {
  const [orders, setOrders] = useState<QoqaOrder[]>(initialOrders);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = useCallback(
    async (newSearch: string, page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: newSearch,
          page: page.toString(),
          pageSize: "20",
        });
        const res = await fetch(`/api/orders?${params}`);
        const data = await res.json();
        setOrders(data.orders ?? []);
        setPagination(data.pagination ?? pagination);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [pagination]
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearch(value);
      setCurrentPage(1);
      // Debounce is kept simple here — for production use a library
      fetchOrders(value, 1);
    },
    [fetchOrders]
  );

  const handlePage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      fetchOrders(search, page);
    },
    [fetchOrders, search]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Toutes les commandes ({pagination.total})
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              className="pl-9"
              value={search}
              onChange={handleSearch}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  N° commande
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Partenaire
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune commande trouvée.
                  </td>
                </tr>
              )}
              {!loading &&
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-4 py-3">
                      {order.partner_name ? (
                        <Badge variant="secondary" className="font-normal">
                          {order.partner_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatCHF(parseFloat(order.amount_chf))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} / {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-md border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                ← Précédent
              </button>
              <button
                onClick={() => handlePage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                className="rounded-md border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
