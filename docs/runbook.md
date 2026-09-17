# Runbook

One section per known failure, in the same order as the signature table in
`.claude/commands/diagnose.md`. Each section is: **symptom → diagnose → fix → prevent**.

New sections are added by step 2 of the bug loop protocol in `CLAUDE.md`. Do not add a
section for a failure that has not actually occurred.

---

## §1 — `empty-cargo-manifest`

Rootcause file: [`rootcause/empty-cargo-manifest.json`](rootcause/empty-cargo-manifest.json)

### Symptom

Any cargo command run inside `wasm/` fails immediately:

```
error: failed to parse manifest at `/…/wasm/Cargo.toml`

Caused by:
  manifest is missing either a `[package]` or a `[workspace]`
```

### Diagnose

```bash
wc -c wasm/Cargo.toml          # 0 → this is the cause
git ls-files wasm | while read f; do [ -s "$f" ] || echo "EMPTY: $f"; done
```

At the time, the Rust source and test placeholders under `wasm/` were empty too — the
directory structure had been committed before the Cargo project was created. All of them
are populated now; this section is kept as the record of the failure, not as a
description of the current tree.

### Fix

This was the expected state before build step 1. The permanent fix is now implemented:

```bash
cargo check --manifest-path wasm/Cargo.toml
```

### Prevent

This entry is historical. `npm run verify:invariants` now runs Cargo check, tests,
Clippy with warnings denied, and the formatting check.

---

## §2 — `dead-posttooluse-hook`

Rootcause file: [`rootcause/dead-posttooluse-hook.json`](rootcause/dead-posttooluse-hook.json)

### Symptom

**There is no error message.** This failure presents as silence: you edit a file under
`wasm/src/`, and nothing appears — no invariant check, no reminder that I2 needs the
same change in all three languages. A working hook and a dead hook look identical from
the outside, which is why this survived from the day it was written.

The tell is that `scripts/verify_invariants.sh --structural` exists solely to be called
by this hook, and had never run.

### Diagnose

```bash
npm run verify:harness          # the direct check
grep CLAUDE_TOOL_INPUT .claude/settings.json   # any hit is the bug
```

Two distinct faults, and a hook can have either:

1. **Wrong input channel.** There is no `CLAUDE_TOOL_INPUT_FILE_PATH`. The payload is
   JSON on **stdin**; the edited path is `.tool_input.file_path`. `CLAUDE_PROJECT_DIR`
   *is* a real variable and can be used directly.
2. **Wrong output channel.** On exit 0, a hook's stdout goes to the debug log where
   nobody reads it. To put text in front of Claude, write to **stderr and exit 2**, or
   print JSON containing a **`systemMessage`** field.

A hook can be perfectly correct about the file path and still be invisible because of
the second point.

### Fix

Logic lives in [`.claude/hooks/post_tool_use.sh`](../.claude/hooks/post_tool_use.sh),
not inline in `settings.json` — a shell one-liner escaped inside JSON is unreadable and
untestable, which is how this went unnoticed. The script parses stdin with `python3`
(`jq` is not a project dependency), fails loudly on stderr with exit 2, and uses
`systemMessage` for the non-failure reminder.

### Prevent

`npm run verify:harness`, wired into `npm run verify` and CI. It reads the command
string out of `.claude/settings.json` and runs it against a synthetic payload, so it
tests the real hook rather than a copy that could drift from it. It asserts the hook
reacts to a `wasm/src/` path, stays quiet on an unrelated one, and that
`settings.json` never mentions `CLAUDE_TOOL_INPUT*` again.

Deliberately a separate script from `verify_invariants.sh`: the hook calls that script,
so a self-check living inside it would turn one I1 violation into two red checks and
point at the tooling when the engine is what broke.

---

## §3 — golden baseline diffs

Rootcause file: none — this is not a bug, it is how to read a check.

### Symptom

```
golden: FAIL
  FAIL arad-bucharest differs from tests/golden/arad-bucharest.txt
```

### Diagnose

