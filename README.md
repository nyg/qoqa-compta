# QoQa Compta

<p align="center">
  <img src="assets/icon.svg" width="80" alt="QoQa Compta icon" />
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
  <img src="assets/screenshot.png" alt="QoQa Compta dashboard screenshot" width="900" />
</p>

## Getting started

### Download the app

Standalone desktop apps are available for macOS (Apple Silicon) and Windows — no Bun or Git required.

**macOS (recommended — Homebrew):**

```sh
brew install --cask nyg/tap/qoqa-compta
```

This handles the Gatekeeper step for you (see below), so the app launches normally.

**Windows (recommended — Scoop):**

```powershell
scoop bucket add nyg https://github.com/nyg/scoop-bucket
scoop install qoqa-compta
```

Scoop installs per-user (no admin rights) and avoids the SmartScreen prompt (see [Windows SmartScreen](#windows-smartscreen) below). If you don't have Scoop, install it first (no admin required):

```powershell
irm get.scoop.sh | iex
```

**Manual download:**

1. Download the installer from the [releases page](https://github.com/nyg/qoqa-compta/releases):
   - macOS: `…-macos-arm64.dmg`
   - Windows: `…-windows-x64-setup.zip`
2. **macOS**: open the DMG, drag **QoQa Compta.app** to your **Applications** folder, then see [macOS Gatekeeper](#macos-gatekeeper) below before first launch
3. **Windows**: extract the ZIP and run **QoQa Compta-Setup.exe** inside (installs per-user to `%LOCALAPPDATA%` — no admin rights). See [Windows SmartScreen](#windows-smartscreen) below before first launch.

#### Updates

The app checks the releases page once per launch and says so when a newer version exists — the version number in the header carries a dot, and **About** (behind that version number) shows the details. It never replaces itself, so Homebrew and Scoop installs stay under their package manager's control:

```sh
brew upgrade --cask nyg/tap/qoqa-compta
```

```powershell
scoop update qoqa-compta
```

#### The menu bar on Windows

Windows starts without a menu bar; press **Alt** to show it and **Alt** or **Escape** to hide it again. Everything it offers is reachable elsewhere: the editing shortcuts work natively in the WebView, and **About** is behind the version number in the header. macOS keeps its usual application menu.

#### macOS Gatekeeper

Because the app is not signed with an Apple Developer certificate, macOS quarantines it after download and blocks it on first launch.

The quickest fix is to remove the quarantine flag once, after copying the app to Applications:

```sh
xattr -dr com.apple.quarantine "/Applications/QoQa Compta.app"
```

Alternatively, use the GUI path:

1. Try to open the app — macOS will show a warning and block it
2. Open **System Settings → Privacy & Security**
3. Scroll down to the security section — you will see *"QoQa Compta was blocked from use because it is not from an identified developer"*
4. Click **Open Anyway**, then confirm in the dialog

You only need to do this once per installation. Installing via Homebrew avoids it entirely.

#### Windows SmartScreen

Because the app is not code-signed, Windows SmartScreen shows *"Windows protected your PC"* when you run `QoQa Compta-Setup.exe`. Click **More info → Run anyway** (this option is only offered to administrators).

Installing via Scoop avoids this prompt entirely.

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
| **Database** | SQLite (default, via `@libsql/client`) or PostgreSQL (via `@neondatabase/serverless`) |
| **i18n** | [react-i18next](https://react.i18next.com/) — 5 locales: en, fr, de, it, rm |
