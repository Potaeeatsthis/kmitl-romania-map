# Rootcause cache

One JSON file per bug, written **before** the fix is applied. This is the project's
memory: `/diagnose` reads these to match an error against a bug already solved, instead
of investigating it a second time.

A file here means *we actually hit this*. Do not pre-populate it with bugs that might
happen — an entry that was never observed is noise, and it makes the signature table
less trustworthy.

## Format

```json
{
  "id": "short-kebab-slug",
  "date": "YYYY-MM-DD",
  "symptom": "What went wrong, from the user or test perspective",
  "rootcause": "Why it happened — the actual technical reason, not the surface error",
  "fix": "What was changed to resolve it",
  "recurrence_risk": "low | medium | high",
  "invariant": "I1 | I2 | I3 | I4 | I5 | null",
  "automation_gap": "Optional — if CI cannot catch this, explain why",
  "tags": ["cargo", "wasm", "parity", "heuristic", "..."]
}
```

`invariant` links the bug to the rules in `CLAUDE.md` when one applies. A bug that breaks
an invariant with no check behind it means the check is missing — add it to
`scripts/verify_*.sh`, which is where both `/prevent` and CI pick it up.

## Naming

`<slug>.json`, short and descriptive. The slug is what appears in the `/diagnose`
signature table, so it should read as the name of the problem.

## Closing the loop

Writing this file is step 1 of four. See "Bug loop protocol" in `CLAUDE.md` — the entry is
not finished until the signature row, the runbook section, and the automated check (or a
filled `automation_gap`) all exist.
