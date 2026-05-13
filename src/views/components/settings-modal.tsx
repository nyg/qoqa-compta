import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Settings, X, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { AppSettings, SyncProgressEvent } from "../../shared/types";
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/index";

type SyncMode = "full" | "update";

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

export function SettingsModal() {
  const { t } = useTranslation("Settings");
  const [open, setOpen] = useState(false);

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

  // Reset DB
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sync
  const [syncMode, setSyncMode] = useState<SyncMode>("update");
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncLog, setSyncLog] = useState<LogEntry[]>([]);
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
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setResetting(true);
    try {
      await apiClient.resetDatabase();
      setResetSuccess(true);
      setConfirmReset(false);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  }

  function handleRunSync() {
    setSyncRunning(true);
    setSyncDone(false);
    setSyncLog([]);

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
        if (parsed.type === "done" || parsed.type === "error" || parsed.type === "cancelled") {
          setSyncRunning(false);
          setSyncDone(true);
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
                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={resetting}
                      onClick={handleResetDb}
                    >
                      {resetting ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <AlertTriangle className="size-3" />
                      )}
                      {t("resetDb")}
                    </Button>
                    {confirmReset && !resetting && (
                      <span className="text-xs text-destructive">
                        {t("resetDbConfirm")}
                      </span>
                    )}
                    {resetSuccess && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <Check className="size-3" />
                        {t("resetDbSuccess")}
                      </span>
                    )}
                  </div>
                </section>

                {/* ── Sync ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("syncSection")}
                  </h3>

                  {/* Locale selects */}
                  <div className="grid grid-cols-2 gap-3">
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
                            {loc.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("syncLocale")}</span>
                      <select
                        value={syncLocale}
                        onChange={(e) =>
                          setSyncLocale(e.target.value as "fr" | "de")
                        }
                        className="h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
                      >
                        <option value="fr">FR</option>
                        <option value="de">DE</option>
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
                      {syncRunning ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
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
                    {syncRunning && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        {t("syncRunning")}
                      </span>
                    )}
                    {syncDone && !syncRunning && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <Check className="size-3" />
                        {t("syncDone")}
                      </span>
                    )}
                  </div>

                  {/* Sync log */}
                  {syncLog.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-[0.65rem] space-y-0.5">
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
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-2 border-t px-4 py-3 shrink-0">
            <DialogPrimitive.Close render={<Button variant="ghost" size="sm" />}>
              {t("close")}
            </DialogPrimitive.Close>
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
          </footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
