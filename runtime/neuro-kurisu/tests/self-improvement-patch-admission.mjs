import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalPatchReceiptPayload, parseUnifiedDiff } from '../src/organism/analysis/PatchReceiptGuard.ts';
import { canonicalPairedHoldoutPayload } from '../src/organism/analysis/PairedSelfImprovementEvidence.ts';
import {
  computeSourceSnapshotSha256,
  SelfImprovementCandidatePool,
  SelfImprovementPatchAdmissionService,
} from '../src/organism/analysis/SelfImprovementCandidatePool.ts';

const baseSha = 'a'.repeat(40);
const file = 'src/organism/cognition/Evolvable.ts';
const patch = [
  'diff --git a/' + file + ' b/' + file,
  'index 1111111..2222222 100644',
  '--- a/' + file,
  '+++ b/' + file,
  '@@ -1 +1 @@',
  '-export function tune(x: number) { return x; }',
  '+export function tune(x: number) { return x + 1; }',
  '',
].join('\n');

const patchSigner = generateKeyPairSync('ed25519');
const evaluatorA = generateKeyPairSync('ed25519');
const evaluatorB = generateKeyPairSync('ed25519');
const trustedPublicKeys = {
  'nk1-patch-test': patchSigner.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
};
const trustedOutcomePublicKeys = {
  'nk1-evaluator-a': evaluatorA.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  'nk1-evaluator-b': evaluatorB.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
};

const sourceFiles = [
  { path: file, text: 'export function tune(x: number) { return x; }\n' },
  { path: 'src/organism/learning/VerifiedOutcomePromotionGate.ts', text: 'export class VerifiedOutcomePromotionGate {}\n' },
  { path: 'src/organism/analysis/PatchReceiptGuard.ts', text: 'export function verifyPatchReceipt() {}\n' },
  { path: 'src/organism/analysis/PairedSelfImprovementEvidence.ts', text: 'export function verifySignedPairedHoldoutEvidence() {}\n' },
  { path: 'src/organism/analysis/SelfImprovementCandidatePool.ts', text: 'export class SelfImprovementCandidatePool {}\n' },
];
const sourceSnapshotSha256 = computeSourceSnapshotSha256(sourceFiles);
const hostTrust = { baseSha, sourceSnapshotSha256, trustedPublicKeys, trustedOutcomePublicKeys };

function makeReceipt(text = patch, keyPair = patchSigner) {
  const unsigned = {
    schemaVersion: 1,
    keyId: 'nk1-patch-test',
    baseSha,
    patchSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    changedFiles: parseUnifiedDiff(text),
  };
  return {
    ...unsigned,
    signature: sign(null, Buffer.from(canonicalPatchReceiptPayload(unsigned), 'utf8'), keyPair.privateKey).toString('base64'),
  };
}

function makePairedOutcomes(candidateId, text = patch, options = {}) {
  const digest = createHash('sha256').update(text, 'utf8').digest('hex');
  const rows = [];
  for (let index = 0; index < 5; index += 1) {
    const verifierId = options.singleVerifier ? 'nk1-evaluator-a' : (index < 3 ? 'nk1-evaluator-a' : 'nk1-evaluator-b');
    const environmentId = options.singleEnvironment ? 'isolated-eval-a' : (index < 3 ? 'isolated-eval-a' : 'isolated-eval-b');
    const keyPair = verifierId === 'nk1-evaluator-a' ? evaluatorA : evaluatorB;
    const payload = {
      schemaVersion: 1,
      candidateId,
      patchSha256: digest,
      evidenceId: 'holdout-evidence-' + candidateId + '-' + (index + 1),
      seed: index + 1,
      split: 'holdout',
      verifierId,
      environmentId,
      proxyGain: 0.30,
      downstreamGain: 0.28,
      observedAt: 1800000000000 + index,
    };
    rows.push({
      payload,
      signature: sign(null, Buffer.from(canonicalPairedHoldoutPayload(payload), 'utf8'), keyPair.privateKey).toString('base64'),
    });
  }
  return rows;
}

function candidate(id, targets = [file]) {
  return {
    candidateId: id,
    targetFiles: targets,
    evolveBlocks: targets.map(target => ({ file: target, startLine: 1, endLine: 1 })),
    // Deliberately forged. The verified path must not read this field.
    observations: Array.from({ length: 5 }, (_, index) => ({
      id: 'candidate-invented-' + (index + 1),
      proxyGain: 0.99,
      downstreamGain: 0.99,
    })),
    rollbackReady: true,
  };
}

