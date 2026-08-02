import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { subuniverseKey } from "../../shared/filters";
import type { UniverseOption } from "../../shared/types";

interface UniversePickerProps {
  available: UniverseOption[];
  selected: string[];
  /** `universe:subuniverse` keys — see shared/filters */
  selectedSubuniverses: string[];
  onFiltersChange: (universes: string[], subuniverses: string[]) => void;
}

export function UniversePicker({
  available,
  selected,
  selectedSubuniverses,
  onFiltersChange,
}: UniversePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("UniversePicker");

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

  function applyFilters(nextUniverses: Set<string>, nextSubuniverses: Set<string>) {
    const allIds = available.map((u) => u.identifier);
    const allSelected =
      allIds.length > 0 &&
      nextUniverses.size === allIds.length &&
      allIds.every((id) => nextUniverses.has(id)) &&
      nextSubuniverses.size === 0;

    if (allSelected) {
      onFiltersChange([], []);
    } else {
      onFiltersChange([...nextUniverses], [...nextSubuniverses]);
    }
  }

  function toggleUniverse(uid: string, subKeys: string[]) {
    if (isAllMode) {
      const nextU = new Set(available.map((u) => u.identifier));
      nextU.delete(uid);
      applyFilters(nextU, new Set());
      return;
    }
    const nextU = new Set(selected);
    const nextS = new Set(selectedSubuniverses);

    if (nextU.has(uid)) {
      nextU.delete(uid);
      for (const s of subKeys) nextS.delete(s);
    } else {
      nextU.add(uid);
      for (const s of subKeys) nextS.delete(s);
    }
    applyFilters(nextU, nextS);
  }

  function toggleSubuniverse(
    subKey: string,
    parentUid: string,
    allSubKeys: string[]
  ) {
    if (isAllMode) {
      const nextU = new Set(available.map((u) => u.identifier));
      nextU.delete(parentUid);
      const nextS = new Set<string>();
      for (const s of allSubKeys) {
        if (s !== subKey) nextS.add(s);
      }
      applyFilters(nextU, nextS);
      return;
    }
    const nextU = new Set(selected);
    const nextS = new Set(selectedSubuniverses);

    if (nextU.has(parentUid)) {
      // Universe is selected — explode into individual subs, then remove this one
      for (const s of allSubKeys) {
        if (s !== subKey) nextS.add(s);
      }
      nextU.delete(parentUid);
    } else if (nextS.has(subKey)) {
      nextS.delete(subKey);
    } else {
      nextS.add(subKey);
      // If all subs are now selected, collapse to universe level
      const allNowSelected = allSubKeys.every((s) => nextS.has(s));
      if (allNowSelected) {
        for (const s of allSubKeys) nextS.delete(s);
        nextU.add(parentUid);
      }
    }
    applyFilters(nextU, nextS);
  }

  const isAllMode =
    selected.length === 0 && selectedSubuniverses.length === 0;
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
            const allSubKeys = subuniverses.map((s) => subuniverseKey(uid, s.identifier));
            const isUniverseSelected = isAllMode || selected.includes(uid);
            const selectedSubCount = allSubKeys.filter((s) =>
              selectedSubuniverses.includes(s)
            ).length;
            const isIndeterminate =
              !isUniverseSelected &&
              selectedSubCount > 0 &&
              selectedSubCount < allSubKeys.length;
            const isChecked =
              isUniverseSelected ||
              (allSubKeys.length > 0 &&
                selectedSubCount === allSubKeys.length);

            return (
              <div key={uid}>
                <button
                  role="option"
                  aria-selected={isChecked}
                  onClick={() => toggleUniverse(uid, allSubKeys)}
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
                    {isIndeterminate && !isChecked && (
                      <Minus className="h-3 w-3" />
                    )}
                  </span>
                  <span className="font-medium">{name}</span>
                </button>

                {subuniverses.map(({ identifier: subId, name: subName }) => {
                  const subKey = subuniverseKey(uid, subId);
                  const isSubSelected =
                    isUniverseSelected ||
                    selectedSubuniverses.includes(subKey);
                  return (
                    <button
                      key={subKey}
                      role="option"
                      aria-selected={isSubSelected}
                      onClick={() =>
                        toggleSubuniverse(subKey, uid, allSubKeys)
                      }
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
