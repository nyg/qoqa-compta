"""Main synchronisation logic for the qoqa-compta crawler.

CLI usage:
    python -m crawler.sync --full    # Sync all orders from scratch
    python -m crawler.sync --update  # Sync only new orders (default)
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import track
from sqlalchemy import select, text
from crawler.api import (
    OrderData,
    UniverseData,
    detect_locale,
    download_pdf,
    fetch_universes,
    get_auth_token,
    get_order_details,
    list_all_purchases,
    parse_order_data,
)
from crawler.browser import get_pdf_download_dir, login_and_get_cookies
from crawler.db import Base, SessionLocal, engine, get_dialect_insert
from crawler.models import QoqaOrder, QoqaSubuniverse, QoqaUniverse

console = Console()
app = typer.Typer(help="QoQa.ch invoice crawler & DB sync tool.")


def _run_migrations() -> None:
    """Apply idempotent schema migrations not covered by ``create_all``.

    ``create_all`` only creates missing tables; it never adds missing columns
    to existing tables. New columns added to existing models must be migrated
    explicitly here.
    """
    is_sqlite = engine.dialect.name == "sqlite"
    blob_type = "BLOB" if is_sqlite else "BYTEA"

    with engine.begin() as conn:
        # Detect existence of qoqa_orders.pdf_data and add it if missing.
        if is_sqlite:
            cols = {
                row[1]
                for row in conn.exec_driver_sql(
                    "PRAGMA table_info(qoqa_orders)"
                ).fetchall()
            }
            table_exists = bool(cols)
            has_pdf_data = "pdf_data" in cols
        else:
            table_exists = bool(
                conn.execute(
                    text(
                        "SELECT 1 FROM information_schema.tables "
                        "WHERE table_name = 'qoqa_orders' LIMIT 1"
                    )
                ).first()
            )
            has_pdf_data = bool(
                conn.execute(
                    text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = 'qoqa_orders' "
                        "AND column_name = 'pdf_data' LIMIT 1"
                    )
                ).first()
            )

        if table_exists and not has_pdf_data:
            conn.exec_driver_sql(
                f"ALTER TABLE qoqa_orders ADD COLUMN pdf_data {blob_type}"
            )
            console.log("[green]✓[/green] Added column qoqa_orders.pdf_data.")


def _ensure_schema() -> None:
    """Create any missing DB tables and apply schema migrations."""
    _run_migrations()
    Base.metadata.create_all(bind=engine)
    console.log("[green]✓[/green] Database schema is up to date.")


def _sync_universes(token: str, locale: str) -> None:
    """Fetch universes (and their sub-universes) and upsert into the database."""
    insert = get_dialect_insert()

    try:
        universe_data = fetch_universes(token, locale)
    except Exception as exc:
        console.print(f"[yellow]⚠ Could not fetch universes: {exc}[/yellow]")
        return

    with SessionLocal() as session:
        for ud in universe_data:
            uid = ud.universe_tracking_identifier
            stmt = (
                insert(QoqaUniverse)
                .values(
                    universe_tracking_identifier=uid,
                    name=ud.name,
                )
                .on_conflict_do_update(
                    index_elements=["universe_tracking_identifier"],
                    set_={"name": ud.name},
                )
            )
            session.execute(stmt)

            for sub in ud.subuniverses:
                sub_stmt = (
                    insert(QoqaSubuniverse)
                    .values(
                        identifier=sub.identifier,
                        name=sub.name,
                        universe_tracking_identifier=uid,
                    )
                    .on_conflict_do_update(
                        index_elements=["identifier"],
                        set_={
                            "name": sub.name,
                            "universe_tracking_identifier": uid,
                        },
                    )
                )
                session.execute(sub_stmt)

        session.commit()

    total_subs = sum(len(ud.subuniverses) for ud in universe_data)
    console.log(
        f"[green]✓[/green] Synced {len(universe_data)} universe(s) "
        f"and {total_subs} sub-universe(s)."
    )


def _known_order_numbers() -> set[str]:
    """Return the set of order numbers already in the database."""
    with SessionLocal() as session:
        rows = session.execute(select(QoqaOrder.order_number)).scalars().all()
        return set(rows)


def _upsert_order(
    session, order: OrderData, pdf_bytes: bytes | None = None
) -> bool:
    """Insert or update one QoqaOrder row. Returns True if a new row was inserted.

    When ``pdf_bytes`` is provided, the bytes are written to the ``pdf_data``
    column. When it is ``None`` the column is left untouched on update so that
    a previously-stored PDF is not overwritten with NULL.
    """
    insert = get_dialect_insert()
    now = datetime.now(tz=timezone.utc)

    base_values = dict(
        order_number=order.order_number,
        order_date=order.order_date,
        amount_chf=order.amount_chf,
        status=order.status,
        subtotal_chf=order.subtotal_chf,
        discount_chf=order.discount_chf,
        vat_chf=order.vat_chf,
        delivery_on=order.delivery_on,
        offer_id=order.offer_id,
        offer_title=order.offer_title,
        offer_subtitle=order.offer_subtitle,
        universe=order.universe,
        subuniverse=order.subuniverse,
        item_description=order.item_description,
        invoice_number=order.invoice_number,
        pdf_filename=order.pdf_filename,
        raw_json=order.raw_json,
    )

    update_values = {k: v for k, v in base_values.items() if k != "order_number"}
    update_values["updated_at"] = now

    if pdf_bytes is not None:
        base_values["pdf_data"] = pdf_bytes
        update_values["pdf_data"] = pdf_bytes

    stmt = (
        insert(QoqaOrder)
        .values(**base_values)
        .on_conflict_do_update(
            index_elements=["order_number"],
            set_=update_values,
        )
    )
    result = session.execute(stmt)
    return result.rowcount == 1


@app.command()
def sync(
    full: bool = typer.Option(
        False,
        "--full",
        help="Sync all orders from the beginning.",
    ),
    update: bool = typer.Option(
        False,
        "--update",
        help="Sync only new orders since the last run (default behaviour).",
    ),
    pdf_only: bool = typer.Option(
        False,
        "--pdf-only",
        help="Only download PDFs, skip DB sync.",
    ),
    db_only: bool = typer.Option(
        False,
        "--db-only",
        help="Skip PDF download, only sync data to database.",
    ),
    locale: str = typer.Option(
        None,
        "--locale",
        help=(
            "Locale for QoQa API responses (fr or de). "
            "Defaults to auto-detection from the system locale (LANG/LC_ALL env vars). "
            "Falls back to 'fr' if detection fails."
        ),
    ),
) -> None:
    """Synchronise QoQa invoices: fetch via API, upsert to DB, download PDFs."""

    console.rule("[bold blue]qoqa-compta sync[/bold blue]")

    resolved_locale = locale or detect_locale()
    console.log(f"[cyan]→[/cyan] Using locale: [bold]{resolved_locale}[/bold]")

    _ensure_schema()

    # ── Step 1: Authenticate ───────────────────────────────────────────────────
    console.log("[cyan]→[/cyan] Logging in to QoQa.ch…")
    try:
        cookies = login_and_get_cookies()
    except Exception as exc:
        console.print(f"[red]✗ Login error:[/red] {exc}")
        raise typer.Exit(code=1)
    console.log("[green]✓[/green] Browser login successful.")

    console.log("[cyan]→[/cyan] Obtaining API token…")
    try:
        token = get_auth_token(cookies)
    except Exception as exc:
        console.print(f"[red]✗ Token error:[/red] {exc}")
        raise typer.Exit(code=1)
    console.log("[green]✓[/green] API token obtained.")

    # ── Step 2: Sync universes ─────────────────────────────────────────────────
    console.log("[cyan]→[/cyan] Syncing universes…")
    _sync_universes(token, resolved_locale)

    # ── Step 3: Fetch purchases ────────────────────────────────────────────────
    console.log("[cyan]→[/cyan] Fetching purchases from API…")
    try:
        purchases = list_all_purchases(token, locale=resolved_locale)
    except Exception as exc:
        console.print(f"[red]✗ API error:[/red] {exc}")
        raise typer.Exit(code=1)
    console.log(f"[green]✓[/green] Found {len(purchases)} purchase(s).")

    if not purchases:
        console.log("[yellow]No purchases found.[/yellow]")
        raise typer.Exit()

    # In update mode, filter out already-known orders
    known = _known_order_numbers() if not full else set()

    # ── Step 4: Get order details + sync ───────────────────────────────────────
    pdf_dir = get_pdf_download_dir()
    counts = {"synced": 0, "downloaded": 0, "skipped": 0, "failed": 0}

    for purchase in track(purchases, description="Syncing orders…"):
        purchase_id = purchase.get("id") or purchase.get("reference", "")
        if not purchase_id:
            counts["failed"] += 1
            continue

        # Skip orders already in DB (update mode)
        if purchase_id in known:
            counts["skipped"] += 1
            continue

        try:
            detail = get_order_details(token, purchase_id, locale=resolved_locale)
        except Exception as exc:
            console.print(f"[red]✗[/red] API error for {purchase_id}: {exc}")
            counts["failed"] += 1
            continue

        order = parse_order_data(detail)

        # Download PDF first so its bytes can be persisted alongside the order.
        pdf_bytes: bytes | None = None
        if not db_only and order.pdf_url:
            dest = pdf_dir / (order.pdf_filename or f"{order.order_number}.pdf")
            if full or not dest.exists():
                try:
                    download_pdf(order.pdf_url, dest)
                    counts["downloaded"] += 1
                except Exception as exc:
                    console.print(f"[red]✗[/red] PDF error for {order.order_number}: {exc}")
            if dest.exists():
                try:
                    pdf_bytes = dest.read_bytes()
                except Exception as exc:
                    console.print(
                        f"[yellow]⚠[/yellow] Could not read {dest.name} for DB storage: {exc}"
                    )

        # Upsert to DB
        if not pdf_only:
            try:
                with SessionLocal() as session:
                    _upsert_order(session, order, pdf_bytes=pdf_bytes)
                    session.commit()
                counts["synced"] += 1
            except Exception as exc:
                console.print(f"[red]✗[/red] DB error for {order.order_number}: {exc}")
                counts["failed"] += 1
                continue

    console.rule("[bold green]Done[/bold green]")
    console.print(
        f"  Synced to DB : [green]{counts['synced']}[/green]\n"
        f"  PDFs downloaded: [cyan]{counts['downloaded']}[/cyan]\n"
        f"  Skipped      : [blue]{counts['skipped']}[/blue]\n"
        f"  Failed       : [red]{counts['failed']}[/red]"
    )


if __name__ == "__main__":
    app()
