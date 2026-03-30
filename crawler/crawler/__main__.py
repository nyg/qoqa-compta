"""CLI entry point for the qoqa-compta crawler.

Usage:
    python -m crawler.sync --full    # Download and sync all orders
    python -m crawler.sync --update  # Only sync new orders since last run
"""

from crawler.sync import app

if __name__ == "__main__":
    app()
