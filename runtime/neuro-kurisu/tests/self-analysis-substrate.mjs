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
import {
  DEFAULT_POOL_POLICY,
  SelfImprovementCandidatePool,
} from '../src/organism/analysis/SelfImprovementCandidatePool.ts';

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
  { path: 'src/organism/analysis/ProxyDivergenceGuard.ts', text: 'export function evaluateProxyDivergence() {}\n' },
  { path: 'src/organism/analysis/SelfImprovementCandidatePool.ts', text: 'export class SelfImprovementCandidatePool {}\n' },
  { path: 'src/organism/system/CanonicalSelfAgencyAuthority.ts', text: 'export class CanonicalSelfAgencyAuthority {}\n' },
  { path: 'src/organism/language/KurisuCanonProfile.ts', text: 'export const KURISU_ORGANISM_CANON = {};\n' },
  { path: 'src/organism/core/OrganismCore.ts', text: 'export class OrganismCore {}\n' },
  { path: 'src/organism/core/OrganismRuntime.ts', text: 'export class OrganismRuntime {}\n' },
  { path: 'tests/self-analysis-substrate.mjs', text: '// self evaluator regression suite\n' },
  { path: 'tests/canonical-self-agency-authority.mjs', text: '// identity authority regression suite\n' },
  { path: 'package.json', text: '{ "scripts": {} }\n' },
  { path: 'runtime/neuro-kurisu/package-lock.json', text: '{}\n' },
  { path: 'contracts/progress-workstreams.json', text: '{}\n' },
  { path: 'tools/progress-report.mjs', text: '// progress scoring owner\n' },
  { path: 'tools/run-local-gate.mjs', text: '// verification runner\n' },
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

// The trust boundary must protect the scorer, candidate pool, canonical identity
// authority and the regression suites that constrain them—not only the outer guard.
for (const protectedPath of [
  'src/organism/analysis/ProxyDivergenceGuard.ts',
  'src/organism/analysis/SelfImprovementCandidatePool.ts',
  'src/organism/system/CanonicalSelfAgencyAuthority.ts',
  'src/organism/language/KurisuCanonProfile.ts',
  'src/organism/core/OrganismCore.ts',
  'src/organism/core/OrganismRuntime.ts',
  'tests/self-analysis-substrate.mjs',
  'tests/canonical-self-agency-authority.mjs',
  'package.json',
  'runtime/neuro-kurisu/package-lock.json',
  'contracts/progress-workstreams.json',
  'tools/progress-report.mjs',
  'tools/run-local-gate.mjs',
]) {
  const decision = evaluateModification({ candidateId: 'protect-trust-boundary', targetFiles: [protectedPath] }, guardGraph);
  assert.equal(decision.decision, 'refused', `self-modification must not edit trust-boundary file: ${protectedPath}`);
}

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

const accessorCandidate = { targetFiles: ['src/organism/cognition/NeutralThing.ts'] };
Object.defineProperty(accessorCandidate, 'candidateId', { get() { throw new Error('candidate getter must not execute'); } });
assert.equal(evaluateModification(accessorCandidate, guardGraph).decision, 'refused',
  'accessor-backed proposal fields must fail closed without invoking getters');
const accessorTargets = [];
Object.defineProperty(accessorTargets, '0', { get() { throw new Error('target getter must not execute'); }, configurable: true });
Object.defineProperty(accessorTargets, 'length', { value: 1 });
assert.equal(evaluateModification({ candidateId: 'accessor-target', targetFiles: accessorTargets }, guardGraph).decision, 'refused',
  'accessor-backed target entries must be refused');
assert.equal(evaluateModification({ candidateId: 'sparse-target', targetFiles: new Array(1) }, guardGraph).decision, 'refused',
  'sparse target arrays must be refused');
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
for (const owner of [
  'ProxyDivergenceGuard',
  'SelfImprovementCandidatePool',
  'CanonicalSelfAgencyAuthority',
  'KurisuCanonProfile',
  'OrganismCore',
  'OrganismRuntime',
]) {
  assert.ok(realProtected.some((f) => f.includes(owner)), `real source graph must protect ${owner}`);
}
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

