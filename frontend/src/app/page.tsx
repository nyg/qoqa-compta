/**
 * Main dashboard — home page of the QoQa Compta application.
 *
 * Fetches data server-side via the /api/orders API route and renders:
 *   - Stats cards (total, count, average)
 *   - Spending charts (monthly bar+line, yearly)
 *   - Orders table with search/filters
 */
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchInitialOrders,
  fetchTotalCount,
} from "@/lib/queries";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";

// Revalidate this page every 5 minutes
export const revalidate = 300;

async function fetchDashboardData() {
  const [stats, monthly, yearly, orders, total] = await Promise.all([
    fetchStats(),
    fetchMonthlySpending(),
    fetchYearlySpending(),
    fetchInitialOrders(),
    fetchTotalCount(),
  ]);
  return { stats, monthly, yearly, orders, total };
}

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  let data;
  try {
    data = await fetchDashboardData();
  } catch {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">QoQa Compta</h1>
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">{t("errorTitle")}</p>
          <p className="text-sm mt-1">
            {t.rich("errorDetail", {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </p>
        </div>
      </main>
    );
  }

  const { stats, monthly, yearly, orders, total } = data;

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">QoQa Compta</h1>
        <p className="text-muted-foreground mt-1">
          {t.rich("subtitle", {
            link: (chunks) => (
              <a
                href="https://www.qoqa.ch/fr/my_account/orders"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>

      {/* Stats cards */}
      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}>
        <StatsCards stats={stats} />
      </Suspense>

      {/* Spending charts */}
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <SpendingChart monthly={monthly} yearly={yearly} />
      </Suspense>

      {/* Orders table */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <OrdersTable
          initialOrders={orders}
          initialPagination={{
            page: 1,
            pageSize: 20,
            total,
            totalPages: Math.ceil(total / 20),
          }}
        />
      </Suspense>
    </main>
  );
}