**A golden diff is not automatically a regression.** Read the diff and decide which of
two things happened:

- **You changed the CLI output on purpose** — renamed a column, added a metric, adjusted
  wording. Expected. Re-record.
- **A number changed that you did not intend to change** — a cost, an explored order, an
  expansion count, a memory figure. That is a real regression, and it is exactly what
  this check exists to catch.

The second case is worth taking seriously: `verify:parity` compares the three
implementations to each other, so a change applied to all three at once keeps it green.
The road table lives in three separate encodings, so editing a road *is* a
change to all three. Golden is the only check that notices.

### Fix

Intended change — re-record and review what moves:

```bash
bash scripts/verify_golden.sh --update
git diff tests/golden/
```

`--update` refuses to record unless all three implementations already agree, so it can
never bless output that only one of them produces.

Unintended change — fix the code, not the baseline. Never re-record to make a red check
go green; that discards the only fixed point the project has.

### The trace goldens are a separate set with a separate command

`wasm/tests/golden/` records every frame of the search trace — the frontier and discovered
lists at each expansion — for two routes under both algorithms. It is compared by
`cargo test`, which runs inside `verify:invariants`, **not** by `verify:golden`.

A failure looks like this, and names the frame that moved:

```
arad-bucharest (astar) differs at line 4
```

It catches a change to how `make_step()` sorts or dedupes the frontier: the CLI output is
unaffected, `trace.len()` is unchanged, explored order is unchanged, so every other check
stays green while every middle frame of the animation is different.

Re-record an intended change with a **different** command from the one above:

```bash
UPDATE_GOLDEN=1 cargo test --manifest-path wasm/Cargo.toml
git diff wasm/tests/golden/
```

### Prevent

`npm run verify:golden` for the CLI output and `cargo test` for the trace, both wired into
`npm run verify` and CI.

---

## §4 — `clippy-needless-range-loop`

Rootcause file: [`rootcause/clippy-needless-range-loop.json`](rootcause/clippy-needless-range-loop.json)

### Symptom

`cargo clippy --all-targets -- -D warnings` reports
`clippy::needless-range-loop` in a Rust test.

### Diagnose

Read the named loop. If its numeric index is mainly used to access the same collection,
iterate over that collection directly and keep the index with `.enumerate()`.

### Fix

Replace `for index in 0..items.len()` plus `items[index]` with
`for (index, item) in items.iter().enumerate()`.

### Prevent

`npm run verify:invariants` runs Cargo check, tests, Clippy with warnings denied, and
the formatting check whenever `wasm/Cargo.toml` exists.

---

## §5 — `shared-integration-test-dead-code`

Rootcause file: [`rootcause/shared-integration-test-dead-code.json`](rootcause/shared-integration-test-dead-code.json)

### Symptom

Clippy says a helper in `tests/common/mod.rs` is never used, even though another
integration-test file calls it.

### Diagnose

Remember that each file in `tests/` is a separate crate. A shared module is compiled
once for each test file that declares it, and one of those crates may not use every helper.

### Fix

Prefer smaller shared modules when useful. For a small test-only helper used by most
suites, add a narrow documented `#[allow(dead_code)]` on that helper only.

### Prevent

`npm run verify:invariants` runs Clippy across all targets with warnings denied.

## §6 — `mutation-false-pass-broken-gate`

**Symptom.** A fault whose expectation is `missed` reports *"is now caught -- a gap was
closed"*, or the `Preflight` block is missing from the output entirely. Both mean the same
thing: a gate that cannot run, scoring every fault it touches as caught.

**Not a symptom: a fast run.** The first version of this section said two minutes instead
of ten. That was calibrated on a Mac. CI completes the full suite in under three minutes
legitimately -- 2m53s on 2026-08-24 with all fifteen preflight and fault lines correct.
Duration tells you nothing on its own; M15's verdict does.

**Diagnose.** Read the top of the output. Every gate should be listed green under
*Preflight*. If the suite starts at all, the preflight passed; if it refused with
`the harness is broken`, the named gate is the problem. On a run from before the preflight
existed, look for a gate reporting `CAUGHT` for *every* fault it touches — a working gate
catches some and misses others.