// Malformed policy is an authorization failure, never a reason to skip thresholds.
for (const invalidPolicy of [
  { minPairs: Number.NaN, maxMeanDivergence: 0.15, maxInversionRate: 0.2 },
  { minPairs: 0, maxMeanDivergence: 0.15, maxInversionRate: 0.2 },
  { minPairs: 5, maxMeanDivergence: Number.NaN, maxInversionRate: 0.2 },
  { minPairs: 5, maxMeanDivergence: -0.1, maxInversionRate: 0.2 },
  { minPairs: 5, maxMeanDivergence: 0.15, maxInversionRate: 1.1 },
  Object.defineProperty({}, 'minPairs', { get() { throw new Error('untrusted policy getter'); } }),
]) {
  const invalid = evaluateProxyDivergence(five(0.3, 0.28), invalidPolicy);
  assert.equal(invalid.decision, 'refused', 'malformed divergence policy must fail closed');
  assert.equal(invalid.reason, 'invalid-divergence-policy');
}

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

// Duplicate family rows are ambiguous evidence. Exclude the family entirely rather
// than allowing last-write-wins to select whichever downstream result is favourable.
const duplicateFamilyObs = toDivergenceObservations(
  [
    { family: 'ambiguous', baselinePassRate: 0.1, candidatePassRate: 0.9 },
    { family: 'ambiguous', baselinePassRate: 0.1, candidatePassRate: 0.2 },
    { family: 'unique', baselinePassRate: 0.2, candidatePassRate: 0.4 },
  ],
  [
    { family: 'ambiguous', baselinePassRate: 0.1, candidatePassRate: 0.11 },
    { family: 'ambiguous', baselinePassRate: 0.1, candidatePassRate: 0.99 },
    { family: 'unique', baselinePassRate: 0.2, candidatePassRate: 0.38 },
  ],
);
assert.deepEqual(duplicateFamilyObs.map((o) => o.id), ['unique'],
  'duplicate families on either side must be excluded, not overwritten');
const arithmetic = adapterObs.find((o) => o.id === 'arithmetic');
assert.ok(Math.abs(arithmetic.proxyGain - 0.2) < 1e-9);
assert.ok(Math.abs(arithmetic.downstreamGain - 0.18) < 1e-9);

// The same real-ledger shape, with the proxy diverging hard, must refuse.
const divergingLedger = toDivergenceObservations(
  ['f1', 'f2', 'f3', 'f4', 'f5'].map((f) => ({ family: f, baselinePassRate: 0.2, candidatePassRate: 0.95 })),
  ['f1', 'f2', 'f3', 'f4', 'f5'].map((f) => ({ family: f, baselinePassRate: 0.2, candidatePassRate: 0.22 })),
);
assert.equal(evaluateProxyDivergence(divergingLedger).decision, 'refused');

// --- 8. self-improvement candidate pool: selection by measured downstream gain ---
const poolGraph = buildSourceGraph([
  { path: 'src/organism/cognition/Evolvable.ts', text: 'export function tune(x: number) { return x; }\n' },
  { path: 'src/organism/learning/VerifiedOutcomePromotionGate.ts', text: 'export class VerifiedOutcomePromotionGate {}\n' },
]);
const block = { file: 'src/organism/cognition/Evolvable.ts', startLine: 1, endLine: 1 };
const pool = new SelfImprovementCandidatePool({ maxPoolSize: 2 });
const backed = (n) => Array.from({ length: 5 }, (_, i) => ({ id: `p${n}-${i}`, proxyGain: 0.3, downstreamGain: 0.25 + n * 0.01 }));

// A legitimate candidate inside an evolve block is admitted.
const good = pool.submit({
  candidateId: 'good', targetFiles: [block.file], evolveBlocks: [block], observations: backed(1), rollbackReady: true,
}, poolGraph);
assert.equal(good.accepted, true, 'in-block, backed, reversible candidate must be admitted');
assert.equal(pool.size, 1);

// A candidate targeting a file with no evolve block is refused.
assert.equal(pool.submit({
  candidateId: 'no-block', targetFiles: ['src/organism/cognition/Evolvable.ts'], evolveBlocks: [],
  observations: backed(1), rollbackReady: true,
}, poolGraph).reason, 'target-outside-evolve-block:src/organism/cognition/Evolvable.ts');

