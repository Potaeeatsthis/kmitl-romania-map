# /diagnose — Match an error to a known rootcause, or investigate and record a new one

When the user pastes an error message, test failure, or unexpected output, follow these
steps in order.

## Step 1 — Match the signature

Scan the error for these known signatures. The table grows over time; a row here means
this project actually hit that bug.

Most rows are keyed on text you can paste. Some failures produce **no error at all** —
they present as silence, or as a check that is merely reporting what it was built to
report. Those rows are marked *(no error text)* and are matched on the observation
instead, because nobody will ever arrive here with a string to search for.

| Signature in the error | Rootcause | Runbook |
|---|---|---|
| `manifest is missing either a [package] or a [workspace]` + cargo | `empty-cargo-manifest` | §1 |
| *(no error text)* Edits under `wasm/src/` produce no hook output; `--structural` never runs | `dead-posttooluse-hook` | §2 |
| *(no error text)* `golden: FAIL` with a diff against `tests/golden/` | not a bug — read the diff before re-recording | §3 |
| `clippy::needless-range-loop` | `clippy-needless-range-loop` | §4 |
| `function … is never used` in `tests/common/mod.rs` | `shared-integration-test-dead-code` | §5 |
| `typescript-eslint does not support TS 7.0` when adding ESLint | not a bug — blocked upstream, see CLAUDE.md's frontend-test rule | — |
| A `missed` fault reports "is now caught -- a gap was closed", or the Preflight block is absent from the output | `mutation-false-pass-broken-gate` | §6 |
| *(no error text)* The benchmark panel's "NATIVE SPEED SAMPLE" runtime figure never changes when a different route is selected | `benchmark-panel-static-runtime` | §7 |
| *(no error text)* The benchmark panel's "SELECTED ROUTE" ring shows `—` after a city is chosen, while the runtime ring beside it updates | `benchmark-ring-null-after-city-change` | §8 |
| *(no error text)* Clicking a third city after a route is already complete overwrites one endpoint instead of starting a new route | `search-ui-third-click-no-rolling-restart` | §9 |
| *(no error text)* App loads pre-populated with Arad → Bucharest instead of a blank slate; a single city click searches against a stale/default city; no way to clear a selection | `search-ui-no-clean-slate-reset` | §10 |

## Step 2 — Apply the known fix

Read `docs/rootcause/<slug>.json` for the symptom, rootcause, and fix. Open
`docs/runbook.md` at the matching section and follow **Diagnose → Fix** exactly.

Report in this format and stop:

```
Pattern matched: <slug>
Root cause: <one sentence from the rootcause file>
Fix: <the specific change, with a snippet if useful>
Prevent: <the check that catches it, or why it cannot be caught>
```

## Step 3 — Near-miss check

Before treating an error as new, decide whether it is a variant of a known row — the same
rootcause in a different file or language. If so, apply that row's fix pattern and add a
note to the existing rootcause JSON rather than creating a second entry.

## Step 4 — Investigate, if genuinely new

### Phase A — gather facts from the code, not from the user

**Investigate autonomously before asking anything.** Ask the user only when the code
cannot answer the question.

1. Read the file and line named in the error
2. `git log --oneline -5` — what changed recently
3. `git diff HEAD~1` — what those changes were
4. Check the relevant config: `package.json`, `.github/workflows/ci.yml`,
   `scripts/verify_*.sh`, `wasm/Cargo.toml`
5. Grep the failing symbol across the repository

Then, if it is still unclear, branch on where it fails:

```
CI only     → compare the workflow's steps against what runs locally
local only  → check toolchain versions against rust-toolchain.toml, and `bin/` existing
both        → find the change that affected both
```

Stop Phase A once you have: the error category, the affected file, and what changed.

### Phase B — five whys, autonomously

No user questions in this phase. Investigate the code for each answer.

| Why | Probe | How to investigate |
|---|---|---|
| 1 | Why did this specific thing fail? | Read the failing file at the error line |
| 2 | Why did that happen? | Trace the call chain — read callers and dependencies |
| 3 | Why was it allowed to happen? | Look for the missing guard, check, or invariant |
| 4 | Why did no existing check catch it? | Read `scripts/verify_*.sh` and `ci.yml` |
| 5 | What condition lets it recur? | Look for the same pattern elsewhere — especially the other two language implementations |

Stop at five, or earlier once the root condition is clear. If the code cannot answer a
why, say what was found and what remains unknown rather than asking the user to fill it in.

### Phase C — close the loop

**A bug is not fixed until every box is ticked.** This is what makes the project learn.

- [ ] `docs/rootcause/<slug>.json` written — `symptom`, `rootcause`, `fix`,
      `recurrence_risk` filled, and `automation_gap` if it cannot be automated
- [ ] new row added to the signature table in this file
- [ ] new section added to `docs/runbook.md` — symptom → diagnose → fix → prevent
- [ ] check added to `scripts/verify_*.sh` so `/prevent` **and** CI both pick it up,
      **or** `automation_gap` explains why not
- [ ] `.claude/commands/prevent.md` updated if a new check category was added

> **The harness does not update itself.** Writing the rootcause, the row, and the runbook
> section is your responsibility. Adding the check is a code change you make. CI only ever
> runs what is already configured.

## Output format for a new bug

```
No match in the signature table — investigating.

Phase A findings:
  <what the code showed>

Phase B root condition:
  <what actually allows this>

Recorded:
  docs/rootcause/<slug>.json
  docs/runbook.md §<n>
  signature table row added
  check added to scripts/verify_<x>.sh   (or: automation_gap — <reason>)
```

## Invariant-specific hints

Failures in this project cluster around the five invariants in `CLAUDE.md`:

- **Parity failure (I2)** — a change made in one language and not the other two. Diff the
  three implementations around whatever the failing field is: a cost difference points at
  the road table, an explored-order difference at the relaxation condition or the counters.
  Note that a `(f, g, city)` → `(f, city, g)` tie-break swap does **not** trigger this —
  measured identical on all 800 combinations — so parity failures come from real outcome
  changes, not tie-break edits.
- **Admissibility or consistency failure (I3)** — the heuristic scale is wrong. Resistance
  must equal distance in km, so conductance is `1.0 / distance`.
- **Purity failure (I4)** — `Instant`, `println!` or `io::` reached engine code. It belongs
  in `bin/cli.rs`.
