# Where data is stored

Every location QoQa Compta writes to, what lands there, and how to get rid of it. The short version: one directory per platform holds the settings and the database, two credentials live in the OS credential store, three keys live in the browser's `localStorage`, and everything else is either an explicit export into `~/Downloads` or in-memory state that dies with the process.

Nothing leaves the machine except calls to QoQa's own API (`auth.qoqa.ch`, `api.qoqa.ch`) during a sync, and one call to `api.github.com` for the update check. There is no telemetry, no analytics and no remote logging.

---

## The app's own directories

`src/server/paths.ts` resolves a config directory and a data directory. macOS and Windows name the folder after the app as the user sees it and put both in the same place; the XDG spec wants a lowercase machine-readable name and keeps them apart.

| | macOS | Windows | Linux |
|---|---|---|---|
| Config | `~/Library/Application Support/QoQa Compta/` | `%APPDATA%\QoQa Compta\` | `$XDG_CONFIG_HOME/qoqa-compta/` (or `~/.config/…`) |
| Data | the same directory | the same directory | `$XDG_DATA_HOME/qoqa-compta/` (or `~/.local/share/…`) |

Both used to be `qoqa-compta` everywhere. On macOS and Windows a directory left by an earlier version is renamed across on first launch; if the rename fails — read-only parent, open handle, separate volume — the old location keeps being used, because an unfashionable path is better than lost data.

| File | Directory | Written by | Contents |
|---|---|---|---|
| `settings.json` | config | `src/server/settings.ts` | Non-secret settings, plus a credential only when the OS store refused it |
| `window-state.json` | config | `src/electrobun/window-state.ts` | Window frame, maximized flag, display fingerprint. Desktop only |
| `qoqa.db` | data | `src/server/db.ts` | The SQLite database. Created by the first sync, not by starting the app. Absent when a PostgreSQL URL is configured |
| `qoqa.db-wal`, `qoqa.db-shm` | data | SQLite | WAL sidecars, present while the database is open |

A `file:` or `sqlite://` URL saved as the database URL overrides the `qoqa.db` path; anything else is treated as PostgreSQL and no local file exists at all.

Neither does one exist before the first sync, nor after the file has been deleted from Settings. Starting the app opens `qoqa.db` only when it is already there, so an install that is launched and quit writes nothing into the data directory — which is itself only created alongside the database. `ensureDb()`, the first step of a sync, is the one thing that creates either.

### `settings.json`

| Key | Contents |
|---|---|
| `qoqaEmail` | QoQa account email, or `null` |
| `syncLocale` | `fr` or `de` — the language universe and offer names are synced in |
| `qoqaPassword` | **Fallback only.** Present only when the credential store refused the write |
| `databaseUrl` | **Fallback only.** Same |

Written whole on every save, pretty-printed. Keys a previous version wrote are dropped on read rather than served forever — `uiLocale` went that way when the language picker moved into the browser. A file that fails to parse is treated as empty, so a corrupt one degrades to defaults instead of breaking startup.

The two fallback keys are the interesting ones: they exist only where `Bun.secrets` throws, and `migrateSecretsToCredentialStore()` moves them back out at startup as soon as a store answers. `GET /api/settings/credential-store` reports, per secret, which of the two actually happened, and the Settings modal prints it under the field.

### `window-state.json`

A version, the frame (`x`, `y`, `width`, `height`), a maximized boolean, and a fingerprint of the displays attached when it was captured. Nothing about the content of the app.

Writes are debounced 400 ms, suppressed for the first 600 ms after launch and while the window is minimized or fullscreen, and go through a `.tmp` file that is renamed over the target. On restore the frame is clamped to the current displays and an 800×600 minimum, and discarded for a centred default when the display fingerprint changed or the window would land off screen. Every failure path is swallowed — losing the layout must never take the app down.

---

## The OS credential store

Two values never touch `settings.json` when a store is reachable. They go through `Bun.secrets` under service `io.github.nyg.qoqa-compta`, and `src/server/secrets.ts` is the only module that reads or writes either.

| Name | Contents |
|---|---|
| `qoqa-password` | The QoQa account password |
| `database-url` | The PostgreSQL connection string, password included |

| Platform | Store |
|---|---|
| macOS | Keychain Services (login keychain) |
| Windows | Credential Manager, as a generic credential named `io.github.nyg.qoqa-compta/<name>` |
| Linux | libsecret (GNOME Keyring, KWallet) |

