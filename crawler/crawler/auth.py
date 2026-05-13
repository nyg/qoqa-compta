"""QoQa.ch authentication — no browser required.

Obtains a JWT token by posting credentials directly to the auth API.
"""

import os
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

_AUTH_LOGIN_URL = "https://auth.qoqa.ch/v2/login"


def get_pdf_download_dir() -> Path:
    """Return the directory where PDFs will be saved."""
    pdf_dir = os.environ.get("PDF_DOWNLOAD_DIR", "./pdfs")
    path = Path(pdf_dir).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_token() -> str:
    """Authenticate to QoQa.ch and return a JWT bearer token.

    Reads QOQA_EMAIL and QOQA_PASSWORD from the environment and posts them to
    the auth API, which returns the token directly in the response body.

    Returns:
        The JWT bearer token string.

    Raises:
        RuntimeError: If credentials are missing or the API returns an error.
    """
    email = os.environ.get("QOQA_EMAIL", "")
    password = os.environ.get("QOQA_PASSWORD", "")
    if not email or not password:
        raise RuntimeError(
            "Missing credentials. Set QOQA_EMAIL and QOQA_PASSWORD in .env."
        )

    device_id = str(uuid.uuid4())
    resp = requests.post(
        _AUTH_LOGIN_URL,
        params={"locale": "fr"},
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Referer": "https://www.qoqa.ch/",
            "x-qoqa-device-identifier": device_id,
        },
        json={
            "user": {"login": email, "password": password},
            "device_identifier": device_id,
            "two_factor_code": "",
            "remember_me": True,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Login failed (HTTP {resp.status_code}): {resp.text[:200]}"
        )
    token = resp.json().get("token")
    if not token:
        raise RuntimeError(f"Auth response missing 'token' field: {resp.text[:200]}")
    return token
