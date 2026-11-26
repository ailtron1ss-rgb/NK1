/**
 * Runtime wiring census.
 *
 * Answers one question mechanically: which canonical runtime modules are never
 * reached from a runtime entrypoint (OrganismCore / OrganismSystemFabric /
 * organism index / server entry)? A module that no entrypoint imports is not a
 * connected capability, whatever its test coverage or documentation claims.
 *
 * The census follows only relative imports of project sources, so it cannot be
 * confused by package imports, type-only re-exports or generated drafts. It
 * never edits files and never promotes anything.
 *
 * Usage:
 *   node scripts/audit-runtime-wiring.mjs                     # human summary
 *   node scripts/audit-runtime-wiring.mjs --json              # JSON only
 *   node scripts/audit-runtime-wiring.mjs --strict            # exit 1 on any orphan
 *   node scripts/audit-runtime-wiring.mjs --strict \\
 *        --baseline scripts/runtime-wiring-baseline.json      # exit 1 on NEW orphans
 *   node scripts/audit-runtime-wiring.mjs \\
 *        --write-baseline scripts/runtime-wiring-baseline.json # refresh the known-orphan set
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const srcRoot = path.join(root, 'src');

const ENTRYPOINTS = [
  'organism/core/OrganismCore.ts',
  'organism/core/OrganismSystemFabric.ts',
  'organism/index.ts',
  'server/server.mjs',
];

/** Directories whose modules are meant to be reached from the runtime. */
const CANONICAL_DIRS = [
  'organism/core',
  'organism/developmental',
  'organism/cognition',
  'organism/cognition/evolution',
  'organism/learning',
  'organism/memory',
  'organism/system',
  'organism/world',
  'organism/body',
  'organism/research',
  'organism/integration',
];

/** Modules that are entry surfaces or pure type/contract files by design. */
const STRUCTURAL_ALLOWLIST = new Set([
  'organism/index.ts',
  'organism/core/OrganismCore.ts',
  'organism/core/OrganismSystemFabric.ts',
  'organism/core/types.ts',
  'server/server.mjs',
]);

const IMPORT_RE = /(?:^|\\n)\\s*(?:import|export)\\s+(?:type\\s+)?[^;\\n]*?from\\s+['"](\\.[^'"]+)['"]/g;
const BARE_IMPORT_RE = /(?:^|\\n)\\s*import\\s+['"](\\.[^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\\(\\s*['"](\\.[^"']+)['"]\\s*\\)/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveSpecifier(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`,
    path.join(base, 'index.ts'), path.join(base, 'index.mjs')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && /\\.(ts|tsx|mjs|js)$/.test(candidate)) return candidate;
  }
  return null;
}

function importsOf(file) {
  const text = readFileSync(file, 'utf8');
  const specifiers = new Set();
  for (const re of [IMPORT_RE, BARE_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text))) specifiers.add(match[1]);
  }
  const resolved = [];
  for (const specifier of specifiers) {
    const target = resolveSpecifier(file, specifier);
    if (target) resolved.push(target);
  }
  return resolved;
}

const allFiles = walk(srcRoot);
const graph = new Map(allFiles.map(file => [file, importsOf(file)]));

const missingEntrypoints = [];
const reachable = new Set();
const queue = [];
for (const relative of ENTRYPOINTS) {
  const entry = path.join(srcRoot, relative);
  if (!existsSync(entry)) {
    missingEntrypoints.push(relative);
    continue;
  }
  reachable.add(entry);
  queue.push(entry);
}
while (queue.length) {
  const file = queue.shift();
  for (const target of graph.get(file) ?? []) {
    if (reachable.has(target)) continue;
    reachable.add(target);
    queue.push(target);
  }
}

const canonicalFiles = allFiles.filter(file => {
  const relative = path.relative(srcRoot, file).split(path.sep).join('/');
  if (!/\\.tsx?$/.test(relative)) return false;
  if (STRUCTURAL_ALLOWLIST.has(relative)) return false;
  return CANONICAL_DIRS.some(dir => relative.startsWith(`${dir}/`));
});

const orphans = canonicalFiles
  .filter(file => !reachable.has(file))
  .map(file => path.relative(srcRoot, file).split(path.sep).join('/'))
  .sort();

const canonicalCount = canonicalFiles.length;
const connectedCount = canonicalCount - orphans.length;

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  entrypoints: ENTRYPOINTS,
  missingEntrypoints,
  sourceFiles: allFiles.length,
  reachableModules: reachable.size,
  canonicalModules: canonicalCount,
  connectedModules: connectedCount,
  orphanModules: orphans.length,
  connectionRatio01: canonicalCount === 0 ? 0 : Number((connectedCount / canonicalCount).toFixed(4)),
  orphans,
};

const argv = process.argv.slice(2);
const args = new Set(argv);
const argValue = name => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const baselinePath = argValue('--baseline') ?? argValue('--write-baseline');
let newOrphans = [];
let resolvedOrphans = [];
if (baselinePath) {
  if (args.has('--write-baseline')) {
    writeFileSync(path.resolve(root, baselinePath), `${JSON.stringify({ version: 1, note: 'Known unconnected canonical modules; shrink this list, never grow it.', orphans }, null, 2)}\\n`);
    console.log(`WIRING_BASELINE_WRITTEN=${baselinePath} orphans=${orphans.length}`);
  } else {
    const baselineFile = path.resolve(root, baselinePath);
    if (!existsSync(baselineFile)) {
      console.log(`WIRING_BASELINE_MISSING=${baselinePath}`);
      process.exit(1);
    }
    const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
    const known = new Set(Array.isArray(baseline.orphans) ? baseline.orphans : []);
    newOrphans = orphans.filter(orphan => !known.has(orphan));
    resolvedOrphans = [...known].filter(orphan => !orphans.includes(orphan)).sort();
    report.knownOrphans = known.size;
    report.newOrphans = newOrphans;
    report.resolvedOrphans = resolvedOrphans;
  }
}

if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const verdict = baselinePath && !args.has('--write-baseline') ? (newOrphans.length === 0 ? 'PASS' : 'FAIL') : (orphans.length === 0 ? 'PASS' : 'FAIL');
  console.log(
    `RUNTIME_WIRING=${verdict} ` +
      `canonicalModules=${canonicalCount} connected=${connectedCount} orphans=${orphans.length} ` +
      `connectionRatio01=${report.connectionRatio01} entrypoints=${ENTRYPOINTS.length - missingEntrypoints.length}/${ENTRYPOINTS.length}`,
  );
  if (missingEntrypoints.length) console.log(`MISSING_ENTRYPOINTS=${missingEntrypoints.join(',')}`);
  for (const orphan of (newOrphans.length ? newOrphans : orphans).slice(0, 40)) console.log(`ORPHAN=${orphan}`);
  if (orphans.length > 40 && !newOrphans.length) console.log(`ORPHAN_TRUNCATED=${orphans.length - 40}`);
  if (baselinePath && !args.has('--write-baseline')) {
    console.log(`WIRING_NEW_ORPHANS=${newOrphans.length} WIRING_RESOLVED=${resolvedOrphans.length}`);
    for (const orphan of resolvedOrphans) console.log(`RESOLVED=${orphan}`);
  }
}
if (args.has('--write-baseline')) process.exit(0);
if (args.has('--strict')) {
  const failing = baselinePath ? newOrphans.length : orphans.length;
  if (failing > 0) {
    console.log(`RUNTIME_WIRING_STRICT=FAIL newOrphans=${failing}`);
    process.exit(1);
  }
  console.log('RUNTIME_WIRING_STRICT=PASS');
}
