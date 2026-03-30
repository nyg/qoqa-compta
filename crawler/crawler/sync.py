"""Main synchronisation logic for the qoqa-compta crawler.

CLI usage:
    python -m crawler.sync --full    # Sync all orders from scratch
    python -m crawler.sync --update  # Sync only new orders (default)
"""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.progress import track
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from crawler.api import (
    OrderData,
    download_pdf,
    get_auth_token,
    get_order_details,
    list_all_purchases,
    parse_order_data,
)
from crawler.browser import get_pdf_download_dir, login_and_get_cookies
from crawler.db import Base, SessionLocal, engine
from crawler.models import QoqaOrder

console = Console()
app = typer.Typer(help="Qoqa.ch invoice crawler & DB sync tool.")


def _ensure_schema() -> None:
    """Create the DB tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
    console.log("[green]✓[/green] Database schema is up to date.")


def _known_order_numbers() -> set[str]:
    """Return the set of order numbers already in the database."""
    with SessionLocal() as session:
        rows = session.execute(select(QoqaOrder.order_number)).scalars().all()
        return set(rows)


def _upsert_order(session, order: OrderData) -> bool:
    """Insert or update one QoqaOrder row. Returns True if a new row was inserted."""
    stmt = (
        pg_insert(QoqaOrder)
        .values(
            order_number=order.order_number,
            order_date=order.order_date,
            amount_chf=order.amount_chf,
            partner_name=order.partner_name,
            pdf_filename=order.pdf_filename,
            raw_text=order.raw_json,
        )
        .on_conflict_do_update(
            index_elements=["order_number"],
            set_={
                "order_date": order.order_date,
                "amount_chf": order.amount_chf,
                "partner_name": order.partner_name,
                "pdf_filename": order.pdf_filename,
                "raw_text": order.raw_json,
            },
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
) -> None:
    """Synchronise Qoqa invoices: fetch via API, upsert to DB, download PDFs."""

    console.rule("[bold blue]qoqa-compta sync[/bold blue]")

    _ensure_schema()

    # ── Step 1: Authenticate ───────────────────────────────────────────────────
    console.log("[cyan]→[/cyan] Logging in to Qoqa.ch…")
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

    # ── Step 2: Fetch purchases ────────────────────────────────────────────────
    console.log("[cyan]→[/cyan] Fetching purchases from API…")
    try:
        purchases = list_all_purchases(token)
    except Exception as exc:
        console.print(f"[red]✗ API error:[/red] {exc}")
        raise typer.Exit(code=1)
    console.log(f"[green]✓[/green] Found {len(purchases)} purchase(s).")

    if not purchases:
        console.log("[yellow]No purchases found.[/yellow]")
        raise typer.Exit()

    # In update mode, filter out already-known orders
    known = _known_order_numbers() if not full else set()

    # ── Step 3: Get order details + sync ───────────────────────────────────────
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
            detail = get_order_details(token, purchase_id)
        except Exception as exc:
            console.print(f"[red]✗[/red] API error for {purchase_id}: {exc}")
            counts["failed"] += 1
            continue

        order = parse_order_data(detail)

        # Upsert to DB
        if not pdf_only:
            try:
                with SessionLocal() as session:
                    _upsert_order(session, order)
                    session.commit()
                counts["synced"] += 1
            except Exception as exc:
                console.print(f"[red]✗[/red] DB error for {order.order_number}: {exc}")
                counts["failed"] += 1
                continue

        # Download PDF
        if not db_only and order.pdf_url:
            dest = pdf_dir / (order.pdf_filename or f"{order.order_number}.pdf")
            if full or not dest.exists():
                try:
                    download_pdf(order.pdf_url, dest)
                    counts["downloaded"] += 1
                except Exception as exc:
                    console.print(f"[red]✗[/red] PDF error for {order.order_number}: {exc}")

    console.rule("[bold green]Done[/bold green]")
    console.print(
        f"  Synced to DB : [green]{counts['synced']}[/green]\n"
        f"  PDFs downloaded: [cyan]{counts['downloaded']}[/cyan]\n"
        f"  Skipped      : [blue]{counts['skipped']}[/blue]\n"
        f"  Failed       : [red]{counts['failed']}[/red]"
    )


if __name__ == "__main__":
    app()
