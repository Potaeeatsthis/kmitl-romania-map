// Verifies public/data/benchmark-results.json against a fresh in-memory
// regeneration from the committed, verified public/data/all-pairs-search.json.
//
// Unlike the all-pairs runtime gate, this file is fully deterministic: every
// field is derived from the committed structural dataset, so an exact diff is
// meaningful and catches silent staleness (CLAUDE.md notes this was the one
// committed data file with no gate).
//
// Run via: npm run verify:benchmark

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildBenchmarkResults,
  serializeBenchmarkResults,
} from "./lib/benchmark_results.mjs";

const sourcePath = "public/data/all-pairs-search.json";
const dataPath = "public/data/benchmark-results.json";

const allPairs = JSON.parse(
  readFileSync(new URL(`../${sourcePath}`, import.meta.url), "utf8"),
);
const committed = readFileSync(new URL(`../${dataPath}`, import.meta.url), "utf8");
const expected = serializeBenchmarkResults(buildBenchmarkResults(allPairs));

if (committed !== expected) {
  console.error(
    `${dataPath} is stale or was hand-edited. Regenerate it with:\n` +
      `  npm run generate:benchmark\n` +
      `(derived from ${sourcePath}; runtime is intentionally excluded)`,
  );
  process.exit(1);
}

console.log(`${dataPath}: PASS (matches a fresh aggregate of ${sourcePath})`);
