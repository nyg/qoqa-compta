import { SECRET_MASK } from "../shared/types";

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function maskDatabaseUrl(url: string | null): string | null {
  if (!url) return url;

  const parsed = parse(url);
  if (!parsed || !parsed.password) return url;

  parsed.password = SECRET_MASK;
  return parsed.toString();
}

export function unmaskDatabaseUrl(
  incoming: string | null,
  stored: string | null
): string | null {
  if (!incoming) return incoming;

  const parsed = parse(incoming);
  if (!parsed || parsed.password !== SECRET_MASK) return incoming;

  const storedParsed = stored ? parse(stored) : null;
  if (!storedParsed?.password) return incoming;

  parsed.password = storedParsed.password;
  return parsed.toString();
}
