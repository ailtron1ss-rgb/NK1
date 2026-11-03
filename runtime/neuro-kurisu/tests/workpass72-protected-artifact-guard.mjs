import assert from 'node:assert/strict';
import { CanonicalSelfAgencyAuthority } from '../src/organism/system/CanonicalSelfAgencyAuthority.ts';
import {
  guardSelfModification,
  classifyProtectedArtifact,
  canonicalizeRepoPath,
  PROTECTED_ARTIFACT_RULES,
} from '../src/organism/verification/ProtectedArtifactRegistry.ts';

// 1. Path canonicalization normalizes separators and rejects escapes.
assert.equal(canonicalizeRepoPath('./runtime/neuro-kurisu/src/x.ts'),'runtime/neuro-kurisu/src/x.ts');
assert.equal(canonicalizeRepoPath('runtime\\neuro-kurisu\\src\\x.ts'),'runtime/neuro-kurisu/src/x.ts');
assert.equal(canonicalizeRepoPath('runtime/./src/../src/x.ts'),'runtime/src/x.ts');
assert.equal(canonicalizeRepoPath('a/../../etc/passwd'),null,'escaping the repository root is invalid');
assert.equal(canonicalizeRepoPath(''),null);
assert.equal(canonicalizeRepoPath(null),null);
assert.equal(canonicalizeRepoPath('x'.repeat(600)),null);

// 2. Protected artifacts are classified.
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/src/organism/verification/ProtectedArtifactRegistry.ts').artifactClass,'protected-artifact-registry');
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/src/organism/verification/FunctionPassport.ts').artifactClass,'verifier');
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/tests/holdout-dataset.json').artifactClass,'holdout');
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts').artifactClass,'evaluation-harness');
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeLedger.ts').artifactClass,'evidence-ledger');
assert.equal(classifyProtectedArtifact('.github/workflows/workpass-ci.yml').artifactClass,'verification-ci');
assert.equal(classifyProtectedArtifact('.github/workflows/nk1-unified-cognitive-cycle.yml').artifactClass,'verification-ci');
assert.equal(classifyProtectedArtifact('runtime/neuro-kurisu/src/organism/memory/MemoryOS2.ts').protected,false);

// 3. Unparseable paths fail closed (protected).
assert.equal(classifyProtectedArtifact('').protected,true);
assert.equal(classifyProtectedArtifact(42).protected,true);
assert.equal(classifyProtectedArtifact('../../etc/passwd').protected,true);

// 4. The guard blocks any change set that touches a protected artifact.
const safe = guardSelfModification({ changedPaths:['runtime/neuro-kurisu/src/organism/memory/MemoryOS2.ts','docs/NOTES.md'] });
assert.equal(safe.allowed,true);
assert.equal(safe.violations.length,0);
assert.equal(safe.checkedPaths,2);

const blocked = guardSelfModification({ changedPaths:['runtime/neuro-kurisu/src/organism/memory/MemoryOS2.ts','runtime/neuro-kurisu/src/organism/verification/FunctionPassport.ts'] });
assert.equal(blocked.allowed,false);
assert.equal(blocked.reason,'protected-artifact-modification-blocked');
assert.equal(blocked.violations.length,1);
assert.equal(blocked.violations[0].artifactClass,'verifier');

// 5. Malformed guard input fails closed.
assert.equal(guardSelfModification({ changedPaths:'not-an-array' }).allowed,false);
assert.equal(guardSelfModification(null).allowed,false);
assert.equal(guardSelfModification({ changedPaths:new Array(600).fill('a.ts') }).allowed,false);
// Declaring no changed paths is allowed; the constitutional evidence gates still apply.
assert.equal(guardSelfModification({}).allowed,true);

// 6. The guard is wired into the canonical self-modification gate.
const authority = new CanonicalSelfAgencyAuthority();
const base = {
  expectedGain01:.9, holdoutGain01:.9, risk01:.1, rollbackReady:true,
  identityContinuity01:.95, evidence01:.9,
  invariantFingerprint: authority.snapshot().invariantFingerprint,
};
assert.equal(authority.admitSelfModification(base).allowed,true,'evidence-complete change with no paths is admitted');
assert.equal(authority.admitSelfModification({ ...base, changedPaths:['runtime/neuro-kurisu/src/organism/memory/MemoryOS2.ts'] }).allowed,true);

const blockedByArtifact = authority.admitSelfModification({ ...base, changedPaths:['runtime/neuro-kurisu/src/organism/verification/FunctionPassport.ts'] });
assert.equal(blockedByArtifact.allowed,false,'a perfect evidence score cannot authorise editing a verifier');
assert.equal(blockedByArtifact.reason,'self-modification-protected-artifact-block');
assert.equal(blockedByArtifact.artifactGuard.violations.length,1);

const blockedByHoldout = authority.admitSelfModification({ ...base, changedPaths:['runtime/neuro-kurisu/tests/holdout-core.json'] });
assert.equal(blockedByHoldout.allowed,false,'holdout data is off-limits even at maximum measured gain');

const blockedByRegistry = authority.admitSelfModification({ ...base, changedPaths:['runtime/neuro-kurisu/src/organism/verification/ProtectedArtifactRegistry.ts'] });
assert.equal(blockedByRegistry.allowed,false,'the guard cannot edit itself');

// 7. The block is counted and does not leak into an allowed decision.
const diagnostics = authority.diagnostics();
assert.ok(diagnostics.selfModificationBlocks >= 3);
assert.ok(diagnostics.selfModificationChecks >= 5);
assert.equal(diagnostics.lastReason,'self-modification-protected-artifact-block');

// 8. Every rule is well-formed.
for (const rule of PROTECTED_ARTIFACT_RULES) {
  assert.ok(rule.reason && rule.reason.length > 0);
  assert.ok(rule.match.prefix !== undefined || rule.match.suffix !== undefined || rule.match.includes !== undefined);
}

console.log('WORKPASS72_PROTECTED_ARTIFACT_GUARD=PASS');
