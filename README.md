# QoQa Compta

<p align="center">
  <img src="docs/icon.svg" width="80" alt="QoQa Compta icon" />
</p>

> Desktop-ready spending dashboard for [QoQa.ch](https://www.qoqa.ch) — automatically syncs your orders and PDF invoices to a local SQLite (or PostgreSQL) database and displays spending charts, stats, and a searchable orders table.

---

## Features

- **Stats cards** — total spent, number of orders, average per order
- **Spending charts** — monthly and yearly bar + line charts
- **Category filter** — filter all data by QoQa universe/sub-universe (URL-encoded)
- **Orders table** — searchable, paginated list of all orders
- **Invoice PDF viewer** — opens stored invoices in an in-app popup
- **Settings modal** — configure credentials, database URL, sync locale, and UI language; trigger a full or incremental sync with a live progress log

---

## Screenshot

<p align="center">
  <img src="docs/screenshot.png" alt="QoQa Compta dashboard screenshot" width="900" />
</p>

---

## Getting started

### Download

Pre-built binaries are available on the [Releases](https://github.com/nyg/qoqa-compta/releases) page.

### Run it yourself

<details>
<summary>Requirements: <a href="https://bun.sh">Bun</a> ≥ 1.x</summary>

```bash
bun install
```

</details>

#### Development — web

```bash
bun run dev
```

Starts the Hono API (`:3001`) and the Vite dev server (`:3000`) concurrently. Open [http://localhost:3000](http://localhost:3000).

#### Development — desktop

```bash
bun run dev:vite      # Vite dev server on :3000 (keep this running)
bun run desktop:dev   # ElectroBun desktop app (separate terminal)
```

ElectroBun starts the Hono API internally on `127.0.0.1:3001` and opens a native window pointed at the Vite dev server.

#### Build — web production

```bash
bun run build   # compile the SPA to dist/
bun run start   # serve dist/ + API from :3001
```

#### Build — desktop

```bash
bun run build:stable
```

Runs `vite build` first (via the ElectroBun `preBuild` hook) then packages the app. Output artifacts are in `artifacts/`: `.dmg` for macOS, `.zip` for Windows.

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
