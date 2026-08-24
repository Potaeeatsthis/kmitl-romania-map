// Checks the static export is actually servable, which `next build` exiting 0 does not.
//
// The GitHub Pages failure mode is a build that succeeds and then 404s every asset:
// the site lives under /kmitl-romania-map, so a page whose script tags point at
// /_next/... instead of /kmitl-romania-map/_next/... is a blank screen with a clean
// build log. Nothing else in the harness looks at the built output at all.
//
// Three assertions, in the order they would fail:
//
//   1. out/index.html exists.
//   2. the wasm module is in the export. It is produced by wasm-pack into public/wasm/,
//      which is gitignored, so a build that skipped build:wasm still writes a perfectly
//      well-formed out/ -- with no engine in it.
//   3. every root-relative src/href carries the base path. This is the one that catches
//      next.config.ts and lib/wasm/client.ts disagreeing about NEXT_PUBLIC_BASE_PATH,
//      which is the whole reason they were collapsed onto one variable.
//
// Run via: npm run verify:export   (after npm run build)

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const OFF = "\x1b[0m";

let failed = false;
const pass = (msg) => console.log(`  ${GREEN}ok${OFF}   ${msg}`);
const bad = (msg, detail) => {
  console.log(`  ${RED}FAIL${OFF} ${msg}`);
  if (detail) for (const line of detail) console.log(`       ${line}`);
  failed = true;
};

function sizeOf(relative) {
  try {
    return statSync(new URL(relative, `file://${repo}`)).size;
  } catch {
    return null;
  }
}

// 1 -- the page itself
const indexSize = sizeOf("out/index.html");
if (indexSize === null) {
  bad("out/index.html is missing -- run npm run build first");
  console.log("\nexport: FAIL");
  process.exit(1);
}
pass(`out/index.html exists (${indexSize} bytes)`);

// 2 -- the engine
const WASM = "out/wasm/romania_search_bg.wasm";
const wasmSize = sizeOf(WASM);
if (wasmSize === null) {
  bad(`${WASM} is missing`, [
    "public/wasm/ is gitignored and produced by wasm-pack.",
    "A build that skipped `npm run build:wasm` exports a page with no engine.",
  ]);
} else if (wasmSize === 0) {
  bad(`${WASM} is empty`);
} else {
  pass(`${WASM} is present (${wasmSize} bytes)`);
}

// 3 -- the base path actually reached the output
const html = readFileSync(new URL("out/index.html", `file://${repo}`), "utf8");
const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);

if (refs.length === 0) {
  bad("out/index.html has no root-relative src/href at all -- did the build produce a real page?");
} else if (basePath === "") {
  const prefixed = refs.filter((r) => r.startsWith("/kmitl-romania-map/"));
  if (prefixed.length > 0) {
    bad("NEXT_PUBLIC_BASE_PATH is unset but the output is prefixed anyway", [
      "A hardcoded basePath has crept back into next.config.ts.",
      ...prefixed.slice(0, 5),
    ]);
  } else {
    pass(`${refs.length} root-relative references, none prefixed (NEXT_PUBLIC_BASE_PATH unset)`);
  }
} else {
  const unprefixed = refs.filter((r) => !r.startsWith(`${basePath}/`));
  if (unprefixed.length > 0) {
    bad(`${unprefixed.length} of ${refs.length} references are missing the ${basePath} prefix`, [
      "These 404 on GitHub Pages. next.config.ts and the build environment disagree.",
      ...unprefixed.slice(0, 5),
    ]);
  } else {
    pass(`all ${refs.length} root-relative references carry ${basePath}`);
  }
}

console.log(failed ? "\nexport: FAIL" : "\nexport: PASS");
process.exit(failed ? 1 : 0);
