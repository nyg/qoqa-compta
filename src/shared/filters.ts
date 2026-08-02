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
