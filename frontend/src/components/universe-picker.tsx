/**
 * UniversePicker — hierarchical multi-select dropdown for filtering by universe
 * and sub-universe.
 *
 * Selected universes are encoded as ?universes=id1,id2 in the URL.
 * Selected sub-universes are encoded as ?subuniverses=id1,id2.
 * An empty selection means "all universes" (no filter applied).
 *
 * Hierarchy rules:
 * - Selecting a universe = filter by that universe (all sub-universes included).
 * - When all sub-universes of a universe are checked → switches to universe-level.
 * - When a sub-universe is unchecked while the universe is selected → explodes
 *   the selection into individual sub-universes (minus the unchecked one).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UniverseOption } from "@/types/order";

interface UniversePickerProps {
  available: UniverseOption[];
  selected: string[];
  selectedSubuniverses: string[];
}

export function UniversePicker({ available, selected, selectedSubuniverses }: UniversePickerProps) {
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

  function pushParams(nextUniverses: Set<string>, nextSubuniverses: Set<string>) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextUniverses.size === 0) {
      params.delete("universes");
    } else {
      params.set("universes", [...nextUniverses].join(","));
    }
    if (nextSubuniverses.size === 0) {
      params.delete("subuniverses");
    } else {
      params.set("subuniverses", [...nextSubuniverses].join(","));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleUniverse(uid: string, subs: string[]) {
    const nextU = new Set(selected);
    const nextS = new Set(selectedSubuniverses);

    if (nextU.has(uid)) {
      // Deselect universe and all its sub-universes
      nextU.delete(uid);
      for (const s of subs) nextS.delete(s);
    } else {
      // Select universe, remove individual sub-universe selections
      nextU.add(uid);
      for (const s of subs) nextS.delete(s);
    }
    pushParams(nextU, nextS);
  }

  function toggleSubuniverse(subId: string, parentUid: string, allSubs: string[]) {
    const nextU = new Set(selected);
    const nextS = new Set(selectedSubuniverses);

    if (nextU.has(parentUid)) {
      // Universe is selected — explode into individual subs, then remove this one
      for (const s of allSubs) {
        if (s !== subId) nextS.add(s);
      }
      nextU.delete(parentUid);
    } else if (nextS.has(subId)) {
      nextS.delete(subId);
    } else {
      nextS.add(subId);
      // If all subs are now selected, collapse to universe level
      const allNowSelected = allSubs.every((s) => nextS.has(s));
      if (allNowSelected) {
        for (const s of allSubs) nextS.delete(s);
        nextU.add(parentUid);
      }
    }
    pushParams(nextU, nextS);
  }

  const totalSelected = selected.length + selectedSubuniverses.length;
  const label =
    totalSelected === 0
      ? t("allUniverses")
      : t("nSelected", { count: totalSelected });

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
          className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {available.map(({ identifier: uid, name, subuniverses }) => {
            const allSubIds = subuniverses.map((s) => s.identifier);
            const isUniverseSelected = selected.includes(uid);
            const selectedSubCount = allSubIds.filter((s) => selectedSubuniverses.includes(s)).length;
            const isIndeterminate =
              !isUniverseSelected && selectedSubCount > 0 && selectedSubCount < allSubIds.length;
            const isChecked = isUniverseSelected || (allSubIds.length > 0 && selectedSubCount === allSubIds.length);

            return (
              <div key={uid}>
                {/* Universe row */}
                <button
                  role="option"
                  aria-selected={isChecked}
                  onClick={() => toggleUniverse(uid, allSubIds)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isChecked
                        ? "border-primary bg-primary text-primary-foreground"
                        : isIndeterminate
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border"
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                    {isIndeterminate && !isChecked && <Minus className="h-3 w-3" />}
                  </span>
                  <span className="font-medium">{name}</span>
                </button>

                {/* Sub-universe rows */}
                {subuniverses.map(({ identifier: subId, name: subName }) => {
                  const isSubSelected = isUniverseSelected || selectedSubuniverses.includes(subId);
                  return (
                    <button
                      key={subId}
                      role="option"
                      aria-selected={isSubSelected}
                      onClick={() => toggleSubuniverse(subId, uid, allSubIds)}
                      className="flex w-full items-center gap-2 pl-8 pr-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                          isSubSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        )}
                      >
                        {isSubSelected && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="text-muted-foreground">{subName}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