function proof(id, options = {}) {
  const proofPatch = options.patchText ?? patch;
  return {
    patchText: proofPatch,
    receipt: options.receipt ?? makeReceipt(proofPatch),
    pairedOutcomes: options.pairedOutcomes === undefined ? makePairedOutcomes(id, proofPatch) : options.pairedOutcomes,
    expectedBaseSha: 'b'.repeat(40),
    trustedPublicKeys: {},
    trustedOutcomePublicKeys: {},
  };
}

function service(config = {}) {
  return new SelfImprovementPatchAdmissionService({
    sourceSnapshot: config.sourceSnapshot ?? { baseSha, files: sourceFiles },
    hostTrust: config.hostTrust ?? hostTrust,
  });
}

test('admits a signed exact diff only with independently signed holdout pairs', () => {
  const admission = service();
  const result = admission.admitVerifiedPatch(candidate('verified-change'), proof('verified-change'));
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.admissionClass, 'signed-patch-receipt');
  assert.equal(result.divergence.pairs, 5);
  assert.equal(result.divergence.meanProxyGain, 0.30);
  assert.equal(result.divergence.meanDownstreamGain, 0.28);
  assert.equal(result.pairedOutcomeEvidence.pairs, 5);
  assert.equal(result.pairedOutcomeEvidence.verifierCount, 2);
  assert.equal(result.pairedOutcomeEvidence.environmentCount, 2);
  assert.equal(admission.rank()[0].pairedOutcomeEvidence.fingerprint, result.pairedOutcomeEvidence.fingerprint);
});

