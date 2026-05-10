"""QoQa.ch REST API client.

Provides authenticated access to the QoQa API for fetching purchases,
order details, and downloading invoice PDFs.

Auth flow:
    1. Obtain session cookies (via browser login)
    2. Exchange cookies for a JWT token via auth.qoqa.ch
    3. Use JWT as ``Authorization: Token bearer=<jwt>`` for API calls
"""

from __future__ import annotations

import json
import locale as _locale_module
import os
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import requests

AUTH_TOKEN_URL = "https://auth.qoqa.ch/v2/token"
API_BASE = "https://api.qoqa.ch/v2"
PURCHASES_URL = f"{API_BASE}/users/me/purchases"
ORDER_URL = f"{API_BASE}/users/me/orders"
ALERTS_URL = f"{API_BASE}/alerts"

_SUPPORTED_LOCALES = {"fr", "de"}


def detect_locale() -> str:
    """Detect the system locale and map it to a QoQa-supported locale.

    Checks ``LC_ALL``, ``LC_MESSAGES``, and ``LANG`` environment variables
    in order, then falls back to Python's ``locale`` module. Maps any German
    variant to ``"de"`` and any French variant to ``"fr"``; defaults to ``"fr"``.
    """
    for var in ("LC_ALL", "LC_MESSAGES", "LANG"):
        lang = os.environ.get(var, "")
        if lang.startswith("de"):
            return "de"
        if lang.startswith("fr"):
            return "fr"
    try:
        lang_code = _locale_module.getlocale()[0] or ""
        if lang_code.startswith("de"):
            return "de"
        if lang_code.startswith("fr"):
            return "fr"
    except Exception:
        pass
    return "fr"


@dataclass
class OrderData:
    """Structured order data extracted from the QoQa API."""

    order_number: str
    order_date: date
    amount_chf: Decimal
    status: str | None
    subtotal_chf: Decimal | None
    discount_chf: Decimal | None
    vat_chf: Decimal | None
    delivery_on: date | None
    offer_id: str | None
    offer_title: str | None
    offer_subtitle: str | None
    universe: str | None
    subuniverse: str | None  # cleaned identifier (e.g. "beer", not "qbeerqoqach")
    item_description: str | None
    invoice_number: str | None
    pdf_url: str | None
    pdf_filename: str | None
    raw_json: str


@dataclass
class SubuniverseData:
    """Structured sub-universe data extracted from a universe's push_topics."""

    identifier: str  # cleaned (e.g. "beer")
    name: str | None
    universe_tracking_identifier: str


@dataclass
class UniverseData:
    """Structured universe data extracted from the QoQa API."""

    universe_tracking_identifier: str
    name: str | None
    subuniverses: list[SubuniverseData]


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


