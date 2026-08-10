import { useState, useCallback } from "react";
import {
  ALL_UNIVERSES,
  parseSubuniverseKey,
  type UniverseSelection,
} from "../../shared/filters";

export interface FilterState {
  selection: UniverseSelection;
  from?: string;
  to?: string;
}

const STORAGE_KEY = "qoqa-compta-filters";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

// Selections stored before sub-universes were namespaced by universe are
// dropped: they cannot be mapped back to a single universe.
function namespacedSubuniverses(value: unknown): string[] {
  return isStringArray(value)
    ? value.filter((key) => parseSubuniverseKey(key).universe !== null)
    : [];
}

function readSelection(parsed: Record<string, unknown>): UniverseSelection {
  const stored = parsed.selection as Record<string, unknown> | undefined;
  if (stored?.mode === "all") return ALL_UNIVERSES;
  if (stored?.mode === "custom") {
    return {
      mode: "custom",
      universes: isStringArray(stored.universes) ? stored.universes : [],
      subuniverses: namespacedSubuniverses(stored.subuniverses),
    };
  }

  const universes = isStringArray(parsed.universes) ? parsed.universes : [];
  const subuniverses = namespacedSubuniverses(parsed.subuniverses);
  if (universes.length === 0 && subuniverses.length === 0) return ALL_UNIVERSES;
  return { mode: "custom", universes, subuniverses };
}

function readFromStorage(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        selection: readSelection(parsed),
        from: typeof parsed.from === "string" ? parsed.from : undefined,
        to: typeof parsed.to === "string" ? parsed.to : undefined,
      };
    }
  } catch {}
  return { selection: ALL_UNIVERSES };
}

export function useFilterState() {
  const [filters, setFiltersState] = useState<FilterState>(readFromStorage);

  const setFilters = useCallback(
    (update: Partial<FilterState> | ((prev: FilterState) => FilterState)) => {
      setFiltersState((prev) => {
        const next =
          typeof update === "function" ? update(prev) : { ...prev, ...update };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  return { filters, setFilters };
}
