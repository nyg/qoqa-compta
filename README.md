# qoqa-compta

> Web app & crawler to automatically sync your Qoqa.ch orders and PDF invoices to a local SQLite (or PostgreSQL) database and display a spending dashboard.

![Dashboard screenshot](docs/screenshot.png)

---

## Table of contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Python crawler](#python-crawler)
  - [Installation](#crawler-installation)
  - [Running the crawler](#running-the-crawler)
- [Next.js frontend](#nextjs-frontend)
  - [Installation](#frontend-installation)
  - [Running the frontend](#running-the-frontend)
- [Contributing](#contributing)

---

## Overview

The crawler logs in to Qoqa.ch via the browser (just for authentication), then uses the Qoqa REST API to fetch all order data and download PDF invoices. Data is stored in a local SQLite database (or PostgreSQL) and displayed in a Next.js dashboard.

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

> **Authentication**: the crawler supports two modes:
> - **Credentials** *(recommended)*: set `QOQA_EMAIL` + `QOQA_PASSWORD` in `.env`. The crawler logs in automatically — Chrome can stay open.
> - **Profile reuse**: set `CHROME_USER_DATA_DIR` in `.env`. Uses your existing Chrome cookies — you must close Chrome first.
>
> **Chromium**: set `BROWSER_PATH` in `.env` to use Chromium instead of Chrome.

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

---

## Environment variables

### Crawler

Copy `crawler/.env.example` to `crawler/.env` and fill in:

| Variable               | Description                                          | Example                                                                          |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Database URL (SQLite default, PostgreSQL optional)   | `sqlite:////home/user/.local/share/qoqa-compta/qoqa.db`                         |
| `QOQA_EMAIL`           | Qoqa.ch login email *(recommended)*                 | `me@example.com`                                                                 |
| `QOQA_PASSWORD`        | Qoqa.ch login password *(recommended)*              | `••••••••`                                                                       |
| `CHROME_USER_DATA_DIR` | Chrome profile path *(alt. auth method)*             | `~/Library/Application Support/Google/Chrome` (macOS)                            |
| `PDF_DOWNLOAD_DIR`     | PDF download folder                                  | `./pdfs`                                                                         |
| `BROWSER_PATH`         | Custom browser binary *(optional)*                   | `/Applications/Chromium.app/Contents/MacOS/Chromium`                             |

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