// A candidate that would edit its own evaluator is refused even with a valid block.
assert.equal(pool.submit({
  candidateId: 'evaluator-edit',
  targetFiles: ['src/organism/learning/VerifiedOutcomePromotionGate.ts'],
  evolveBlocks: [{ file: 'src/organism/learning/VerifiedOutcomePromotionGate.ts', startLine: 1, endLine: 1 }],
  observations: backed(2), rollbackReady: true,
}, poolGraph).accepted, false, 'evaluator edit must be refused');

// A proxy-only candidate is refused at the divergence gate.
const poolProxyOnly = pool.submit({
  candidateId: 'proxy-only', targetFiles: [block.file], evolveBlocks: [block],
  observations: [0, 1, 2, 3, 4].map((i) => ({ id: `x${i}`, proxyGain: 0.9, downstreamGain: 0.01 })),
  rollbackReady: true,
}, poolGraph);
assert.equal(poolProxyOnly.accepted, false);
assert.match(poolProxyOnly.reason, /^divergence:/);

// No rollback path is never admitted.
assert.equal(pool.submit({
  candidateId: 'no-rollback', targetFiles: [block.file], evolveBlocks: [block], observations: backed(3), rollbackReady: false,
}, poolGraph).reason, 'no-rollback-path');

// Duplicate ids cannot inflate the pool.
assert.equal(pool.submit({
  candidateId: 'good', targetFiles: [block.file], evolveBlocks: [block], observations: backed(4), rollbackReady: true,
}, poolGraph).reason, 'duplicate-candidate-id');

// Malformed blocks are refused.
assert.equal(pool.submit({
  candidateId: 'bad-block', targetFiles: [block.file],
  evolveBlocks: [{ file: block.file, startLine: 5, endLine: 2 }], observations: backed(5), rollbackReady: true,
}, poolGraph).reason, 'malformed-evolve-block:src/organism/cognition/Evolvable.ts');

// Eviction keeps the pool bounded and keeps the strongest by downstream gain.
pool.submit({
  candidateId: 'stronger', targetFiles: [block.file], evolveBlocks: [block], observations: backed(9), rollbackReady: true,
}, poolGraph);
assert.equal(pool.size, 2, 'pool must honour maxPoolSize');
const ranked = pool.rank();
assert.equal(ranked[0].candidateId, 'stronger', 'strongest downstream gain must rank first');
assert.ok(ranked.every((r) => r.downstreamGain > 0));
assert.equal(DEFAULT_POOL_POLICY.maxPoolSize, 32);
assert.ok(Object.isFrozen(DEFAULT_POOL_POLICY), 'default pool policy must be immutable');
assert.ok(Object.isFrozen(DEFAULT_DIVERGENCE_POLICY), 'default divergence policy must be immutable');
assert.equal(pool.best().candidateId, 'stronger');

// Ranking must never use the proxy value: give a candidate a huge proxy, tiny downstream.
const rankPool = new SelfImprovementCandidatePool({ maxPoolSize: 4 });
rankPool.submit({
  candidateId: 'honest', targetFiles: [block.file], evolveBlocks: [block],
  observations: [0, 1, 2, 3, 4].map((i) => ({ id: `h${i}`, proxyGain: 0.36, downstreamGain: 0.35 })),
  rollbackReady: true,
}, poolGraph);
rankPool.submit({
  candidateId: 'flashy', targetFiles: [block.file], evolveBlocks: [block],
  observations: [0, 1, 2, 3, 4].map((i) => ({ id: `f${i}`, proxyGain: 0.4, downstreamGain: 0.3 })),
  rollbackReady: true,
}, poolGraph);
const honest = rankPool.rank().find((r) => r.candidateId === 'honest');
const flashy = rankPool.rank().find((r) => r.candidateId === 'flashy');
assert.ok(flashy.proxyGain > honest.proxyGain, 'flashy must have the higher proxy');
assert.ok(flashy.downstreamGain < honest.downstreamGain, 'flashy must have the lower downstream');
assert.equal(rankPool.rank()[0].candidateId, 'honest', 'ranking must follow downstream, not proxy');

