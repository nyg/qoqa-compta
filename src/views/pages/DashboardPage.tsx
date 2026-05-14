import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, Loader2, RefreshCw, Settings } from "lucide-react";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { UniversePicker } from "@/components/universe-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useFilterState, type FilterState } from "@/lib/use-filter-state";
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
  const { t, i18n } = useTranslation("Dashboard");
  const { filters, setFilters } = useFilterState();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const qoqaLang = i18n.language === "de" ? "de" : "fr";
  const qoqaUrl = `https://www.qoqa.ch/${qoqaLang}/my_account/orders`;

  const loadDashboard = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getDashboard({
        universes: f.universes.length > 0 ? f.universes : undefined,
        subuniverses: f.subuniverses.length > 0 ? f.subuniverses : undefined,
        from: f.from,
        to: f.to,
      });
      setData(result);
      setDataVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(filters);
  }, [filters, loadDashboard]);

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
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-heading text-sm font-semibold truncate">QoQa Compta</h1>
            {loading && data && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            )}
            <span className="hidden text-xs text-muted-foreground sm:block">
              <Trans
                i18nKey="subtitle"
                ns="Dashboard"
                components={{
                  qoqa: (
                    <a
                      href={qoqaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-foreground transition-colors"
                    />
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
                  selected={filters.universes}
                  selectedSubuniverses={filters.subuniverses}
                  onFiltersChange={(universes, subuniverses) =>
                    setFilters({ universes, subuniverses })
                  }
                />
                <DateRangePicker
                  from={filters.from}
                  to={filters.to}
                  onFromChange={(val) => setFilters({ from: val })}
                  onToChange={(val) => setFilters({ to: val })}
                />
              </>
            )}
            <ThemeToggle />
            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-screen-2xl px-3 py-6 space-y-4">
        {!data && loading && <LoadingSkeleton />}
        {!data && !loading && error && (
          <ErrorState message={error} onRetry={() => loadDashboard(filters)} />
        )}
        {data && (
          <>
            {data.stats.order_count === 0 &&
            filters.universes.length === 0 &&
            filters.subuniverses.length === 0 &&
            !filters.from &&
            !filters.to ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <Settings className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("emptyTitle")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Trans
                      i18nKey="emptyDetail"
                      ns="Dashboard"
                      components={{
                        settings: (
                          <button
                            type="button"
                            className="underline underline-offset-4 hover:text-foreground transition-colors"
                            onClick={() => {
                              setSettingsOpen(true);
                            }}
                          />
                        ),
                      }}
                    />
                  </p>
                </div>
              </div>
            ) : (
              <>
                <StatsCards stats={data.stats} />
                <SpendingChart
                  monthly={data.monthly}
                  yearly={data.yearly}
                  pieData={data.pieData}
                  pieMode={data.pieMode}
                />
                <OrdersTable
                  key={dataVersion}
                  initialOrders={data.orders}
                  initialPagination={data.pagination}
                  selectedUniverses={filters.universes}
                  selectedSubuniverses={filters.subuniverses}
                  subuniverseNames={subuniverseNames}
                  from={filters.from}
                  to={filters.to}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
