import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Settings, X, RefreshCw, AlertTriangle, Check, Copy, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";
import { useFormatter } from "@/lib/formatter-context";
import { useInstallInfo } from "@/lib/use-install-info";
import type { SyncLogEntry, SyncMode, SyncRunner } from "@/lib/use-sync-runner";
import type {
  AppSettings,
  CredentialStore,
  CredentialStores,
  SyncProgressEvent,
} from "../../shared/types";

import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/index";

type DbMode = "local" | "postgres";
type DbAction = "clear" | "delete";

function databaseMode(databaseUrl: string | null | undefined): DbMode {
  return databaseUrl?.startsWith("postgres") ? "postgres" : "local";
}

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
    type === "db_ready" ||
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
  const { t: tLog } = useTranslation("SyncLog");
  const { formatTime } = useFormatter();
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
  const [dbMode, setDbMode] = useState<DbMode>("local");
  const [dbUrl, setDbUrl] = useState("");
  const [uiLocale, setUiLocale] = useState<SupportedLocale>(activeLocale);
  const [syncLocale, setSyncLocale] = useState<"fr" | "de">("fr");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dbPath, setDbPath] = useState<string | null>(null);
  const [dbFileExists, setDbFileExists] = useState(false);
  const [savedDbMode, setSavedDbMode] = useState<DbMode>("local");
  const [pathCopied, setPathCopied] = useState(false);
  const [revealFailed, setRevealFailed] = useState(false);
  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [credentialStore, setCredentialStore] = useState<CredentialStores | null>(null);
  const loadedRef = useRef<AppSettings | null>(null);

  const [pendingAction, setPendingAction] = useState<DbAction | null>(null);
  const [destroying, setDestroying] = useState<DbAction | null>(null);
  const [destroySuccess, setDestroySuccess] = useState<DbAction | null>(null);

  // Sync
  const [syncMode, setSyncMode] = useState<SyncMode>("update");
  const { running: syncRunning, done: syncDone, log: syncLog, stats: syncStats } = sync;
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load settings on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    setPendingAction(null);
    setDestroySuccess(null);
    setRevealFailed(false);
    setDestroyError(null);
    setTestResult(null);
    // The sync log is deliberately left alone: the dialog is opened
    // automatically when a run started from the header fails, and clearing it
    // here would discard the very log the user is being shown. `start()`
    // clears it at the beginning of each run.
    apiClient
      .getSettings()
      .then((s: AppSettings) => {
        loadedRef.current = s;
        setEmail(s.qoqaEmail ?? "");
        setPassword(s.qoqaPassword ?? "");
        setDbMode(databaseMode(s.databaseUrl));
        setSavedDbMode(databaseMode(s.databaseUrl));
        setDbUrl(s.databaseUrl ?? "");
        setSyncLocale(s.syncLocale ?? "fr");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    apiClient
      .getDbPath()
      .then((r) => {
        setDbPath(r.path);
        setDbFileExists(r.exists);
      })
      .catch(console.error);
    apiClient.getCredentialStore().then(setCredentialStore).catch(console.error);
  }, [open]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [syncLog]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const settings: Partial<AppSettings> = {
        qoqaEmail: email || null,
        qoqaPassword: password || null,
        databaseUrl: dbMode === "postgres" ? dbUrl || null : null,
        syncLocale,
      };
      const next = await apiClient.updateSettings(settings);
      const dbChanged = next.databaseUrl !== loadedRef.current?.databaseUrl;
      loadedRef.current = next;
      setDbMode(databaseMode(next.databaseUrl));
      setSavedDbMode(databaseMode(next.databaseUrl));
      setDbUrl(next.databaseUrl ?? "");

      if (dbChanged) {
        onDataChanged?.();
        refreshDbFileInfo();
        apiClient.getCredentialStore().then(setCredentialStore).catch(console.error);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const activeIsSqlite = dbPath !== null;
  const dbSelectionPending = dbMode !== savedDbMode;
  const noDatabaseYet = activeIsSqlite && !dbFileExists;
  const missingDbUrl = dbMode === "postgres" && dbUrl.trim() === "";

  function refreshDbFileInfo() {
    apiClient
      .getDbPath()
      .then((r) => {
        setDbPath(r.path);
        setDbFileExists(r.exists);
      })
      .catch(console.error);
  }

  function revealLabel(): string {
    if (install?.platform === "windows") return t("showInExplorer");
    if (install?.platform === "macos") return t("showInFinder");
    return t("showInFileManager");
  }

  async function handleDbAction(action: DbAction) {
    setDestroying(action);
    setDestroyError(null);
    try {
      await (action === "delete"
        ? apiClient.deleteDatabaseFile()
        : apiClient.clearDatabase());
      setDestroySuccess(action);
      setPendingAction(null);
      onDataChanged?.();
      refreshDbFileInfo();
      setTimeout(() => setDestroySuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setDestroyError(e instanceof Error ? e.message : String(e));
    } finally {
      setDestroying(null);
    }
  }

  async function handleTestCredentials() {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(
        await apiClient.testCredentials({ qoqaEmail: email, qoqaPassword: password })
      );
    } catch (e) {
      console.error(e);
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
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

  function logMessage(entry: SyncLogEntry): string {
    if (!entry.messageKey) return entry.message;
    return tLog(entry.messageKey, {
      ...entry.messageParams,
      defaultValue: entry.message,
    });
  }

  function storeName(store: CredentialStore): string | null {
    const keys: Record<CredentialStore["kind"], string | null> = {
      keychain: "storeKeychain",
      "credential-manager": "storeCredentialManager",
      keyring: "storeKeyring",
      file: "storeFile",
      env: "storeEnv",
      none: null,
    };
    const key = keys[store.kind];
    if (key === null) return null;
    return t(key, {
      path: store.path ?? "",
      variable: store.variable ?? "",
    });
  }

  function storedInLabel(carrier: string, store: CredentialStore): string | null {
    const name = storeName(store);
    return name === null ? null : t(carrier, { store: name });
  }

  const saveRow = (blocked = false) => (
    <>
      <hr className="border-border" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            disabled={saving || loading || blocked}
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
        {saveError && (
          <p className="text-xs text-destructive break-words">
            {t("saveFailed", { error: saveError })}
          </p>
        )}
      </div>
    </>
  );

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
            "fixed left-1/2 top-[8vh] z-50 -translate-x-1/2",
            "flex max-h-[84vh] w-[min(95vw,560px)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 shadow-xl",
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
          <Tabs defaultValue="credentials" className="min-h-0 flex-auto">
            <TabsList className="shrink-0 border-b px-4">
              <TabsTab value="credentials">{t("tabCredentials")}</TabsTab>
              <TabsTab value="languages">{t("tabLanguages")}</TabsTab>
              <TabsTab value="database">{t("tabDatabase")}</TabsTab>
              <TabsTab value="sync">{t("tabSync")}</TabsTab>
            </TabsList>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsPanel value="credentials" className="min-h-0 flex-auto overflow-y-auto px-4 py-4 space-y-6">
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
                    {credentialStore && credentialStore.qoqaPassword.kind !== "none" && (
                      <span className="text-[0.65rem] leading-snug text-muted-foreground break-all">
                        {storedInLabel("passwordStoredIn", credentialStore.qoqaPassword)}
                      </span>
                    )}
                  </label>
                  <div className="space-y-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={testing || !email || !password}
                      onClick={handleTestCredentials}
                    >
                      {testing ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : testResult?.ok ? (
                        <Check className="size-3" />
                      ) : null}
                      {t("testConnection")}
                    </Button>
                    {testResult?.ok && (
                      <p className="text-xs text-green-500">{t("testConnectionOk")}</p>
                    )}
                    {testResult && !testResult.ok && (
                      <p className="text-xs text-destructive break-words">
                        {t("testConnectionFailed", { error: testResult.error })}
                      </p>
                    )}
                  </div>
                </div>

                  {saveRow()}
                </TabsPanel>

                <TabsPanel value="languages" className="min-h-0 flex-auto overflow-y-auto px-4 py-4 space-y-6">
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

                  {saveRow()}
                </TabsPanel>

                <TabsPanel value="database" className="min-h-0 flex-auto overflow-y-auto px-4 py-4 space-y-6">
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
                      {credentialStore && credentialStore.databaseUrl.kind !== "none" && (
                        <span className="text-[0.65rem] leading-snug text-muted-foreground break-all">
                          {storedInLabel("databaseUrlStoredIn", credentialStore.databaseUrl)}
                        </span>
                      )}
                    </label>
                  )}
                </div>

                {dbMode === "local" && dbPath && dbFileExists && (
                  <div className="pt-1">
                    <span className="text-xs font-medium block mb-1">{t("dbLocation")}</span>
                    <div className="flex items-center gap-2">
                      <code title={dbPath} className="flex-1 text-xs font-mono bg-muted/40 rounded px-2 py-1 truncate">{dbPath}</code>
                      {install && install.method !== "web" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevealDb}
                          className="shrink-0 h-7 px-2 text-xs gap-1"
                        >
                          <FolderOpen className="size-3" />
                          {revealLabel()}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        title={pathCopied ? t("pathCopied") : t("copyPath")}
                        aria-label={pathCopied ? t("pathCopied") : t("copyPath")}
                        className="shrink-0 h-7 px-2 text-xs gap-1"
                        onClick={() => {
                          void copyText(dbPath).then((copied) => {
                            setPathCopied(copied);
                            if (copied) setTimeout(() => setPathCopied(false), 2000);
                          });
                        }}
                      >
                        {pathCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                    {revealFailed && (
                      <p className="mt-1 text-xs text-destructive">{t("revealFailed")}</p>
                    )}
                  </div>
                )}

                <div className="pt-1 space-y-2">
                  {dbSelectionPending ? null : pendingAction ? (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive">
                        {pendingAction === "delete" ? t("deleteDbConfirm") : t("clearDbConfirm")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={destroying !== null}
                          onClick={() => handleDbAction(pendingAction)}
                        >
                          {destroying && <RefreshCw className="size-3 animate-spin" />}
                          {pendingAction === "delete" ? t("deleteDbYes") : t("clearDbYes")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={destroying !== null}
                          onClick={() => setPendingAction(null)}
                        >
                          {t("dbActionCancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={noDatabaseYet}
                          onClick={() => setPendingAction("clear")}
                        >
                          <AlertTriangle className="size-3" />
                          {t("clearDb")}
                        </Button>
                        {activeIsSqlite && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={noDatabaseYet}
                            onClick={() => setPendingAction("delete")}
                          >
                            <AlertTriangle className="size-3" />
                            {t("deleteDb")}
                          </Button>
                        )}
                      </div>
                      {noDatabaseYet && (
                        <p className="text-xs text-muted-foreground">{t("noDatabaseYet")}</p>
                      )}
                    </>
                  )}
                  {destroySuccess && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="size-3" />
                      {destroySuccess === "delete" ? t("deleteDbSuccess") : t("clearDbSuccess")}
                    </span>
                  )}
                  {destroyError && (
                    <p className="text-xs text-destructive break-words">{destroyError}</p>
                  )}
                </div>

                  {saveRow(missingDbUrl)}
                </TabsPanel>

                <TabsPanel value="sync" className="min-h-0 flex-auto overflow-y-auto px-4 py-4 space-y-6">
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
                      <span className="text-green-500">
                        {t("statsSynced", { count: syncStats.synced })}
                      </span>
                      <span className="text-muted-foreground">
                        {t("statsPdf", { count: syncStats.withPdf })}
                      </span>
                      <span className="text-yellow-500">
                        {t("statsSkipped", { count: syncStats.skipped })}
                      </span>
                      {syncStats.errors > 0 && (
                        <span className="text-red-500">
                          {t("statsErrors", { count: syncStats.errors })}
                        </span>
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
                              {formatTime(entry.timestamp)}
                            </span>
                            {logMessage(entry)}
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    )}
                  </div>
                )}
                </TabsPanel>

              </>
            )}
          </Tabs>

        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
