import { useState, useCallback } from "react";

export interface FilterState {
  universes: string[];
  subuniverses: string[];
  from?: string;
  to?: string;
}

const STORAGE_KEY = "qoqa-compta-filters";

function readFromStorage(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        universes: Array.isArray(parsed.universes) ? parsed.universes : [],
        subuniverses: Array.isArray(parsed.subuniverses) ? parsed.subuniverses : [],
        from: typeof parsed.from === "string" ? parsed.from : undefined,
        to: typeof parsed.to === "string" ? parsed.to : undefined,
      };
    }
  } catch {}
  return { universes: [], subuniverses: [] };
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
