import { apiClient } from "@/lib/api-client";
import { isDesktop } from "@/lib/downloads";

const EXTERNAL_LINK = 'a[target="_blank"]';

function externalHref(target: EventTarget | null): string | null {
  const anchor = (target as Element | null)?.closest?.(EXTERNAL_LINK) as
    | HTMLAnchorElement
    | null;
  if (!anchor) return null;
  return /^https?:\/\//i.test(anchor.href) ? anchor.href : null;
}

export function installExternalLinkHandler(): void {
  if (!isDesktop) return;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
      return;
    }

    const href = externalHref(event.target);
    if (!href) return;

    event.preventDefault();
    apiClient.openExternal(href).catch(console.error);
  });
}
