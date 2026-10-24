import assert from "node:assert/strict";
import test from "node:test";
import { collectRelativeImportSpecifiers, stripComments } from "../scripts/import-specifier-scanner.mjs";

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

test("scanner de-duplicates repeated local import edges", () => {
  const source = [
    'import "./shared.js";',
    'const a = import("./shared.js");',
  ].join("\n");
  assert.deepEqual(collectRelativeImportSpecifiers(source), ["./shared.js"]);
});
