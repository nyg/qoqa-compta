# Copilot Instructions — qoqa-compta

## Project overview

Single Bun application — a Hono REST API + sync engine that serves a Vite/React SPA. There is no separate crawler or frontend subdirectory; everything lives in `src/`.

- **`src/server/`** — Hono API server running on Bun. Handles authentication (direct HTTP POST to QoQa, no browser), order sync (TypeScript pipeline with SSE progress), database access (Drizzle ORM), and user settings (platform-aware `settings.json`).
- **`src/views/`** — Vite SPA (React 19, React Router v7). Dashboard with spending charts, orders table, invoice PDF viewer, and settings modal.
- **`src/shared/`** — TypeScript types shared between server and SPA.

## Commands

```bash
bun install              # install dependencies

bun run dev              # dev: Vite :3000 + Hono :3001 (concurrently)
bun run build            # production: compile SPA to dist/
bun run start            # production: serve dist/ + API from :3001
bun run typecheck        # tsc --noEmit
bun run lint             # ESLint
bun run db:push          # drizzle-kit push (schema sync)
```

## Architecture

### Data flow

- The SPA makes all API calls through `src/views/lib/api-client.ts` — isolated so the HTTP transport can be swapped for ElectroBun RPC in the future.
- `GET /api/dashboard` returns all stats, charts, and initial orders in one round-trip.
- `GET /api/orders` is used for client-side search and pagination.
- `POST /api/sync` starts a sync job; progress is streamed via SSE (`GET /api/sync/stream`).
- `GET/PUT /api/settings` reads/writes `settings.json`.

### Sync pipeline

```
POST /api/sync { mode: "full" | "update" }
  → auth.ts       — POST auth.qoqa.ch/v2/login → JWT (no browser, pure HTTP)
  → api.ts        — fetchUniverses → upsert qoqa_universes + qoqa_subuniverses
  → api.ts        — fetchPurchases (list)
  → for each:
      api.ts      — fetchOrderDetail + downloadPdf
      queries.ts  — upsertOrder (INSERT … ON CONFLICT DO UPDATE)
  → SSE stream emits SyncProgressEvent at each step
```

## Conventions

### TypeScript

- Bun runtime; `bun-types` in devDependencies
- `strict: true` in tsconfig; path alias `@/*` → `./src/*`
- UI built with Base UI (`@base-ui/react`) primitives, CVA + `cn()` utility from `src/views/lib/utils.ts`
- Tailwind v4 with CSS-variable theming in `src/views/globals.css` (`@theme inline` directive) — no `tailwind.config.ts`
- Charts use Recharts (`ComposedChart` with bar + line dual-axis; pie chart for spending breakdown)
- UI text internationalised with react-i18next (5 locales: `en`, `fr`, `de`, `it`, `rm`); message files live in `src/views/i18n/messages/`
- Locale auto-detected from the browser in `src/views/i18n/index.ts`; Romansh (`rm`) falls back to `de-CH` for `Intl` formatting
- Number/date formatting pairs the UI language with a region resolved from the host (`src/views/lib/locale.ts`), falling back to `CH`; on desktop the real OS region is injected by `src/electrobun/locale.ts` via Electrobun's `preload`, because WKWebView and WebView2 do not expose it. Helpers in `src/views/lib/formatters.ts` + `src/views/lib/formatter-context.tsx`
- Filter state (universe, subuniverse, date range) is managed in URL search params via `src/views/lib/use-filter-state.ts`

### Database

- `qoqa_orders` table with `order_number` as the unique business key
- `qoqa_universes` and `qoqa_subuniverses` lookup tables, populated from the QoQa alerts API on every sync
- Both `name_fr` and `name_de` columns on universes/subuniverses
- Amounts stored as `NUMERIC(10, 2)` (CHF); represented as `string` in TypeScript
- `pdf_data` column holds raw invoice PDF bytes (`BLOB` on SQLite, `BYTEA` on PostgreSQL); list queries use `has_pdf` boolean instead of selecting the bytes
- Schema defined in `src/server/schema.ts` (dual SQLite + PG via Drizzle); bootstrapped at startup via `src/server/schema-bootstrap.ts`

### Settings

- Persisted to `~/Library/Application Support/QoQa Compta/settings.json` on macOS (see `src/server/paths.ts` for platform paths and the legacy-directory migration)
- In development only, env vars (`QOQA_EMAIL`, `QOQA_PASSWORD`, `DATABASE_URL`, `PORT`) override the settings file
- All settings are configurable from the in-app Settings modal — no `.env` file required in production

### Git

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- Always create PRs against `master` using a dedicated feature branch. If the current branch is `master` or does not exist remotely (i.e. is new/untracked), create a new branch (e.g. `feat/short-description`) before committing, push it, then open the PR. If the current branch already exists on the remote and is not deleted, use it directly.

### Environment

- No `.env` file required for production; the Settings modal handles all config
- In development, optionally create a `.env` at the repo root with `DATABASE_URL`, `QOQA_EMAIL`, `QOQA_PASSWORD`, or `PORT`
- Dependency updates managed by Renovate (config extends `github>nyg/renovate-presets`)

