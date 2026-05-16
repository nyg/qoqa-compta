# QoQa Compta

<p align="center">
  <img src="docs/icon.svg" width="80" alt="QoQa Compta icon" />
</p>

> Desktop-ready spending dashboard for [QoQa.ch](https://www.qoqa.ch) — automatically syncs your orders and PDF invoices to a local SQLite (or PostgreSQL) database and displays spending charts, stats, and a searchable orders table.

## Features

- **Stats cards** — total spent, number of orders, average per order
- **Spending charts** — monthly and yearly bar + line charts
- **Category filter** — filter all data by QoQa universe/sub-universe (URL-encoded)
- **Orders table** — searchable, paginated list of all orders
- **Invoice PDF viewer** — opens stored invoices in an in-app popup
- **Settings modal** — configure credentials, database URL, sync locale, and UI language; trigger a full or incremental sync with a live progress log

<p align="center">
  <img src="docs/screenshot.png" alt="QoQa Compta dashboard screenshot" width="900" />
</p>

## Getting started

### Download the app

Pre-built binaries are available on the [Releases](https://github.com/nyg/qoqa-compta/releases) page.

#### macOS Gatekeeper

Because the app is not signed with an Apple Developer certificate, macOS will block it on first launch. To allow it:

1. Try to open the app — macOS will show a warning and block it
2. Open **System Settings → Privacy & Security**
3. Scroll down to the security section — you will see *"QoQa Compta was blocked from use because it is not from an identified developer"*
4. Click **Open Anyway**, then confirm in the dialog

You only need to do this once per installation.

### Run it yourself

QoQa Compta uses [Bun](https://bun.sh).

```bash
bun install

# Starts the Hono API on :3001 and the Vite dev server on `:3000` concurrently. Open http://localhost:3000.
bun run dev

# Starts the ElectroBun desktop app
bun run desktop:dev

# Runs `vite build` first (via the ElectroBun `preBuild` hook) then packages the app. Output artifacts are in `artifacts/`: `.dmg` for macOS, `.zip` for Windows.
bun run build:stable
```

## Tech stack

| Layer | Technology |
|---|---|
| **Backend** | [Hono](https://hono.dev/) on [Bun](https://bun.sh) — REST API + sync engine |
| **Frontend** | [Vite](https://vitejs.dev/) SPA — React 19, React Router v7, Tailwind v4 |
| **Desktop** | [ElectroBun](https://github.com/blackboardsh/electrobun) — native macOS & Windows app |
| **Database** | SQLite (default, via `@libsql/client`) or PostgreSQL (via `@neondatabase/serverless`) |
| **i18n** | [react-i18next](https://react.i18next.com/) — 5 locales: en, fr, de, it, rm |
