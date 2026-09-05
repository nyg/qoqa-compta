# Agent Instructions — qoqa-compta

## Project overview

Single Bun application — a Hono REST API + sync engine that serves a Vite/React SPA, wrapped in an Electrobun desktop shell. There is no separate crawler or frontend subdirectory; everything lives in `src/`.

- **`src/server/`** — Hono API server running on Bun. Handles authentication (direct HTTP POST to QoQa, no browser), order sync (TypeScript pipeline with SSE progress), database access (Drizzle ORM), user settings (platform-aware `settings.json`), the GitHub release check and install-method detection.
- **`src/views/`** — Vite SPA (React 19, React Router v7). Dashboard with spending charts, orders table, invoice PDF viewer, universe and date-range filters, settings modal and About dialog.
- **`src/electrobun/`** — desktop entry point. Starts the Hono server on an ephemeral loopback port, opens the `BrowserWindow`, installs the macOS application menu, injects preload flags (API port, OS locales, inset title bar) and persists the window frame.
- **`src/shared/`** — TypeScript types and the universe selection model shared between server and SPA.

Three deeper documents exist and are the reference for their subjects — read them instead of re-deriving:

- [`docs/architecture.md`](docs/architecture.md) — web vs desktop mode, scripts, project structure, desktop shell, sync pipeline, settings paths, full database schema.
- [`docs/storage.md`](docs/storage.md) — every location the app writes to: config and data directories, `settings.json` keys, the credential store, `localStorage`, the database tables, the exports, the in-memory caches, and how to remove each. Add a line there whenever a change introduces or moves persisted state.
- [`docs/universe-filters.md`](docs/universe-filters.md) — the three selection states, normalization rules, what the picker label counts, and what to check when changing any of it.

## Commands

```bash
bun install              # install dependencies

bun run dev              # dev: Vite :3000 + Hono :3001 (concurrently)
bun run desktop:prepare  # download Hutch, generate .hutch/devkit (needed once before typecheck)
bun run desktop:dev      # Electrobun desktop app with live reload
bun run build            # production: compile SPA to dist/
bun run build:stable     # production: package the desktop app into artifacts/
bun run start            # production: serve dist/ + API from :3001
bun run typecheck        # electrobun prepare && tsc --build (one project per runtime)
bun run test             # bun test — server, shared and views unit tests
bun run lint             # ESLint over src
bun run db:generate      # regenerate SQLite + PG migrations from schema.ts, then re-embed them
bun run db:verify        # fail if src/server/migrations.generated.ts is stale
```

## Architecture

### Data flow

- The SPA makes all API calls through `src/views/lib/api-client.ts` — isolated so the HTTP transport can be swapped for Electrobun RPC in the future.
- `GET /api/dashboard` returns all stats, charts, and initial orders in one round-trip.
- `GET /api/orders` is used for client-side search and pagination.
- `GET /api/orders/csv` exports the filtered orders; `POST /api/orders/csv-save` and `POST /api/orders/:orderNumber/pdf-save` are the desktop-only equivalents, mounted only when `createApp()` gets `desktop: true`. The WebView ignores `<a download>`, so there the server writes into `~/Downloads` through `src/server/downloads.ts` and returns the path; the browser gets a blob download. `saveFile()` in `src/views/lib/downloads.ts` picks between them.
- `POST /api/sync` starts a sync job; progress is streamed via SSE (`GET /api/sync/stream`).
- `GET/PUT /api/settings` reads/writes `settings.json`; the QoQa password and the PostgreSQL URL go to the OS credential store instead (see Settings below), and `GET /api/settings/credential-store` reports, per secret, which store each actually landed in. A changed database URL is connection-probed before anything is written and rejected with a 400 when it does not answer; the schema is left to the next sync.
- `POST /api/settings/test-credentials` tries a QoQa login and reports the outcome without starting a sync; the Settings modal offers it as *Test connection*.
- `DELETE /api/settings/database` drops and recreates every table; `DELETE /api/settings/database/file` deletes the SQLite file itself and leaves nothing in its place, and answers 400 when PostgreSQL is the active database. The Settings modal offers *Clear database* for both dialects and *Delete database file* alongside it on SQLite. Both endpoints, and `reveal-db`, answer 400 when the SQLite file has not been created yet.
- `GET /api/settings/db-path` returns `{ path, exists }` — the active SQLite file path (`null` on PostgreSQL) and whether that file is on disk yet. The Settings modal uses it to decide which buttons to show and whether to disable them.
- `POST /api/settings/reveal-db` opens the SQLite file in the system file manager. On desktop this runs through Electrobun's `Utils.showItemInFolder`, injected into `createApp()` as `revealInFileManager` so `src/server/` never imports the Electrobun SDK; web mode falls back to a platform-specific spawn.
- `GET /api/app/latest-release` reads the GitHub releases API server-side (the opaque `views://` origin cannot satisfy CORS), cached 6h on success and 15m on failure; `?refresh=1` bypasses the cache.
- `POST /api/app/open-external` hands an http(s) link to the system browser through Electrobun's `Utils.openExternal`, injected into `createApp()` as `openExternal`. The SPA routes every `target="_blank"` link through it in desktop mode (`src/views/lib/external-links.ts`), because a WebView opens one in a tab-less window of its own instead.
- `GET /api/app/install` reports the platform and how the running copy was installed (`homebrew`, `scoop`, `manual`, `web`), so the About dialog only shows the update path that applies.

