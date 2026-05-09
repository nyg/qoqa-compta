/**
 * Main dashboard — home page of the QoQa Compta application.
 *
 * Fetches data server-side via the /api/orders API route and renders:
 *   - Category picker (top-right header)
 *   - Stats cards (total, count, average)
 *   - Spending charts (monthly bar+line, yearly)
 *   - Orders table with search/filters
 *
 * The page is fully dynamic (no ISR) because it reads URL search params
 * to apply the category filter across all dashboard data.
 */
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchInitialOrders,
  fetchTotalCount,
  fetchCategories,
} from "@/lib/queries";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryPicker } from "@/components/category-picker";

async function fetchDashboardData(categories: string[]) {
  const [stats, monthly, yearly, orders, total, availableCategories] = await Promise.all([
    fetchStats(categories),
    fetchMonthlySpending(categories),
    fetchYearlySpending(categories),
    fetchInitialOrders(categories),
    fetchTotalCount(categories),
    fetchCategories(),
  ]);
  return { stats, monthly, yearly, orders, total, availableCategories };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ categories?: string }>;
}) {
  const t = await getTranslations("Dashboard");
  const { categories: categoriesParam } = await searchParams;
  const selectedCategories = categoriesParam
    ? categoriesParam.split(",").filter(Boolean)
    : [];

  let data;
  try {
    data = await fetchDashboardData(selectedCategories);
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

  const { stats, monthly, yearly, orders, total, availableCategories } = data;

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex items-center gap-2">
          <Suspense>
            <CategoryPicker
              available={availableCategories}
              selected={selectedCategories}
            />
          </Suspense>
          <ThemeToggle />
        </div>
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
          key={selectedCategories.join(",")}
          initialOrders={orders}
          initialPagination={{
            page: 1,
            pageSize: 20,
            total,
            totalPages: Math.ceil(total / 20),
          }}
          selectedCategories={selectedCategories}
        />
      </Suspense>
    </main>
  );
}
