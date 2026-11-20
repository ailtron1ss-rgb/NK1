import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { collectRelativeImportSpecifiers, collectRelativeTypeImportSpecifiers, stripComments } from "../scripts/import-specifier-scanner.mjs";

test("comment masking preserves quoted URLs and removes comment-only imports", () => {
  const source = [
    'const url = "https://example.test/path";',
    '// import "./line-comment.js"',
    '/* export { ignored } from "./block-comment.mjs"; */',
    'import "./real-entry.js";',
  ].join("\n");

  const stripped = stripComments(source);
  assert.match(stripped, /https:\/\/example\.test\/path/);
  assert.doesNotMatch(stripped, /line-comment\.js|block-comment\.mjs/);
  assert.deepEqual(collectRelativeImportSpecifiers(source), ["./real-entry.js"]);
});

test("scanner finds static, re-export, side-effect, dynamic and CommonJS imports", () => {
  const source = [
    'import value from "./value.js";',
    'export { shared } from "../shared/reexport.mjs";',
    'import "./polyfill.ts";',
    'const lazy = import("./lazy.js");',
    'const common = require("./legacy.cjs");',
    'import React from "react";',
  ].join("\n");

  assert.deepEqual(collectRelativeImportSpecifiers(source), [
    "./value.js",
    "../shared/reexport.mjs",
    "./polyfill.ts",
    "./lazy.js",
    "./legacy.cjs",
  ]);
});

test("scanner ignores import-like examples inside strings and regex literals", () => {
  const source = [
    "const fixture = 'import \"./fake-string.js\"';",
    "const pattern = /import\\s*\\([\"']\\.\\/fake-regex\\.js[\"']\\)/;",
    'import "./actual.js";',
  ].join("\n");

  assert.deepEqual(collectRelativeImportSpecifiers(source), ["./actual.js"]);
});

test("scanner separates TypeScript import-type queries from runtime imports", () => {
  const source = [
    "import type { StaticState } from './static-types.ts';",
    "export type { PublicShape } from '../shape-types.ts';",
    "type State = import('./state-types.ts').State;",
    "interface Context { memory?: import('../memory-types.ts').MemoryState; }",
    "const lazy = import('./runtime-module.ts').then(module => module.value);",
  ].join("\n");

  assert.deepEqual(collectRelativeImportSpecifiers(source), ["./runtime-module.ts"]);
  assert.deepEqual(collectRelativeTypeImportSpecifiers(source), [
    "./static-types.ts",
    "../shape-types.ts",
    "./state-types.ts",
    "../memory-types.ts",
  ]);
});

test("scanner de-duplicates repeated local import edges", () => {
  const source = [
    'import "./shared.js";',
    'const a = import("./shared.js");',
  ].join("\n");
  assert.deepEqual(collectRelativeImportSpecifiers(source), ["./shared.js"]);
});
test("scanner does not treat division as a regex or let comment quotes leak into later code", () => {
  const division = [
    "const ratio = numerator / denominator;",
    "const example = \"from './not-an-import.ts'\";",
  ].join("\n");
  assert.deepEqual(collectRelativeImportSpecifiers(division), []);

  const commentQuote = [
    "// it's fine; this quote must not open a string",
    "import value from './after-comment.ts';",
  ].join("\n");
  assert.deepEqual(collectRelativeImportSpecifiers(commentQuote), ["./after-comment.ts"]);
});

test("scanner handles the two real fixtures that previously created architecture false positives", async () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const runtimeFixture = resolve(packageRoot, "tests/world-perception-runtime-wiring.mjs");
  const avatarFixture = resolve(packageRoot, "../../app/scripts/avatar-motor-intent.test.mjs");
  assert.ok(existsSync(runtimeFixture), "runtime regression fixture must remain in the repository");
  assert.ok(existsSync(avatarFixture), "app regression fixture must remain in the repository");

  const runtimeSource = await readFile(runtimeFixture, "utf8");
  const avatarSource = await readFile(avatarFixture, "utf8");
  assert.deepEqual(
    collectRelativeImportSpecifiers(runtimeSource),
    [],
    "string examples in the world-perception wiring fixture must not become dependency edges",
  );

  const appSpecifiers = collectRelativeImportSpecifiers(avatarSource);
  assert.ok(appSpecifiers.includes("../src/components/avatar/motorIntent.ts"),
    "the avatar fixture's real app import must remain visible");
  assert.ok(appSpecifiers.includes("../../runtime/neuro-kurisu/public/live2d/embodiment-intent.mjs"),
    "the avatar fixture's real runtime contract import must remain visible");

  const resolveLocal = (sourceFile, specifier) => {
    const target = path.resolve(path.dirname(sourceFile), specifier);
    const candidates = [
      target,
      ...[".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"].map(ext => target + ext),
      path.join(target, "index.ts"),
      path.join(target, "index.tsx"),
    ];
    return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  };
  for (const specifier of appSpecifiers) {
    assert.ok(resolveLocal(avatarFixture, specifier), `real app import must resolve: ${specifier}`);
  }
});
