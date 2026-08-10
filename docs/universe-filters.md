# Universe filtering

The universe picker in the header decides what every other part of the dashboard shows: the stat cards, both bar charts, the pie chart, the orders table and the CSV export all run against the same filter. It is also the part of the UI that has regressed most often, because "no universe in the filter" is ambiguous — it can mean *everything* or *nothing* — and because QoQa keeps re-filing its offers under new universes, which quietly invalidates a stored selection. This document is the reference for how it is supposed to behave.

## The three states

The selection is a discriminated union (`UniverseSelection` in [`src/shared/filters.ts`](../src/shared/filters.ts)), never a bare pair of arrays:

| State | Value | Button label | What the dashboard shows |
|---|---|---|---|
| Everything | `{ mode: "all" }` | *All universes* | Every order, no universe condition in the SQL |
| A subset | `{ mode: "custom", universes, subuniverses }` (at least one entry) | *N selected* | Only orders matching the selected entries |
| Nothing | `{ mode: "custom", universes: [], subuniverses: [] }` | *No universe* | The "pick a universe" screen instead of the dashboard body |

`mode: "all"` is deliberately not "the list of every universe". The two are not equivalent: filtering on every known universe still drops orders whose universe is `NULL`, and the list of universes changes between syncs. `all` means *no universe condition at all*.

A selection is stored in `localStorage` under `qoqa-compta-filters` and survives restarts, including the empty one — a user who cleared the filter finds the same empty screen on the next launch, with the picker there to fix it.

One screen outranks all three: when the database holds no orders at all, the dashboard shows its "configure and sync" screen whatever the selection says. An empty selection saved before a database reset would otherwise strand the user on "pick a universe" with an empty picker.

### Reading a selection written by an older version

Before this model existed, the state was `{ universes: [], subuniverses: [] }` and **empty meant everything**. `readSelection()` in [`use-filter-state.ts`](../src/views/lib/use-filter-state.ts) still understands that shape: a legacy payload with two empty arrays becomes `all`, and anything else becomes `custom`. Sub-universe keys stored before they were namespaced (`vins` rather than `wine-and-spirits:vins`) are dropped on read — they cannot be mapped back to one universe.

## Entries, not check boxes: what *N selected* counts

An entry is one thing the user picked: a whole universe, or a single sub-universe. Selecting *Vins & Spiritueux* is one entry even though the picker then draws its three sub-universes as checked; selecting *Vins* and *Spiritueux* individually is two entries. The count is `universes.length + subuniverses.length`, and it is only ever shown for the *subset* state — the other two states have their own labels.

The count is computed **after normalization** (below). That matters: before, a selection carrying entries QoQa no longer publishes showed a number larger than the number of boxes on screen, and could never reach *All universes* even with every box ticked.

## Normalization

`normalizeSelection(selection, available)` runs on every change made in the picker, and again whenever the dashboard returns a universe tree, so a stored selection is repaired before it is used. It is a pure function; `available` is the tree from `GET /api/dashboard` (`fetchUniverses()`, which is never itself filtered). Rules, in order:

1. **`all` is left alone**, and so is any selection when `available` is empty — an empty tree means the data has not loaded yet, not that everything is stale.
2. **Unknown entries are dropped**: universes missing from the tree, sub-universe keys whose universe is missing, and sub-universe keys filed under a universe they no longer belong to.
3. **A sub-universe of an already-selected universe is dropped** — the universe covers it, so keeping both would double-count in the label.
4. **A universe whose sub-universes are *all* individually selected collapses onto the universe**, so a fully-ticked universe reads as one entry.
5. **A selection covering every universe becomes `all`** — that is what makes the button say *All universes* when the user ticks the last box.
6. **A selection whose entries were *all* dropped as stale becomes `all`**, not empty. Losing the filter is recoverable; silently showing an empty dashboard after a QoQa re-tagging looks like data loss.

Rule 6 is the reason the empty state must be reachable only by an explicit user action: an already-empty selection is returned untouched, so a deliberate "nothing" is never rewritten into "everything".

### Why entries go stale

An order stores the universe its offer carried when it was synced, while the sub-universe tree is refreshed from the alerts endpoint on every sync, and QoQa re-files offers one at a time. `effectiveUniverse()` in [`queries.ts`](../src/server/queries.ts) papers over this on the query side by grouping on the *current* parent of an order's sub-universe. The picker sees the same churn as entries that no longer exist — `alcohol:vins` after *Vins* moved to `wine-and-spirits` — which is what rules 2 and 6 clean up.

## Talking to the API

`selectionParams(selection)` is the single place that turns a selection into query parameters. Every call site (dashboard, orders, CSV export, CSV save) spreads its result rather than building the parameters itself.

| State | Parameters |
|---|---|
| `all` | *(none)* |
| subset | `universes=a,b` and/or `subuniverses=u:s,u:s2` |
| nothing | `universes=__none__` |

`__none__` (`NO_UNIVERSE_FILTER`) is a reserved identifier no order can carry. `buildUniverseFilter()` recognizes it and returns `1 = 0`, so every aggregate comes back at zero and no order is listed. It exists so that the client keeps making exactly one dashboard request in every state: the response still carries the universe tree the picker needs to let the user select something again, which a skipped request would not.

Sub-universes travel as `universe:subuniverse` pairs because QoQa reuses the same sub-universe identifier under several universes; see the header of `src/shared/filters.ts`.

## Interaction rules in the picker

The picker never mutates the stored selection directly. It expands the current state into a working pair of sets, applies the click, and hands the result to `normalizeSelection`:

- In `all` mode the working set starts as *every* universe, so the first click after *All universes* deselects exactly one universe rather than clearing the filter.
- Clicking a universe toggles it and clears any of its individually selected sub-universes.
- Clicking a sub-universe of a selected universe explodes that universe into its sub-universes first, then toggles the one clicked — so unticking one sub-universe keeps the rest.
- A universe box is drawn checked when the universe itself is selected, and indeterminate when only some of its sub-universes are.

## What to check when changing this

- Ticking every box, in any order, ends at *All universes* — not *N selected*.
- Unticking the last remaining box lands on the "pick a universe" screen, and the picker stays reachable in the header.
- The empty state survives a reload.
- A stored selection naming a universe that no longer exists recovers to *All universes* instead of showing an empty dashboard.
- The count on the button matches the number of *entries*, and never exceeds the number of universes plus sub-universes on screen.
- The orders table, the CSV export and the charts all agree with the picker — they share `selectionParams`, so a new call site must use it too.
