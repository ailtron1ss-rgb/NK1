import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';
import { memoryTaskConditionedUtilityVerificationInput } from '../src/organism/system/MemoryTaskConditionedUtilityLedger.ts';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fingerprint = value => sha256(String(value));
const NONE_EVIDENCE = fingerprint('nk1:no-memory-evidence:v1');
const NOW = Date.now();
const taskKeyHash = fingerprint('notification-format-task:v1');
const holdoutFingerprint = fingerprint('notification-format-holdout:v1');
const contextFingerprint = fingerprint('same-user-and-project-context:v1');
const readerFingerprint = fingerprint('same-reader-model-prompt-decode-budget:v1');
const scorerFingerprint = fingerprint('action-grounded-scorer:v1');
const fillerFingerprint = fingerprint('same-filler-and-insertion-position:v1');

function createFabric() {
  return new MemoryFabric(
    new MemoryOS2(), new EventLog(), new MultiTimescaleMemory(),
    new MemorySubstrateCoordinator(), new UnifiedMemorySystem(),
    new P62MemoryFabric(), new SemanticMemoryGraph(),
  );
}

function decideFormat(items) {
  const current = items.find(item =>
    item.kind === 'semantic' && item.epistemicStatus === 'fact' &&
    item.supersededById == null && /project notifications/i.test(item.content) &&
    /detailed step-by-step summaries/i.test(item.content));
  if (current) return { decision: 'execute', format: 'detailed', evidenceId: current.id };
  return { decision: 'clarify', format: null, evidenceId: null };
}

async function runArm({ seed, withMemory }) {
  const memory = new MemoryOS2();
  if (withMemory) {
    const oldFact = memory.encode({
      content: 'For project notifications, the user prefers concise one-line summaries.',
      kind: 'semantic', source: 'memory-action-benchmark', tags: ['notification-format'],
      context: { topic: 'project-notifications' }, salience: .8, emotionalWeight: .1, identityRelevance: .2,
      goalRelevance: .4, socialRelevance: .1, predictionError: .1, confidence: .95, epistemicStatus: 'fact',
      entities: ['project notifications'], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
      validFromAt: NOW - 10_000, observedAt: NOW - 10_000, provenanceClass: 'user',
      sourceAuthority01: .86, independenceKey: 'user-preference:notification-format',
      evidenceFreshnessAt: NOW - 10_000,
    }, { clone: false });
    const corrected = memory.reviseContent(oldFact.id,
      'For project notifications, the user prefers detailed step-by-step summaries.',
      { reason: 'explicit-user-correction' });
    assert.ok(corrected);
  }
  const retrieved = withMemory
    ? memory.retrieve('project notifications user prefers detailed step-by-step summaries', 8, 0, 0, { temporalMode: 'current' }, true)
    : [];
  const decision = decideFormat(retrieved);
  if (withMemory) {
    assert.equal(decision.decision, 'execute');
    assert.ok(retrieved.some(item => item.id === decision.evidenceId));
    assert.equal(retrieved.some(item => /concise one-line/i.test(item.content)), false,
      'superseded memory must never ground the next action');
  } else {
    assert.equal(decision.decision, 'clarify');
  }

  const gateway = new ActionGateway({ live: true });
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({
    id: 'sandbox.notification.send', capability: 'notification.send', destructive: false,
    requiresIdempotencyKey: true,
    execute: async input => ({ ok: true, format: input.format, sandbox: true }),
    verify: ({ input, result }) => {
      const matches = result.ok === true && result.sandbox === true && result.format === input.format;
      return {
        verified: matches, basis: 'tool-contract', confidence01: matches ? 1 : 0,
        notes: 'deterministic in-memory sandbox postcondition',
      };
    },
  });
  gateway.registerTool({
    id: 'sandbox.notification.clarify', capability: 'notification.clarify', destructive: false,
    requiresIdempotencyKey: true,
    execute: async input => ({ ok: true, requested: true, topic: input.topic }),
    verify: ({ input, result }) => {
      const matches = result.ok === true && result.requested === true && result.topic === input.topic;
      return {
        verified: matches, basis: 'tool-contract', confidence01: matches ? 1 : 0,
        notes: 'deterministic in-memory sandbox clarification',
      };
    },
  });

  const execution = withMemory
    ? await gateway.executeTool('sandbox.notification.send', { format: decision.format },
        `memory-action-benchmark:${seed}:send`, {
          idempotencyKey: `memory-action-benchmark:${seed}:send`,
          decisionId: `memory-action-benchmark:${seed}:with-memory`, autonomous: false,
        })
    : await gateway.executeTool('sandbox.notification.clarify', { topic: 'project-notification-format' },
        `memory-action-benchmark:${seed}:clarify`, {
          idempotencyKey: `memory-action-benchmark:${seed}:clarify`,
          decisionId: `memory-action-benchmark:${seed}:without-memory`, autonomous: false,
        });
  assert.equal(execution.verified, true, 'ActionGateway must verify the sandbox postcondition');
  assert.equal(execution.verification.basis, 'tool-contract');

  const decisionFingerprint = fingerprint(`decision:${seed}:${withMemory ? 'with' : 'without'}:${decision.decision}:${decision.format ?? 'none'}`);
  const traceFingerprint = fingerprint(JSON.stringify({
    executionId: execution.executionId, tool: execution.tool, outcomeClass: execution.outcomeClass,
    verified: execution.verified, result: execution.result,
  }));
  const evidenceFingerprint = withMemory ? fingerprint(retrieved.map(item => item.id).sort().join('|')) : NONE_EVIDENCE;
  return {
    evidence: {
      decisionFingerprint, traceFingerprint, evidenceFingerprint,
      taskCompletion01: withMemory ? 1 : 0,
      goalProgress01: withMemory ? 1 : .25,
      groundedActionRate01: 1,
      verifiedActionRate01: execution.verified ? 1 : 0,
      staleMemoryUseRate01: 0,
      safetyViolationCount: 0,
    },
    score01: withMemory ? 1 : .5,
    execution,
  };
}

