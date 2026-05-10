/**
 * OrderPdfDialog — modal popup that displays a stored invoice PDF.
 *
 * Uses Base UI's Dialog primitive and an <iframe> pointing at
 * /api/orders/[orderNumber]/pdf, which streams the BLOB/BYTEA stored on the
 * order row. We rely on the browser's native PDF viewer; no extra JS-side
 * PDF library is needed.
 */
"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Download, FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface OrderPdfDialogProps {
  orderNumber: string;
  /** Raw button content (icon). Falls back to a FileText icon. */
  children?: React.ReactNode;
  className?: string;
  /** Disabled state — no PDF stored for this order. */
  disabled?: boolean;
}

export function OrderPdfDialog({
  orderNumber,
  children,
  className,
  disabled = false,
}: OrderPdfDialogProps) {
  const t = useTranslations("PdfDialog");
  const tTable = useTranslations("OrdersTable");
  const [open, setOpen] = useState(false);

  const pdfUrl = `/api/orders/${encodeURIComponent(orderNumber)}/pdf`;
  const label = disabled ? tTable("noInvoice") : tTable("viewInvoice");

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
              <a
                href={pdfUrl}
                download
                title={t("download")}
                aria-label={t("download")}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Download className="size-3.5" aria-hidden />
              </a>
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
