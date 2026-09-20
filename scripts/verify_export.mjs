// Checks the static export is actually servable, which `next build` exiting 0 does not.
//
// The GitHub Pages failure mode is a build that succeeds and then 404s every asset:
// the site lives under /kmitl-romania-map, so a page whose script tags point at
// /_next/... instead of /kmitl-romania-map/_next/... is a blank screen with a clean
// build log. Nothing else in the harness looks at the built output at all.
//
// Five assertions, in the order they would fail:
//
//   1. out/index.html exists.
//   2. the wasm module is in the export. It is produced by wasm-pack into public/wasm/,
//      which is gitignored, so a build that skipped build:wasm still writes a perfectly
//      well-formed out/ -- with no engine in it.
//   3. every root-relative src/href carries the base path. This is the one that catches
//      next.config.ts and lib/wasm/client.ts disagreeing about NEXT_PUBLIC_BASE_PATH,
//      which is the whole reason they were collapsed onto one variable.
//   4. the theme-boot script resolves under the prefix. next/script does not rewrite
//      its src with basePath, so app/layout.tsx builds that URL by hand. It appears
//      both as a preload <link href> and inside the self.__next_s bootstrap array, and
//      both have to point at out/theme-boot.js.
//   5. every url() inside the exported CSS resolves to a file that shipped. The
//      @font-face url lives in CSS, which the src/href scan never sees; a hand-written
//      /fonts/... would 404 under Pages exactly the same way.
//
// Run via: npm run verify:export   (after npm run build)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

// Mirrors lib/basePath.ts normalizeBasePath. This file is plain Node and cannot import
// the TS helper, so the decode is repeated here; keep the two in step.
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const basePath =
  !rawBasePath || rawBasePath === "/"
    ? ""
    : (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`).replace(/\/+$/, "");

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

function sizeOf(relativePath) {
  try {
    return statSync(new URL(relativePath, `file://${repo}`)).size;
  } catch {
    return null;
  }
}

function exists(absolutePath) {
  try {
    statSync(absolutePath);
    return true;
  } catch {
    return false;
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

// 4 -- the theme script resolves under the prefix
const themeRefs = [...html.matchAll(/(["'])(\/[^"']*theme-boot\.js)\1/g)].map((m) => m[2]);
const expectedTheme = `${basePath}/theme-boot.js`;
const wrongTheme = [...new Set(themeRefs)].filter((r) => r !== expectedTheme);
if (themeRefs.length === 0) {
  bad("out/index.html never references theme-boot.js", [
    "The beforeInteractive theme script was renamed or removed, so the page",
    "would paint the default theme and flash on load.",
  ]);
} else if (wrongTheme.length > 0) {
  bad(`theme-boot.js is not referenced as ${expectedTheme}`, [
    "next/script does not rewrite its src with basePath; app/layout.tsx has to.",
    ...wrongTheme.slice(0, 5),
  ]);
} else if (sizeOf("out/theme-boot.js") === null) {
  bad("out/theme-boot.js is missing from the export");
} else {
  pass(`theme-boot.js is referenced as ${expectedTheme} and exported`);
}

// 5 -- every url() in the exported CSS resolves to a file that shipped
const cssRoot = join(repo, "out", "_next", "static");

function collectCss(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectCss(full));
    else if (entry.name.endsWith(".css")) files.push(full);
  }
  return files;
}

const cssFiles = exists(cssRoot) ? collectCss(cssRoot) : [];
const localCssRefs = [];
const missingCssRefs = [];
const unprefixedCssRefs = [];
for (const file of cssFiles) {
  const css = readFileSync(file, "utf8");
  const cssUrlPath = `/${relative(repo, file).split(sep).join("/")}`;
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const ref = match[2].trim();
    // Fragments are same-document SVG references; data: and http(s): are not files.
    if (ref.startsWith("#") || ref.startsWith("data:") || /^https?:\/\//.test(ref)) continue;
    localCssRefs.push(ref);
    if (ref.startsWith("/")) {
      if (basePath && !ref.startsWith(`${basePath}/`)) {
        unprefixedCssRefs.push(`${cssUrlPath}: ${ref}`);
      } else if (!exists(join(repo, "out", ref.slice(basePath.length)))) {
        missingCssRefs.push(`${cssUrlPath}: ${ref}`);
      }
    } else if (!exists(resolve(dirname(file), ref))) {
      // Relative urls (what next/font emits) are already base-path agnostic; they only
      // have to land on a file the build actually wrote.
      missingCssRefs.push(`${cssUrlPath}: ${ref}`);
    }
  }
}

if (cssFiles.length === 0) {
  bad("no exported CSS found under out/_next/static", [
    "The font @font-face lives in the CSS bundle; a missing bundle means no font.",
  ]);
} else if (localCssRefs.length === 0) {
  bad("the exported CSS has no local url() references", [
    "Expected at least the self-hosted Departure Mono @font-face.",
  ]);
} else if (unprefixedCssRefs.length > 0) {
  bad(`${unprefixedCssRefs.length} CSS url() references are missing the ${basePath} prefix`, [
    "These 404 on GitHub Pages. Prefer next/font/local over a hand-written url().",
    ...unprefixedCssRefs.slice(0, 5),
  ]);
} else if (missingCssRefs.length > 0) {
  bad(`${missingCssRefs.length} CSS url() references do not resolve to an exported file`, [
    "The stylesheet points at an asset the build did not emit.",
    ...missingCssRefs.slice(0, 5),
  ]);
} else {
  pass(`all ${localCssRefs.length} CSS url() references resolve`);
}

console.log(failed ? "\nexport: FAIL" : "\nexport: PASS");
process.exit(failed ? 1 : 0);