What this protects against, what it does not, and why the macOS Keychain does not re-prompt on every release is covered in [architecture.md → The secrets](architecture.md#the-secrets). The short form: it keeps the credential out of a file that backups and synced config directories can see; on neither platform does it isolate the app from other code running as the same user.

Environment variables win over both stores wherever `src/server/environment.ts` allows them — always in development, and in production only for the web entry point. `GET /api/settings/credential-store` then reports `env` and names the variable, so the UI never implies a protection that is not there.

---

## The browser's `localStorage`

Per browser profile, and on desktop per WebView profile. None of it reaches the server, and none of it is part of a backup of the app's directories.

| Key | Written by | Contents |
|---|---|---|
| `qoqa-compta-filters` | `src/views/lib/use-filter-state.ts` | The universe/sub-universe selection and the date range |
| `qoqa-compta-language` | `i18next-browser-languagedetector` | UI language, once the user picks one; absent until then, and the navigator decides |
| `theme` | `next-themes` | `light`, `dark` or `system` |

The filter state is revalidated on every read rather than trusted: a date that is not ISO `YYYY-MM-DD`, a range whose start is after its end, and sub-universe keys written before they were namespaced by universe are all dropped, falling back to *all universes*. Every read and write is wrapped, so a profile that blocks storage loses the preference and nothing else.

---

## The database

Four tables plus Drizzle's `__drizzle_migrations` journal, identical in shape on SQLite and PostgreSQL. Column-by-column DDL is in [architecture.md → Table structure](architecture.md#table-structure).

| Table | Contents |
|---|---|
| `qoqa_orders` | One row per order, keyed by `order_number`. Amounts as `NUMERIC(10, 2)` in CHF, the raw invoice PDF in `pdf_data` (`BLOB` / `BYTEA`), and the untouched API response in `raw_json` |
| `qoqa_universes` | Universe lookup, `name_fr` and `name_de` |
| `qoqa_subuniverses` | Sub-universe lookup, with the universe it belongs to |
| `qoqa_order_subuniverses` | Every sub-universe tag an order carries, primary at position 0 |
| `__drizzle_migrations` | Which migrations have been applied. In the `drizzle` schema on PostgreSQL |

Two of those columns are worth calling out because they are the bulk of the file and the most sensitive part of it. `pdf_data` holds complete invoices — name, address and line items as QoQa issued them. `raw_json` keeps the order detail response verbatim, which is what makes `backfillOrderSubuniverses()` able to reconstruct tags without a re-sync, and also means the database holds slightly more than the columns alone suggest.

---

## Explicit exports

Only ever written when the user clicks something.

| File | Source |
|---|---|
| `~/Downloads/qoqa-orders-<YYYY-MM-DD>.csv` | The CSV export button, carrying whatever the current filters select |
| `~/Downloads/invoice-<order number>.pdf` | The save button in the invoice dialog |

In a browser these are ordinary blob downloads and the app never learns where the file went. In the desktop WebView `<a download>` does nothing and a PDF opens in a full-screen viewer instead, so the server writes the file itself and returns the path — `POST /api/orders/csv-save` and `POST /api/orders/:orderNumber/pdf-save`, mounted only when `createApp()` is given `desktop: true`, which is what stops a hosted deployment from writing into the server's home directory. `src/server/downloads.ts` creates `~/Downloads` if it does not exist and never overwrites: `report.csv` becomes `report (1).csv`.

---

## Everything else on disk

- **`~/Library/Application Support/io.github.nyg.qoqa-compta/stable/`** (macOS) — the retained tar payload, an `uninstall` binary and `.electrobun-uninstall.json`, left by Electrobun's self-extracting installer on first launch. Written by the installer, never read or written by the app. See [architecture.md → macOS installer panel](architecture.md#macos-installer-panel).
- **The WebView profile** — WKWebView and WebView2 keep their own caches wherever the OS puts them. The app stores nothing there deliberately and clears nothing.
- **stdout** — one line per HTTP request plus the sync progress log. The app opens no log file; where the desktop bundle's output goes is up to the OS.
- **`.env` at the repo root** — development only, gitignored, and read only where `environment.ts` allows overrides. Not created or written by the app.

---

## In memory only

Gone the moment the process exits, and never written anywhere:

- The QoQa JWT from `auth.ts` — fetched fresh at the start of each sync and held for its duration.
- The running sync job's state and abort controller (`src/server/sync-job.ts`).
- The latest-release response (`src/server/routes/app.ts`), cached 6h on success and 15m on failure.
- The detected install method (`src/server/install.ts`), resolved once per process.

---

## Removing it

| What | How |
|---|---|
| Order data, keeping the database | Settings → *Clear database* (`DELETE /api/settings/database` drops and recreates every table, journal included). Offered for both SQLite and PostgreSQL |
| The SQLite database itself, from the app | Settings → *Delete database file* (`DELETE /api/settings/database/file` removes `qoqa.db` and its sidecars and leaves nothing behind). SQLite only; the next sync recreates it |
| The SQLite file, by hand | Settings → *Reveal in Finder/Explorer* (`POST /api/settings/reveal-db`), then delete it with the app closed |
| The QoQa password | Clear the password field in Settings and save — an empty field sends `null`, which deletes the credential-store item. Or delete it directly in Keychain Access / Credential Manager |
| The PostgreSQL URL | Switch the database back to local in Settings and save; same deletion path |
| UI preferences | Clear site data for the app's origin. On desktop that means the WebView profile, so removing the app's own directory does not clear them |
| Everything else | Delete the config and data directories listed above. The app never removes them itself, and uninstalling does not either |
