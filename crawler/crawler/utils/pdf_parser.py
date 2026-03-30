"""PDF parsing utilities for Qoqa.ch invoice PDFs.

Uses pdfplumber — the most Pythonic library for extracting structured data
(text, tables) from PDFs.

Qoqa invoice structure (typical):
    - Header: "Confirmation de commande No XXXXXX"
    - Date line: "Date : DD.MM.YYYY"
    - Partner/brand section (optional)
    - Line items table
    - Total TTC line: "Total CHF XX.XX"
"""

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pdfplumber


@dataclass
class ParsedInvoice:
    """Structured data extracted from one Qoqa PDF invoice."""

    order_number: str
    order_date: date
    amount_chf: Decimal
    partner_name: str | None = None
    raw_text: str = field(default="", repr=False)


# ── Regular expressions ────────────────────────────────────────────────────────

_RE_ORDER_NUMBER = re.compile(
    r"(?:commande|order|no\.?|n°)[^\d]*(\d{5,})",
    re.IGNORECASE,
)
_RE_DATE = re.compile(
    r"(?:date\s*[:\-]?\s*)?"
    r"(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})",
    re.IGNORECASE,
)
_RE_TOTAL = re.compile(
    r"total\s+(?:TTC\s+)?(?:CHF\s+)?([\d\s'.,]+)",
    re.IGNORECASE,
)
_RE_PARTNER = re.compile(
    r"(?:partenaire|partner|marque|brand|chez)\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)


def parse_invoice_pdf(pdf_path: Path) -> ParsedInvoice | None:
    """Parse a Qoqa invoice PDF and return a ParsedInvoice or None on failure.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        A ParsedInvoice dataclass instance, or None if parsing fails.
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "\n".join(
                page.extract_text() or "" for page in pdf.pages
            )
    except Exception as exc:
        print(f"[pdf_parser] Cannot open {pdf_path.name}: {exc}")
        return None

    order_number = _extract_order_number(full_text, pdf_path.stem)
    order_date = _extract_date(full_text)
    amount_chf = _extract_total(full_text)
    partner_name = _extract_partner(full_text)

    if order_number is None or order_date is None or amount_chf is None:
        print(
            f"[pdf_parser] Incomplete data for {pdf_path.name}: "
            f"order={order_number}, date={order_date}, amount={amount_chf}"
        )
        return None

    return ParsedInvoice(
        order_number=order_number,
        order_date=order_date,
        amount_chf=amount_chf,
        partner_name=partner_name,
        raw_text=full_text,
    )


# ── Private helpers ────────────────────────────────────────────────────────────


def _extract_order_number(text: str, fallback_stem: str) -> str | None:
    """Try to extract the order number from the PDF text."""
    match = _RE_ORDER_NUMBER.search(text)
    if match:
        return match.group(1).strip()

    # Fall back to using the filename stem if it looks numeric
    digits = re.sub(r"\D", "", fallback_stem)
    if digits:
        return digits

    return None


def _extract_date(text: str) -> date | None:
    """Extract the order date from text. Returns the first plausible date found."""
    for match in _RE_DATE.finditer(text):
        day_str, month_str, year_str = match.group(1), match.group(2), match.group(3)
        try:
            day = int(day_str)
            month = int(month_str)
            year = int(year_str)
            if year < 100:
                year += 2000
            return date(year, month, day)
        except ValueError:
            continue
    return None


def _extract_total(text: str) -> Decimal | None:
    """Extract the total CHF amount from the PDF text."""
    # Search for the last occurrence of a "Total" line (most likely the grand total)
    matches = list(_RE_TOTAL.finditer(text))
    for match in reversed(matches):
        raw = match.group(1).strip()
        # Normalise Swiss number format: 1'234.56 or 1 234,56
        raw = raw.replace("'", "").replace(" ", "").replace(",", ".")
        # Remove trailing non-numeric characters
        raw = re.sub(r"[^\d.]", "", raw)
        try:
            return Decimal(raw)
        except InvalidOperation:
            continue
    return None


def _extract_partner(text: str) -> str | None:
    """Try to extract the brand / partner name from the invoice text."""
    match = _RE_PARTNER.search(text)
    if match:
        return match.group(1).strip()[:255]
    return None
