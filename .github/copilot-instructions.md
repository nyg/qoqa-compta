# Copilot Instructions — qoqa-compta

## Project overview

Monorepo with two independent components that share a PostgreSQL database (Neon.tech):

- **`crawler/`** — Python CLI that automates Chrome via SeleniumBase to download invoice PDFs from Qoqa.ch, parses them with pdfplumber, and upserts structured data into PostgreSQL.
- **`frontend/`** — Next.js 16 (App Router) dashboard displaying spending stats, charts, and a searchable orders table. Deployed to Vercel Edge.

Both connect to the same `qoqa_orders` table. The crawler writes; the frontend reads.

## Commands

### Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev          # dev server on :3000
pnpm build        # production build
pnpm lint         # ESLint (next/core-web-vitals)
```

### Crawler (Python)

```bash
cd crawler
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m crawler.sync --full       # all orders from scratch
python -m crawler.sync --update     # incremental (default)
python -m crawler.sync --pdf-only   # download PDFs only
python -m crawler.sync --db-only    # parse existing PDFs into DB
```

No test suite exists in either component.

## Architecture

### Frontend data flow

- **`page.tsx`** is a Server Component that fetches dashboard data via direct SQL (ISR, revalidates every 5 min).
- **`/api/orders`** is an Edge Runtime route used by `OrdersTable` for client-side search and pagination.
- Both use `@neondatabase/serverless` (the `sql` tagged template from `src/lib/db.ts`) — raw SQL, no ORM.

### Crawler pipeline

```
CLI (Typer)  →  browser.py (SeleniumBase CDP, reuses Chrome profile)
             →  pdf_parser.py (pdfplumber + regex extraction)
             →  db.py / models/order.py (SQLAlchemy 2.x upsert via ON CONFLICT)
```

The crawler reuses the user's Chrome profile for authentication (no stored credentials). Chrome must be closed before running.

## Conventions

### Python (crawler)

- Python 3.11+ with modern union types (`str | None`, `list[Path]`)
- SQLAlchemy 2.x `Mapped[]` type annotations for ORM fields
- Private functions prefixed with `_` (e.g., `_ensure_schema`, `_upsert_order`)
- CLI built with Typer; terminal output uses Rich (progress bars, colored status)
- Environment loaded from `crawler/.env` via python-dotenv

### TypeScript (frontend)

- `strict: true` in tsconfig; path alias `@/*` → `./src/*`
- UI built with shadcn/ui (Radix primitives + CVA + `cn()` utility from `src/lib/utils.ts`)
- Tailwind v4 with CSS-variable theming in `globals.css` (`@theme inline` directive) — no `tailwind.config.ts`
- Charts use Recharts (`ComposedChart` with bar + line dual-axis)
- All UI text is in English; number/date formatting uses `fr-CH` locale for Swiss conventions
- Currency formatting via `formatCHF()` and date formatting via `formatDate()` in `src/lib/utils.ts`
- Client components marked with `"use client"`; server components are the default

### Database

- Single table `qoqa_orders` with `order_number` as the unique business key
- Amounts stored as `NUMERIC(10, 2)` (CHF); represented as `Decimal` in Python, `string` in TypeScript
- Crawler uses SQLAlchemy upsert (INSERT … ON CONFLICT UPDATE); frontend uses raw SQL via Neon driver

### Environment

- `crawler/.env` holds crawler vars (`DATABASE_URL`, `CHROME_USER_DATA_DIR`, `PDF_DOWNLOAD_DIR`)
- `frontend/.env.local` holds frontend vars (`DATABASE_URL`)
- Dependency updates managed by Renovate (config extends `github>nyg/renovate-presets`)