async function main() {
  const fabric = createFabric();
  const base = {
    memoryId: 'memory:semantic:notification-format',
    taskKeyHash, holdoutFingerprint, contextFingerprint, readerFingerprint,
    scorerFingerprint, fillerFingerprint, insertionPosition: 512,
    formationCostTokens: 18, storageBytes: 220,
  };
  const verifier = new OutcomeVerificationService();

  for (const seed of [11, 23, 37, 41, 59]) {
    const at = NOW + seed * 1000;
    const registered = fabric.registerTaskConditionedUtilityProbe({ ...base, seed, at });
    assert.equal(registered.accepted, true);
    const withMemory = await runArm({ seed, withMemory: true });
    const withoutMemory = await runArm({ seed, withMemory: false });
    const actionEvidence = { withMemory: withMemory.evidence, withoutMemory: withoutMemory.evidence };
    const metrics = {
      withMemoryScore01: withMemory.score01,
      withoutMemoryScore01: withoutMemory.score01,
      withMemoryInputTokens: 180, withoutMemoryInputTokens: 140,
      withMemoryOutputTokens: 35, withoutMemoryOutputTokens: 18,
      withMemoryRetrievalLatencyMs: 5, withoutMemoryRetrievalLatencyMs: 0,
      actionEvidence,
    };
    const verificationInput = memoryTaskConditionedUtilityVerificationInput(registered.probe, metrics);
    const postcondition = `paired-memory-action-evaluation:${registered.probe.id}:verified`;
    const verification = await verifier.verify({
      toolId: 'nk1-memory-action-grounded-evaluator',
      input: verificationInput,
      result: { probeId: registered.probe.id, actionEvidence },
    }, async context => {
      assert.equal(context.input.probeId, registered.probe.id,
        'the evaluator receipt must bind the exact probe and action trajectory evidence tuple');
      return {
        verified: true, basis: 'external-postcondition', confidence01: 1,
        externalObservation: true, observationId: `memory-action-eval:${registered.probe.id}`,
        expectedPostcondition: postcondition, observedPostcondition: postcondition,
      };
    });
    const resolved = fabric.resolveTaskConditionedUtilityProbe({
      probeId: registered.probe.id, ...metrics, verification, validationAt: at + 500,
    });
    assert.equal(resolved.accepted, true, JSON.stringify(resolved));
  }

  const query = {
    memoryId: base.memoryId, taskKeyHash, holdoutFingerprint, contextFingerprint,
    readerFingerprint, scorerFingerprint, fillerFingerprint, insertionPosition: 512,
  };
  const estimate = fabric.taskConditionedActionEvidence(query);
  assert.ok(estimate, 'the canonical MemoryFabric must expose paired action-grounded evidence');
  assert.equal(estimate.samples, 5);
  assert.equal(estimate.meanTaskCompletionDelta01, 1);
  assert.equal(estimate.meanGoalProgressDelta01, .75);
  assert.equal(estimate.meanGroundedActionRateDelta01, 0);
  assert.equal(estimate.meanVerifiedActionRateDelta01, 0);
  assert.equal(estimate.meanStaleMemoryUseDelta01, 0);
  assert.equal(estimate.meanSafetyViolationDelta, 0);
  assert.equal(estimate.positiveTaskCompletionRate01, 1);
  assert.equal(estimate.staleMemoryRegressionRate01, 0);
  assert.equal(estimate.safetyRegressionRate01, 0);
  assert.equal(fabric.taskConditionedActionEvidence({ ...query, holdoutFingerprint: fingerprint('another-holdout') }), null);

  const snapshot = fabric.snapshot();
  const restored = createFabric();
  restored.restore(snapshot);
  assert.equal(restored.taskConditionedUtilityDiagnostics().resolved, 5);
  assert.equal(restored.taskConditionedActionEvidence(query), null,
    'restored audit rows must not become fresh paired action-evaluation evidence');

  // Adversarial negative control: the estimator must surface stale-memory and safety regression,
  // not merely report a positive score when both arms look clean.
  const adverseFabric = createFabric();
  const adverseAt = NOW + 90_000;
  const adverseProbe = adverseFabric.registerTaskConditionedUtilityProbe({ ...base, seed: 73, at: adverseAt });
  assert.equal(adverseProbe.accepted, true);
  const adverseMetrics = {
    withMemoryScore01: .1, withoutMemoryScore01: .6,
    withMemoryInputTokens: 150, withoutMemoryInputTokens: 140,
    withMemoryOutputTokens: 12, withoutMemoryOutputTokens: 18,
    withMemoryRetrievalLatencyMs: 6, withoutMemoryRetrievalLatencyMs: 0,
    actionEvidence: {
      withMemory: {
        decisionFingerprint: fingerprint('adverse:decision:with'),
        traceFingerprint: fingerprint('adverse:trace:with'),
        evidenceFingerprint: fingerprint('adverse:evidence:stale'),
        taskCompletion01: 0, goalProgress01: .1, groundedActionRate01: 0,
        verifiedActionRate01: 0, staleMemoryUseRate01: 1, safetyViolationCount: 1,
      },
      withoutMemory: {
        decisionFingerprint: fingerprint('adverse:decision:without'),
        traceFingerprint: fingerprint('adverse:trace:without'),
        evidenceFingerprint: fingerprint('adverse:evidence:none'),
        taskCompletion01: .5, goalProgress01: .5, groundedActionRate01: 1,
        verifiedActionRate01: 1, staleMemoryUseRate01: 0, safetyViolationCount: 0,
      },
    },
  };
  const adverseVerificationInput = memoryTaskConditionedUtilityVerificationInput(adverseProbe.probe, adverseMetrics);
  const adversePostcondition = `paired-memory-action-evaluation:${adverseProbe.probe.id}:verified`;
  const adverseVerification = await verifier.verify({
    toolId: 'nk1-memory-action-grounded-evaluator', input: adverseVerificationInput,
    result: { probeId: adverseProbe.probe.id, actionEvidence: adverseMetrics.actionEvidence },
  }, () => ({
    verified: true, basis: 'external-postcondition', confidence01: 1,
    externalObservation: true, observationId: `memory-action-eval:${adverseProbe.probe.id}`,
    expectedPostcondition: adversePostcondition, observedPostcondition: adversePostcondition,
  }));
  const adverseResolved = adverseFabric.resolveTaskConditionedUtilityProbe({
    probeId: adverseProbe.probe.id, ...adverseMetrics, verification: adverseVerification, validationAt: adverseAt + 500,
  });
  assert.equal(adverseResolved.accepted, true);
  const adverseEstimate = adverseFabric.taskConditionedActionEvidence(query);
  assert.equal(adverseEstimate.staleMemoryRegressionRate01, 1);
  assert.equal(adverseEstimate.safetyRegressionRate01, 1);
  assert.equal(adverseEstimate.meanTaskCompletionDelta01, -.5);

  console.log('MEMORY_ACTION_GROUNDED_UTILITY=PASS', JSON.stringify({
    pairedSeeds: estimate.samples,
    taskCompletionDelta01: estimate.meanTaskCompletionDelta01,
    staleMemoryRegressionRate01: estimate.staleMemoryRegressionRate01,
    safetyRegressionRate01: estimate.safetyRegressionRate01,
    adverseStaleAndSafetyRegressionDetected: adverseEstimate.staleMemoryRegressionRate01 === 1 && adverseEstimate.safetyRegressionRate01 === 1,
    canonicalOwner: 'MemoryFabric/MemoryOS2',
    syntheticSandboxOnly: true,
  }));
}

await main();
