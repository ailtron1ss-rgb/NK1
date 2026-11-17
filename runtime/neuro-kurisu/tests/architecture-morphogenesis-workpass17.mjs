import assert from 'node:assert/strict';

const engine = await import('../src/organism/system/ArchitectureMorphogenesisEngine.ts').catch(() => null);
assert.ok(engine, 'Architecture Morphogenesis must expose a real architecture-control engine');

const {
  buildLiveArchitectureMorphogenesisGraph,
  validateArchitectureMorphogenesisGraph,
  createArchitectureMorphogenesisPlan,
  evaluateArchitectureMorphogenesisPlan,
  computeArchitectureGraphDigest,
} = engine;

for (const [name, value] of Object.entries({
  buildLiveArchitectureMorphogenesisGraph,
  validateArchitectureMorphogenesisGraph,
  createArchitectureMorphogenesisPlan,
  evaluateArchitectureMorphogenesisPlan,
  computeArchitectureGraphDigest,
})) assert.equal(typeof value, 'function', name + ' must be exported');

const live = buildLiveArchitectureMorphogenesisGraph();
const liveReport = validateArchitectureMorphogenesisGraph(live);
assert.equal(liveReport.ok, true, JSON.stringify(liveReport));
assert.ok(live.modules.length >= 12, 'live graph must cover the existing cognitive architecture map');
assert.ok(live.contracts.length >= 6, 'single-owner architecture authorities must be represented as contracts');
assert.match(live.canonicalGenomeDigest, /^sha256:[a-f0-9]{64}$/);
assert.ok(live.edges.some(edge => edge.kind === 'data-flow'), 'live graph must preserve typed data flows');
assert.ok(live.edges.some(edge => edge.kind === 'contract'), 'live graph must expose dependency/contract edges');

const digest = letter => 'sha256:' + letter.repeat(64);
const moduleRecord = (id, path, hash) => ({
  id,
  path,
  owner: 'owner:' + id,
  revisionSha256: digest(hash),
});
const graph = (modules, edges = [], contracts = []) => ({
  schemaVersion: 1,
  canonicalGenomeDigest: digest('0'),
  modules,
  edges,
  contracts,
});
const sha = '1'.repeat(40);
const migration = (changed = []) => ({
  checkpoint: {
    id: 'checkpoint-1',
    baselineCommit: sha,
    reference: 'artifact://checkpoint/base',
    description: 'Restorable baseline snapshot for candidate comparison',
  },
  steps: [{ id: 'migrate-1', description: 'Apply the staged structural migration', verify: 'Run the focused contract suite' }],
  rollbackSteps: [{ id: 'rollback-1', description: 'Restore the captured baseline', verify: 'Re-run baseline contract and architecture audits' }],
  affectedContractIds: changed,
});
const proposal = (baselineGraph, candidateGraph, operations, changed = []) => createArchitectureMorphogenesisPlan({
  baselineCommit: sha,
  candidateBranch: 'aspect/morphogenesis-architecture-20261117',
  baselineGraph,
  candidateGraph,
  operations,
  migrationPlan: migration(changed),
});

const alpha = moduleRecord('alpha', 'src/organism/system/Alpha.ts', 'a');
const beta = moduleRecord('beta', 'src/organism/system/Beta.ts', 'b');
const consumer = moduleRecord('consumer', 'src/organism/core/Consumer.ts', 'c');

// Merge: two old modules are replaced by one explicitly identified target.
const mergeBase = graph(
  [alpha, beta, consumer],
  [
    { from: 'alpha', to: 'beta', kind: 'contract' },
    { from: 'alpha', to: 'consumer', kind: 'contract' },
  ],
  [{ id: 'shared-contract', ownerModuleId: 'alpha', consumerModuleIds: ['beta', 'consumer'], authority: 'single-owner' }],
);
const merged = moduleRecord('merged', 'src/organism/system/Merged.ts', 'd');
const mergeCandidate = graph(
  [merged, consumer],
  [{ from: 'merged', to: 'consumer', kind: 'contract' }],
  [{ id: 'shared-contract', ownerModuleId: 'merged', consumerModuleIds: ['consumer'], authority: 'single-owner' }],
);
const mergePlan = proposal(mergeBase, mergeCandidate, [{
  kind: 'merge', sourceModuleIds: ['alpha', 'beta'], targetModuleId: 'merged',
  rationale: 'Collapse duplicated responsibilities behind one explicit owner',
}], ['shared-contract']);
assert.equal(mergePlan.status, 'READY_FOR_REVIEW', JSON.stringify(mergePlan.issues));
assert.equal(mergePlan.activation, 'NOT_APPLIED');
assert.equal(mergePlan.diff.removedModuleIds.length, 2);
assert.deepEqual(mergePlan.diff.addedModuleIds, ['merged']);

// Split: a composite module is replaced by two separately owned modules.
const splitBase = graph([alpha, consumer]);
const left = moduleRecord('alpha-left', 'src/organism/system/AlphaLeft.ts', 'd');
const right = moduleRecord('alpha-right', 'src/organism/system/AlphaRight.ts', 'e');
const splitCandidate = graph([left, right, consumer]);
const splitPlan = proposal(splitBase, splitCandidate, [{
  kind: 'split', sourceModuleId: 'alpha', targetModuleIds: ['alpha-left', 'alpha-right'],
  rationale: 'Separate parsing from policy ownership',
}]);
assert.equal(splitPlan.status, 'READY_FOR_REVIEW', JSON.stringify(splitPlan.issues));

