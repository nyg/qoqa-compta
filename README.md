# QoQa Compta

> Desktop-ready spending dashboard for [QoQa.ch](https://www.qoqa.ch) — automatically syncs your orders and PDF invoices to a local SQLite (or PostgreSQL) database and displays spending charts, stats, and a searchable orders table.

---

## Architecture

| Layer | Technology |
|---|---|
| **Backend** | [Hono](https://hono.dev/) on [Bun](https://bun.sh) — REST API + sync engine |
| **Frontend** | [Vite](https://vitejs.dev/) SPA — React 19, React Router v7, Tailwind v4 |
| **Database** | SQLite (default, via `@libsql/client`) or PostgreSQL (via `@neondatabase/serverless`) |
| **i18n** | [react-i18next](https://react.i18next.com/) — 5 locales: en, fr, de, it, rm |

In **development**, Vite runs on `:3000` and proxies `/api/*` to Hono on `:3001`.
In **production**, Hono serves the Vite build from `dist/` and the API from the same port.

The codebase is structured for an eventual [ElectroBun](https://github.com/blackboardsh/electrobun) migration: all API calls are isolated behind `src/views/lib/api-client.ts`, making the HTTP transport trivially swappable for ElectroBun RPC.

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.3

### Install

```bash
bun install
```

### Configure

Credentials and the database URL are configured from the in-app **Settings** modal (gear icon). No `.env` file is required.

In development you can optionally create a `.env` file with any of the following overrides (they take precedence over the settings file):

| Variable | Description |
|---|---|
| `QOQA_EMAIL` | QoQa.ch login email |
| `QOQA_PASSWORD` | QoQa.ch login password |
| `DATABASE_URL` | SQLite or PostgreSQL URL — defaults to `~/Library/Application Support/qoqa-compta/qoqa.db` on macOS |

### Run (development)

```bash
bun run dev
```

This starts both the Hono API server (`:3001`) and the Vite dev server (`:3000`) concurrently. The dashboard is available at [http://localhost:3000](http://localhost:3000).

### Build & run (production)

```bash
bun run build   # compile the SPA to dist/
bun run start   # serve dist/ + API from :3001
```

---

## Features

- **Stats cards** — total spent, number of orders, average per order
- **Spending charts** — monthly and yearly bar + line charts
- **Category filter** — filter all data by QoQa universe/sub-universe (URL-encoded)
- **Orders table** — searchable, paginated list of all orders
- **Invoice PDF viewer** — opens stored invoices in an in-app popup
- **Settings modal** — configure credentials, database URL, sync locale, and UI language; trigger a full or incremental sync with a live progress log

---

## Database

SQLite is used by default (no setup required). To use PostgreSQL (e.g. [Neon](https://neon.tech)), set `DATABASE_URL` to a `postgresql://...` connection string.

The schema is bootstrapped automatically on first run (`CREATE TABLE IF NOT EXISTS`). To reset the database, use the **Reset DB** button in the Settings modal.

---

## Project structure

```
src/
  server/           # Hono API + Bun sync engine
    index.ts        # Server entry point
    routes/         # API route handlers
    sync.ts         # QoQa order sync pipeline
    db.ts           # Drizzle ORM client (SQLite + PostgreSQL)
    schema.ts       # Drizzle schema definitions
    settings.ts     # settings.json read/write
  views/            # Vite SPA (React)
    main.tsx        # App entry point
    pages/          # React Router pages
    components/     # UI components
    i18n/           # i18next setup + message files
    lib/            # Utilities, formatters, API client
  shared/
    types.ts        # Shared TypeScript types
```

