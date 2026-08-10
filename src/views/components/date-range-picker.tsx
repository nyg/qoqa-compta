import { useEffect, useRef, useState } from "react";
import { Calendar, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFormatter } from "@/lib/formatter-context";

interface DateRangePickerProps {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  onFromChange: (val: string | undefined) => void;
  onToChange: (val: string | undefined) => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("DateRangePicker");
  const { formatDate } = useFormatter();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const hasFilter = Boolean(from || to);
  const label =
    !from && !to
      ? t("allTime")
      : from && to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : from
      ? `${t("from")} ${formatDate(from)}`
      : `${t("to")} ${formatDate(to!)}`;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="default"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("label")}
        className={cn(hasFilter && "border-primary")}
      >
        <Calendar className="mr-1.5 h-3.5 w-3.5 opacity-60 shrink-0" />
        <span className="truncate max-w-[12rem]">{label}</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t("label")}
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md p-3 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("from")}
            </label>
            <input
              type="date"
              value={from ?? ""}
              max={to ?? undefined}
              onChange={(e) => onFromChange(e.target.value || undefined)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("to")}
            </label>
            <input
              type="date"
              value={to ?? ""}
              min={from ?? undefined}
              onChange={(e) => onToChange(e.target.value || undefined)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => {
                onFromChange(undefined);
                onToChange(undefined);
                setOpen(false);
              }}
            >
              <X className="mr-1 h-3 w-3" />
              {t("clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