The tell that started this: `node_modules not found ... the vitest faults will be skipped`.
They were not skipped. `gate()` scores detection by exit status alone, so `npx vitest run`
exiting 1 because vitest is not installed reads exactly like vitest failing because the
fault was found.

**Fix.** Whatever the gate needs, install it. For the vitest gates that is `npm ci`; the
script now exits rather than continuing without `node_modules`, and
`.github/workflows/mutation.yml` runs Setup Node and `npm ci` before the suite.

**Prevent.** The suite preflights every gate against the unmutated worktree and refuses to
start if one is red. Adding a gate that needs a tool the CI job does not install now fails
loudly on the first run instead of turning the suite green.

**Never do this.** Do not act on a `missed → caught` promotion without checking the
preflight first. The advice to close a documented blind spot is exactly what a broken gate
produces, and M15 is the blind spot it will offer to close.

---

## §7 — `benchmark-panel-static-runtime`

Rootcause file: [`rootcause/benchmark-panel-static-runtime.json`](rootcause/benchmark-panel-static-runtime.json)

### Symptom

**There is no error message.** The benchmark results panel's "NATIVE SPEED SAMPLE"
runtime figure never changes no matter which start/goal pair is selected on the map —
it always shows the same Arad → Bucharest numbers.

### Diagnose

```bash
grep -n "sample_route" components/benchmark/BenchmarkCharts.tsx
```

`components/benchmark/BenchmarkCharts.tsx` read runtime exclusively from
`public/data/benchmark-results.json`'s single hardcoded `sample_route` object, not
from the store's `startCity`/`destinationCity`. Every other metric in the same panel
(expanded, generated, peak queue, peak records, cost) already updated correctly,
because those come from the live WASM search result in `stores/useSearchStore.ts`.
Runtime could not follow the same path: `SearchResult` (`wasm/src/metrics.rs`) has no
timing field at all, and invariant I5 forbids measuring it in the browser anyway —
`performance.now()` is coarsened to ~100 µs in Chrome against a ~1 µs search.

### Fix

Added a CLI/export-layer binary, `wasm/src/bin/export_all_runtimes.rs`, that times
both algorithms for all 400 ordered pairs natively — reusing `cli.rs`'s
`Instant`-based approach (a warmup call, then repeated individually-timed runs, median
taken) — without adding a field to `SearchResult` or touching `search()` (I1/I4).
Ships `public/data/all-pairs-runtime.json` as a separate file, not folded into the
larger `all-pairs-search.json`, since it carries only two numbers per pair and no
traces. `BenchmarkCharts.tsx` now looks up the selected route's entry from that file
(`index = startCity * city_count + destinationCity`) instead of the static
`sample_route`.

### Prevent

`npm run verify:all-runtimes`, wired into `npm run verify`. Unlike `verify:all-pairs`'s
exact byte-for-byte diff, it checks structure and coverage only — every pair present,
row-major, positive finite runtimes for both algorithms — because timing is inherently
non-deterministic run to run and machine to machine; an exact-value diff would be a
false alarm on every run.

---

## §8 — `benchmark-ring-null-after-city-change`

### Symptom

In the results drawer, the **SELECTED ROUTE** ring shows `—` and *"Run a route to
compare expansions"* instead of a percentage, and stays that way, after a starting
point is chosen on the map. The **NATIVE SPEED SAMPLE** ring beside it updates to the
new pair correctly. The route summary reads *"Run this route to see its details."* and
the frame scrubber reads `0 / 0`.

The asymmetry between the two rings is the diagnostic tell — see Diagnose below.

### Diagnose

The two rings read different sources, which is why one survives and one does not:

| Ring | Source | Survives `data: null`? |
|---|---|---|
| SELECTED ROUTE (expansions) | the store's live `data` | no — falls back to `—` |
| NATIVE SPEED SAMPLE (runtime) | `all-pairs-runtime.json`, keyed on `startCity`/`destinationCity` | yes |

