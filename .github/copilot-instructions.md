# Copilot Instructions — qoqa-compta

## Project overview

Monorepo with two independent components that share a PostgreSQL database (Neon.tech):

- **`crawler/`** — Python CLI that logs in to QoQa.ch through Chrome (SeleniumBase CDP) only to obtain a JWT, then uses the QoQa REST API (`requests`) to fetch order JSON and download invoice PDFs. PDFs are parsed with pdfplumber and upserted into PostgreSQL.
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

- **`page.tsx`** is a fully dynamic Server Component that reads `searchParams` (selected universes) and fetches all dashboard data — stats, charts, initial orders — server-side with the active filter applied.
- **`/api/orders`** is an API route used by `OrdersTable` for client-side search and pagination. It also accepts a `universes` query param to keep the table in sync with the active filter.
- Both use Drizzle ORM (`src/lib/queries.ts`) which supports SQLite (via `@libsql/client`) and PostgreSQL (via `@neondatabase/serverless`).

### Crawler pipeline

```
CLI (Typer, sync.py)
  → browser.py (SeleniumBase CDP) — login only, extracts cookies → JWT
  → api.py (requests) — fetches universes list + order list + downloads PDFs from QoQa REST API
  → utils/pdf_parser.py (pdfplumber + regex) — extracts structured fields
  → db.py / models/order.py + models/universe.py (SQLAlchemy 2.x) — upsert via ON CONFLICT
```

**Authentication has two modes** (see README):
- *Credentials* (recommended): `QOQA_EMAIL` + `QOQA_PASSWORD` in `crawler/.env`; Chrome can stay open.
- *Profile reuse*: `CHROME_USER_DATA_DIR` in `crawler/.env`; Chrome must be closed first.

`BROWSER_PATH` can override the Chrome binary (e.g. for Chromium).

## Conventions

### Python (crawler)

- Python 3.11+ with modern union types (`str | None`, `list[Path]`)
- SQLAlchemy 2.x `Mapped[]` type annotations for ORM fields
- Private functions prefixed with `_` (e.g., `_ensure_schema`, `_upsert_order`)
- CLI built with Typer; terminal output uses Rich (progress bars, colored status)
- Environment loaded from `crawler/.env` via python-dotenv

### TypeScript (frontend)

- `strict: true` in tsconfig; path alias `@/*` → `./src/*`
- UI built with shadcn/ui (Base UI primitives via `@base-ui/react`, base-mira style preset, CVA + `cn()` utility from `src/lib/utils.ts`)
- Tailwind v4 with CSS-variable theming in `globals.css` (`@theme inline` directive) — no `tailwind.config.ts`
- Charts use Recharts (`ComposedChart` with bar + line dual-axis)
- UI text is fully internationalised with next-intl (5 locales: `en`, `fr`, `de`, `it`, `rm`); message files live in `frontend/messages/`
- Locale is auto-detected from the `Accept-Language` header in `src/i18n/request.ts`; Romansh (`rm`) falls back to `de-CH` for `Intl` formatting
- Number/date formatting uses `fr-CH` locale for Swiss conventions; helpers are in `src/lib/formatters.ts` + `src/lib/formatter-context.tsx`
- Client components marked with `"use client"`; server components are the default
- Category filter state is encoded in the URL (`?universes=qwine,alcohol`) — the `UniversePicker` client component updates search params via `useRouter`

### Database

- `qoqa_orders` table with `order_number` as the unique business key; `universe` (formerly `offer_category`) and `subuniverse` (formerly `offer_subcategory`) store the QoQa universe tracking identifier
- `qoqa_universes` lookup table: `universe_tracking_identifier` (unique), `name_fr`, `name_de`, `updated_at` — populated by the crawler from the public `/v2/universes` API on every run
- Amounts stored as `NUMERIC(10, 2)` (CHF); represented as `Decimal` in Python, `string` in TypeScript
- Crawler uses SQLAlchemy upsert (INSERT … ON CONFLICT UPDATE); frontend uses Drizzle ORM (`src/lib/queries.ts`)

### Git

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)

### Environment

- `crawler/.env` holds crawler vars (`DATABASE_URL`, `QOQA_EMAIL`, `QOQA_PASSWORD`, `CHROME_USER_DATA_DIR`, `PDF_DOWNLOAD_DIR`, optional `BROWSER_PATH`)
- `frontend/.env.local` holds frontend vars (`DATABASE_URL`)
- Dependency updates managed by Renovate (config extends `github>nyg/renovate-presets`)
