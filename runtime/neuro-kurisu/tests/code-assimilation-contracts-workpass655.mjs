import assert from 'node:assert/strict';
import {
  canTransitionCodeAssimilationStage,
  createCodeAssimilationCandidate,
  normalizeCodeAssimilationCandidate,
  transitionCodeAssimilationCandidate,
} from '../src/organism/learning/CodeAssimilationContracts.ts';

const sha = (digit) => String(digit).repeat(64);
const validInput = () => ({
  baseRuntimeSha: 'a'.repeat(40),
  createdAt: 1_800_000_000_000,
  manifest: {
    componentId: 'memory.reranker',
    componentVersion: '1.2.3',
    capabilityId: 'memory.rerank',
    interfaceVersion: '1.0.0',
    language: 'TypeScript',
    runtime: 'node>=24',
    source: {
      sourceKind: 'git',
      canonicalUri: 'https://github.com/example/memory-reranker',
      publisher: 'example-org',
      immutableRevision: 'b'.repeat(40),
      contentSha256: sha(1),
      treeSha256: sha(2),
      retrievedAt: 1_799_999_999_000,
    },
    dependencyLockFingerprint: null,
    sbomFingerprint: null,
    declaredLicenseExpression: 'MIT',
  },
});
const step = (candidate, to, actor, occurredAt, evidenceDigit=3) =>
  transitionCodeAssimilationCandidate(candidate, {
    to, actor, occurredAt, reason: `verified transition to ${to}`, evidenceFingerprint: sha(evidenceDigit),
  });

const initial = createCodeAssimilationCandidate(validInput());
assert.equal(initial.schemaVersion, 1);
assert.equal(initial.stage, 'discovered');
assert.equal(initial.revision, 0);
assert.match(initial.candidateId, /^codeassim:[a-f0-9]{40}$/);
assert.equal(initial.events.length, 1);
assert.equal(initial.events[0].from, null);
assert.equal(initial.events[0].to, 'discovered');
assert.equal(initial.sourceFingerprint, normalizeCodeAssimilationCandidate(initial).sourceFingerprint);

// Same immutable source, target baseline and manifest yield the same identity.
assert.equal(createCodeAssimilationCandidate(validInput()).candidateId, initial.candidateId);
const changedBase = validInput();
changedBase.baseRuntimeSha = 'c'.repeat(40);
assert.notEqual(createCodeAssimilationCandidate(changedBase).candidateId, initial.candidateId);
const changedSource = validInput();
changedSource.manifest.source.contentSha256 = sha(4);
assert.notEqual(createCodeAssimilationCandidate(changedSource).candidateId, initial.candidateId);

// Intake rejects floating references, non-HTTPS external sources and malformed digests.
for (const floating of ['main', 'master', 'latest', 'stable', 'develop']) {
  const input = validInput();
  input.manifest.source.immutableRevision = floating;
  assert.throws(() => createCodeAssimilationCandidate(input), /immutable/);
}
{
  const input = validInput();
  input.manifest.source.canonicalUri = 'http://github.com/example/repo';
  assert.throws(() => createCodeAssimilationCandidate(input), /https/);
}
{
  const input = validInput();
  input.manifest.source.contentSha256 = 'not-a-digest';
  assert.throws(() => createCodeAssimilationCandidate(input), /fingerprint-invalid/);
}
{
  const input = validInput();
  input.manifest.source.immutableRevision = 'main';
  assert.throws(() => createCodeAssimilationCandidate(input), /immutable/);
}
{
  const input = validInput();
  input.manifest.componentVersion = 'latest';
  assert.throws(() => createCodeAssimilationCandidate(input), /component-version-invalid/);
}
{
  const input = validInput();
  input.manifest.source.sourceKind = 'package';
  input.manifest.source.immutableRevision = '2.3';
  assert.throws(() => createCodeAssimilationCandidate(input), /exact/);
}

// Getter-backed data is rejected without invoking the getter.
{
  const input = validInput();
  let getterCalls = 0;
  Object.defineProperty(input.manifest.source, 'canonicalUri', {
    enumerable: true,
    configurable: true,
    get() { getterCalls += 1; return 'https://example.com/evil'; },
  });
  assert.throws(() => createCodeAssimilationCandidate(input), /accessor-invalid/);
  assert.equal(getterCalls, 0);
}

