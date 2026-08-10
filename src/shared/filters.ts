import type { UniverseOption } from "./types";

/**
 * A sub-universe is only meaningful together with the universe it was filed
 * under: QoQa reuses the same sub-universe identifier (e.g. `vins`) across
 * several universes, so filters address them as `universe:subuniverse` pairs.
 */
const SEPARATOR = ":";

export function subuniverseKey(universe: string, subuniverse: string): string {
  return `${universe}${SEPARATOR}${subuniverse}`;
}

export function parseSubuniverseKey(key: string): {
  universe: string | null;
  subuniverse: string;
} {
  const index = key.indexOf(SEPARATOR);
  if (index === -1) return { universe: null, subuniverse: key };
  return { universe: key.slice(0, index), subuniverse: key.slice(index + 1) };
}

export const NO_UNIVERSE_FILTER = "__none__";

export type UniverseSelection =
  | { mode: "all" }
  | { mode: "custom"; universes: string[]; subuniverses: string[] };

export const ALL_UNIVERSES: UniverseSelection = { mode: "all" };

export function isNothingSelected(selection: UniverseSelection): boolean {
  return (
    selection.mode === "custom" &&
    selection.universes.length === 0 &&
    selection.subuniverses.length === 0
  );
}

export function selectedEntryCount(selection: UniverseSelection): number {
  return selection.mode === "custom"
    ? selection.universes.length + selection.subuniverses.length
    : 0;
}

export function selectionParams(selection: UniverseSelection): {
  universes?: string[];
  subuniverses?: string[];
} {
  if (selection.mode === "all") return {};
  if (isNothingSelected(selection)) return { universes: [NO_UNIVERSE_FILTER] };
  return {
    universes: selection.universes.length > 0 ? selection.universes : undefined,
    subuniverses:
      selection.subuniverses.length > 0 ? selection.subuniverses : undefined,
  };
}

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const members = new Set(a);
  return b.every((value) => members.has(value));
}

export function selectionsEqual(
  a: UniverseSelection,
  b: UniverseSelection
): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "all" || b.mode === "all") return true;
  return (
    sameMembers(a.universes, b.universes) &&
    sameMembers(a.subuniverses, b.subuniverses)
  );
}

export function normalizeSelection(
  selection: UniverseSelection,
  available: UniverseOption[]
): UniverseSelection {
  if (selection.mode === "all" || available.length === 0) return selection;

  const tree = new Map(
    available.map((universe) => [
      universe.identifier,
      new Set(universe.subuniverses.map((sub) => sub.identifier)),
    ])
  );

  const wholeUniverses = new Set(
    selection.universes.filter((identifier) => tree.has(identifier))
  );

  const subsByUniverse = new Map<string, Set<string>>();
  for (const key of selection.subuniverses) {
    const { universe, subuniverse } = parseSubuniverseKey(key);
    if (universe === null || wholeUniverses.has(universe)) continue;
    if (!tree.get(universe)?.has(subuniverse)) continue;
    const subs = subsByUniverse.get(universe) ?? new Set<string>();
    subs.add(subuniverse);
    subsByUniverse.set(universe, subs);
  }

  const subuniverses: string[] = [];
  for (const [universe, subs] of subsByUniverse) {
    if (subs.size === tree.get(universe)!.size) {
      wholeUniverses.add(universe);
      continue;
    }
    for (const sub of subs) subuniverses.push(subuniverseKey(universe, sub));
  }

  if (wholeUniverses.size === 0 && subuniverses.length === 0) {
    return isNothingSelected(selection) ? selection : ALL_UNIVERSES;
  }
  if (subuniverses.length === 0 && wholeUniverses.size === tree.size) {
    return ALL_UNIVERSES;
  }

  return { mode: "custom", universes: [...wholeUniverses], subuniverses };
}
