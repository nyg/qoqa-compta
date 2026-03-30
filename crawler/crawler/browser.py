"""Browser automation — login only.

Opens a browser, logs in to Qoqa.ch, extracts session cookies, and closes
the browser. The cookies are then used server-side to obtain a JWT token
for API access.

Two authentication modes:
  1. Credentials (recommended): set QOQA_EMAIL + QOQA_PASSWORD in .env.
     Uses a fresh profile — Chrome can stay open.
  2. Profile reuse: set CHROME_USER_DATA_DIR in .env.
     Inherits your session cookies — Chrome must be closed.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from seleniumbase import sb_cdp

load_dotenv()

QOQA_BASE_URL = "https://www.qoqa.ch/fr"

# Qoqa.ch login selectors (MUI-based Next.js SPA)
_SEL_ACCOUNT_BTN = '[data-testid="login-status-not_logged"]'
_SEL_LOGIN_BTN = '[data-testid="account-login-button"]'
_SEL_USERNAME = 'input[name="login"]'
_SEL_PASSWORD = 'input[name="password"]'


def get_pdf_download_dir() -> Path:
    """Return the directory where PDFs will be saved."""
    pdf_dir = os.environ.get("PDF_DOWNLOAD_DIR", "./pdfs")
    path = Path(pdf_dir).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _get_credentials() -> tuple[str, str] | None:
    """Return (email, password) from env, or None."""
    email = os.environ.get("QOQA_EMAIL", "")
    password = os.environ.get("QOQA_PASSWORD", "")
    if email and password:
        return (email, password)
    return None


def _get_user_data_dir() -> str | None:
    """Return Chrome user-data directory from env or OS default."""
    explicit = os.environ.get("CHROME_USER_DATA_DIR", "")
    if explicit:
        return str(Path(explicit).expanduser())

    home = Path.home()
    candidates = [
        home / "Library" / "Application Support" / "Google" / "Chrome",  # macOS
        home / ".config" / "google-chrome",  # Linux
        home / "AppData" / "Local" / "Google" / "Chrome" / "User Data",  # Windows
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return None


def _check_chrome_not_running(user_data_dir: str) -> None:
    """Raise a clear error if Chrome is already running with this profile."""
    lock_file = Path(user_data_dir) / "SingletonLock"
    if lock_file.exists() or lock_file.is_symlink():
        raise RuntimeError(
            "Chrome is currently running and locks its profile directory.\n"
            "  → Close ALL Chrome windows, then retry.\n"
            "  → Or set QOQA_EMAIL + QOQA_PASSWORD in .env to skip profile reuse.\n"
            f"  Profile: {user_data_dir}"
        )


def _login(sb, email: str, password: str) -> None:
    """Log in to Qoqa.ch via the SPA login modal."""
    sb.sleep(3)  # wait for SPA to hydrate

    sb.click(_SEL_ACCOUNT_BTN)
    sb.sleep(1.5)

    sb.click(_SEL_LOGIN_BTN)
    sb.sleep(2)

    sb.type(_SEL_USERNAME, email)
    sb.type(_SEL_PASSWORD, password)
    sb.press_keys(_SEL_PASSWORD, "\n")
    sb.sleep(4)  # wait for auth redirect


def _extract_cookies(sb) -> dict[str, str]:
    """Extract cookies from the browser as a simple name→value dict."""
    try:
        cookies = sb.get_all_cookies()
        if isinstance(cookies, list):
            return {
                (c.get("name") if isinstance(c, dict) else getattr(c, "name", "")): (
                    c.get("value") if isinstance(c, dict) else getattr(c, "value", "")
                )
                for c in cookies
            }
    except Exception:
        pass
    # Fallback: parse cookie string
    try:
        cookie_str = sb.get_cookie_string()
        return dict(
            pair.split("=", 1) for pair in cookie_str.split("; ") if "=" in pair
        )
    except Exception:
        return {}


def login_and_get_cookies() -> dict[str, str]:
    """Open a browser, authenticate to Qoqa.ch, and return session cookies.

    Returns:
        A dict of cookie name→value from the authenticated session.

    Raises:
        RuntimeError: If no auth method is configured or login fails.
    """
    credentials = _get_credentials()
    browser_path = os.environ.get("BROWSER_PATH") or None

    kwargs: dict = {"headless": False, "incognito": False}
    if browser_path:
        kwargs["browser_executable_path"] = browser_path

    sb = None
    try:
        if credentials:
            sb = sb_cdp.Chrome(url=QOQA_BASE_URL, **kwargs)
            _login(sb, *credentials)
        else:
            user_data_dir = _get_user_data_dir()
            if not user_data_dir:
                raise RuntimeError(
                    "No authentication method configured.\n"
                    "  Option A (recommended): set QOQA_EMAIL + QOQA_PASSWORD in .env\n"
                    "  Option B: set CHROME_USER_DATA_DIR in .env"
                )
            _check_chrome_not_running(user_data_dir)
            kwargs["user_data_dir"] = user_data_dir
            sb = sb_cdp.Chrome(url=QOQA_BASE_URL, **kwargs)
            sb.sleep(3)

        cookies = _extract_cookies(sb)
        if not cookies:
            raise RuntimeError("No cookies extracted from browser session.")
        return cookies
    finally:
        if sb:
            sb.driver.stop()