So a blank *left* ring next to a correct *right* ring means `data` is null, not that the
lookup is wrong. `setCity()` in `stores/useSearchStore.ts` sets `data: null` on every
city change, deliberately, so a stale trace is never drawn against a new route. The
question is therefore always *why nothing re-ran*, never *why the data is wrong*.

Confirm in the browser console with the drawer open:

```js
document.querySelector('aside[aria-labelledby="benchmark-panel-title"]').innerText
```

`SELECTED ROUTE / —` together with a populated `NATIVE SPEED SAMPLE` is this bug.

### Fix

Keep the re-run trigger in the store, never in the caller. `setCity()` calls
`void get().run()` on **both** branches — the changed-city branch and the same-city
early return:

```ts
setCity: (field, city) => {
  const current = field === "start" ? get().startCity : get().destinationCity;
  const nextSelecting = field === "start" ? "destination" : "start";

  if (current === city) {
    set({ selecting: nextSelecting });
    void get().run();          // the same-city path re-runs too
    return;
  }

  requestGeneration += 1;
  set({ /* …city, selecting, data: null, step: 0, … */ } as Partial<SearchState>);
  void get().run();
},
```

`components/search/SearchMap.tsx`'s `chooseCity()` drops its
`if (selectedField === "destination")` guard and just calls `setCity(selecting, city.id)`.
`RoutePlanner.tsx` needs no change — its `onSelect` handlers re-run through the store.

Do **not** re-add a `run()` call in a caller. That is what split the behaviour across
two call sites in the first place.

### Prevent

Three tests, all of which go red if the store's trigger is removed:

- `stores/useSearchStore.test.ts` — *"runs the search only once both cities are
  chosen"* and *"toggles selecting when the same city is clicked again before a route
  is complete"* (renamed from *"re-runs the search after either city changes"* /
  *"re-runs when the same city is picked again"* by §9's rolling-restart change; the
  behavior these two protect — no run() until both cities are non-null, and the
  same-city early-return toggling `selecting` — is unchanged, only the starting state
  and names moved). The second covers the early-return branch, which the old
  caller-side guard used to handle for the destination field.
- `components/benchmark/BenchmarkPanel.test.tsx` — *"keeps the expansion ring populated
  after a start city is chosen on the map"*. This one renders `RomaniaSearch` **and**
  `BenchmarkPanel` together and clicks a real map marker, because the gap that hid this
  bug was that no test crossed selection with the benchmark panel.

The panel tests that seed the store with `setState({ data, startCity, destinationCity })`
cannot catch this class of bug at all — they bypass `setCity` and so never execute the
`data: null` path. When testing anything about the panel reacting to a *selection*, drive
the selection, do not seed the result.

---

## §9 — `search-ui-third-click-no-rolling-restart`

Rootcause file: [`rootcause/search-ui-third-click-no-rolling-restart.json`](rootcause/search-ui-third-click-no-rolling-restart.json)

### Symptom

**There is no error message.** Once a route is complete (both a start and a
destination chosen), clicking a third city just overwrites whichever field
`selecting` happens to point to — leaving one endpoint of the *old* route paired with
the newly clicked city, instead of starting a clean new route.

### Diagnose

```bash
grep -n "routeComplete" stores/useSearchStore.ts
```

`setCity()` only ever branched on which single field was clicked and whether that
field's value changed — it had no notion of "a complete route already exists," so a
third click was handled identically to the first or second.

### Fix