### Sync pipeline

```
POST /api/sync { mode: "full" | "update" }
  → db.ts         — ensureDb() → creates the SQLite file on a first sync
  → migrate.ts    — runMigrations() → db_ready event naming any migration applied
  → auth.ts       — POST auth.qoqa.ch/v2/login → JWT (no browser, pure HTTP)
  → api.ts        — fetchUniverses → upsert qoqa_universes + qoqa_subuniverses
  → api.ts        — fetchPurchases (list)
  → for each:
      api.ts      — fetchOrderDetail + downloadPdf
      queries.ts  — upsertOrder (INSERT … ON CONFLICT DO UPDATE)
  → SSE stream emits SyncProgressEvent at each step
```

In **update** mode the sync stops after 5 consecutive already-known orders.

## Conventions

### TypeScript

- Bun runtime; `bun-types` in devDependencies
- One tsconfig per runtime, listed as project references by a solution `tsconfig.json` that holds nothing else: `tsconfig.server.json` (Bun types, no DOM), `tsconfig.views.json` (DOM, no Bun), `tsconfig.shared.json` for `src/shared/` (neither), and `tsconfig.electrobun.json` + `tsconfig.tools.json` (Bun types plus `WebWorker`, which the vendored Electrobun SDK sources under `.hutch/devkit/` need for their `self` usage). Options common to all of them live in `tsconfig.base.json`, which declares `lib: ["ES2022"]` and `types: []` — a runtime that wants globals asks for them in its own config. `bun run typecheck` builds the solution, so a `document` in `src/server/` and a `Bun` in `src/views/` are both type errors.
- `strict: true` in `tsconfig.base.json`, plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noImplicitOverride` and `erasableSyntaxOnly`. The two unused-code flags matter more than usual: typescript-eslint cannot run against `typescript@7`, so the compiler is the only thing that catches a dead import or binding. `exactOptionalPropertyTypes` is deliberately off — see `docs/architecture.md`. `skipLibCheck` stays on; dropping it surfaces Electrobun devkit noise
- Index into an array and you get `T | undefined`: destructure and test the binding (`const [row] = rows; if (!row) …`) rather than reaching for `!` or a cast
- Path alias `@/*` → `./src/views/*`, declared in both `tsconfig.views.json` and `vite.config.ts` — it resolves SPA modules only and is used only from within `src/views/`
- `src/shared/` has no alias of its own: both the SPA and the server import it by relative path (`import type { QoqaOrder } from "../../shared/types"`)
- UI built with Base UI (`@base-ui/react`) primitives, CVA + `cn()` utility from `src/views/lib/utils.ts`
- Tailwind v4 with CSS-variable theming in `src/views/globals.css` (`@theme inline` directive) — no `tailwind.config.ts`
- Charts use Recharts (`ComposedChart` with bar + line dual-axis; pie chart for spending breakdown); the date range picker uses react-day-picker through `src/views/components/ui/calendar.tsx`
- UI text internationalised with react-i18next (5 locales: `en`, `fr`, `de`, `it`, `rm`); message files live in `src/views/i18n/messages/` — a new key goes into all five, and `messages.test.ts` fails when one is missing
- Sync progress events carry a `messageKey` from `SYNC_MESSAGE_KEYS` plus its parameters, and the SPA renders them through the `SyncLog` namespace; the English `message` the server also sends is the console text and the fallback. A new event message means a new key in `src/shared/types.ts` and a line in all five message files
- Locale auto-detected from the browser in `src/views/i18n/index.ts`; Romansh (`rm`) falls back to `de-CH` for `Intl` formatting
- Number/date formatting pairs the UI language with a region resolved from the host (`src/views/lib/locale.ts`), falling back to `CH`; on desktop the real OS region is injected by `src/electrobun/locale.ts` via Electrobun's `preload`, because WKWebView and WebView2 do not expose it. Helpers in `src/views/lib/formatters.ts` + `src/views/lib/formatter-context.tsx`
- Filter state (universe selection, date range) lives in `src/views/lib/use-filter-state.ts` and is persisted to `localStorage`; every call site turns a selection into query parameters through `selectionParams()` in `src/shared/filters.ts`

### Database

- `qoqa_orders` table with `order_number` as the unique business key
- `qoqa_universes` and `qoqa_subuniverses` lookup tables, populated from the QoQa alerts API on every sync
- `qoqa_order_subuniverses` holds every sub-universe tag an order carries, primary at position 0; filtering addresses the full list, money grouping stays on the primary tag
- Both `name_fr` and `name_de` columns on universes/subuniverses
- Amounts stored as `NUMERIC(10, 2)` (CHF); represented as `string` in TypeScript
- `pdf_data` column holds raw invoice PDF bytes (`BLOB` on SQLite, `BYTEA` on PostgreSQL); list queries use `has_pdf` boolean instead of selecting the bytes
- Schema defined in `src/server/schema.ts` (dual SQLite + PG via Drizzle) — the single source of truth. Adding or changing a column means editing `schema.ts` and running `bun run db:generate`; nothing else restates the DDL
- `bun run db:generate` writes migrations to `drizzle/sqlite/` and `drizzle/pg/`, then regenerates `src/server/migrations.generated.ts`, which inlines every migration's SQL so it is compiled into the desktop bundle instead of being read from disk at runtime
- `src/server/migrate.ts` applies them at startup and as the first step of every sync — never on a settings save — and records each one in Drizzle's `__drizzle_migrations` journal. It also runs the SQLite `journal_mode=WAL` and `busy_timeout=5000` PRAGMAs, which are not schema
- The two are not symmetric. `prepareDatabase()` in `src/server/startup.ts` — the shared boot body both entry points call — migrates only when `isSchemaReady()` is already true, so startup upgrades an existing database and never creates one; it logs failures instead of exiting, so an unreachable PostgreSQL still leaves the app startable. Creating a schema is always the sync, whose first step is `ensureDb()` followed by `runMigrations()`
- `GET /api/dashboard` and `GET /api/orders` degrade to an empty payload through `hasUsableSchema()` — `isSchemaReady()` with a `catch`, because an unreachable server and a missing schema both mean there is nothing to serve, and a 500 there would take the Settings modal down with it. `isSchemaReady()` stays strict for startup and the sync, which need the real error
- `initDb()` never creates the SQLite file — it resolves the path and opens the file only when it already exists, so launching the app writes nothing to disk. `ensureDb()` is the only creating path. `getDbFilePath()` still reports the path while the file is absent (the SPA reads a `null` path as PostgreSQL); `sqliteFileExists()` is the separate existence question
- Databases created before migrations existed already have every table and no journal. On those, `runMigrations()` records migration `0000` as applied instead of executing it, then applies anything newer normally — detected as "no journal rows and `qoqa_orders` already present"
- `dropAllTables()` (the Settings *Clear database*, offered for both dialects) drops the journal too, so the next `runMigrations()` rebuilds from `0000`. On SQLite the modal additionally offers deleting the file — see `docs/architecture.md`
- SQLite (`bun:sqlite`) is the default and needs no setup; PostgreSQL goes through `@neondatabase/serverless`

### Settings

- Persisted to `~/Library/Application Support/QoQa Compta/settings.json` on macOS (see `src/server/paths.ts` for platform paths and the legacy-directory migration)
- The QoQa password and the PostgreSQL URL are the exceptions: they live in the OS credential store (macOS Keychain, Windows Credential Manager) via `Bun.secrets`, and `src/server/secrets.ts` is the only module that touches them. It falls back to `settings.json` where no store is reachable, and migrates a value left there by an earlier version at startup — see `docs/architecture.md`
- The URL reaches the SPA with its password segment masked (`src/server/database-url.ts`); an unedited mask coming back on save restores the stored password
- Env vars (`QOQA_EMAIL`, `QOQA_PASSWORD`, `DATABASE_URL`, `PORT`) override the settings file in development, and in production only in web mode — `src/server/index.ts` opts in through `allowEnvironmentOverrides()` in `src/server/environment.ts` so a headless deployment has somewhere to put a password; the desktop entry point deliberately does not
- All settings are configurable from the in-app Settings modal — no `.env` file required in production
- Client-side preferences never reach the server: `localStorage` holds `qoqa-compta-filters` (universe selection + date range, revalidated on read), `qoqa-compta-language` (UI language, written by the i18next detector) and `theme` (written by `next-themes`). Every access is wrapped, so a profile that blocks storage loses the preference and nothing else

### Desktop

- The app never updates itself: Electrobun's `Updater` would fork a Scoop install and overwrite an app Homebrew manages. The About dialog names the right update command instead.
- Only macOS gets an application menu; on Windows there is none, and About sits behind the version number in the header.
- Both entry points bind the API to loopback — a wildcard bind raises a Windows Defender Firewall prompt on first run.
- The macOS DMG ships a self-extracting wrapper, not the app; `scripts/postwrap.ts` stamps `ELECTROBUN_INSTALLER_UI_AUTOCLOSE=1` into its `Info.plist` so the first-run installer panel closes itself instead of sitting behind the app window. Windows keeps its installer UI.
- The window frame is persisted to `window-state.json` in the config directory by `src/electrobun/window-state.ts` — debounced, written through a `.tmp` rename, and discarded on restore when the display set changed or the frame would land off screen. Every failure path is swallowed on purpose.
- The OS region is not visible to a WebView, so `src/electrobun/locale.ts` reads it from `defaults`/the registry and the preload injects it as `window.__LOCALES__`; `src/views/lib/locale.ts` consumes it and falls back to `navigator.languages`, then `CH`.

### Git

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- Always create PRs against `master` using a dedicated feature branch. If the current branch is `master` or does not exist remotely (i.e. is new/untracked), create a new branch (e.g. `feat/short-description`) before committing, push it, then open the PR. If the current branch already exists on the remote and is not deleted, use it directly.

### Environment

- No `.env` file required for production; the Settings modal handles all config
- In development, optionally create a `.env` at the repo root with `DATABASE_URL`, `QOQA_EMAIL`, `QOQA_PASSWORD`, or `PORT`
- A headless web deployment may pass the same variables in production — see the Settings bullet above
- CI runs the full `verify` job on `ubuntu-latest` and a second, test-only job on `windows-latest`: the Ubuntu runner has no secret service, so the credential-store half of `secrets.test.ts` only ever executes on Windows. Keep the tests platform-neutral — no `HOME`, no `chmod`, and close the database before deleting a temp directory
- Dependency updates managed by Renovate (config extends `github>nyg/renovate-presets`)