// Move: identity is preserved while the canonical path changes.
const moved = moduleRecord('alpha', 'src/organism/learning/Alpha.ts', 'a');
const movePlan = proposal(graph([alpha]), graph([moved]), [{
  kind: 'move', moduleId: 'alpha', fromPath: alpha.path, toPath: moved.path,
  rationale: 'Move the module to its canonical ownership domain',
}]);
assert.equal(movePlan.status, 'READY_FOR_REVIEW', JSON.stringify(movePlan.issues));

// Replace: path/identity remain fixed while the content revision changes.
const replaced = moduleRecord('alpha', alpha.path, 'f');
const replacePlan = proposal(graph([alpha]), graph([replaced]), [{
  kind: 'replace', moduleId: 'alpha',
  rationale: 'Replace the implementation while preserving the public module boundary',
}]);
assert.equal(replacePlan.status, 'READY_FOR_REVIEW', JSON.stringify(replacePlan.issues));

// Structural import/contract cycles fail; legitimate feedback data-flow cycles remain legal.
const cyclic = graph(
  [alpha, beta],
  [
    { from: 'alpha', to: 'beta', kind: 'import' },
    { from: 'beta', to: 'alpha', kind: 'import' },
  ],
);

assert.ok(validateArchitectureMorphogenesisGraph(cyclic).issues.some(issue => issue.code === 'structural-cycle'));
const contractCycle = graph(
  [alpha, beta],
  [
    { from: 'alpha', to: 'beta', kind: 'contract' },
    { from: 'beta', to: 'alpha', kind: 'contract' },
  ],
  [
    { id: 'a-contract', ownerModuleId: 'alpha', consumerModuleIds: ['beta'], authority: 'single-owner' },
    { id: 'b-contract', ownerModuleId: 'beta', consumerModuleIds: ['alpha'], authority: 'single-owner' },
  ],
);
assert.ok(validateArchitectureMorphogenesisGraph(contractCycle).issues.some(issue => issue.code === 'structural-cycle'));
const recurrentFlow = graph(
  [alpha, beta],
  [
    { from: 'alpha', to: 'beta', kind: 'data-flow' },
    { from: 'beta', to: 'alpha', kind: 'data-flow' },
  ],
);
assert.equal(validateArchitectureMorphogenesisGraph(recurrentFlow).ok, true);

// An unaccounted source change, an unsafe path, or a protected branch must fail closed.
const unaccounted = proposal(graph([alpha]), graph([replaced]), []);
assert.equal(unaccounted.status, 'BLOCKED');
const unsafePath = graph([moduleRecord('unsafe', 'src/organism/legacy/Unsafe.ts', 'a')]);
assert.equal(validateArchitectureMorphogenesisGraph(unsafePath).ok, false);
const protectedBranch = createArchitectureMorphogenesisPlan({
  baselineCommit: sha, candidateBranch: 'main',
  baselineGraph: graph([alpha]), candidateGraph: graph([replaced]),
  operations: [{ kind: 'replace', moduleId: 'alpha', rationale: 'test' }],
  migrationPlan: migration(),
});
assert.equal(protectedBranch.status, 'BLOCKED');

// Missing evidence cannot be treated as a pass; a false gate blocks.
assert.equal(evaluateArchitectureMorphogenesisPlan(mergePlan, {}).status, 'NEEDS_REVIEW');
const malformedMerge = proposal(graph([alpha]), graph([alpha]), [{
  kind: 'merge', rationale: 'malformed operation must fail closed',
}]);
assert.equal(malformedMerge.status, 'BLOCKED');
assert.equal(evaluateArchitectureMorphogenesisPlan(mergePlan, {
  candidateBranch: 'aspect/morphogenesis-architecture-20261117',
  candidateCommit: '2'.repeat(40),
  baselineCommit: sha,
  testsPassed: false, typecheckPassed: true, architectureAuditPassed: true,
  contractChecksPassed: true, rollbackVerified: true, reviewApproved: true,
}).status, 'BLOCKED');

const eligible = evaluateArchitectureMorphogenesisPlan(mergePlan, {
  candidateBranch: 'aspect/morphogenesis-architecture-20261117',
  candidateCommit: '2'.repeat(40),
  baselineCommit: sha,
  testsPassed: true, typecheckPassed: true, architectureAuditPassed: true,
  contractChecksPassed: true, rollbackVerified: true, reviewApproved: true,
});
assert.equal(eligible.status, 'ELIGIBLE_FOR_MANUAL_INTEGRATION');
assert.equal(eligible.activation, 'NOT_APPLIED');
assert.equal(eligible.mergeAllowed, false, 'Morphogenesis must never merge or activate a candidate automatically');

// The graph digest detects tampering; accessors and cyclic payloads are quarantined.
const cleanGraph = graph([alpha]);
const originalDigest = computeArchitectureGraphDigest(cleanGraph);
assert.match(originalDigest, /^sha256:[a-f0-9]{64}$/);
const tamperedGraph = { ...cleanGraph, modules: [moduleRecord('alpha', alpha.path, 'b')] };
assert.notEqual(computeArchitectureGraphDigest(tamperedGraph), originalDigest);
const accessorGraph = graph([alpha]);
Object.defineProperty(accessorGraph.modules[0], 'owner', { enumerable: true, get() { throw new Error('getter executed'); } });
assert.equal(validateArchitectureMorphogenesisGraph(accessorGraph).ok, false);
const cyclicObject = graph([alpha]);
cyclicObject.extra = cyclicObject;
assert.equal(validateArchitectureMorphogenesisGraph(cyclicObject).ok, false);

console.log('ARCHITECTURE_MORPHOGENESIS_WORKPASS17=PASS live-graph+contracts+merge-split-move-replace+rollback+promotion-gate');