test('refuses candidate-supplied paired observations when host evidence is missing', () => {
  const result = service().admitVerifiedPatch(candidate('self-reported-only'), proof('self-reported-only', {
    pairedOutcomes: [],
  }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'paired-outcome:host-evidence-missing');
});

test('rejects a signed outcome bound to another candidate ID', () => {
  const result = service().admitVerifiedPatch(candidate('candidate-id-mismatch'), proof('candidate-id-mismatch', {
    pairedOutcomes: makePairedOutcomes('different-candidate'),
  }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'paired-outcome:candidate-id-mismatch');
});

test('rejects a signed outcome bound to different patch bytes', () => {
  const alteredPatch = patch.replace('x + 1', 'x + 2');
  const result = service().admitVerifiedPatch(candidate('patch-mismatch'), proof('patch-mismatch', {
    pairedOutcomes: makePairedOutcomes('patch-mismatch', alteredPatch),
  }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'paired-outcome:patch-digest-mismatch');
});

test('requires at least five unique holdout seeds and independent verifiers/environments', () => {
  const fewRows = makePairedOutcomes('few');
  fewRows.pop();
  const few = service().admitVerifiedPatch(candidate('few'), proof('few', { pairedOutcomes: fewRows }));
  assert.equal(few.accepted, false);
  assert.match(few.reason, /insufficient-independent-pairs/);

  const oneVerifier = service().admitVerifiedPatch(candidate('one-verifier'), proof('one-verifier', {
    pairedOutcomes: makePairedOutcomes('one-verifier', patch, { singleVerifier: true }),
  }));
  assert.equal(oneVerifier.accepted, false);
  assert.equal(oneVerifier.reason, 'paired-outcome:insufficient-independent-verifiers');

  const oneEnvironment = service().admitVerifiedPatch(candidate('one-environment'), proof('one-environment', {
    pairedOutcomes: makePairedOutcomes('one-environment', patch, { singleEnvironment: true }),
  }));
  assert.equal(oneEnvironment.accepted, false);
  assert.equal(oneEnvironment.reason, 'paired-outcome:insufficient-independent-environments');
});

test('rejects invalid evaluator signatures and duplicate seed reuse', () => {
  const invalid = makePairedOutcomes('bad-signature');
  invalid[0].signature = 'A'.repeat(88);
  const invalidResult = service().admitVerifiedPatch(candidate('bad-signature'), proof('bad-signature', {
    pairedOutcomes: invalid,
  }));
  assert.equal(invalidResult.accepted, false);
  assert.equal(invalidResult.reason, 'paired-outcome:invalid-signature');

  const duplicated = makePairedOutcomes('duplicate-seed');
  duplicated[4] = structuredClone(duplicated[3]);
  const duplicateResult = service().admitVerifiedPatch(candidate('duplicate-seed'), proof('duplicate-seed', {
    pairedOutcomes: duplicated,
  }));
  assert.equal(duplicateResult.accepted, false);
  assert.equal(duplicateResult.reason, 'paired-outcome:duplicate-evidence-id-or-seed');
});

test('snapshots the exact source inventory and both verifier registries at construction', () => {
  const mutableFiles = sourceFiles.map(row => ({ ...row }));
  const mutablePatchKeys = { ...trustedPublicKeys };
  const mutableOutcomeKeys = { ...trustedOutcomePublicKeys };
  const mutableTrust = {
    baseSha,
    sourceSnapshotSha256: computeSourceSnapshotSha256(mutableFiles),
    trustedPublicKeys: mutablePatchKeys,
    trustedOutcomePublicKeys: mutableOutcomeKeys,
  };
  const admission = service({
    sourceSnapshot: { baseSha, files: mutableFiles },
    hostTrust: mutableTrust,
  });
  mutableFiles[0].text = 'tampered after construction';
  mutablePatchKeys['nk1-patch-test'] = evaluatorA.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  mutableOutcomeKeys['nk1-evaluator-a'] = patchSigner.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const result = admission.admitVerifiedPatch(candidate('immutable-host-snapshot'), proof('immutable-host-snapshot'));
  assert.equal(result.accepted, true, result.reason);
});

test('refuses a source tree whose SHA or complete snapshot digest differs from host trust', () => {
  assert.throws(() => service({
    sourceSnapshot: { baseSha: 'b'.repeat(40), files: sourceFiles },
  }), /host-source-snapshot-base-sha-mismatch/);
  assert.throws(() => service({
    hostTrust: { ...hostTrust, sourceSnapshotSha256: 'b'.repeat(64) },
  }), /host-source-snapshot-digest-mismatch/);
});

test('refuses protected source files and edits outside the declared evolve block', () => {
  const protectedPath = 'src/organism/learning/VerifiedOutcomePromotionGate.ts';
  const protectedText = [
    'diff --git a/' + protectedPath + ' b/' + protectedPath,
    'index 1111111..2222222 100644',
    '--- a/' + protectedPath,
    '+++ b/' + protectedPath,
    '@@ -1 +1 @@',
    '-export class VerifiedOutcomePromotionGate {}',
    '+export class VerifiedOutcomePromotionGate { readonly safe = true; }',
    '',
  ].join('\n');
  const protectedResult = service().admitVerifiedPatch(
    candidate('protected', [protectedPath]),
    proof('protected', { patchText: protectedText }),
  );
  assert.equal(protectedResult.accepted, false);
  assert.match(protectedResult.reason, /structural:protected-capability/);

  const outside = service().admitVerifiedPatch({
    ...candidate('outside'),
    evolveBlocks: [{ file, startLine: 2, endLine: 3 }],
  }, proof('outside'));
  assert.equal(outside.accepted, false);
  assert.match(outside.reason, /patch-receipt:changed-lines-outside-evolve-block/);
});

test('a low-level pool cannot mint verified admission without the host service capability', () => {
  const pool = new SelfImprovementCandidatePool({}, undefined, hostTrust);
  const graph = {
    version: 1,
    files: sourceFiles.map(row => row.path),
    nodes: [],
    edges: [],
  };
  const result = pool.submitVerifiedFromHost(candidate('direct-pool-call'), graph, proof('direct-pool-call'), Symbol('forged'));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'patch-receipt:host-admission-service-required');
});

test('metrics-only candidate ranking never implies signed patch authorization', () => {
  const pool = new SelfImprovementCandidatePool();
  const result = pool.submit(candidate('metrics-only'), {
    version: 1,
    files: [file],
    nodes: [{ id: file + '#__module__', kind: 'file', name: file, file, startLine: 1, endLine: 1, exported: true }],
    edges: [],
  });
  assert.equal(result.accepted, true);
  assert.equal(result.admissionClass, 'metrics-only');
  assert.equal(pool.best().admissionClass, 'metrics-only');
});
