import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Settings, X, RefreshCw, AlertTriangle, Check, Copy, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useInstallInfo } from "@/lib/use-install-info";
import type { SyncMode, SyncRunner } from "@/lib/use-sync-runner";
import type { AppSettings, CredentialStore, SyncProgressEvent } from "../../shared/types";
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/index";

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  rm: "Rumantsch",
};

// supportedLngs is configured in views/i18n, so i18next has already narrowed whatever
// was detected to one of SUPPORTED_LOCALES — de-CH arrives as de, an unsupported tag as
// the configured fallback. Re-checking the list here would only duplicate that config.
function activeLocale(): SupportedLocale {
  return (i18n.resolvedLanguage ?? i18n.language) as SupportedLocale;
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

export function SettingsModal({
  open: controlledOpen,
  onOpenChange,
  onDataChanged,
  sync,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDataChanged?: () => void;
  sync: SyncRunner;
}) {
  const { t } = useTranslation("Settings");
  const install = useInstallInfo();
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
  const [uiLocale, setUiLocale] = useState<SupportedLocale>(activeLocale);
  const [syncLocale, setSyncLocale] = useState<"fr" | "de">("fr");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [dbPath, setDbPath] = useState<string | null>(null);
  const [pathCopied, setPathCopied] = useState(false);
  const [revealFailed, setRevealFailed] = useState(false);
  const [credentialStore, setCredentialStore] = useState<CredentialStore | null>(null);

  // Reset DB
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sync
  const [syncMode, setSyncMode] = useState<SyncMode>("update");
  const { running: syncRunning, done: syncDone, log: syncLog, stats: syncStats } = sync;
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load settings on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    setConfirmReset(false);
    setResetSuccess(false);
    setRevealFailed(false);
    // The sync log is deliberately left alone: the dialog is opened
    // automatically when a run started from the header fails, and clearing it
    // here would discard the very log the user is being shown. `start()`
    // clears it at the beginning of each run.
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
        setSyncLocale(s.syncLocale ?? "fr");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    apiClient.getDbPath().then((r) => setDbPath(r.path)).catch(console.error);
    apiClient.getCredentialStore().then(setCredentialStore).catch(console.error);
  }, [open]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [syncLog]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const settings: Partial<AppSettings> = {
        qoqaEmail: email || null,
        qoqaPassword: password || null,
        databaseUrl: dbMode === "postgres" ? dbUrl || null : null,
        syncLocale,
      };
      await apiClient.updateSettings(settings);
      setSaved(true);
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
    setRevealFailed(false);
    try {
      await apiClient.revealDbInFinder();
    } catch (e) {
      console.error(e);
      setRevealFailed(true);
    }
  }

  function credentialStoreLabel(store: CredentialStore): string {
    const keys: Record<CredentialStore["kind"], string> = {
      keychain: "credentialStoreKeychain",
      "credential-manager": "credentialStoreCredentialManager",
      keyring: "credentialStoreKeyring",
      file: "credentialStoreFile",
      env: "credentialStoreEnv",
    };
    return t(keys[store.kind], { path: store.path ?? "" });
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
            "flex h-[min(90vh,620px)] w-[min(95vw,560px)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 shadow-xl",
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
          <Tabs defaultValue="settings" className="min-h-0 flex-1">
            <TabsList className="shrink-0 border-b px-4">
              <TabsTab value="settings">{t("tabSettings")}</TabsTab>
              <TabsTab value="sync">{t("tabSync")}</TabsTab>
            </TabsList>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsPanel value="settings" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-6">
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
                      {credentialStore && (
                        <span className="text-[0.65rem] leading-snug text-muted-foreground break-all">
                          {credentialStoreLabel(credentialStore)}
                        </span>
                      )}
                    </label>
                  </div>
                </section>

                {/* ── Languages ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("languagesSection")}
                  </h3>
                  <div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("uiLocale")}</span>
                      <select
                        value={uiLocale}
                        onChange={(e) => {
                          const next = e.target.value as SupportedLocale;
                          setUiLocale(next);
                          // Applied here rather than on Save: the language is not part
                          // of what Save sends any more, so leaving it behind the
                          // request meant a failing server silently kept the old one.
                          i18n.changeLanguage(next);
                        }}
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

                  <div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{t("syncLocale")}</span>
                      <select
                        value={syncLocale}
                        onChange={(e) => setSyncLocale(e.target.value as "fr" | "de")}
                        className="h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
                      >
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                      </select>
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
                    {dbPath && (
                      <div className="pt-1">
                        <span className="text-xs font-medium block mb-1">{t("dbLocation")}</span>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-muted/40 rounded px-2 py-1 truncate">{dbPath}</code>
                          {install && install.method !== "web" ? (
                            <Button variant="outline" size="sm" onClick={handleRevealDb} className="shrink-0 h-7 px-2 text-xs gap-1">
                              <FolderOpen className="size-3" />
                              {t("showInFinder")}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 h-7 px-2 text-xs gap-1"
                              onClick={() => {
                                navigator.clipboard.writeText(dbPath).then(() => {
                                  setPathCopied(true);
                                  setTimeout(() => setPathCopied(false), 2000);
                                }).catch(console.error);
                              }}
                            >
                              {pathCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                            </Button>
                          )}
                        </div>
                        {revealFailed && (
                          <p className="mt-1 text-xs text-destructive">{t("showInFinderFailed")}</p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <hr className="border-border" />

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

                </TabsPanel>

                <TabsPanel value="sync" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <section className="space-y-3">
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
                      onClick={() => sync.start(syncMode)}
                    >
                      <RefreshCw className={cn("size-3", syncRunning && "animate-spin")} />
                      {t("runSync")}
                    </Button>
                    {syncRunning && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={sync.cancel}
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
                </TabsPanel>
              </>
            )}
          </Tabs>

        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
