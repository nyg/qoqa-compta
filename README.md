# qoqa-compta

> Personal open-source tool to automatically sync Qoqa.ch order data and PDF invoices to PostgreSQL (Neon.tech) and display a spending dashboard.

---

## Table of contents

- [Overview](#overview)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Python crawler](#python-crawler)
  - [Installation](#crawler-installation)
  - [Running the crawler](#running-the-crawler)
- [Next.js frontend](#nextjs-frontend)
  - [Installation](#frontend-installation)
  - [Running the frontend](#running-the-frontend)
- [Database (Neon.tech)](#database-neontech)
- [Contributing](#contributing)

---

## Overview

The crawler logs in to Qoqa.ch via the browser (just for authentication), then
uses the Qoqa REST API to fetch all order data and download PDF invoices.

```
                          cookies           JWT token
┌──────────┐  login  ┌──────────┐  auth  ┌──────────────┐
│  Chrome   │ ──────► │ Cookies  │ ─────► │ Qoqa REST API│
│ (CDP,10s) │        └──────────┘        │ api.qoqa.ch  │
└──────────┘                              └──────┬───────┘
                                                 │  JSON + PDF URLs
                                          ┌──────▼───────┐
                                          │ Python Sync   │
                                          │ (requests)    │
                                          └──┬────────┬──┘
                                    upsert   │        │  download
                                   ┌─────────▼──┐  ┌─▼──────────┐
                                   │ PostgreSQL  │  │   PDFs/    │
                                   │ (Neon.tech) │  │   (local)  │
                                   └──────┬──────┘  └────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  Dashboard  │
                                   │ (Next.js 16)│
                                   └─────────────┘
```

---

## Project structure

```
qoqa-compta/
├── .gitignore
├── renovate.json
├── README.md
├── crawler/                  # Python code
│   ├── .env.example
│   ├── requirements.txt
│   ├── crawler/
│   │   ├── __init__.py
│   │   ├── __main__.py       # CLI entry point
│   │   ├── sync.py           # Main synchronisation logic (CLI)
│   │   ├── api.py            # Qoqa REST API client
│   │   ├── browser.py        # Browser login only (SeleniumBase CDP)
│   │   ├── db.py             # SQLAlchemy connection and session
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── order.py      # SQLAlchemy QoqaOrder model
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── pdf_parser.py # PDF parsing with pdfplumber
└── frontend/                 # Next.js application
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── components.json       # shadcn/ui config
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx      # Main dashboard
        │   └── api/
        │       └── orders/
        │           └── route.ts
        ├── components/
        │   ├── ui/           # shadcn/ui auto-generated
        │   ├── stats-cards.tsx
        │   ├── spending-chart.tsx
        │   └── orders-table.tsx
        ├── lib/
        │   ├── db.ts         # Neon serverless connection
        │   └── utils.ts
        └── types/
            └── order.ts
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **pnpm**
- **Google Chrome** or **Chromium** installed
- A **Neon.tech** account with a PostgreSQL database (free tier is sufficient)
- A **Qoqa.ch** account with orders

---

## Environment variables

### Crawler

Copy `crawler/.env.example` to `crawler/.env` and fill in:

| Variable               | Description                              | Example                                                                          |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection URL (Neon.tech)    | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/qoqa?sslmode=require` |
| `QOQA_EMAIL`           | Qoqa.ch login email *(recommended)*     | `me@example.com`                                                                 |
| `QOQA_PASSWORD`        | Qoqa.ch login password *(recommended)*  | `••••••••`                                                                       |
| `CHROME_USER_DATA_DIR` | Chrome profile path *(alt. auth method)* | `~/Library/Application Support/Google/Chrome` (macOS)                            |
| `PDF_DOWNLOAD_DIR`     | PDF download folder                      | `./pdfs`                                                                         |
| `BROWSER_PATH`         | Custom browser binary *(optional)*       | `/Applications/Chromium.app/Contents/MacOS/Chromium`                             |

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

| Variable       | Description                              | Example                                                                          |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection URL (Neon.tech)    | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/qoqa?sslmode=require` |

> **Neon.tech note**: your `DATABASE_URL` can be found in the Neon dashboard → your project → *Connection Details* → select the `psycopg` driver.

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

### Frontend installation

```bash
cd frontend

# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL
```

### Running the frontend

```bash
# Development mode
pnpm dev

# Production build
pnpm build && pnpm start
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

---

## Database (Neon.tech)

The crawler automatically creates the `qoqa_orders` table on first run (via SQLAlchemy `create_all`).

Table structure:

```sql
CREATE TABLE qoqa_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(64) UNIQUE NOT NULL,
    order_date      DATE NOT NULL,
    amount_chf      NUMERIC(10, 2) NOT NULL,
    partner_name    VARCHAR(255),
    pdf_filename    VARCHAR(255),
    raw_text        TEXT,            -- JSON from the Qoqa API
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Contributing

This is a personal project but PRs are welcome. Please open an issue before submitting a major change.
