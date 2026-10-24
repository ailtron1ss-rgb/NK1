import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const entry = path.join(packageRoot, "src/server/server.mjs");
const extensions = [".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".json"];
const indexFiles = extensions.map(extension => path.join("index" + extension));
const graph = new Map();
const unresolved = [];
const queue = [entry];
const visited = new Set();
const sourceExtension = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx)$/i;

function resolveImport(importer, specifier) {
  // Query/hash suffixes are loader metadata, not part of the filesystem path.
  const clean = String(specifier).split(/[?#]/, 1)[0];
  const base = path.resolve(path.dirname(importer), clean);
  const candidates = [
    base,
    ...extensions.map(extension => base + extension),
    ...indexFiles.map(file => path.join(base, file)),
  ];

  // NodeNext TypeScript code can import "./module.js" while the checkout
  // contains "./module.ts". Resolve those source counterparts explicitly.
  const emittedSuffix = base.match(/\.(mjs|cjs|js|jsx)$/i)?.[0];
  if (emittedSuffix) {
    const stem = base.slice(0, -emittedSuffix.length);
    candidates.push(stem + ".ts", stem + ".tsx", stem + ".mts", stem + ".cts");
  }

  return candidates.find(candidate => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function stripComments(source) {
  const blank = (match) => match.replace(/[^\r\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[ \t])\/\/[^\r\n]*/gm, blank);
}

function collectRelativeSpecifiers(source) {
  // Covers static imports, re-exports, literal dynamic imports and literal
  // CommonJS requires. Bare package imports are intentionally not traversed.
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g;
  const result = new Set();
  for (const match of stripComments(source).matchAll(pattern)) {
    const specifier = match[1];
    if (specifier.startsWith(".")) result.add(specifier);
  }
  return [...result];
}

while (queue.length > 0) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    unresolved.push({
      importer: path.relative(packageRoot, file),
      specifier: "<entry>",
      reason: "entry or dependency is not a file",
    });
    continue;
  }

  // Assets and JSON may be legitimate local imports, but their contents are
  // not JavaScript modules and must not be parsed as source code.
  if (!sourceExtension.test(file)) {
    graph.set(file, []);
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  const edges = [];
  for (const specifier of collectRelativeSpecifiers(source)) {
    const resolved = resolveImport(file, specifier);
    if (!resolved) {
      unresolved.push({
        importer: path.relative(packageRoot, file),
        specifier,
        reason: "relative import did not resolve to a local file",
      });
      continue;
    }
    edges.push(resolved);
    if (!visited.has(resolved)) queue.push(resolved);
  }
  graph.set(file, edges);
}

const edgeCount = [...graph.values()].reduce((total, edges) => total + edges.length, 0);
const report = {
  check: "server-transitive-relative-imports",
  entry: path.relative(packageRoot, entry),
  checkedFiles: visited.size,
  checkedEdges: edgeCount,
  unresolvedCount: unresolved.length,
  unresolved: unresolved.slice(0, 50),
  truncated: unresolved.length > 50,
};
console.log(JSON.stringify(report, null, 2));

if (unresolved.length) {
  console.error("AUDIT_SERVER_IMPORTS=FAIL");
  process.exitCode = 1;
} else {
  console.log("AUDIT_SERVER_IMPORTS=PASS");
}
