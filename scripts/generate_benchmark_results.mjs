// Regenerates public/data/benchmark-results.json from the committed, verified
// public/data/all-pairs-search.json. Run via: npm run generate:benchmark
//
// The output is deterministic, so `npm run verify:benchmark` can fail on any drift.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildBenchmarkResults,
  serializeBenchmarkResults,
} from "./lib/benchmark_results.mjs";

const sourcePath = "public/data/all-pairs-search.json";
const outputPath = "public/data/benchmark-results.json";

const allPairs = JSON.parse(
  readFileSync(new URL(`../${sourcePath}`, import.meta.url), "utf8"),
);
const output = serializeBenchmarkResults(buildBenchmarkResults(allPairs));
writeFileSync(new URL(`../${outputPath}`, import.meta.url), output);

console.log(`wrote ${outputPath} from ${sourcePath} (${output.length} bytes)`);
