import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  isNothingSelected,
  normalizeSelection,
  selectionCounts,
  subuniverseKey,
  type UniverseSelection,
} from "../../shared/filters";
import type { UniverseOption } from "../../shared/types";

interface UniversePickerProps {
  available: UniverseOption[];
  selection: UniverseSelection;
  onSelectionChange: (selection: UniverseSelection) => void;
}

export function UniversePicker({
  available,
  selection,
  onSelectionChange,
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

  const isAllMode = selection.mode === "all";

  function currentSets() {
    if (selection.mode === "all") {
      return {
        universes: new Set(available.map((u) => u.identifier)),
        subuniverses: new Set<string>(),
      };
    }
    return {
      universes: new Set(selection.universes),
      subuniverses: new Set(selection.subuniverses),
    };
  }

  function emit(universes: Set<string>, subuniverses: Set<string>) {
    onSelectionChange(
      normalizeSelection(
        {
          mode: "custom",
          universes: [...universes],
          subuniverses: [...subuniverses],
        },
        available
      )
    );
  }

  function toggleUniverse(uid: string, allSubKeys: string[]) {
    const { universes, subuniverses } = currentSets();
    const wasSelected =
      universes.has(uid) ||
      (allSubKeys.length > 0 && allSubKeys.every((key) => subuniverses.has(key)));

    universes.delete(uid);
    for (const key of allSubKeys) subuniverses.delete(key);
    if (!wasSelected) universes.add(uid);

    emit(universes, subuniverses);
  }

  function toggleSubuniverse(
    subKey: string,
    parentUid: string,
    allSubKeys: string[]
  ) {
    const { universes, subuniverses } = currentSets();

    if (universes.has(parentUid)) {
      universes.delete(parentUid);
      for (const key of allSubKeys) subuniverses.add(key);
    }
    if (subuniverses.has(subKey)) subuniverses.delete(subKey);
    else subuniverses.add(subKey);

    emit(universes, subuniverses);
  }

  const counts = selectionCounts(selection);
  const universesLabel = t("universesSelected", { count: counts.universes });
  const subuniversesLabel = t("subuniversesSelected", {
    count: counts.subuniverses,
  });

  const label = isAllMode
    ? t("allUniverses")
    : isNothingSelected(selection)
    ? t("noneSelected")
    : counts.subuniverses === 0
    ? universesLabel
    : counts.universes === 0
    ? subuniversesLabel
    : t("mixedSelected", {
        universes: universesLabel,
        subuniverses: subuniversesLabel,
      });

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
        <span className="truncate max-w-[14rem]">{label}</span>
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
            const isUniverseSelected =
              isAllMode ||
              (selection.mode === "custom" && selection.universes.includes(uid));
            const selectedSubCount =
              selection.mode === "custom"
                ? allSubKeys.filter((key) => selection.subuniverses.includes(key))
                    .length
                : 0;
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
                    (selection.mode === "custom" &&
                      selection.subuniverses.includes(subKey));
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
