import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw } from "lucide-react";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { UniversePicker } from "@/components/universe-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { DashboardData } from "../../shared/types";

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-72 rounded-lg bg-muted" />
        <div className="h-72 rounded-lg bg-muted" />
      </div>
      <div className="h-96 rounded-lg bg-muted" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("Dashboard");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div>
        <p className="font-medium">{t("errorTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans
            i18nKey="errorDetail"
            ns="Dashboard"
            components={{ code: <code className="font-mono text-xs bg-muted px-1 rounded" /> }}
          />
        </p>
        {message && (
          <p className="mt-2 font-mono text-xs text-muted-foreground opacity-70">
            {message}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3" />
        Retry
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation("Dashboard");
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse filter params from URL
  const universesParam = searchParams.get("universes");
  const subuniversesParam = searchParams.get("subuniverses");
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const selectedUniverses = universesParam
    ? universesParam.split(",").filter(Boolean)
    : [];
  const selectedSubuniverses = subuniversesParam
    ? subuniversesParam.split(",").filter(Boolean)
    : [];

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getDashboard({
        universes: selectedUniverses.length > 0 ? selectedUniverses : undefined,
        subuniverses:
          selectedSubuniverses.length > 0 ? selectedSubuniverses : undefined,
        from,
        to,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Reload whenever search params change
  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Build a subuniverse name lookup for the orders table
  const subuniverseNames: Record<string, string> = {};
  if (data?.universes) {
    for (const u of data.universes) {
      for (const s of u.subuniverses) {
        subuniverseNames[s.identifier] = s.name;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-heading text-sm font-semibold truncate">
              qoqa-compta
            </h1>
            <span className="hidden text-xs text-muted-foreground sm:block">
              <Trans
                i18nKey="subtitle"
                ns="Dashboard"
                components={{
                  link: (
                    <a
                      href="https://qoqa.ch/fr/my_account/orders"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-foreground transition-colors"
                    >
                      QoQa.ch
                    </a>
                  ),
                }}
              />
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {data && (
              <>
                <UniversePicker
                  available={data.universes}
                  selected={selectedUniverses}
                  selectedSubuniverses={selectedSubuniverses}
                />
                <DateRangePicker from={from} to={to} />
              </>
            )}
            <ThemeToggle />
            <SettingsModal />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {loading && <LoadingSkeleton />}
        {!loading && error && (
          <ErrorState message={error} onRetry={loadDashboard} />
        )}
        {!loading && !error && data && (
          <>
            <StatsCards stats={data.stats} />
            <SpendingChart
              monthly={data.monthly}
              yearly={data.yearly}
              pieData={data.pieData}
              pieMode={data.pieMode}
            />
            <OrdersTable
              initialOrders={data.orders}
              initialPagination={data.pagination}
              selectedUniverses={selectedUniverses}
              selectedSubuniverses={selectedSubuniverses}
              subuniverseNames={subuniverseNames}
              from={from}
              to={to}
            />
          </>
        )}
      </main>
    </div>
  );
}
