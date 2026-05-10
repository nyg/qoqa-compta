/**
 * Main dashboard — home page of the QoQa Compta application.
 *
 * Fetches data server-side via the /api/orders API route and renders:
 *   - Universe picker (top-right header)
 *   - Stats cards (total, count, average)
 *   - Spending charts (monthly bar+line, yearly)
 *   - Orders table with search/filters
 *
 * The page is fully dynamic (no ISR) because it reads URL search params
 * to apply the universe filter across all dashboard data.
 */
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchInitialOrders,
  fetchTotalCount,
  fetchUniverses,
} from "@/lib/queries";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { UniversePicker } from "@/components/universe-picker";

async function fetchDashboardData(universes: string[], subuniverses: string[]) {
  const [stats, monthly, yearly, orders, total, availableUniverses] = await Promise.all([
    fetchStats(universes, subuniverses),
    fetchMonthlySpending(universes, subuniverses),
    fetchYearlySpending(universes, subuniverses),
    fetchInitialOrders(universes, subuniverses),
    fetchTotalCount(universes, subuniverses),
    fetchUniverses(),
  ]);
  return { stats, monthly, yearly, orders, total, availableUniverses };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ universes?: string; subuniverses?: string }>;
}) {
  const t = await getTranslations("Dashboard");
  const { universes: universesParam, subuniverses: subuniversesParam } = await searchParams;
  const selectedUniverses = universesParam
    ? universesParam.split(",").filter(Boolean)
    : [];
  const selectedSubuniverses = subuniversesParam
    ? subuniversesParam.split(",").filter(Boolean)
    : [];

  let data;
  try {
    data = await fetchDashboardData(selectedUniverses, selectedSubuniverses);
  } catch {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">QoQa Compta</h1>
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">{t("errorTitle")}</p>
          <p className="text-sm mt-1">{t.rich("errorDetail", { code: (c) => <code>{c}</code> })}</p>
        </div>
      </main>
    );
  }

  const { stats, monthly, yearly, orders, total, availableUniverses } = data;

  const subuniverseNames: Record<string, string> = Object.fromEntries(
    availableUniverses.flatMap((u) => u.subuniverses.map((s) => [s.identifier, s.name]))
  );

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
            <UniversePicker
              available={availableUniverses}
              selected={selectedUniverses}
              selectedSubuniverses={selectedSubuniverses}
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
          key={`${selectedUniverses.join(",")}-${selectedSubuniverses.join(",")}`}
          initialOrders={orders}
          initialPagination={{
            page: 1,
            pageSize: 20,
            total,
            totalPages: Math.ceil(total / 20),
          }}
          selectedUniverses={selectedUniverses}
          selectedSubuniverses={selectedSubuniverses}
          subuniverseNames={subuniverseNames}
        />
      </Suspense>
    </main>
  );
}