`setCity()` now checks `startCity !== null && destinationCity !== null` at the top,
before anything else. When true, it takes a rolling-restart branch **regardless of
which field was clicked or which field `selecting` points to**: the clicked city
becomes the new `startCity`, `destinationCity` resets to `null`, `selecting` becomes
`"destination"`, and `data`/`step`/`isPlaying`/`error` are wiped — no search fires
until the next click supplies a destination. `requestGeneration` is bumped on this
branch too, so a search already in flight from the discarded route can't land
afterward and repopulate `data`. Deliberately **not** touched: the map's pan/zoom
viewport (`SearchMap.tsx`'s local, non-store state) — only the dedicated Reset button
resets that.

Edge case, intentional: clicking a city that is *already* one of the two current
endpoints, while the route is complete, still restarts from it. The route-complete
check happens before the existing same-city early return, so there is no special case
for "the clicked city happens to already be selected."

### Prevent

`stores/useSearchStore.test.ts` — *"rolling-restarts from a third click once a route
is complete"* and *"rolling-restarts even when the clicked city is already a current
endpoint"*. Both go red if the `routeComplete` branch is removed or reordered after
the same-city check.

---

## §10 — `search-ui-no-clean-slate-reset`

Rootcause file: [`rootcause/search-ui-no-clean-slate-reset.json`](rootcause/search-ui-no-clean-slate-reset.json)

### Symptom

**There is no error message.** On load, the app always starts pre-populated with the
Arad → Bucharest sample route rather than a blank slate. A single city click
immediately re-runs the search against whatever the other city happens to be (the
default, or a stale prior selection), instead of waiting for a deliberate second pick.
There was no way to clear a selection back to "nothing chosen."

### Diagnose

```bash
grep -n "startCity: number" stores/useSearchStore.ts
```

`startCity`/`destinationCity` were typed as plain `number`, seeded to concrete
defaults (`0`/`12`), with `data` seeded to the committed sample response. The type
itself had no way to represent "nothing selected," so the store was built around
always holding a valid pair rather than gating on two explicit picks — and `setCity`
called `run()` on every single change as a consequence.

### Fix

Five-phase change, each phase typechecked/built/tested before the next:

1. **Types + gating** (`stores/useSearchStore.ts`) — widened `startCity`/
   `destinationCity` to `number | null`, seeded initial state to `null`/`null`/`data:
   null` (no more preloaded sample), and rewrote `setCity` to only call `run()` once
   both cities are non-null, with a matching guard inside `run()` itself as a safety
   net.
2. **Consumers** — every place that dereferenced the now-nullable fields as if they
   were always numbers (`components/search/RoutePlanner.tsx`'s `CitySearch`,
   `components/benchmark/BenchmarkCharts.tsx`'s name and per-pair runtime lookups) now
   guards against `null` and renders a clean "nothing selected yet" placeholder
   instead of crashing or indexing with `null`.
3. **Reset button** — a `reset()` store action plus a standalone button in
   `RomaniaSearch.tsx`, centered at the bottom of the search UI (not inside
   `PlaybackControls.tsx`'s bottom-right animation cluster, which stays purely about
   playback transport). Renders only once at least one city is picked
   (`startCity !== null || destinationCity !== null`).
4. **Map viewport** (`components/search/SearchMap.tsx`) — a `useEffect` watching
   `startCity`/`destinationCity` resets the local, non-store `mapViewport` to its
   default when *both* become `null`. This condition is deliberately specific to a
   real `reset()` call: §9's rolling-restart only ever nulls `destinationCity` while
   setting `startCity` to the newly clicked city, so it never satisfies "both null"
   and never touches the map's pan/zoom — only the Reset button does.
5. **Tests** — added coverage for the blank initial state, the two-pick gate, and
   `reset()` end-to-end (state *and* map viewport). Several pre-existing tests whose
   `beforeEach` seeded an already-complete route needed fixing along the way, both
   here and again for §9 — see that section's "unexpected but necessary" note.

### Prevent

`stores/useSearchStore.test.ts` — *"runs the search only once both cities are
chosen"* and *"reset returns to a blank state without touching speed"*.
`components/search/RomaniaSearch.test.tsx` — *"starts with nothing selected and no
reset button"* and *"resets to blank and snaps the map back to its default
viewport"* (the only test that exercises the Reset button through a real click and
checks the map's `viewBox` afterward). All four are in
`scripts/verify_invariants.sh`'s frontend test-inventory list.

---

## §11 — `search-map-zoom-blocks-city-clicks`

Rootcause file: [`rootcause/search-map-zoom-blocks-city-clicks.json`](rootcause/search-map-zoom-blocks-city-clicks.json)

### Symptom

**There is no error message.** At default zoom, clicking a city selects it normally.
After zooming in (wheel, pinch, or the `+` button), clicking a city does nothing —
`setCity` never fires, no matter where on the city you click.

### Diagnose

```bash
grep -n "setPointerCapture" components/search/SearchMap.tsx
```

`SearchMap.tsx`'s `beginMapPan()` called `event.currentTarget.setPointerCapture()`
unconditionally on every mouse pointerdown once `mapZoom > MAP_MIN_ZOOM`, before
knowing whether the gesture would become a drag or stay a plain click. Per the
Pointer Events spec, once a pointer is captured, the `click` event that follows is
*also* redirected to the capturing element — here, the `<svg>` root, since that's
where `onPointerDown` is bound — rather than hit-tested against whatever is actually
under the pointer. A city's own `onClick={chooseCity}` lives on the nested `<g
role="button">`, so it never received the click. At default zoom,
`handleMapPointerDown`'s `mapZoom <= MAP_MIN_ZOOM` guard short-circuits before
`beginMapPan`/`setPointerCapture` ever runs, which is why clicking worked fine there
and the bug was zoom-gated. The identical unconditional call existed in the
single-touch branch of the touch pointerdown handler too.

**Testing note, worth knowing before writing a similar test again:** jsdom does not
implement the browser's actual click-redirection-on-capture behavior. A test that
zooms in, clicks a city via `userEvent.click()`, and asserts the store updated will
pass whether or not the fix is applied — verified directly by temporarily reverting
the fix and re-running. It's kept as a behavioral spec, but the regression test that
actually catches this class of bug asserts on the mechanism jsdom *can* observe:
exactly when `setPointerCapture` is called.

### Fix

Deferred `setPointerCapture` until the gesture is confirmed a drag. `pointerdown` now
only arms `panGestureRef` (records start position/viewport, `moved: false`) without
capturing. `handleMapPointerMove` calls `setPointerCapture` at the exact moment
`panGesture.moved` flips from `false` to `true` — the existing 4px-movement
threshold that was already being tracked for the click-suppression logic, just not
yet used to gate capture itself. A plain click never crosses that threshold, so
capture — and the click-redirection side effect — never happens, and the city's
native `onClick` fires normally. A genuine drag still captures and pans exactly as
before.

The single-touch branch got the same fix. The two-touch (pinch) branch is
unambiguous the instant a second finger lands — it can never be a tap — so it keeps
capturing immediately, now for *both* touch pointer IDs (`for (const pointerId of
mapTouchesRef.current.keys())`) rather than just the one that triggered the
`pointerdown`, preserving the original robustness if a finger slides outside the SVG
mid-pinch.

### Prevent

`components/search/RomaniaSearch.test.tsx`:
- *"does not capture the pointer until the drag threshold is crossed"* — the test
  that actually catches this regression (confirmed by reverting the fix and watching
  it fail). Spies directly on `setPointerCapture` and asserts it's uncalled through a
  full pointerdown/pointerup with no movement, then called only once movement crosses
  the threshold.
- *"selects a city by clicking even after zooming in"* — behavioral spec of the
  intended outcome (see the jsdom caveat above).
- *"does not select a city when the pointer drags across the map"* — the inverse
  invariant: a genuine drag pans and leaves both cities `null`.
- *"leaves the map viewport untouched when a zoomed-in click triggers a rolling
  restart"* — closes the gap flagged in the investigation that preceded this fix:
  confirms §9's rolling-restart and this fix compose correctly while zoomed.

All four are in `scripts/verify_invariants.sh`'s frontend test-inventory list.


## 12 — Calculation page fails static export

**Symptom:** `next build` reports that `useSearchParams()` needs a Suspense boundary on `/heuristic-summary`.

**Diagnose:** Development rendering succeeds, but static export suspends while resolving browser query parameters. Check the route for a parent Suspense or loading boundary.

**Fix:** Add `app/heuristic-summary/loading.tsx`; the shared `CalculationPage` shell wraps the new teaching routes in Suspense.

**Prevent:** Run `npm run build`, already part of CI. The build itself exercises this requirement; unit tests and typechecking do not. See `docs/rootcause/calculation-missing-suspense.json`.


## §13 — `terrain-border-mercator-mismatch`

Rootcause file: [`rootcause/terrain-border-mercator-mismatch.json`](rootcause/terrain-border-mercator-mismatch.json)

### Symptom

**There is no error message.** In the Terrain map view, Google's own black
country-border line visibly drifts away from our green SVG-drawn Romania border.
The gap is smallest near the center of the current viewport and grows toward the
edges — worst near the Moldova/Ukraine border and the Black Sea coast.

### Diagnose

This is not the county-outline-vs-neighboring-country seam covered by
`scripts/fetch_neighboring_context.mjs` (that's two of *our own* backdrop layers,
already patched with `inflateOutward`) — it's our SVG layer against Google's live
basemap tiles, never previously diagnosed.

First rule out a bad projection fit: refit `components/search/SearchMap.tsx`'s
`PROJECTION` constants via least squares against all 20 cities' known lon/lat
(`scripts/fetch_road_geometry.mjs`'s `CITY_COORDS`) vs. their committed `x,y`
(`lib/romaniaGraph.ts`). If the refit reproduces the existing constants almost
exactly, the transform is already optimal and the residual (a few px, from
hand-adjusted city layout, not a bug) is not the cause of a large, edge-growing
mismatch — look elsewhere.

```bash
node -e "
const CITY_COORDS = /* from scripts/fetch_road_geometry.mjs */;
const XY = /* from lib/romaniaGraph.ts */;
// linear regression x~lon, y~lat, compare to PROJECTION in SearchMap.tsx
"
```

The real cause: Google Maps always renders in **Web Mercator** (latitude scale
grows with `sec(lat)`, i.e. with distance from the equator). Our SVG overlay
(`countyOutlines.ts`, `romaniaGraph.ts`) is deliberately **linear equirectangular**
("no distortion, bounding-box fit" — see `lib/countyOutlines.ts`'s header comment)
so the schematic diagram stays undistorted. The two projections agree on longitude
but diverge on latitude, growing with distance from the view's center latitude —
confirmed by checking that the committed city positions fit a *linear* latitude
model better than a Mercator-transformed one (RMSE 1.6 vs 1.8 across all 20
cities), i.e. the diagram truly is linear by construction, not an approximation of
Mercator.

### Fix

Don't chase pixel alignment — it's structurally impossible here without either
re-projecting every piece of committed SVG geometry into Web Mercator, or moving
the background to a projection-controllable renderer (MapLibre, listed as a future
enhancement in CLAUDE.md's Build order, step 5). Instead, turn off Google's own
country-boundary stroke on Terrain via the style array, so only our own single,
deliberately-schematic border shows:

```ts
// components/search/SearchMap.tsx — TERRAIN_MAP_STYLES
{ featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] }
```

Same reasoning already applied earlier in the same array to hide Google's own
place-name labels in favor of our own SVG labels.

### Prevent

No script check: nothing in this repo renders or screenshots the composited map,
so pixel alignment between the Google tile background and the SVG overlay isn't
testable by the existing gates. The prevention is a documented convention instead
— see `automation_gap` in the rootcause file: never rely on a Mercator-based
background's own border/label rendering to visually agree with our
linear-equirectangular schematic layer; always suppress the competing feature via
`TERRAIN_MAP_STYLES` rather than trying to align it.

### Update — the same cause on roads (2026-09-16)

**Symptom:** a thin gray sliver of Google's real road visibly peeks out from
under our thicker route line at some curves in Terrain/Satellite view, worst on
roads that span more latitude (e.g. the Mehadia–Lugoj mountain pass, "70").

**Diagnose:** same root cause as above (Web Mercator vs. linear equirectangular),
just visible on roads instead of the border. Unlike the border, this one *is*
fixable by re-projecting, not hiding — every road/city coordinate is a known,
invertible equirectangular transform, so no new external GIS data or OSRM
refetch is needed.

**Fix:** new `lib/mercatorProjection.ts` — moved `PROJECTION`/`unprojectToLatLng`
there from `SearchMap.tsx`, added a Web Mercator `mercatorY(lat)` helper and a
least-squares-fit `MERCATOR_LAT_SCALE`/`MERCATOR_LAT_OFFSET` (fit against the
same 20 city control points; longitude is untouched since both projections
scale it identically). Exports precomputed `mercatorCityPositions` and
`mercatorRoadGeometry` — parallel Mercator-space copies of `romaniaGraph.ts`'s
city positions and `roadGeometry.ts`'s road points.

`lib/roadPath.ts`'s `getRoadPoints`/`getRoadPathD` gained an optional
`variant: "default" | "mercator"` parameter (default preserves today's exact
behavior; the memoization cache key now includes it). `SearchMap.tsx` computes
`roadVariant = displayMode === "default" ? "default" : "mercator"` once, and
threads it into the road base layer, road labels, city node positions, and all
four trace-line families (`SearchTreeLines`/`ExpandedTreeLines`/`PathLines`/
`GraphLine`, which already funneled through one shared `getRoadPathD` call, so
this was one change, not four). The "Default" schematic view never reads the
Mercator tables — it's pixel-identical to before.

`PathDots` (the county-clipped route-progress dot texture) was deliberately
left on the default variant always — it's a decorative density texture clipped
by county polygons (which stay equirectangular per the border fix above), not
a marker riding on the line, so reprojecting only its distance calculation
would have desynced it from the unmoved county clip regions for no benefit.

**Prevent:** same as above — no script check, verified by manually zooming into
Terrain/Satellite at the known trouble spots (Arad–Zerind, Mehadia–Lugoj,
Sibiu–Rimnicu Vâlcea) and confirming the sliver is gone. See the rootcause
file's updated `fix`/`notes` for the full reasoning, including why this went
the *opposite* direction from the border fix (reproject our data vs. hide
Google's) and why that's not a contradiction — roads have committed source
coordinates to reproject from; the border doesn't.

---

## §14 — `svg-map-note-font-fallback`

Rootcause file: [`rootcause/svg-map-note-font-fallback.json`](rootcause/svg-map-note-font-fallback.json)

### Symptom

**There is no error message.** On the A* walkthrough map (`RouteMap.tsx`), the
small `f=` score labels below the "waiting in queue" city markers render in the
browser's generic monospace, visibly different from the city-name labels on the
same markers. Both should be Departure Mono.

### Diagnose

```bash
grep -rn -- "--font-mono" app components
```

`.markerNote` in `components/heuristic/RouteMap.module.css` used
`var(--font-mono, monospace)`, but `--font-mono` is defined nowhere — only
`--font-interface` exists, in `app/globals.css`. A `var()` with an undefined
property resolves to its fallback, so the notes silently dropped to generic
`monospace`. `.markerLabel` used `var(--font-interface, sans-serif)`, which is
why the two layers disagreed.

### Fix

Point the note at the same token the city label already uses:

```css
/* components/heuristic/RouteMap.module.css */
.markerNote {
  font: 600 10.5px var(--font-interface, sans-serif);
}
```

The same undefined-token pattern still exists in `components/circuit/CircuitMap.module.css`
and `app/circuit-flow/page.module.css` (10 rules). Left untouched — out of scope.

### Prevent

No script check: jsdom cannot resolve CSS custom properties, and there is no CSS
lint (ESLint is blocked upstream). A mechanical "every `var(--font-*)` is defined"
check would go red on the 10 pre-existing circuit usages, so it cannot land green
without a wider fix. The convention is to use the single app font token,
`--font-interface`, for all text. See the rootcause file's `automation_gap`.
