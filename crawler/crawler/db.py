"""Database connection and session management using SQLAlchemy 2.x + psycopg 3."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""


def get_engine():
    """Create and return a SQLAlchemy engine from DATABASE_URL env var."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Copy crawler/.env.example to crawler/.env and fill in your value."
        )
    # Use psycopg 3 driver explicitly
    if database_url.startswith("postgresql://") and "+psycopg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 1},
    )


engine = get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    """Yield a database session (context manager friendly)."""
    with SessionLocal() as session:
        yield session
