# qoqa-compta

> Personal open-source tool to automatically download PDF invoices from Qoqa.ch, parse them, store them in PostgreSQL (Neon.tech), and display a spending dashboard.

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

```
┌──────────────────┐     PDFs      ┌──────────────────┐    SQL     ┌──────────────────┐
│   Qoqa.ch        │ ──────────►   │  Python Crawler  │ ────────►  │  PostgreSQL      │
│  (via CDP/Chrome)│               │  (SeleniumBase)  │            │  (Neon.tech)     │
└──────────────────┘               └──────────────────┘            └────────┬─────────┘
                                                                            │
                                                                            ▼
                                                                   ┌──────────────────┐
                                                                   │  Dashboard       │
                                                                   │  (Next.js 16)    │
                                                                   └──────────────────┘
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
│   │   ├── sync.py           # Main synchronisation logic
│   │   ├── browser.py        # Browser management (SeleniumBase CDP)
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
- **Google Chrome** installed (the crawler reuses your existing profile)
- A **Neon.tech** account with a PostgreSQL database (free tier is sufficient)
- A **Qoqa.ch** account with orders

---

## Environment variables

### Crawler

Copy `crawler/.env.example` to `crawler/.env` and fill in:

| Variable               | Description                              | Example                                                                          |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection URL (Neon.tech)    | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/qoqa?sslmode=require` |
| `CHROME_USER_DATA_DIR` | Path to your main Chrome profile         | `~/Library/Application Support/Google/Chrome` (macOS)                            |
| `PDF_DOWNLOAD_DIR`     | PDF download folder                      | `./pdfs`                                                                         |

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
# Edit .env with your DATABASE_URL and CHROME_USER_DATA_DIR
```

### Running the crawler

```bash
# From the crawler/ directory, with the venv activated:

# Full sync (all orders)
python -m crawler.sync --full

# Incremental sync (new orders only)
python -m crawler.sync --update

# Show help
python -m crawler.sync --help
```

**Important**: close all Chrome windows before running the crawler, as it reuses your main Chrome profile (cookies included — no manual login required).

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
    raw_text        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Contributing

This is a personal project but PRs are welcome. Please open an issue before submitting a major change.
