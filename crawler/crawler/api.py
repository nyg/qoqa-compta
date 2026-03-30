"""Qoqa.ch REST API client.

Provides authenticated access to the Qoqa API for fetching purchases,
order details, and downloading invoice PDFs.

Auth flow:
    1. Obtain session cookies (via browser login)
    2. Exchange cookies for a JWT token via auth.qoqa.ch
    3. Use JWT as ``Authorization: Token bearer=<jwt>`` for API calls
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import requests

AUTH_TOKEN_URL = "https://auth.qoqa.ch/v2/token"
API_BASE = "https://api.qoqa.ch/v2"
PURCHASES_URL = f"{API_BASE}/users/me/purchases"
ORDER_URL = f"{API_BASE}/users/me/orders"


@dataclass
class OrderData:
    """Structured order data extracted from the Qoqa API."""

    order_number: str
    order_date: date
    amount_chf: Decimal
    partner_name: str | None
    pdf_url: str | None
    pdf_filename: str | None
    raw_json: str


def get_auth_token(cookies: dict[str, str]) -> str:
    """Exchange browser session cookies for a JWT token.

    Args:
        cookies: dict of cookie name→value from the browser session.

    Returns:
        The JWT bearer token string.

    Raises:
        RuntimeError: If the token endpoint returns an error.
    """
    resp = requests.get(AUTH_TOKEN_URL, cookies=cookies, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(
            f"Failed to obtain auth token (HTTP {resp.status_code}): {resp.text[:200]}"
        )
    data = resp.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"Auth response missing 'token' field: {data}")
    return token


def _api_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Token bearer={token}"}


def list_all_purchases(token: str) -> list[dict]:
    """Paginate through all purchases and return the combined list.

    Each purchase dict contains at least: id, reference, kind, title,
    purchased_at, state.
    """
    headers = _api_headers(token)
    all_purchases: list[dict] = []
    page = 1

    while True:
        resp = requests.get(
            PURCHASES_URL,
            headers=headers,
            params={"locale": "fr", "page": page, "per_page": 50, "with_campaign": "false"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        purchases = data.get("purchases", [])
        all_purchases.extend(purchases)

        if data.get("meta", {}).get("is_last_page", True):
            break
        page += 1

    return all_purchases


def get_order_details(token: str, order_id: str) -> dict:
    """Fetch full details for a single order.

    Returns the raw API response dict, which includes reference, total,
    created_at, invoice_link, accounting_documents, etc.
    """
    headers = _api_headers(token)
    resp = requests.get(
        f"{ORDER_URL}/{order_id}",
        headers=headers,
        params={"locale": "fr"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def parse_order_data(detail: dict) -> OrderData:
    """Transform an API order-detail response into an OrderData instance."""
    reference = detail.get("reference", "")
    total = Decimal(str(detail.get("total", 0)))

    created_at_str = detail.get("created_at", "")
    try:
        order_date = datetime.fromisoformat(created_at_str).date()
    except (ValueError, TypeError):
        order_date = date.today()

    # Partner name: use the offer title or the top-level title
    offer = detail.get("offer") or {}
    partner_name = offer.get("title") or detail.get("title")

    # PDF link: prefer accounting_documents, fall back to invoice_link
    pdf_url = None
    pdf_filename = None
    docs = detail.get("accounting_documents", [])
    if docs:
        pdf_url = docs[0].get("pdf_link")
    if not pdf_url:
        pdf_url = detail.get("invoice_link")
    if pdf_url:
        # Extract filename from URL (before query params)
        path_part = pdf_url.split("?")[0]
        pdf_filename = path_part.split("/")[-1]

    return OrderData(
        order_number=reference,
        order_date=order_date,
        amount_chf=total,
        partner_name=partner_name,
        pdf_url=pdf_url,
        pdf_filename=pdf_filename,
        raw_json=json.dumps(detail, ensure_ascii=False, default=str),
    )


def download_pdf(url: str, dest_path: Path) -> None:
    """Download a PDF from a self-authenticated URL (contains ?token=...).

    Args:
        url: Full download URL (includes authentication token in query string).
        dest_path: Local path to save the PDF.

    Raises:
        RuntimeError: On download failure.
    """
    try:
        resp = requests.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        dest_path.write_bytes(resp.content)
    except Exception as exc:
        raise RuntimeError(f"Failed to download {dest_path.name}: {exc}") from exc
