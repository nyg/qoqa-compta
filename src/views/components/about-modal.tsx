import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  AlertCircle,
  ArrowUpCircle,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { useFormatter } from "@/lib/formatter-context";
import { useInstallInfo } from "@/lib/use-install-info";
import {
  APP_VERSION,
  useLatestRelease,
  type LatestReleaseState,
} from "@/lib/use-latest-release";
import type { InstallMethod } from "../../shared/types";

const REPOSITORY_URL = "https://github.com/nyg/qoqa-compta";
const COPIED_FEEDBACK_MS = 1500;

const UPDATE_COMMANDS: Partial<
  Record<InstallMethod, { command: string; hint: string }>
> = {
  homebrew: {
    command: "brew upgrade --cask nyg/tap/qoqa-compta",
    hint: "updateWithHomebrew",
  },
  scoop: { command: "scoop update qoqa-compta", hint: "updateWithScoop" },
};

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation("About");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={copied ? t("copied") : t("copy")}
      aria-label={copied ? t("copied") : t("copy")}
      onClick={() => {
        void copyText(value).then(setCopied);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function UpdateStatus({
  release,
  loading,
  failed,
  updateAvailable,
}: LatestReleaseState) {
  const { t } = useTranslation("About");

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" aria-hidden />
        {t("checking")}
      </p>
    );
  }

  if (failed || !release) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="size-3.5" aria-hidden />
        {t("checkFailed")}
      </p>
    );
  }

  if (!updateAvailable) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden />
        {t("upToDate")}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-xs">
      <ArrowUpCircle className="size-3.5 text-muted-foreground" aria-hidden />
      <span>
        {t("updateAvailable", { version: release.version })}{" "}
        <a
          href={release.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4"
        >
          {t("releaseNotes")}
        </a>
      </span>
    </p>
  );
}

function UpdateSection() {
  const { t } = useTranslation("About");
  const { formatDateTime } = useFormatter();
  const { check, ...status } = useLatestRelease();
  const install = useInstallInfo();

  const update = install ? UPDATE_COMMANDS[install.method] : undefined;
  const showDownloadLink =
    !update && status.updateAvailable && status.release !== null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("updates")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={check}
          disabled={status.loading}
        >
          <RefreshCw className={cn(status.loading && "animate-spin")} />
          {t("checkNow")}
        </Button>
      </div>

      <div className="space-y-1">
        <UpdateStatus {...status} />
        {status.checkedAt && (
          <p className="text-xs text-muted-foreground">
            {t("lastChecked", { when: formatDateTime(status.checkedAt) })}
          </p>
        )}
      </div>

      {update && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t(update.hint)}</p>
          <div className="flex items-center gap-1 rounded bg-muted py-1 pl-2 pr-1">
            <code className="flex-1 truncate font-mono text-[0.7rem]">
              {update.command}
            </code>
            <CopyButton value={update.command} />
          </div>
        </div>
      )}

      {showDownloadLink && (
        <p className="text-xs">
          <a
            href={status.release!.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4"
          >
            {t("downloadUpdate")}
          </a>
        </p>
      )}
    </section>
  );
}

export function AboutModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("About");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[90vh] w-[min(95vw,460px)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 shadow-xl",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 transition-[opacity,transform]"
          )}
        >
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

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <section className="space-y-1">
              <h3 className="font-heading text-sm font-semibold">QoQa Compta</h3>
              <p className="text-xs text-muted-foreground tabular-nums">
                {APP_VERSION ? t("version", { version: APP_VERSION }) : t("devBuild")}
              </p>
            </section>

            <UpdateSection />

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("project")}
              </h3>
              <p className="text-xs">
                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  {t("sourceCode")}
                </a>
                <span className="text-muted-foreground"> — {t("license")}</span>
              </p>
              <p className="text-xs">
                <a
                  href={`${REPOSITORY_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  {t("reportIssue")}
                </a>
              </p>
            </section>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