def list_all_purchases(token: str, locale: str = "fr") -> list[dict]:
    """Paginate through all purchases and return the combined list.

    Each purchase dict contains at least: id, reference, kind, title,
    purchased_at, state.

    Args:
        token: JWT bearer token.
        locale: API locale for localised strings (``"fr"`` or ``"de"``).
    """
    headers = _api_headers(token)
    all_purchases: list[dict] = []
    page = 1

    while True:
        resp = requests.get(
            PURCHASES_URL,
            headers=headers,
            params={"locale": locale, "page": page, "per_page": 50, "with_campaign": "false"},
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


def get_order_details(token: str, order_id: str, locale: str = "fr") -> dict:
    """Fetch full details for a single order.

    Returns the raw API response dict, which includes reference, total,
    created_at, invoice_link, accounting_documents, etc.

    Args:
        token: JWT bearer token.
        order_id: The order/purchase ID.
        locale: API locale for localised strings (``"fr"`` or ``"de"``).
    """
    headers = _api_headers(token)
    resp = requests.get(
        f"{ORDER_URL}/{order_id}",
        headers=headers,
        params={"locale": locale},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def clean_subuniverse_identifier(raw: str) -> str:
    """Remove vendor-specific prefix and suffix from a raw subuniverse identifier.

    Rules applied in order:
    1. Strip ``subuniverse_`` prefix if present.
    2. Otherwise strip a leading ``q`` character if present.
    3. Strip trailing ``qoqach`` suffix if present.

    Examples::

        clean_subuniverse_identifier("qbeerqoqach")   # → "beer"
        clean_subuniverse_identifier("subuniverse_nolow")  # → "nolow"
    """
    s = raw
    if s.startswith("subuniverse_"):
        s = s[len("subuniverse_"):]
    elif s.startswith("q"):
        s = s[1:]
    if s.endswith("qoqach"):
        s = s[: -len("qoqach")]
    return s


def fetch_universes(token: str, locale: str = "fr") -> list[UniverseData]:
    """Fetch universes and their sub-universes from the authenticated QoQa API.

    Uses the private ``/v2/alerts`` endpoint (requires a valid JWT). The
    response contains a hierarchical structure: each universe has a list of
    sub-universes in its ``push_topics`` field.

    Args:
        token: JWT bearer token.
        locale: Locale for universe names (``"fr"`` or ``"de"``).

    Returns:
        List of :class:`UniverseData` objects, each with a populated
        ``subuniverses`` list.
    """
    headers = _api_headers(token)
    resp = requests.get(
        ALERTS_URL,
        headers=headers,
        params={"locale": locale, "sub_universe": "true"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    universes: list[UniverseData] = []
    alerts = data.get("alerts", {})
    # The API may return alerts as a list of universe objects directly,
    # or as a dict with a "universes" key — handle both.
    if isinstance(alerts, list):
        universe_list = alerts
    else:
        universe_list = alerts.get("universes", [])
    for u in universe_list:
        uid = u.get("identifier")
        if not uid:
            continue
        subuniverses: list[SubuniverseData] = []
        for sub in u.get("push_topics", []):
            sub_raw = sub.get("identifier")
            if not sub_raw:
                continue
            subuniverses.append(
                SubuniverseData(
                    identifier=clean_subuniverse_identifier(sub_raw),
                    name=sub.get("name"),
                    universe_tracking_identifier=uid,
                )
            )
        universes.append(
            UniverseData(
                universe_tracking_identifier=uid,
                name=u.get("name"),
                subuniverses=subuniverses,
            )
        )
    return universes


def parse_order_data(detail: dict) -> OrderData:
    """Transform an API order-detail response into an OrderData instance."""
    reference = detail.get("reference", "")
    total = Decimal(str(detail.get("total", 0)))
    subtotal = detail.get("subtotal")
    subtotal_chf = Decimal(str(subtotal)) if subtotal is not None else None

    discount_centimes = int(detail.get("discount_amount_to_centimes") or 0)
    discount_chf = Decimal(discount_centimes) / 100 if discount_centimes else None

    created_at_str = detail.get("created_at", "")
    try:
        order_date = datetime.fromisoformat(created_at_str).date()
    except (ValueError, TypeError):
        order_date = date.today()

    # Offer
    offer = detail.get("offer") or {}
    offer_id = offer.get("id")
    offer_title = offer.get("title") or detail.get("title")
    offer_subtitle = offer.get("subtitle")
    universe = offer.get("universe_tracking_identifier")
    subs = offer.get("sub_universe_tracking_identifiers") or []
    raw_sub = subs[0] if subs else None
    subuniverse = clean_subuniverse_identifier(raw_sub) if raw_sub else None

    # Order items
    items = detail.get("order_items") or []
    item_description = items[0].get("full_name") if items else None
    vat_centimes = sum(int(i.get("vat_amount_to_centimes") or 0) for i in items)
    vat_chf = Decimal(vat_centimes) / 100 if vat_centimes else None

    # Delivery
    delivery_on_str = detail.get("delivery_on")
    try:
        delivery_on = date.fromisoformat(delivery_on_str) if delivery_on_str else None
    except (ValueError, TypeError):
        delivery_on = None

    # PDF / invoice
    pdf_url = None
    pdf_filename = None
    invoice_number = None
    docs = detail.get("accounting_documents") or []
    if docs:
        pdf_url = docs[0].get("pdf_link")
        title = docs[0].get("title") or ""
        invoice_number = title.removeprefix("Facture ").strip() or None
    if not pdf_url:
        pdf_url = detail.get("invoice_link")
    if pdf_url:
        path_part = pdf_url.split("?")[0]
        pdf_filename = path_part.split("/")[-1]

    return OrderData(
        order_number=reference,
        order_date=order_date,
        amount_chf=total,
        status=detail.get("status"),
        subtotal_chf=subtotal_chf,
        discount_chf=discount_chf,
        vat_chf=vat_chf,
        delivery_on=delivery_on,
        offer_id=offer_id,
        offer_title=offer_title,
        offer_subtitle=offer_subtitle,
        universe=universe,
        subuniverse=subuniverse,
        item_description=item_description,
        invoice_number=invoice_number,
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
