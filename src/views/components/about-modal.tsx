import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AlertCircle, ArrowUpCircle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { APP_VERSION, useLatestRelease } from "@/lib/use-latest-release";

const REPOSITORY_URL = "https://github.com/nyg/qoqa-compta";
const SCOOP_COMMAND = "scoop update qoqa-compta";
const HOMEBREW_COMMAND = "brew upgrade --cask nyg/tap/qoqa-compta";

function UpdateStatus() {
  const { t } = useTranslation("About");
  const { release, loading, failed, updateAvailable } = useLatestRelease();

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

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("updates")}
              </h3>
              <UpdateStatus />
              <p className="text-xs text-muted-foreground">{t("packageManagers")}</p>
              <div className="space-y-1">
                <code className="block rounded bg-muted px-2 py-1 font-mono text-[0.7rem]">
                  {SCOOP_COMMAND}
                </code>
                <code className="block rounded bg-muted px-2 py-1 font-mono text-[0.7rem]">
                  {HOMEBREW_COMMAND}
                </code>
              </div>
            </section>

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
