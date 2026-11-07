import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const runtimeRoot = path.resolve(kitRoot, '..');
const entry = 'src/organism/core/OrganismRuntime.ts';
const IMPORT_RE = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.mts`, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.js')];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return candidates[0];
}

export async function auditImportGraph({ root = runtimeRoot, entrypoint = entry } = {}) {
  const absoluteRoot = path.resolve(root);
  const start = path.resolve(absoluteRoot, entrypoint);
  const visited = new Set();
  const missing = [];
  const escapes = [];
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    let source;
    try { source = await readFile(current, 'utf8'); }
    catch { missing.push(path.relative(absoluteRoot, current)); continue; }
    IMPORT_RE.lastIndex = 0;
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const resolved = await resolveLocal(current, specifier);
      if (!resolved || !(await exists(resolved))) {
        missing.push(`${path.relative(absoluteRoot, current)} -> ${specifier}`);
        continue;
      }
      const relative = path.relative(absoluteRoot, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        escapes.push(`${path.relative(absoluteRoot, current)} -> ${specifier}`);
        continue;
      }
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  const report = {
    schemaVersion: 1,
    audit: 'nk1-runtime-static-import-graph',
    entrypoint,
    reachableLocalFiles: visited.size,
    missingLocalImports: [...new Set(missing)].sort(),
    importsEscapingRuntimeRoot: [...new Set(escapes)].sort(),
    pass: missing.length === 0 && escapes.length === 0,
    limitations: ['Static ESM import graph only; computed dynamic imports and runtime plugin loading are not fully represented.', 'Reachability is not proof of semantic influence or useful behavior.'],
  };
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await auditImportGraph();
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}
