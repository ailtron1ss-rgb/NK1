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

function resolveImport(importer, specifier) {
  // Keep resolution local to the importing file. Query/hash suffixes are not
  // filesystem paths and are removed before trying the normal JS/TS candidates.
  const clean = String(specifier).split(/[?#]/, 1)[0];
  const base = path.resolve(path.dirname(importer), clean);
  const candidates = [
    base,
    ...extensions.map(extension => base + extension),
    ...indexFiles.map(file => path.join(base, file)),
  ];
  return candidates.find(candidate => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function collectRelativeSpecifiers(source) {
  // Covers static imports, re-exports, literal dynamic imports and literal
  // CommonJS requires. Bare package imports are intentionally not traversed.
  const pattern = /(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?|\\brequire\\s*\\(\\s*)["']([^"']+)["']/g;
  const result = new Set();
  for (const match of source.matchAll(pattern)) {
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
    unresolved.push({ importer: path.relative(packageRoot, file), specifier: "<entry>", reason: "entry or dependency is not a file" });
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
