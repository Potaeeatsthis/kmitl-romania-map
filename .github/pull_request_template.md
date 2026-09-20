## What this changes

<!-- One or two sentences. Which build step from CLAUDE.md does this belong to? -->

## Checks

- [ ] `npm run verify` passes locally
- [ ] `npm run typecheck` passes locally
- [ ] CI is green

## Invariants

<!-- Tick what applies. If none apply, say so — don't leave the section blank. -->

- [ ] **I1** — `search()` is still one function. UCS and A\* differ only by the
      heuristic array passed in. No `ucs.rs` / `astar.rs` split.
- [ ] **I2** — **if the algorithm changed, it changed in all three languages**
      (`wasm/src/`, plus `reference/romania_search.py` and
      `reference/romania_search.cpp`) and `verify:parity` still passes.
- [ ] **I3** — the heuristic is still admissible and consistent.
- [ ] **I4** — no `println!`, `Instant`, `black_box` or `io::` in engine code.
- [ ] **I5** — no runtime numbers taken from a browser.

> I2 is the one that catches people. Changing a tie-break or a counter in one language
> and not the other two leaves all three programs running and all three still finding
> optimal paths — while every reported number silently becomes wrong.

## If this fixes a bug

The bug loop in `CLAUDE.md` must be closed before merge:

- [ ] `docs/rootcause/<slug>.json` written
- [ ] signature row added to `.claude/commands/diagnose.md`
- [ ] section added to `docs/runbook.md`
- [ ] check added to `scripts/verify_*.sh`, **or** `automation_gap` filled in with why not
