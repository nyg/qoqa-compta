import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, Download, FileText, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { fileName, saveFile, useShowsSavedPath } from "@/lib/downloads";

interface OrderPdfDialogProps {
  orderNumber: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function OrderPdfDialog({
  orderNumber,
  children,
  className,
  disabled = false,
}: OrderPdfDialogProps) {
  const { t } = useTranslation("PdfDialog");
  const { t: tTable } = useTranslation("OrdersTable");
  const [open, setOpen] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const showsSavedPath = useShowsSavedPath();

  const pdfUrl = apiClient.getPdfUrl(orderNumber);
  const label = disabled ? tTable("noInvoice") : tTable("viewInvoice");

  async function handleDownload() {
    setDownloading(true);
    try {
      const path = await saveFile({
        save: () => apiClient.savePdf(orderNumber),
        url: pdfUrl,
        filename: `invoice-${orderNumber}.pdf`,
      });
      if (path && showsSavedPath) {
        setSavedPath(path);
        setTimeout(() => setSavedPath(null), 5000);
      }
    } catch (e) {
      console.error("PDF download failed:", e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        type="button"
        disabled={disabled}
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
          className
        )}
      >
        {children ?? <FileText className="size-3.5" aria-hidden />}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex h-[90vh] w-[min(95vw,1100px)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 shadow-xl",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 transition-[opacity,transform]"
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <DialogPrimitive.Title className="font-heading text-sm font-medium truncate">
              {t("title", { orderNumber })}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              {savedPath && (
                <span
                  className="max-w-64 truncate text-xs text-muted-foreground"
                  title={savedPath}
                >
                  {t("savedTo", { file: fileName(savedPath) })}
                </span>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                title={t("download")}
                aria-label={t("download")}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {savedPath !== null ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Download className="size-3.5" aria-hidden />
                )}
              </button>
              <DialogPrimitive.Close
                type="button"
                title={t("close")}
                aria-label={t("close")}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </DialogPrimitive.Close>
            </div>
          </header>

          <div className="flex-1 bg-muted/30">
            {open && (
              <iframe
                src={pdfUrl}
                title={t("title", { orderNumber })}
                className="h-full w-full"
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
