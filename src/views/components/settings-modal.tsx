import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Settings, X, RefreshCw, AlertTriangle, Check, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { AppSettings, SyncProgressEvent } from "../../shared/types";
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/index";

type SyncMode = "full" | "update";

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  rm: "Rumantsch",
};

interface LogEntry {
  type: SyncProgressEvent["type"];
  message: string;
  timestamp: string;
}

function logEntryColor(type: SyncProgressEvent["type"]): string {
  if (
    type === "auth_ok" ||
    type === "universes_ok" ||
    type === "order_synced" ||
    type === "done"
  )
    return "text-green-500";
  if (type === "auth_error" || type === "universes_error" || type === "order_error" || type === "error")
    return "text-red-500";
  if (type === "order_skipped" || type === "cancelled")
    return "text-yellow-500";
  return "text-muted-foreground";
}

export function SettingsModal({ open: controlledOpen, onOpenChange, onDataChanged }: { open?: boolean; onOpenChange?: (open: boolean) => void; onDataChanged?: () => void } = {}) {
  const { t } = useTranslation("Settings");
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  // Settings form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dbMode, setDbMode] = useState<"local" | "postgres">("local");
  const [dbUrl, setDbUrl] = useState("");
  const [uiLocale, setUiLocale] = useState<SupportedLocale>("en");
  const [syncLocale, setSyncLocale] = useState<"fr" | "de">("fr");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDesktop = window.location.protocol === "views:";
  const [dbPath, setDbPath] = useState<string | null>(null);

  // Reset DB
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sync
  const [syncMode, setSyncMode] = useState<SyncMode>("update");
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncLog, setSyncLog] = useState<LogEntry[]>([]);
  const [syncStats, setSyncStats] = useState({ synced: 0, skipped: 0, withPdf: 0, errors: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load settings on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    setConfirmReset(false);
    setResetSuccess(false);
    setSyncDone(false);
    setSyncLog([]);
    setSyncStats({ synced: 0, skipped: 0, withPdf: 0, errors: 0 });
    apiClient
      .getSettings()
      .then((s: AppSettings) => {
        setEmail(s.qoqaEmail ?? "");
        setPassword(s.qoqaPassword ?? "");
        setDbMode(
          s.databaseUrl && s.databaseUrl.startsWith("postgres")
            ? "postgres"
            : "local"
        );
        setDbUrl(s.databaseUrl ?? "");
        setUiLocale(s.uiLocale ?? "en");
        setSyncLocale(s.syncLocale ?? "fr");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    if (isDesktop) {
      apiClient.getDbPath().then((r) => setDbPath(r.path)).catch(console.error);
    }
  }, [open]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [syncLog]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const settings: Partial<AppSettings> = {
        qoqaEmail: email || null,
        qoqaPassword: password || null,
        databaseUrl: dbMode === "postgres" ? dbUrl || null : null,
        uiLocale,
        syncLocale,
      };
      await apiClient.updateSettings(settings);
      setSaved(true);
      // Apply locale change immediately
      if (uiLocale !== i18n.language) {
        await i18n.changeLanguage(uiLocale);
      }
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDb() {
    setResetting(true);
    try {
      await apiClient.resetDatabase();
      setResetSuccess(true);
      setConfirmReset(false);
      onDataChanged?.();
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  }

  async function handleRevealDb() {
    try {
      await apiClient.revealDbInFinder();
    } catch (e) {
      console.error(e);
    }
  }

  function handleRunSync() {
    setSyncRunning(true);
    setSyncDone(false);
    setSyncLog([]);
    setSyncStats({ synced: 0, skipped: 0, withPdf: 0, errors: 0 });

    apiClient.startSync(syncMode).catch(console.error);

    const es = apiClient.createSyncEventSource();
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed: SyncProgressEvent = JSON.parse(event.data);
        setSyncLog((prev) => [
          ...prev,
          {
            type: parsed.type,
            message: parsed.message,
            timestamp: parsed.timestamp,
          },
        ]);
        // Update running counters
        if (parsed.type === "order_synced") {
          setSyncStats((prev) => ({
            ...prev,
            synced: prev.synced + 1,
            withPdf: prev.withPdf + (parsed.data?.hasPdf ? 1 : 0),
          }));
        } else if (parsed.type === "order_skipped") {
          setSyncStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
        } else if (parsed.type === "order_error") {
          setSyncStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
        }
        // Sync finished
        if (parsed.type === "done" || parsed.type === "error" || parsed.type === "cancelled") {
          // Overwrite with authoritative final stats from the server payload if available
          if (parsed.data && "synced" in parsed.data) {
            setSyncStats({
              synced: Number(parsed.data.synced ?? 0),
              withPdf: Number(parsed.data.withPdf ?? 0),
              skipped: Number(parsed.data.skipped ?? 0),
              errors: Number(parsed.data.errors ?? 0),
            });
          }
          setSyncRunning(false);
          setSyncDone(true);
          if (parsed.type === "done") onDataChanged?.();
          es.close();
          esRef.current = null;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setSyncRunning(false);
      setSyncDone(true);
      es.close();
      esRef.current = null;
    };
  }

  async function handleCancelSync() {
    try {
      await apiClient.cancelSync();
    } catch (e) {
      console.error(e);
    } finally {
      esRef.current?.close();
      esRef.current = null;
      setSyncRunning(false);
      setSyncDone(true);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        type="button"
        aria-label={t("title")}
        title={t("title")}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        )}
      >
        <Settings className="size-3.5" aria-hidden />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[90vh] w-[min(95vw,560px)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 shadow-xl",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 transition-[opacity,transform]"
          )}
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0">
            <DialogPrimitive.Title className="font-heading text-sm font-medium">
              {t("title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              title={t("close")}
              aria-label={t("close")}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" aria-hidden />
            </DialogPrimitive.Close>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* ── Credentials ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("credentialsSection")}
                  </h3>
                  <div className="space-y-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("email")}</span>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("password")}</span>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                  </div>
                </section>

                {/* ── Database ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("databaseSection")}
                  </h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dbMode"
                        value="local"
                        checked={dbMode === "local"}
                        onChange={() => setDbMode("local")}
                        className="accent-primary"
                      />
                      <span className="text-sm">{t("dbModeLocal")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dbMode"
                        value="postgres"
                        checked={dbMode === "postgres"}
                        onChange={() => setDbMode("postgres")}
                        className="accent-primary"
                      />
                      <span className="text-sm">{t("dbModePostgres")}</span>
                    </label>
                    {dbMode === "postgres" && (
                      <label className="flex flex-col gap-1 mt-1">
                        <span className="text-xs font-medium">{t("dbUrl")}</span>
                        <Input
                          type="text"
                          value={dbUrl}
                          onChange={(e) => setDbUrl(e.target.value)}
                          placeholder={t("dbUrlPlaceholder")}
                          className="font-mono text-xs"
                        />
                      </label>
                    )}
                  </div>

                  {/* Reset DB */}
                  <div className="pt-1 space-y-2">
                    {!confirmReset ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={resetting}
                        onClick={() => setConfirmReset(true)}
                      >
                        <AlertTriangle className="size-3" />
                        {t("resetDb")}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-destructive">{t("resetDbConfirm")}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={resetting}
                            onClick={handleResetDb}
                          >
                            {resetting && <RefreshCw className="size-3 animate-spin" />}
                            {t("resetDbYes")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resetting}
                            onClick={() => setConfirmReset(false)}
                          >
                            {t("resetDbCancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {resetSuccess && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <Check className="size-3" />
                        {t("resetDbSuccess")}
                      </span>
                    )}
                    {isDesktop && dbPath && (
                      <div className="pt-1">
                        <span className="text-xs font-medium block mb-1">{t("dbLocation")}</span>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-muted/40 rounded px-2 py-1 truncate">{dbPath}</code>
                          <Button variant="outline" size="sm" onClick={handleRevealDb} className="shrink-0 h-7 px-2 text-xs gap-1">
                            <FolderOpen className="size-3" />
                            {t("showInFinder")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Interface language ── */}
                <div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{t("uiLocale")}</span>
                    <select
                      value={uiLocale}
                      onChange={(e) =>
                        setUiLocale(e.target.value as SupportedLocale)
                      }
                      className="h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
                    >
                      {SUPPORTED_LOCALES.map((loc) => (
                        <option key={loc} value={loc}>
                          {LOCALE_NAMES[loc] ?? loc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* ── Save ── */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={saving || loading}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : saved ? (
                      <Check className="size-3" />
                    ) : null}
                    {saved ? t("saved") : t("save")}
                  </Button>
                </div>

                {/* ── Sync ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("syncSection")}
                  </h3>

                  {/* Sync locale select */}
                  <div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("syncLocale")}</span>
                      <select
                        value={syncLocale}
                        onChange={(e) =>
                          setSyncLocale(e.target.value as "fr" | "de")
                        }
                        className="h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
                      >
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                      </select>
                    </label>
                  </div>

                  {/* Sync mode radios */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="syncMode"
                        value="update"
                        checked={syncMode === "update"}
                        onChange={() => setSyncMode("update")}
                        className="accent-primary"
                      />
                      <span className="text-sm">{t("syncModeUpdate")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="syncMode"
                        value="full"
                        checked={syncMode === "full"}
                        onChange={() => setSyncMode("full")}
                        className="accent-primary"
                      />
                      <span className="text-sm">{t("syncModeFull")}</span>
                    </label>
                  </div>

                  {/* Run / cancel */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={syncRunning}
                      onClick={handleRunSync}
                    >
                      <RefreshCw className={cn("size-3", syncRunning && "animate-spin")} />
                      {t("runSync")}
                    </Button>
                    {syncRunning && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelSync}
                      >
                        {t("cancelSync")}
                      </Button>
                    )}
                  </div>

                  {/* Sync stats + log */}
                  {(syncRunning || syncDone) && (
                    <div className="mt-2 space-y-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 rounded-md border bg-muted/30 px-2.5 py-1.5 text-[0.65rem] font-mono">
                        <span className="text-green-500">{syncStats.synced} synced</span>
                        <span className="text-muted-foreground">{syncStats.withPdf} PDF</span>
                        <span className="text-yellow-500">{syncStats.skipped} skipped</span>
                        {syncStats.errors > 0 && (
                          <span className="text-red-500">{syncStats.errors} errors</span>
                        )}
                        {syncRunning && (
                          <span className="ml-auto animate-pulse text-muted-foreground">{t("syncRunning")}</span>
                        )}
                      </div>
                      {syncLog.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-[0.65rem] space-y-0.5">
                          {syncLog.map((entry, i) => (
                            <div
                              key={i}
                              className={cn("leading-relaxed", logEntryColor(entry.type))}
                            >
                              <span className="text-muted-foreground/60 select-none mr-1.5">
                                {entry.timestamp.slice(11, 19)}
                              </span>
                              {entry.message}
                            </div>
                          ))}
                          <div ref={logEndRef} />
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-2 border-t px-4 py-3 shrink-0">
            <DialogPrimitive.Close render={<Button variant="ghost" size="sm" />}>
              {t("close")}
            </DialogPrimitive.Close>
          </footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
