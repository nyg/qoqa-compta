# QoQa Compta

<p align="center">
  <img src="assets/icon.svg" width="80" alt="QoQa Compta icon" />
</p>

> Desktop-ready spending dashboard for [QoQa.ch](https://www.qoqa.ch) — automatically syncs your orders and PDF invoices to a local SQLite (or PostgreSQL) database and displays spending charts, stats, and a searchable orders table.

## Features

- **Stats cards** — total spent, number of orders, average per order
- **Spending charts** — monthly and yearly bar + line charts
- **Category filter** — filter all data by QoQa universe/sub-universe
- **Date range filter** — narrow every chart, card and table to a period
- **Orders table** — searchable, paginated list of all orders
- **Invoice PDF viewer** — opens stored invoices in an in-app popup
- **Settings modal** — configure credentials, database URL, sync locale, and UI language; trigger a full or incremental sync with a live progress log

<p align="center">
  <img src="assets/screenshot.png" alt="QoQa Compta dashboard screenshot" width="900" />
</p>

## Getting started

### Download the app

Standalone desktop apps are available for macOS (Apple Silicon) and Windows — no Bun or Git required. Both live on the [releases page](https://github.com/nyg/qoqa-compta/releases).

#### macOS

**Manual** — download `…-macos-arm64.dmg`, open it and drag **QoQa Compta.app** into your **Applications** folder. The app is ad-hoc signed but **not notarized**, so macOS quarantines it after download and blocks the first launch (you may see *"Apple could not verify…"* or *"QoQa Compta.app is damaged"* — both mean the same thing; the app is not corrupted). To let it through, open **System Settings → Privacy & Security**, scroll to the bottom and click **Open Anyway** next to *"QoQa Compta.app" was blocked to protect your Mac*. Alternatively, remove the quarantine flag yourself:

```sh
xattr -dr com.apple.quarantine "/Applications/QoQa Compta.app"
```

Either way, it is once per installation.

**[Homebrew](https://brew.sh)** — handles the above automatically, so the app launches normally:

```sh
brew install --cask nyg/tap/qoqa-compta
```

#### Windows

**Manual** — download `…-windows-x64-setup.exe` and run it. It installs per-user to `%LOCALAPPDATA%` (`C:\Users\<you>\AppData\Local`), so no admin rights are needed, and finishes by putting a **QoQa Compta** shortcut on your Desktop and in the Start menu; there is no completion dialog, so that shortcut is how you know it worked. Because the app is not code-signed, SmartScreen shows *"Windows protected your PC"* on first run — click **More info → Run anyway** (offered to administrators only).

**[Scoop](https://scoop.sh)** — for those who already run it; installs per-user too and skips the SmartScreen prompt:

```powershell
scoop install git
scoop bucket add nyg https://github.com/nyg/scoop-bucket
scoop install qoqa-compta
```

`scoop install git` comes first because `scoop bucket add` needs it. If you don't have Scoop at all, install it first (no admin required):

```powershell
irm get.scoop.sh | iex
```

#### Updates

The app checks the releases page once per launch and says so when a newer version exists — the version number in the header carries a dot, and **About** (behind that version number) shows the details and the update command for the way you installed it. It never replaces itself, so Homebrew and Scoop installs stay under their package manager's control:

```sh
brew upgrade --cask nyg/tap/qoqa-compta
```

```powershell
scoop update qoqa-compta
```

### Run it yourself

QoQa Compta uses [Bun](https://bun.sh).

```bash
bun install

# Starts the Hono API on :3001 and the Vite dev server on `:3000` concurrently. Open http://localhost:3000.
bun run dev

# Downloads the Electrobun toolchain (Hutch) and generates .hutch/devkit.
# Only needed for `bun run typecheck` and editor types — the desktop scripts do it themselves.
bun run desktop:prepare

# Starts the Electrobun desktop app
bun run desktop:dev

# Runs `vite build` first (via the Electrobun `preBuild` hook) then packages the app. Output artifacts are in `artifacts/`: `.dmg` for macOS, `.zip` for Windows.
bun run build:stable
```

## Tech stack

| Layer | Technology |
|---|---|
| **Backend** | [Hono](https://hono.dev/) on [Bun](https://bun.sh) — REST API + sync engine |
| **Frontend** | [Vite](https://vitejs.dev/) SPA — React 19, React Router v7, Tailwind v4 |
| **Desktop** | [Electrobun](https://github.com/blackboardsh/electrobun) — native macOS & Windows app |
| **Database** | SQLite (default, via `bun:sqlite`) or PostgreSQL (via `@neondatabase/serverless`) |
| **i18n** | [react-i18next](https://react.i18next.com/) — 5 locales: en, fr, de, it, rm |
