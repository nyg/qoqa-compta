import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, FilterX, Loader2, RefreshCw, Settings } from "lucide-react";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import { UniversePicker } from "@/components/universe-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { HAS_INSET_TITLEBAR } from "@/lib/desktop";
import { useFilterState, type FilterState } from "@/lib/use-filter-state";
import { useSyncRunner } from "@/lib/use-sync-runner";
import {
  isNothingSelected,
  normalizeSelection,
  selectionParams,
  selectionsEqual,
} from "../../shared/filters";
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

function NoDataState({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation("Dashboard");
  return (
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
                  onClick={onOpenSettings}
                />
              ),
            }}
          />
        </p>
      </div>
    </div>
  );
}

function NoUniverseState() {
  const { t } = useTranslation("Dashboard");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <FilterX className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">{t("noUniverseTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("noUniverseDetail")}
        </p>
      </div>
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
        ...selectionParams(f.selection),
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

  useEffect(() => {
    if (!data) return;
    const normalized = normalizeSelection(filters.selection, data.universes);
    if (!selectionsEqual(normalized, filters.selection)) {
      setFilters({ selection: normalized });
    }
  }, [data, filters.selection, setFilters]);

  // Shared by the header shortcut and the settings dialog, so a sync started
  // from either shows its progress in the other.
  const sync = useSyncRunner(() => loadDashboard(filters));

  // A sync started from the header has nowhere to report a failure (missing
  // credentials, bad login…), so surface the dialog holding the log.
  useEffect(() => {
    if (!sync.done) return;
    const failed = sync.log.some(
      (e) => e.type === "error" || e.type === "auth_error"
    );
    if (failed) setSettingsOpen(true);
  }, [sync.done, sync.log]);

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
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-6 py-2.5",
            HAS_INSET_TITLEBAR && "pl-[5.5rem]"
          )}
        >
          <div className="electrobun-webkit-app-region-drag flex items-center gap-2 min-w-0">
            <h1 className="font-heading text-sm font-semibold truncate">QoQa Compta</h1>
            <Loader2
              aria-hidden
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
                loading && data ? "animate-spin opacity-100" : "opacity-0"
              )}
            />
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
                      className="electrobun-webkit-app-region-no-drag underline underline-offset-4 hover:text-foreground transition-colors"
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
                  selection={filters.selection}
                  onSelectionChange={(selection) => setFilters({ selection })}
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
            <Button
              variant="outline"
              size="icon"
              aria-label={t("syncNow")}
              title={t("syncNow")}
              disabled={sync.running}
              onClick={() => sync.start("update")}
            >
              <RefreshCw className={cn(sync.running && "animate-spin")} />
            </Button>
            <SettingsModal
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onDataChanged={() => loadDashboard(filters)}
              sync={sync}
            />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="px-6 py-6 space-y-4">
        {!data && loading && <LoadingSkeleton />}
        {!data && !loading && error && (
          <ErrorState message={error} onRetry={() => loadDashboard(filters)} />
        )}
        {data &&
          (data.universes.length === 0 && data.stats.order_count === 0 ? (
            <NoDataState onOpenSettings={() => setSettingsOpen(true)} />
          ) : isNothingSelected(filters.selection) ? (
            <NoUniverseState />
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
                selection={filters.selection}
                subuniverseNames={subuniverseNames}
                syncLocale={data.syncLocale}
                from={filters.from}
                to={filters.to}
              />
            </>
          ))}
      </main>
    </div>
  );
}
