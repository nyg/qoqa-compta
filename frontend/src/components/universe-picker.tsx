/**
 * UniversePicker — multi-select dropdown for filtering by universe.
 *
 * Selected universes are encoded in the URL as ?universes=id1,id2.
 * An empty selection means "all universes" (no filter applied).
 * Display names come from the qoqa_universes DB table (via the `available` prop);
 * temporary universes not in that table fall back to their raw identifier.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UniverseOption } from "@/types/order";

interface UniversePickerProps {
  available: UniverseOption[];
  selected: string[];
}

export function UniversePicker({ available, selected }: UniversePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("UniversePicker");

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

  const toggle = (identifier: string) => {
    const next = new Set(selected);
    if (next.has(identifier)) next.delete(identifier);
    else next.add(identifier);

    const params = new URLSearchParams(searchParams.toString());
    if (next.size === 0) {
      params.delete("universes");
    } else {
      params.set("universes", [...next].join(","));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const label =
    selected.length === 0
      ? t("allUniverses")
      : t("nSelected", { count: selected.length });

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="default"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
      >
        {label}
        <ChevronDown
          className={cn(
            "ml-1 h-3 w-3 opacity-60 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={t("label")}
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {available.map(({ identifier, name }) => {
            const isSelected = selected.includes(identifier);
            return (
              <button
                key={identifier}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(identifier)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