// Candidate admission is an untrusted boundary: getters, sparse arrays and
// post-admission mutation must not change the stored candidate or run caller code.
let candidateGetterCalls = 0;
const getterCandidate = {
  candidateId: 'getter-candidate', targetFiles: [block.file], evolveBlocks: [block],
  observations: backed(2), rollbackReady: true,
};
Object.defineProperty(getterCandidate, 'observations', { get() { candidateGetterCalls++; throw new Error('getter must not run'); } });
assert.equal(pool.submit(getterCandidate, poolGraph).reason, 'malformed-observations');
assert.equal(candidateGetterCalls, 0, 'candidate accessors must never execute');
assert.equal(pool.submit({
  candidateId: 'sparse-candidate', targetFiles: new Array(1), evolveBlocks: [block],
  observations: backed(2), rollbackReady: true,
}, poolGraph).reason, 'malformed-target-files');

const immutablePool = new SelfImprovementCandidatePool({ maxPoolSize: 4 });
const mutableCandidate = {
  candidateId: 'immutable-id', targetFiles: [block.file], evolveBlocks: [block],
  observations: backed(3), rollbackReady: true, parentId: 'parent-original',
};
assert.equal(immutablePool.submit(mutableCandidate, poolGraph).accepted, true);
mutableCandidate.candidateId = 'mutated-id';
mutableCandidate.parentId = 'mutated-parent';
mutableCandidate.observations[0].downstreamGain = -1;
const immutableRank = immutablePool.best();
assert.equal(immutableRank.candidateId, 'immutable-id', 'post-admission candidate mutation must not alter its id');
assert.equal(immutableRank.parentId, 'parent-original', 'post-admission candidate mutation must not alter lineage');
assert.ok(immutableRank.downstreamGain > 0, 'post-admission candidate mutation must not alter measured gain');
assert.throws(() => new SelfImprovementCandidatePool({ maxPoolSize: 0 }), /candidate-pool-policy-invalid/);
assert.throws(() => new SelfImprovementCandidatePool({ minDownstreamGain: Number.NaN }), /candidate-pool-policy-invalid/);
let policyGetterCalls = 0;
const accessorPolicy = {};
Object.defineProperty(accessorPolicy, 'maxPoolSize', { get() { policyGetterCalls++; throw new Error('policy getter must not run'); } });
assert.throws(() => new SelfImprovementCandidatePool(accessorPolicy), /candidate-pool-policy-invalid/);
assert.equal(policyGetterCalls, 0, 'candidate-pool policy accessors must never execute');
let parentGetterCalls = 0;
const accessorParent = {
  candidateId: 'accessor-parent', targetFiles: [block.file], evolveBlocks: [block],
  observations: backed(4), rollbackReady: true,
};
Object.defineProperty(accessorParent, 'parentId', { get() { parentGetterCalls++; throw new Error('parent getter must not run'); } });
assert.equal(immutablePool.submit(accessorParent, poolGraph).reason, 'malformed-parent-id');
assert.equal(parentGetterCalls, 0, 'optional lineage accessors must never execute');

let observationGetterCalls = 0;
const getterObservation = { id: 'getter', downstreamGain: .2 };
Object.defineProperty(getterObservation, 'proxyGain', { get() { observationGetterCalls++; throw new Error('row getter must not run'); } });
assert.equal(evaluateProxyDivergence([getterObservation]).decision, 'refused');
assert.equal(observationGetterCalls, 0, 'observation accessors must never execute');
const sparseObservations = new Array(5);
assert.equal(evaluateProxyDivergence(sparseObservations).decision, 'refused');
const getterFamily = { baselinePassRate: .1, candidatePassRate: .2 };
Object.defineProperty(getterFamily, 'family', { get() { observationGetterCalls++; throw new Error('family getter must not run'); } });
assert.deepEqual(toDivergenceObservations([getterFamily], []), []);
assert.equal(observationGetterCalls, 0, 'adapter accessors must never execute');
assert.equal(immutablePool.snapshot().rejectionLedgerSize, 1);

console.log(
  'NK1_SELF_ANALYSIS_SUBSTRATE=PASS assertions=93 '
  + `realFiles=${realSummary.files} realNodes=${realSummary.nodes} realEdges=${realSummary.edges} `
  + `extracted=${realSummary.extractedEdges} inferred=${realSummary.inferredEdges} `
  + `protectedFiles=${realProtected.length} protectedFragments=${PROTECTED_CAPABILITY_FRAGMENTS.length}`,
);
