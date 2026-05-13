# QoQa Compta

> Web app & crawler to automatically sync your [QoQa.ch](https://www.qoqa.ch) orders and PDF invoices to a local SQLite (or PostgreSQL) database and display a spending dashboard.

![Dashboard screenshot](docs/screenshot.png)

---

## Table of contents

- [Overview](#overview)
- [Python crawler](#python-crawler)
  - [Installation](#crawler-installation)
  - [Running the crawler](#running-the-crawler)
- [Next.js frontend](#nextjs-frontend)
  - [Installation](#frontend-installation)
  - [Running the frontend](#running-the-frontend)
- [Environment variables](#environment-variables)

---

## Overview

The crawler authenticates to QoQa.ch via its REST API (no browser required), then uses the QoQa REST API to fetch all order data and download PDF invoices. Data is stored in a local SQLite database (or PostgreSQL) and displayed in a Next.js dashboard.

See [docs/architecture.md](docs/architecture.md) for the full architecture diagram, project structure, and database schema.

---

## Python crawler

### Crawler installation

```bash
cd crawler

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and QOQA_EMAIL + QOQA_PASSWORD
```

### Running the crawler

```bash
# From the crawler/ directory, with the venv activated:

# Full sync (all orders + PDFs)
python -m crawler.sync --full

# Incremental sync (new orders only — default)
python -m crawler.sync --update

# Only sync data to DB, skip PDF download
python -m crawler.sync --full --db-only

# Only download PDFs, skip DB sync
python -m crawler.sync --full --pdf-only

# Show help
python -m crawler.sync --help
```

> **Authentication**: set `QOQA_EMAIL` + `QOQA_PASSWORD` in `.env`. The crawler authenticates via the QoQa REST API — no browser or Chrome required.

---

## Next.js frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# Start Next.js server
pnpm dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

The UI language is automatically detected from your browser's `Accept-Language` header. Supported languages: **English**, **French** (fr), **German** (de), **Italian** (it), and **Romansh** (rm).

Dashboard features:
- **Stats cards** — total spent, number of orders, average per order
- **Spending charts** — monthly and yearly bar + line charts
- **Orders table** — searchable, paginated list of all orders
- **Invoice PDF viewer** — every order with a stored invoice exposes a "View
  invoice" button that opens the PDF in an in-app popup using the browser's
  native PDF viewer (with a download fallback)
- **Category filter** — multi-select dropdown (top-right) to filter all dashboard data by order category; selection is encoded in the URL for shareable links

> Invoice PDFs are stored twice by the crawler: as files under
> `crawler/pdfs/` for offline access, and inline in `qoqa_orders.pdf_data`
> (`BLOB` on SQLite, `BYTEA` on PostgreSQL) so the frontend can serve them
> through `/api/orders/[orderNumber]/pdf` without sharing a filesystem with
> the crawler. Pre-existing databases get the new column added automatically
> on the next `python -m crawler.sync` run.

---

## Environment variables

### Crawler

Copy `crawler/.env.example` to `crawler/.env` and fill in:

| Variable           | Description                                          | Example                                                                          |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`     | Database URL (SQLite default, PostgreSQL optional)   | `sqlite:////home/user/.local/share/qoqa-compta/qoqa.db`                         |
| `QOQA_EMAIL`       | QoQa.ch login email                                 | `me@example.com`                                                                 |
| `QOQA_PASSWORD`    | QoQa.ch login password                              | `••••••••`                                                                       |
| `PDF_DOWNLOAD_DIR` | PDF download folder                                  | `./pdfs`                                                                         |

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

| Variable       | Description                                        | Example                                                                          |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL` | Database URL — must point to the **same file/DB** as the crawler | `sqlite:////home/user/.local/share/qoqa-compta/qoqa.db` |

> **SQLite URL format**: use four slashes for an absolute path:
> `sqlite:////absolute/path/to/qoqa.db` (three slashes for the scheme, one for the root `/`).
>
> **PostgreSQL**: replace with your Neon.tech connection string:
> `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/qoqa?sslmode=require`
>
> **XDG note**: if `DATABASE_URL` is unset, the crawler defaults to
> `$XDG_DATA_HOME/qoqa-compta/qoqa.db` (i.e. `~/.local/share/qoqa-compta/qoqa.db`).
