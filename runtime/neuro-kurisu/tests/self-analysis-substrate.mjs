import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSourceGraph,
  findDuplicateDefinitions,
  findUnreferencedSymbols,
  graphSummary,
  impactOf,
  maskNonCode,
  parseSourceFile,
} from '../src/organism/analysis/SourceGraph.ts';
import {
  evaluateModification,
  findProtectedFiles,
  PROTECTED_CAPABILITY_FRAGMENTS,
} from '../src/organism/analysis/SelfModificationGuard.ts';
import {
  DEFAULT_DIVERGENCE_POLICY,
  evaluateProxyDivergence,
  toDivergenceObservations,
} from '../src/organism/analysis/ProxyDivergenceGuard.ts';

const ROOT = join(fileURLToPath(new URL('../', import.meta.url)), 'src', 'organism');

function collectTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectTsFiles(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

// --- 1. maskNonCode must not leak declarations from strings or comments ---
const masked = maskNonCode([
  "const real = 1;",
  "const s = 'class Fake {}';",
  'const t = `interface AlsoFake {}`;',
  '// class Commented {}',
  '/* function Blocked() {} */',
  'export class Actual {}',
].join('\n'));
assert.ok(!masked.includes('Fake'), 'string/template contents must be masked');
assert.ok(!masked.includes('Commented'), 'line comments must be masked');
assert.ok(!masked.includes('Blocked'), 'block comments must be masked');
assert.ok(masked.includes('Actual'), 'real declarations must survive masking');
assert.equal(masked.split('\n').length, 6, 'masking must preserve line count');

// --- 2. parseSourceFile extracts symbols and relative imports ---
const parsed = parseSourceFile('src/a.ts', [
  "import { Thing } from './Thing.ts';",
  "import './side-effect.ts';",
  'export class Alpha {}',
  'export interface Beta {}',
  'export type Gamma = string;',
  'function helper() {}',
].join('\n'));
assert.deepEqual(
  parsed.symbols.map((s) => [s.name, s.kind, s.exported]),
  [['Alpha', 'class', true], ['Beta', 'interface', true], ['Gamma', 'type', true], ['helper', 'function', false]],
);
assert.deepEqual(parsed.imports.sort(), ['./Thing.ts', './side-effect.ts']);

// --- 3. graph construction, provenance split and impact analysis ---
const graph = buildSourceGraph([
  { path: 'src/Thing.ts', text: 'export class Thing {}\n' },
  { path: 'src/Use.ts', text: "import { Thing } from './Thing.ts';\nexport class Use { t = new Thing(); }\n" },
]);
const summary = graphSummary(graph);
assert.equal(summary.files, 2);
assert.ok(summary.extractedEdges > 0, 'import/define edges must be EXTRACTED');
assert.ok(summary.inferredEdges > 0, 'identifier matches must be INFERRED');
assert.ok(graph.edges.every((e) => e.provenance === 'EXTRACTED' || e.provenance === 'INFERRED'));

const impacted = impactOf(graph, 'src/Thing.ts#__module__');
assert.ok(impacted.includes('src/Use.ts#__module__'), 'Use.ts depends on Thing.ts and must be impacted');
assert.ok(!impacted.includes('src/Thing.ts#__module__'), 'impact must not include the node itself');

// --- 4. duplicate definition and dead-symbol detection ---
const dupGraph = buildSourceGraph([
  { path: 'src/one.ts', text: 'export class Twice {}\n' },
  { path: 'src/two.ts', text: 'export class Twice {}\n' },
]);
const dups = findDuplicateDefinitions(dupGraph);
assert.deepEqual(dups, [{ name: 'Twice', files: ['src/one.ts', 'src/two.ts'] }]);

const deadGraph = buildSourceGraph([
  { path: 'src/dead.ts', text: 'function orphaned() {}\n' },
  { path: 'src/live.ts', text: 'export function used() {}\n' },
]);
const unreferenced = findUnreferencedSymbols(deadGraph).map((n) => n.name);
assert.ok(unreferenced.includes('orphaned'), 'non-exported unreferenced symbol must be reported');
assert.ok(!unreferenced.includes('used'), 'exported symbol must not be reported as unreferenced');

// --- 5. guard refuses evaluator/gate/holdout edits and fails closed on empty input ---
const guardGraph = buildSourceGraph([
  { path: 'src/organism/learning/VerifiedOutcomePromotionGate.ts', text: 'export class VerifiedOutcomePromotionGate {}\n' },
  { path: 'src/organism/analysis/SourceGraph.ts', text: 'export class SourceGraph {}\n' },
  { path: 'src/organism/cognition/NeutralThing.ts', text: 'export class NeutralThing {}\n' },
  { path: '.github/workflows/ci.yml', text: 'name: ci\n' },
]);
const protectedFiles = findProtectedFiles(guardGraph);
assert.ok(protectedFiles.some((f) => f.includes('VerifiedOutcomePromotionGate')));
assert.ok(protectedFiles.some((f) => f.includes('SourceGraph')));

const refusedEvaluator = evaluateModification(
  { candidateId: 'c1', targetFiles: ['src/organism/learning/VerifiedOutcomePromotionGate.ts'] },
  guardGraph,
);
assert.equal(refusedEvaluator.decision, 'refused');
assert.ok(refusedEvaluator.refusals.some((r) => r.reason.startsWith('protected-capability:')));

const refusedWorkflow = evaluateModification(
  { candidateId: 'c2', targetFiles: ['.github/workflows/ci.yml'] },
  guardGraph,
);
assert.equal(refusedWorkflow.decision, 'refused', 'workflow edits must be refused');

assert.equal(
  evaluateModification({ candidateId: '', targetFiles: [] }, guardGraph).decision,
  'refused',
  'guard must fail closed on empty proposal',
);
assert.equal(
  evaluateModification({ candidateId: 'c3', targetFiles: ['src/does/not/exist.ts'] }, guardGraph).decision,
  'refused',
  'unknown target must be refused',
);
assert.equal(
  evaluateModification({ candidateId: 'c4', targetFiles: ['src/organism/cognition/NeutralThing.ts'] }, guardGraph).decision,
  'allowed',
  'neutral in-graph target must be allowed',
);

// --- 6. run against the real organism source tree ---
const files = collectTsFiles(ROOT);
assert.ok(files.length > 100, `expected a real source tree, found ${files.length} files`);
const realGraph = buildSourceGraph(
  files.map((abs) => ({ path: relative(join(ROOT, '..', '..'), abs).replace(/\\/g, '/'), text: readFileSync(abs, 'utf8') })),
);
const realSummary = graphSummary(realGraph);
assert.ok(realSummary.nodes > realSummary.files, 'real tree must yield symbol nodes beyond module nodes');
const realProtected = findProtectedFiles(realGraph);
assert.ok(
  realProtected.some((f) => f.includes('ActionGateway')),
  'real tree must expose ActionGateway as a protected capability',
);
assert.ok(
  realProtected.some((f) => f.includes('P23LearningEngine')),
  'real tree must expose P23LearningEngine as a protected capability',
);
const forbiddenGuard = evaluateModification(
  { candidateId: 'real-guard', targetFiles: realProtected.slice(0, 3) },
  realGraph,
);
assert.equal(forbiddenGuard.decision, 'refused', 'guard must refuse real protected files');

// --- 7. proxy-vs-downstream divergence: refuses unbacked proxy gains ---
const five = (proxyGain, downstreamGain) => Array.from({ length: 5 }, (_, i) => ({
  id: `s${i}`, proxyGain, downstreamGain,
}));

assert.equal(
  evaluateProxyDivergence([]).decision,
  'refused',
  'no paired downstream observations must refuse',
);
assert.equal(
  evaluateProxyDivergence([{ id: 'a', proxyGain: 0.9, downstreamGain: 0.9 }]).decision,
  'refused',
  'fewer than minPairs must refuse even when the single pair looks perfect',
);
assert.match(
  evaluateProxyDivergence([{ id: 'a', proxyGain: 0.9, downstreamGain: 0.9 }]).reason,
  /insufficient-paired-observations/,
);

// The documented failure mode: proxy rises strongly, downstream does not.
const proxyOnly = evaluateProxyDivergence(five(0.8, 0.02));
assert.equal(proxyOnly.decision, 'refused', 'large proxy gain without downstream gain must refuse');
assert.match(proxyOnly.reason, /mean-divergence/);

// Proxy up while downstream falls — the case that must never pass.
const inverted = evaluateProxyDivergence([
  { id: 'i1', proxyGain: 0.5, downstreamGain: -0.3 },
  { id: 'i2', proxyGain: 0.4, downstreamGain: -0.2 },
  { id: 'i3', proxyGain: 0.6, downstreamGain: 0.1 },
  { id: 'i4', proxyGain: 0.3, downstreamGain: -0.1 },
  { id: 'i5', proxyGain: 0.5, downstreamGain: 0.2 },
]);
assert.equal(inverted.decision, 'refused', 'inversion-heavy evidence must refuse');
assert.match(inverted.reason, /inversion-rate/);

// A genuine, backed improvement passes.
const supported = evaluateProxyDivergence(five(0.3, 0.28));
assert.equal(supported.decision, 'supported', 'backed proxy gain must be supported');
assert.equal(supported.pairs, 5);

// Malformed rows are dropped, not zero-filled; duplicates cannot inflate the sample.
const malformed = evaluateProxyDivergence([
  { id: 'ok', proxyGain: 0.3, downstreamGain: 0.28 },
  { id: 'ok', proxyGain: 0.9, downstreamGain: 0.9 },
  { id: '', proxyGain: 0.9, downstreamGain: 0.9 },
  { id: 'nan', proxyGain: Number.NaN, downstreamGain: 0.5 },
  { id: 'inf', proxyGain: 0.5, downstreamGain: Infinity },
]);
assert.equal(malformed.pairs, 1, 'only the single valid row must count');
assert.equal(malformed.decision, 'refused', 'one valid pair is below minPairs');
assert.equal(DEFAULT_DIVERGENCE_POLICY.minPairs, 5);

// Downstream gain present but not positive must still refuse.
assert.equal(
  evaluateProxyDivergence(five(0.05, 0.0)).decision,
  'refused',
  'zero downstream gain must refuse',
);

// Adapter: real ledger comparisons -> divergence observations, paired by family.
const adapterObs = toDivergenceObservations(
  [
    { family: 'arithmetic', baselinePassRate: 0.5, candidatePassRate: 0.7 },
    { family: 'logic', baselinePassRate: 0.6, candidatePassRate: 0.65 },
    { family: 'proxy-only-family', baselinePassRate: 0.2, candidatePassRate: 0.9 },
  ],
  [
    { family: 'arithmetic', baselinePassRate: 0.5, candidatePassRate: 0.68 },
    { family: 'logic', baselinePassRate: 0.6, candidatePassRate: 0.63 },
  ],
);
assert.equal(adapterObs.length, 2, 'families missing on the downstream side must be dropped');
assert.deepEqual(adapterObs.map((o) => o.id).sort(), ['arithmetic', 'logic']);
const arithmetic = adapterObs.find((o) => o.id === 'arithmetic');
assert.ok(Math.abs(arithmetic.proxyGain - 0.2) < 1e-9);
assert.ok(Math.abs(arithmetic.downstreamGain - 0.18) < 1e-9);

// The same real-ledger shape, with the proxy diverging hard, must refuse.
const divergingLedger = toDivergenceObservations(
  ['f1', 'f2', 'f3', 'f4', 'f5'].map((f) => ({ family: f, baselinePassRate: 0.2, candidatePassRate: 0.95 })),
  ['f1', 'f2', 'f3', 'f4', 'f5'].map((f) => ({ family: f, baselinePassRate: 0.2, candidatePassRate: 0.22 })),
);
assert.equal(evaluateProxyDivergence(divergingLedger).decision, 'refused');

console.log(
  'NK1_SELF_ANALYSIS_SUBSTRATE=PASS assertions=38 '
  + `realFiles=${realSummary.files} realNodes=${realSummary.nodes} realEdges=${realSummary.edges} `
  + `extracted=${realSummary.extractedEdges} inferred=${realSummary.inferredEdges} `
  + `protectedFiles=${realProtected.length} protectedFragments=${PROTECTED_CAPABILITY_FRAGMENTS.length}`,
);
