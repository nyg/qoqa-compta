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
from sqlalchemy.dialects.postgresql import insert as pg_insert

from crawler.browser import download_order_pdfs, get_pdf_download_dir
from crawler.db import Base, SessionLocal, engine
from crawler.models import QoqaOrder
from crawler.utils.pdf_parser import parse_invoice_pdf

console = Console()
app = typer.Typer(help="Qoqa.ch invoice crawler & DB sync tool.")


def _ensure_schema() -> None:
    """Create the DB tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
    console.log("[green]✓[/green] Database schema is up to date.")


def _upsert_order(session, invoice) -> bool:
    """Insert or update one QoqaOrder row. Returns True if a new row was inserted."""
    stmt = (
        pg_insert(QoqaOrder)
        .values(
            order_number=invoice.order_number,
            order_date=invoice.order_date,
            amount_chf=invoice.amount_chf,
            partner_name=invoice.partner_name,
            raw_text=invoice.raw_text,
        )
        .on_conflict_do_update(
            index_elements=["order_number"],
            set_={
                "order_date": invoice.order_date,
                "amount_chf": invoice.amount_chf,
                "partner_name": invoice.partner_name,
                "raw_text": invoice.raw_text,
            },
        )
    )
    result = session.execute(stmt)
    return result.rowcount == 1


def _sync_pdfs_to_db(pdf_paths: list[Path]) -> dict[str, int]:
    """Parse each PDF and upsert into the database.

    Returns:
        A dict with counts: {"parsed": N, "inserted": N, "updated": N, "failed": N}
    """
    counts = {"parsed": 0, "inserted": 0, "updated": 0, "failed": 0}

    with SessionLocal() as session:
        for pdf_path in track(pdf_paths, description="Parsing & syncing PDFs…"):
            invoice = parse_invoice_pdf(pdf_path)
            if invoice is None:
                counts["failed"] += 1
                continue

            counts["parsed"] += 1

            try:
                is_new = _upsert_order(session, invoice)
                if is_new:
                    counts["inserted"] += 1
                else:
                    counts["updated"] += 1
            except Exception as exc:
                console.print(f"[red]✗[/red] DB error for {pdf_path.name}: {exc}")
                session.rollback()
                counts["failed"] += 1

        session.commit()

    return counts


@app.command()
def sync(
    full: bool = typer.Option(
        False,
        "--full",
        help="Download all invoices from the beginning (ignores already-downloaded PDFs).",
    ),
    update: bool = typer.Option(
        False,
        "--update",
        help="Download only new invoices since the last run (default behaviour).",
    ),
    pdf_only: bool = typer.Option(
        False,
        "--pdf-only",
        help="Only download PDFs, skip DB sync.",
    ),
    db_only: bool = typer.Option(
        False,
        "--db-only",
        help="Skip browser download; parse PDFs already in the download directory.",
    ),
) -> None:
    """Synchronise Qoqa invoices: download PDFs and upsert into the database."""

    console.rule("[bold blue]qoqa-compta sync[/bold blue]")

    _ensure_schema()

    # ── Step 1: Download PDFs ──────────────────────────────────────────────────
    if not db_only:
        console.log(f"[cyan]→[/cyan] Launching browser ({'full' if full else 'incremental'} mode)…")
        try:
            downloaded = download_order_pdfs(full=full or not update)
            console.log(f"[green]✓[/green] Downloaded {len(downloaded)} PDF(s).")
        except Exception as exc:
            console.print(f"[red]✗ Browser error:[/red] {exc}")
            raise typer.Exit(code=1)
    else:
        # Parse everything already in the download directory
        pdf_dir = get_pdf_download_dir()
        downloaded = list(pdf_dir.glob("*.pdf"))
        console.log(f"[cyan]→[/cyan] Found {len(downloaded)} PDF(s) in {pdf_dir}.")

    if pdf_only:
        console.log("[yellow]--pdf-only: skipping DB sync.[/yellow]")
        raise typer.Exit()

    # ── Step 2: Sync to DB ─────────────────────────────────────────────────────
    if not downloaded:
        console.log("[yellow]No PDFs to sync.[/yellow]")
        raise typer.Exit()

    counts = _sync_pdfs_to_db(downloaded)

    console.rule("[bold green]Done[/bold green]")
    console.print(
        f"  Parsed : [cyan]{counts['parsed']}[/cyan]\n"
        f"  Inserted: [green]{counts['inserted']}[/green]\n"
        f"  Updated : [blue]{counts['updated']}[/blue]\n"
        f"  Failed  : [red]{counts['failed']}[/red]"
    )
