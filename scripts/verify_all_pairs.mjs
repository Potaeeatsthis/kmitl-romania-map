// Verifies the committed all-pairs search data against the Rust engine.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const dataPath = "public/data/all-pairs-search.json";
const committed = JSON.parse(
  readFileSync(new URL(`../${dataPath}`, import.meta.url), "utf8"),
);
const generated = JSON.parse(
  execFileSync(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "wasm/Cargo.toml",
      "--bin",
      "export_all_pairs",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  ),
);

assert.deepEqual(
  committed,
  generated,
  `${dataPath} is stale. Regenerate it with:\n` +
    `cargo run --quiet --manifest-path wasm/Cargo.toml --bin export_all_pairs > ${dataPath}`,
);
assert.equal(committed.schema_version, 1, "unexpected all-pairs schema version");
assert.equal(committed.city_count, 20, "the Romania graph must contain 20 cities");
assert.equal(committed.pair_count, 400, "all 20 x 20 ordered pairs must be present");
assert.equal(committed.includes_same_city_pairs, true, "same-city pairs must be included");
assert.equal(committed.cities.length, 20, "city metadata must cover every city");
assert.equal(committed.pairs.length, 400, "pair data must cover every ordered pair");

const keys = new Set();
for (const [index, pair] of committed.pairs.entries()) {
  const expectedStart = Math.floor(index / committed.city_count);
  const expectedGoal = index % committed.city_count;
  assert.equal(pair.start, expectedStart, `pair ${index} is not in row-major start order`);
  assert.equal(pair.goal, expectedGoal, `pair ${index} is not in row-major goal order`);

  const key = `${pair.start}-${pair.goal}`;
  assert.equal(keys.has(key), false, `duplicate pair ${key}`);
  keys.add(key);

  for (const algorithm of ["ucs", "astar"]) {
    const result = pair[algorithm];
    assert.equal(result.path[0], pair.start, `${key} ${algorithm} has the wrong path start`);
    assert.equal(result.path.at(-1), pair.goal, `${key} ${algorithm} has the wrong path goal`);
    assert.equal(result.trace.length, result.expanded, `${key} ${algorithm} trace is incomplete`);
    assert.equal(
      result.explored_order.length,
      result.expanded,
      `${key} ${algorithm} explored order is incomplete`,
    );
    assert.equal(
      result.trace.at(-1).expanded_city,
      pair.goal,
      `${key} ${algorithm} final frame expands the wrong city`,
    );
  }

  assert.equal(pair.ucs.cost, pair.astar.cost, `${key} algorithms disagree on path cost`);
  if (pair.start === pair.goal) {
    assert.deepEqual(pair.ucs.path, [pair.start], `${key} UCS same-city path is invalid`);
    assert.deepEqual(pair.astar.path, [pair.start], `${key} A* same-city path is invalid`);
    assert.equal(pair.ucs.cost, 0, `${key} same-city cost must be zero`);
  }
}

assert.equal(keys.size, 400, "all ordered pairs must be unique");
console.log("all-pairs search data: PASS (400/400 pairs)");
