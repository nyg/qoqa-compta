"""Schema migration: enrich qoqa_orders with columns extracted from raw JSON.

Performs the following changes (idempotent — safe to run multiple times):

1. Rename  partner_name → offer_title
2. Rename  raw_text     → raw_json
3. ADD COLUMN for each new field (skipped if column already exists)
4. Backfill new columns by parsing the raw_json of every existing row

Works with both SQLite (local dev) and PostgreSQL (Neon.tech production).

Usage:
    cd crawler
    python migrate_schema.py
"""

from __future__ import annotations

import json
import sys
from rich.console import Console
from rich.progress import track
from sqlalchemy import text

from crawler.db import engine, is_sqlite

console = Console()


def _column_exists(conn, table: str, column: str) -> bool:
    if is_sqlite:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(row[1] == column for row in rows)
    else:
        row = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).fetchone()
        return row is not None


def _rename_column(conn, table: str, old: str, new: str) -> None:
    if _column_exists(conn, table, new):
        console.log(f"[dim]  skip rename {old} → {new} (column {new!r} already exists)[/dim]")
        return
    if not _column_exists(conn, table, old):
        console.log(f"[dim]  skip rename {old} → {new} (source column {old!r} not found)[/dim]")
        return
    conn.execute(text(f'ALTER TABLE {table} RENAME COLUMN "{old}" TO "{new}"'))
    console.log(f"[green]  ✓[/green] Renamed {old!r} → {new!r}")


def _add_column(conn, table: str, column: str, col_type: str) -> None:
    if _column_exists(conn, table, column):
        console.log(f"[dim]  skip ADD COLUMN {column!r} (already exists)[/dim]")
        return
    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN "{column}" {col_type}'))
    console.log(f"[green]  ✓[/green] Added column {column!r} ({col_type})")


NEW_COLUMNS: list[tuple[str, str]] = [
    ("status", "VARCHAR(32)"),
    ("subtotal_chf", "NUMERIC(10, 2)"),
    ("discount_chf", "NUMERIC(10, 2)"),
    ("vat_chf", "NUMERIC(10, 2)"),
    ("delivery_on", "DATE"),
    ("offer_id", "VARCHAR(32)"),
    ("offer_subtitle", "VARCHAR(255)"),
    ("offer_category", "VARCHAR(64)"),
    ("offer_subcategory", "VARCHAR(64)"),
    ("item_description", "TEXT"),
    ("invoice_number", "VARCHAR(64)"),
]


def _extract_fields(raw: str) -> dict:
    """Parse raw_json and return a dict of new-column values."""
    d = json.loads(raw)

    offer = d.get("offer") or {}
    items = d.get("order_items") or []
    docs = d.get("accounting_documents") or []

    vat_centimes = sum(int(i.get("vat_amount_to_centimes") or 0) for i in items)
    discount_centimes = int(d.get("discount_amount_to_centimes") or 0)

    subcategories = offer.get("sub_universe_tracking_identifiers") or []
    offer_subcategory = subcategories[0] if subcategories else None

    item_description = items[0].get("full_name") if items else None

    invoice_number = None
    if docs:
        title = docs[0].get("title") or ""
        # "Facture CH_AR13414708" → "CH_AR13414708"
        invoice_number = title.removeprefix("Facture ").strip() or None

    delivery_on = d.get("delivery_on") or None

    subtotal = d.get("subtotal")
    return {
        "status": d.get("status"),
        "subtotal_chf": float(subtotal) if subtotal is not None else None,
        "discount_chf": discount_centimes / 100.0 if discount_centimes else None,
        "vat_chf": vat_centimes / 100.0 if vat_centimes else None,
        "delivery_on": delivery_on,
        "offer_id": offer.get("id"),
        "offer_subtitle": offer.get("subtitle"),
        "offer_category": offer.get("tracking_identifier"),
        "offer_subcategory": offer_subcategory,
        "item_description": item_description,
        "invoice_number": invoice_number,
    }


def run_migration() -> None:
    console.rule("[bold blue]qoqa-compta schema migration[/bold blue]")

    with engine.begin() as conn:
        # ── Step 1: Renames ────────────────────────────────────────────────────
        console.log("[cyan]Step 1:[/cyan] Renaming columns…")
        _rename_column(conn, "qoqa_orders", "partner_name", "offer_title")
        _rename_column(conn, "qoqa_orders", "raw_text", "raw_json")

        # ── Step 2: Add new columns ────────────────────────────────────────────
        console.log("[cyan]Step 2:[/cyan] Adding new columns…")
        for col, col_type in NEW_COLUMNS:
            _add_column(conn, "qoqa_orders", col, col_type)

        # ── Step 3: Backfill ───────────────────────────────────────────────────
        console.log("[cyan]Step 3:[/cyan] Backfilling from raw_json…")
        rows = conn.execute(
            text("SELECT id, raw_json FROM qoqa_orders WHERE raw_json IS NOT NULL")
        ).fetchall()

        updated = 0
        failed = 0
        for row in track(rows, description="Backfilling rows…"):
            row_id, raw = row[0], row[1]
            try:
                fields = _extract_fields(raw)
                conn.execute(
                    text(
                        """
                        UPDATE qoqa_orders SET
                            status            = :status,
                            subtotal_chf      = :subtotal_chf,
                            discount_chf      = :discount_chf,
                            vat_chf           = :vat_chf,
                            delivery_on       = :delivery_on,
                            offer_id          = :offer_id,
                            offer_subtitle    = :offer_subtitle,
                            offer_category    = :offer_category,
                            offer_subcategory = :offer_subcategory,
                            item_description  = :item_description,
                            invoice_number    = :invoice_number
                        WHERE id = :id
                        """
                    ),
                    {**fields, "id": row_id},
                )
                updated += 1
            except Exception as exc:
                console.print(f"[red]✗[/red] Row id={row_id}: {exc}")
                failed += 1

    console.rule("[bold green]Migration complete[/bold green]")
    console.print(
        f"  Updated : [green]{updated}[/green]\n"
        f"  Failed  : [red]{failed}[/red]"
    )
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
