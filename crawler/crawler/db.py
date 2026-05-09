"""Database connection and session management using SQLAlchemy 2.x.

Supports both PostgreSQL (via psycopg 3) and SQLite.
The database is selected from the DATABASE_URL environment variable:

  - ``sqlite:////absolute/path/to/qoqa.db``  → local SQLite file (default)
  - ``postgresql://...``                      → PostgreSQL (e.g. Neon.tech)

If DATABASE_URL is unset, a local SQLite file is used at the XDG data home:
  ``$XDG_DATA_HOME/qoqa-compta/qoqa.db``  (defaults to ``~/.local/share/…``)
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from sqlalchemy import create_engine, event, text as sqlalchemy_text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

_XDG_DATA_HOME = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
_DEFAULT_SQLITE_PATH = _XDG_DATA_HOME / "qoqa-compta" / "qoqa.db"
_DEFAULT_DATABASE_URL = f"sqlite:///{_DEFAULT_SQLITE_PATH}"


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""


def _is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite:///")


def get_engine():
    """Create and return a SQLAlchemy engine from DATABASE_URL env var."""
    database_url = os.environ.get("DATABASE_URL") or _DEFAULT_DATABASE_URL

    if _is_sqlite_url(database_url):
        db_path = Path(database_url[len("sqlite:///"):])
        if not db_path.parent.exists():
            Console().print(Panel(
                f"[bold]SQLite directory not found:[/bold] {db_path.parent}\n\n"
                "The database file is created by the crawler on first run.\n"
                "Make sure [bold]DATABASE_URL[/bold] in [bold]crawler/.env[/bold] "
                "points to a valid path for your OS.",
                title="[red]Database Error[/red]",
                border_style="red",
            ))
            sys.exit(1)
        eng = create_engine(database_url, echo=False)
        # Enable WAL mode and a busy timeout so concurrent reads/writes don't
        # deadlock when the crawler and frontend share the same file.
        @event.listens_for(eng, "connect")
        def _set_sqlite_pragmas(conn, _record):
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
        return eng

    # PostgreSQL path
    if database_url.startswith("postgresql://") and "+psycopg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
    )


def get_dialect_insert():
    """Return the dialect-appropriate INSERT constructor for upsert statements."""
    if engine.dialect.name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:
        from sqlalchemy.dialects.postgresql import insert
    return insert


def run_migrations() -> None:
    """Apply idempotent schema migrations before ``create_all``.

    Currently handles:
    - Renaming ``offer_category`` → ``universe`` on ``qoqa_orders``
    - Renaming ``offer_subcategory`` → ``subuniverse`` on ``qoqa_orders``

    Both SQLite ≥ 3.25 and PostgreSQL support ``ALTER TABLE … RENAME COLUMN``
    natively. The migration is a no-op when the columns have already been
    renamed (checked via ``PRAGMA table_info`` / ``information_schema``).
    """
    _RENAMES = [
        ("offer_category", "universe"),
        ("offer_subcategory", "subuniverse"),
    ]
    with engine.connect() as conn:
        for old_col, new_col in _RENAMES:
            if engine.dialect.name == "sqlite":
                result = conn.execute(
                    sqlalchemy_text("PRAGMA table_info(qoqa_orders)")
                )
                columns = {row[1] for row in result}
            else:
                result = conn.execute(
                    sqlalchemy_text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'qoqa_orders'"
                    )
                )
                columns = {row[0] for row in result}

            if old_col in columns:
                conn.execute(
                    sqlalchemy_text(
                        f"ALTER TABLE qoqa_orders RENAME COLUMN {old_col} TO {new_col}"
                    )
                )
                conn.commit()




engine = get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    """Yield a database session (context manager friendly)."""
    with SessionLocal() as session:
        yield session
