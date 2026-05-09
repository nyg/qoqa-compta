/**
 * CategoryPicker — multi-select dropdown for filtering by offer_category.
 *
 * Selected categories are encoded in the URL as ?categories=cat1,cat2.
 * An empty selection means "all categories" (no filter applied).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const KNOWN_CATEGORIES = new Set([
  "alcohol",
  "qspirits",
  "qwine",
  "qwinegrandcru",
  "qwineprimeurs",
]);

type KnownCategory = "alcohol" | "qspirits" | "qwine" | "qwinegrandcru" | "qwineprimeurs";

interface CategoryPickerProps {
  available: string[];
  selected: string[];
}

export function CategoryPicker({ available, selected }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("CategoryPicker");

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

  const toggle = (cat: string) => {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);

    const params = new URLSearchParams(searchParams.toString());
    if (next.size === 0) {
      params.delete("categories");
    } else {
      params.set("categories", [...next].join(","));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const label =
    selected.length === 0
      ? t("allCategories")
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
          {available.map((cat) => {
            const isSelected = selected.includes(cat);
            const catLabel = KNOWN_CATEGORIES.has(cat)
              ? t(`categories.${cat as KnownCategory}`)
              : cat;

            return (
              <button
                key={cat}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(cat)}
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
                <span>{catLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
