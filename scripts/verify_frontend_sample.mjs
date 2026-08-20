import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sampleUrl = new URL("../public/data/arad-bucharest-search.json", import.meta.url);
const sample = JSON.parse(readFileSync(sampleUrl, "utf8"));
const resultKeys = [
  "cost",
  "expanded",
  "explored_order",
  "generated",
  "path",
  "peak_frontier",
  "peak_payload_bytes",
  "peak_records",
  "trace",
].sort();

assert.deepEqual(Object.keys(sample).sort(), ["astar", "ucs"], "sample must contain only UCS and A*");

for (const algorithm of ["ucs", "astar"]) {
  const result = sample[algorithm];
  assert.deepEqual(Object.keys(result).sort(), resultKeys, `${algorithm} result contract changed`);
  assert.equal(result.path[0], 0, `${algorithm} path must start at Arad`);
  assert.equal(result.path.at(-1), 12, `${algorithm} path must end at Bucharest`);
  assert.equal(result.cost, 418, `${algorithm} must keep the optimal route cost`);
  assert.equal(result.trace.length, result.expanded, `${algorithm} needs one trace frame per expansion`);
  assert.equal(result.explored_order.length, result.expanded, `${algorithm} explored count must match expanded`);

  result.trace.forEach((frame, index) => {
    assert.deepEqual(
      Object.keys(frame).sort(),
      ["discovered", "expanded_city", "expanded_cost", "frontier"],
      `${algorithm} frame ${index} contract changed`,
    );
    assert.equal(frame.expanded_city, result.explored_order[index], `${algorithm} frame ${index} has the wrong city`);
    assert.ok(Number.isFinite(frame.expanded_cost), `${algorithm} frame ${index} has an invalid cost`);
    assert.ok(Array.isArray(frame.frontier), `${algorithm} frame ${index} frontier must be an array`);
    assert.ok(Array.isArray(frame.discovered), `${algorithm} frame ${index} discovered must be an array`);

    for (const node of frame.frontier) {
      assert.ok(Number.isInteger(node.city) && node.city >= 0 && node.city < 20, "frontier city must be valid");
      assert.ok(Number.isFinite(node.cost) && Number.isFinite(node.priority), "frontier costs must be finite");
    }
    for (const node of frame.discovered) {
      assert.ok(Number.isInteger(node.city) && node.city >= 0 && node.city < 20, "discovered city must be valid");
      assert.ok(Number.isFinite(node.cost), "discovered cost must be finite");
      assert.ok(node.parent === null || Number.isInteger(node.parent), "discovered parent must be a city or null");
    }
  });

  assert.equal(result.trace.at(-1).expanded_city, 12, `${algorithm} final frame must expand Bucharest`);
}

assert.equal(sample.ucs.cost, sample.astar.cost, "UCS and A* costs must match");
console.log("frontend sample contract: PASS");
