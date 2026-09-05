import { useInstallInfo } from "@/lib/use-install-info";

/** The SPA is served from views://main/index.html inside the desktop WebView. */
export const isDesktop = window.location.protocol === "views:";

/** Last segment of a POSIX or Windows path. */
export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/**
 * Saves a file the way the current runtime can.
 *
 * The desktop WebView ignores `<a download>` and renders PDFs in a full-screen
 * viewer instead, so there the server writes the file to the user's Downloads
 * folder and we report back the path. In a browser the usual blob download is
 * used and there is no path to report.
 */
export async function saveFile(opts: {
  /** Server-side save, used on desktop. Returns the path written to. */
  save: () => Promise<{ path: string }>;
  /** URL to fetch, used in the browser. */
  url: string;
  filename: string;
}): Promise<string | null> {
  if (isDesktop) {
    const { path } = await opts.save();
    return path;
  }

  const res = await fetch(opts.url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  const objectUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
  return null;
}

export function useShowsSavedPath(): boolean {
  return useInstallInfo()?.platform === "windows";
}
