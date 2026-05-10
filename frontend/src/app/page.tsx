import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchInitialOrders,
  fetchTotalCount,
  fetchUniverses,
  fetchSpendingByGroup,
} from "@/lib/queries";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { UniversePicker } from "@/components/universe-picker";

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
    // Fetch universe metadata first — needed to resolve sub-universe parent
    // universes and determine which pie chart mode to use.
    const availableUniverses = await fetchUniverses();

    // When nothing is selected, treat it as "all universes selected" so that
    // every downstream query sees a concrete IN-list and returns all rows.
    const effectiveUniverses =
      selectedUniverses.length === 0 && selectedSubuniverses.length === 0
        ? availableUniverses.map((u) => u.identifier)
        : selectedUniverses;
    const effectiveSubuniverses = selectedSubuniverses;

    // Build a subuniverse→universe map to count distinct parent universes.
    const subToUniverse = new Map(
      availableUniverses.flatMap((u) =>
        u.subuniverses.map((s) => [s.identifier, u.identifier])
      )
    );
    const activeUniverseIds = new Set([
      ...effectiveUniverses,
      ...effectiveSubuniverses
        .map((s) => subToUniverse.get(s))
        .filter((v): v is string => v !== undefined),
    ]);
    const pieMode: "universe" | "subuniverse" | null =
      activeUniverseIds.size === 0
        ? null
        : activeUniverseIds.size === 1
        ? "subuniverse"
        : "universe";

    const [stats, monthly, yearly, orders, total, pieData] = await Promise.all([
      fetchStats(effectiveUniverses, effectiveSubuniverses),
      fetchMonthlySpending(effectiveUniverses, effectiveSubuniverses),
      fetchYearlySpending(effectiveUniverses, effectiveSubuniverses),
      fetchInitialOrders(effectiveUniverses, effectiveSubuniverses),
      fetchTotalCount(effectiveUniverses, effectiveSubuniverses),
      pieMode !== null
        ? fetchSpendingByGroup(pieMode, effectiveUniverses, effectiveSubuniverses)
        : Promise.resolve(null),
    ]);

    data = { stats, monthly, yearly, orders, total, availableUniverses, pieData, pieMode };
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

  const { stats, monthly, yearly, orders, total, availableUniverses, pieData, pieMode } = data;

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
        <SpendingChart monthly={monthly} yearly={yearly} pieData={pieData} pieMode={pieMode} />
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
