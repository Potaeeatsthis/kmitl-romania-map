// Verifies the committed per-pair native runtime data.
//
// Unlike verify_all_pairs.mjs, this does NOT assert.deepEqual the committed file
// against a freshly generated one -- timing is inherently non-deterministic run to
// run and machine to machine. Instead it checks structure and coverage on BOTH the
// committed file and a freshly generated one: schema, all 400 pairs present in
// row-major order with no duplicates, and every runtime value finite and positive.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const dataPath = "public/data/all-pairs-runtime.json";

function checkStructure(data, label) {
  assert.equal(data.schema_version, 1, `${label}: unexpected schema version`);
  assert.equal(data.city_count, 20, `${label}: the Romania graph must contain 20 cities`);
  assert.equal(data.pair_count, 400, `${label}: all 20 x 20 ordered pairs must be present`);
  assert.equal(data.pairs.length, 400, `${label}: pair data must cover every ordered pair`);

  const keys = new Set();
  for (const [index, pair] of data.pairs.entries()) {
    const expectedStart = Math.floor(index / data.city_count);
    const expectedGoal = index % data.city_count;
    assert.equal(pair.start, expectedStart, `${label}: pair ${index} is not in row-major start order`);
    assert.equal(pair.goal, expectedGoal, `${label}: pair ${index} is not in row-major goal order`);

    const key = `${pair.start}-${pair.goal}`;
    assert.equal(keys.has(key), false, `${label}: duplicate pair ${key}`);
    keys.add(key);

    for (const field of ["ucs_runtime_us", "astar_runtime_us"]) {
      const value = pair[field];
      assert.ok(Number.isFinite(value), `${label}: ${key} ${field} must be finite`);
      assert.ok(value > 0, `${label}: ${key} ${field} must be positive`);
    }
  }
  assert.equal(keys.size, 400, `${label}: all ordered pairs must be unique`);
}

const committed = JSON.parse(
  readFileSync(new URL(`../${dataPath}`, import.meta.url), "utf8"),
);
checkStructure(committed, "committed");

// --release matters here: unlike verify_all_pairs.mjs's structural data (identical
// regardless of optimization level), timing numbers from a debug build would not be
// representative, and the committed file was generated with --release.
const generated = JSON.parse(
  execFileSync(
    "cargo",
    [
      "run",
      "--release",
      "--quiet",
      "--manifest-path",
      "wasm/Cargo.toml",
      "--bin",
      "export_all_runtimes",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  ),
);
checkStructure(generated, "freshly generated");

console.log(
  "all-pairs runtime data: PASS (400/400 pairs, structure verified; " +
    "exact timing values are not compared -- they vary run to run)",
);
