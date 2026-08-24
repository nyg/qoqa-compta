import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useFormatter } from "@/lib/formatter-context";

interface DateRangePickerProps {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  onFromChange: (val: string | undefined) => void;
  onToChange: (val: string | undefined) => void;
}

const FIRST_MONTH = new Date(2008, 0);

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toValue(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("DateRangePicker");
  const { formatDate, calendar } = useFormatter();

  const selected = useMemo<DateRange | undefined>(() => {
    const start = toDate(from);
    const end = toDate(to);
    return start || end ? { from: start, to: end } : undefined;
  }, [from, to]);

  const lastMonth = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => selected?.from ?? selected?.to ?? new Date());

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
        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 opacity-60 shrink-0" />
        <span className="truncate max-w-[12rem]">{label}</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t("label")}
          className="absolute right-0 top-full z-50 mt-1 w-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <Calendar
            mode="range"
            captionLayout="dropdown"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            startMonth={FIRST_MONTH}
            endMonth={lastMonth}
            weekStartsOn={calendar.weekStartsOn}
            formatters={calendar.formatters}
            onSelect={(range) => {
              onFromChange(toValue(range?.from));
              onToChange(toValue(range?.to));
            }}
          />
          {hasFilter && (
            <div className="border-t p-2">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
