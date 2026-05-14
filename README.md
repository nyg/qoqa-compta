# QoQa Compta

> Desktop-ready spending dashboard for [QoQa.ch](https://www.qoqa.ch) — automatically syncs your orders and PDF invoices to a local SQLite (or PostgreSQL) database and displays spending charts, stats, and a searchable orders table.

---

## Architecture

| Layer | Technology |
|---|---|
| **Backend** | [Hono](https://hono.dev/) on [Bun](https://bun.sh) — REST API + sync engine |
| **Frontend** | [Vite](https://vitejs.dev/) SPA — React 19, React Router v7, Tailwind v4 |
| **Desktop** | [ElectroBun](https://github.com/blackboardsh/electrobun) — native macOS & Windows app |
| **Database** | SQLite (default, via `@libsql/client`) or PostgreSQL (via `@neondatabase/serverless`) |
| **i18n** | [react-i18next](https://react.i18next.com/) — 5 locales: en, fr, de, it, rm |

In **web development**, Vite runs on `:3000` and proxies `/api/*` to Hono on `:3001`.
In **web production**, Hono serves the Vite build from `dist/` and the API from the same port.
In **desktop mode**, ElectroBun serves the SPA via `views://` and Hono runs as a local API-only server on `127.0.0.1:3001`.

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

### Run (development — web)

```bash
bun run dev
```

This starts both the Hono API server (`:3001`) and the Vite dev server (`:3000`) concurrently. The dashboard is available at [http://localhost:3000](http://localhost:3000).

### Run (development — desktop)

```bash
bun run dev:vite      # Vite dev server on :3000 (keep this running)
bun run desktop:dev   # ElectroBun desktop app (separate terminal)
```

ElectroBun starts the Hono API server internally on `127.0.0.1:3001` and opens a native window pointed at the Vite dev server for hot-module reloading.

### Build & run (web production)

```bash
bun run build   # compile the SPA to dist/
bun run start   # serve dist/ + API from :3001
```

### Build (desktop)

```bash
bun run build:stable
```

This runs `vite build` first (via the ElectroBun `preBuild` hook) then packages the app. Output artifacts are in `artifacts/`: `.dmg` for macOS, `.zip` for Windows.

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
    app.ts          # Hono app factory (shared by web and desktop entry points)
    index.ts        # Web server entry point (API + static file serving)
    routes/         # API route handlers
    sync.ts         # QoQa order sync pipeline
    db.ts           # Drizzle ORM client (SQLite + PostgreSQL)
    schema.ts       # Drizzle schema definitions
    settings.ts     # settings.json read/write
  electrobun/
    index.ts        # Desktop entry point (ElectroBun main process)
  views/            # Vite SPA (React)
    main.tsx        # App entry point
    pages/          # React Router pages
    components/     # UI components
    i18n/           # i18next setup + message files
    lib/            # Utilities, formatters, API client
  shared/
    types.ts        # Shared TypeScript types
scripts/
  prebuild.ts       # ElectroBun preBuild hook — runs `vite build`
electrobun.config.ts  # ElectroBun build configuration
```

---

## Releases

Releases are created via the **Release** GitHub Actions workflow (`.github/workflows/release.yml`), triggered manually from the **Actions** tab.

### How to release

1. Go to **Actions → Release → Run workflow**
2. Select the version bump type: `patch`, `minor`, or `major`
3. The workflow will:
   - Bump `package.json` version, commit, and tag on `master`
   - Build native desktop artifacts on macOS (arm64 + x64) and Windows (x64)
   - Create a GitHub Release with all artifacts attached

> **Prerequisite:** A `RELEASE_TOKEN` repository secret containing a PAT with `contents: write` permission is required to push the version commit to `master`.

