"""Database connection and session management using SQLAlchemy 2.x.

Supports both PostgreSQL (via psycopg 3) and SQLite.
The database is selected from the DATABASE_URL environment variable:

  - ``sqlite:////absolute/path/to/qoqa.db``  → local SQLite file (default)
  - ``postgresql://...``                      → PostgreSQL (e.g. Neon.tech)

If DATABASE_URL is unset, a local SQLite file is used at the XDG data home:
  ``$XDG_DATA_HOME/qoqa-compta/qoqa.db``  (defaults to ``~/.local/share/…``)
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
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
        # Ensure the parent directory exists for the SQLite file
        db_path = Path(database_url[len("sqlite:///"):])
        db_path.parent.mkdir(parents=True, exist_ok=True)
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


is_sqlite: bool = _is_sqlite_url(os.environ.get("DATABASE_URL") or _DEFAULT_DATABASE_URL)

engine = get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    """Yield a database session (context manager friendly)."""
    with SessionLocal() as session:
        yield session