// Cyclic/sparse inputs are not normalized into trusted metadata.
{
  const input = validInput();
  input.manifest.source.self = input.manifest.source;
  assert.throws(() => createCodeAssimilationCandidate(input), /cycle/);
}
{
  const input = validInput();
  input.manifest.source.dependencies = new Array(2);
  assert.throws(() => createCodeAssimilationCandidate(input), /array-shape-invalid/);
}

// The state machine enforces the intended ordering and actor constraints.
assert.equal(canTransitionCodeAssimilationStage('discovered', 'researched'), true);
assert.equal(canTransitionCodeAssimilationStage('discovered', 'active'), false);
assert.equal(canTransitionCodeAssimilationStage('active', 'rolled-back'), true);
assert.equal(canTransitionCodeAssimilationStage('rejected', 'researched'), false);
assert.throws(() => step(initial, 'active', 'human', initial.updatedAt + 1), /not-allowed/);
assert.throws(() => transitionCodeAssimilationCandidate(initial, {
  to: 'researched', actor: 'agent', occurredAt: initial.updatedAt + 1,
  reason: 'missing evidence', evidenceFingerprint: '',
}), /fingerprint-invalid/);
const researchedForActorGate = step(initial, 'researched', 'agent', initial.updatedAt + 1, 8);
assert.throws(() => step(researchedForActorGate, 'quarantined', 'agent', researchedForActorGate.updatedAt + 1), /system-actor/);
assert.throws(() => step(initial, 'approved', 'agent', initial.updatedAt + 1), /not-allowed/);

let candidate = initial;
let at = initial.updatedAt;
const move = (to, actor, evidence) => {
  at += 1000;
  candidate = step(candidate, to, actor, at, evidence);
  assert.equal(candidate.stage, to);
  assert.equal(candidate.revision, candidate.events.length - 1);
  return candidate;
};
move('researched', 'agent', 3);
move('quarantined', 'system', 4);
move('provenance-checked', 'independent-verifier', 5);
move('analyzed', 'agent', 6);
move('adapted', 'agent', 7);
move('built', 'independent-verifier', 8);
move('tested', 'independent-verifier', 9);
move('shadow', 'independent-verifier', 1);
move('staged', 'system', 2);
assert.throws(() => step(candidate, 'approved', 'agent', at + 1000), /human-actor/);
move('approved', 'human', 3);
move('active', 'human', 4);
assert.equal(candidate.stage, 'active');
assert.equal(candidate.events.at(-1).actor, 'human');

// Rollback is an explicit transition, not deletion of history.
move('rolled-back', 'human', 5);
assert.equal(candidate.stage, 'rolled-back');
assert.equal(candidate.events.length, 13);
assert.throws(() => step(candidate, 'active', 'human', at + 1000), /not-allowed/);

// A blocked or research-only candidate cannot silently become production code.
{
  let blocked = createCodeAssimilationCandidate(validInput());
  blocked = step(blocked, 'researched', 'agent', blocked.updatedAt + 1, 6);
  blocked = step(blocked, 'research-only', 'human', blocked.updatedAt + 1, 7);
  assert.throws(() => step(blocked, 'quarantined', 'system', blocked.updatedAt + 1), /not-allowed/);
}

// Events must be monotonic; candidate state cannot be tampered independently of its history.
{
  const source = createCodeAssimilationCandidate(validInput());
  assert.throws(() => step(source, 'researched', 'agent', source.updatedAt - 1, 8), /time-regression/);
}
{
  const source = createCodeAssimilationCandidate(validInput());
  const tampered = structuredClone(source);
  tampered.stage = 'active';
  assert.throws(() => normalizeCodeAssimilationCandidate(tampered), /revision-invalid/);
}
{
  const source = createCodeAssimilationCandidate(validInput());
  const tampered = structuredClone(source);
  tampered.manifest.source.contentSha256 = sha(9);
  assert.throws(() => normalizeCodeAssimilationCandidate(tampered), /candidateId-mismatch/);
}
{
  const source = createCodeAssimilationCandidate(validInput());
  const tampered = structuredClone(source);
  tampered.events[0].occurredAt += 1;
  assert.throws(() => normalizeCodeAssimilationCandidate(tampered), /candidate-time-invalid/);
}

// Transitions detach data and do not mutate the caller's candidate.
{
  const source = createCodeAssimilationCandidate(validInput());
  const before = JSON.stringify(source);
  step(source, 'researched', 'agent', source.updatedAt + 1000, 2);
  assert.equal(JSON.stringify(source), before);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-contracts-workpass655',
  checks: 36,
  candidateId: initial.candidateId,
  finalTransition: candidate.stage,
}));
