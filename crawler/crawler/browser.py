"""Browser automation helpers using SeleniumBase Pure CDP Mode.

The crawler reuses your existing Chrome profile so you never need to log in
manually — your Qoqa.ch session cookies are already present.

Important: close all Chrome windows before running the crawler.
"""

import os
import time
from pathlib import Path

from dotenv import load_dotenv
from seleniumbase import SB

load_dotenv()

QOQA_BASE_URL = "https://www.qoqa.ch/fr"
ORDERS_URL = "https://www.qoqa.ch/fr/mon-qompte/mes-commandes"


def get_chrome_user_data_dir() -> str:
    """Return the Chrome user-data directory from env or fall back to OS default."""
    user_data_dir = os.environ.get("CHROME_USER_DATA_DIR", "")
    if user_data_dir:
        return str(Path(user_data_dir).expanduser())

    # OS-specific defaults
    home = Path.home()
    candidates = [
        home / "Library" / "Application Support" / "Google" / "Chrome",  # macOS
        home / ".config" / "google-chrome",  # Linux
        home / "AppData" / "Local" / "Google" / "Chrome" / "User Data",  # Windows
    ]
    for path in candidates:
        if path.exists():
            return str(path)

    raise RuntimeError(
        "Could not detect Chrome user-data directory. "
        "Set CHROME_USER_DATA_DIR in your .env file."
    )


def get_pdf_download_dir() -> Path:
    """Return the directory where PDFs will be saved."""
    pdf_dir = os.environ.get("PDF_DOWNLOAD_DIR", "./pdfs")
    path = Path(pdf_dir).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def download_order_pdfs(full: bool = False) -> list[Path]:
    """Open the Qoqa orders page and download all available invoice PDFs.

    Args:
        full: If True, download all PDFs. If False, stop at the first PDF that
              already exists locally (incremental mode).

    Returns:
        List of paths to the downloaded PDF files.
    """
    user_data_dir = get_chrome_user_data_dir()
    pdf_dir = get_pdf_download_dir()
    downloaded: list[Path] = []

    with SB(
        browser="chrome",
        user_data_dir=user_data_dir,
        headless=False,  # keep visible so Chrome can render PDFs
        incognito=False,
    ) as sb:
        sb.open(ORDERS_URL)
        sb.sleep(3)  # let the page fully load

        # Accept cookies banner if present
        try:
            sb.click('button[id*="accept"], button[class*="accept"]', timeout=5)
        except Exception:
            pass

        # Collect all invoice PDF links on the page
        pdf_links = _collect_pdf_links(sb)

        for link_url, filename in pdf_links:
            dest_path = pdf_dir / filename

            # Incremental mode: stop when we encounter an already-downloaded file
            if not full and dest_path.exists():
                break

            _download_pdf(sb, link_url, dest_path)
            downloaded.append(dest_path)
            time.sleep(1)  # be polite

    return downloaded


def _collect_pdf_links(sb) -> list[tuple[str, str]]:
    """Scrape the orders page and return a list of (url, filename) tuples."""
    results: list[tuple[str, str]] = []

    # Qoqa renders order rows — find PDF/invoice download buttons
    # Selectors may need updating if Qoqa changes their HTML structure
    try:
        links = sb.find_elements('a[href$=".pdf"], a[href*="facture"], a[href*="invoice"]')
    except Exception:
        links = []

    for i, link in enumerate(links):
        try:
            href = link.get_attribute("href")
            if not href:
                continue
            # Derive a stable filename from the URL or generate one
            if href.endswith(".pdf"):
                filename = href.split("/")[-1]
            else:
                filename = f"qoqa_facture_{i + 1:04d}.pdf"
            results.append((href, filename))
        except Exception:
            continue

    return results


def _download_pdf(sb, url: str, dest_path: Path) -> None:
    """Navigate to a PDF URL and save it to dest_path."""
    import urllib.request

    # Reuse the browser's cookies to authenticate the download
    cookies = sb.driver.get_cookies()
    cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)

    headers = {
        "Cookie": cookie_header,
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
    }

    # Validate the URL scheme and domain before fetching
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not (
        parsed.netloc.endswith("qoqa.ch") or parsed.netloc.endswith("qoqa.com")
    ):
        raise ValueError(f"Refused to download from untrusted URL: {url!r}")

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:  # noqa: S310
        dest_path.write_bytes(response.read())
