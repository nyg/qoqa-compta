/**
 * DateRangePicker — popover with two date inputs (from / to) for filtering
 * orders by date range.
 *
 * Selected range is encoded as ?from=YYYY-MM-DD&to=YYYY-MM-DD in the URL.
 * An empty selection means "all dates" (no date filter applied).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFormatter } from "@/lib/formatter-context";

interface DateRangePickerProps {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("DateRangePicker");
  const { formatDate } = useFormatter();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function pushParams(nextFrom: string | null, nextTo: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom) {
      params.set("from", nextFrom);
    } else {
      params.delete("from");
    }
    if (nextTo) {
      params.set("to", nextTo);
    } else {
      params.delete("to");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilter = Boolean(from || to);
  const label =
    !from && !to
      ? t("allDates")
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
              onChange={(e) => pushParams(e.target.value || null, to ?? null)}
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
              onChange={(e) => pushParams(from ?? null, e.target.value || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => {
                pushParams(null, null);
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
