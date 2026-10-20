import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const now = Date.now();
const memory = new MemoryOS2();
const original = memory.encode({
  content: 'For project notifications, the user prefers concise one-line summaries.',
  kind: 'semantic',
  source: 'workpass91-user-preference',
  tags: ['workpass91', 'notification-preference'],
  context: { topic: 'project-notifications' },
  salience: .8,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .4,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .95,
  epistemicStatus: 'fact',
  entities: ['project notifications'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 10_000,
  observedAt: now - 10_000,
  provenanceClass: 'user',
  sourceAuthority01: .86,
  independenceKey: 'user-preference:project-notifications',
  evidenceFreshnessAt: now - 10_000,
}, { clone: false });

const correction = memory.reviseContent(original.id,
  'For project notifications, the user prefers detailed step-by-step summaries.',
  { reason: 'explicit-user-correction' });
assert.ok(correction, 'an explicit correction must create a revision');
assert.notEqual(correction.id, original.id, 'a correction must preserve the original as history');

const query = 'project notifications user prefers detailed step-by-step summaries';
const liveHits = memory.retrieve(query, 8, 0, 0, { temporalMode: 'current' }, true);
assert.ok(liveHits.some(item => item.id === correction.id),
  'current retrieval must find the corrected preference');

const staleHits = memory.retrieve(
  'project notifications user prefers concise one-line summaries',
  8, 0, 0, { temporalMode: 'current' }, true,
);
assert.equal(staleHits.some(item => item.id === original.id), false,
  'current retrieval must not revive the superseded preference');

const restoredMemory = new MemoryOS2();
restoredMemory.restore(memory.snapshot());
const restoredHits = restoredMemory.retrieve(query, 8, 0, 0, { temporalMode: 'current' }, true);
assert.ok(restoredHits.some(item => item.id === correction.id),
  'the corrected preference must survive memory snapshot/restore');

// This small, explicit decision rule belongs to the test harness, not the production
// planner. It makes the evaluation oracle inspectable: only a current fact with a
// matching topic can ground the sandbox action; absent topic evidence means clarify.
function decideNotificationFormat(items) {
  const evidence = items.find(item =>
    item.kind === 'semantic' &&
    item.epistemicStatus === 'fact' &&
    item.supersededById == null &&
    /project notifications/i.test(item.content) &&
    /detailed step-by-step summaries/i.test(item.content));
  return evidence
    ? { decision: 'execute', evidenceId: evidence.id, input: { format: 'detailed' } }
    : { decision: 'clarify', evidenceId: null, input: null };
}
const groundedDecision = decideNotificationFormat(restoredHits);
assert.equal(groundedDecision.decision, 'execute');
assert.equal(groundedDecision.evidenceId, correction.id);

const missingEvidenceHits = restoredMemory.retrieve(
  'orbital engine for Mars transfer vehicle',
  8, 0, 0, { temporalMode: 'current' }, true,
);
const unsupportedDecision = decideNotificationFormat(missingEvidenceHits);
assert.equal(unsupportedDecision.decision, 'clarify',
  'missing evidence must request clarification rather than invent a preference');

let executions = 0;
let durableLedger;
function makeGateway() {
  const gateway = new ActionGateway({ live: true });
  gateway.setExecutionLedgerPersister(async snapshot => {
    durableLedger = structuredClone(snapshot);
  });
  gateway.registerTool({
    id: 'sandbox.notification.send',
    capability: 'notification.send',
    destructive: false,
    requiresIdempotencyKey: true,
    execute: async input => {
      executions += 1;
      return { ok: true, format: input.format, sandbox: true };
    },
    verify: ({ input, result }) => ({
      verified: result.ok === true && result.sandbox === true && input.format === 'detailed',
      basis: 'tool-contract',
      confidence01: result.ok === true && result.sandbox === true && input.format === 'detailed' ? 1 : 0,
      notes: 'deterministic in-memory sandbox receipt',
    }),
  });
  return gateway;
}

const firstGateway = makeGateway();
const first = await firstGateway.executeTool(
  'sandbox.notification.send',
  groundedDecision.input,
  'workpass91-grounded-memory-action',
  { idempotencyKey: 'workpass91-notification-1', decisionId: 'decision-workpass91-1', autonomous: false },
);
assert.equal(first.ok, true, 'the grounded sandbox action should complete');
assert.equal(first.verified, true, 'the sandbox contract must verify the deterministic result');
assert.equal(executions, 1, 'the sandbox executor must run exactly once');
assert.ok(durableLedger?.records?.length, 'the action receipt must be persisted');

const restartGateway = makeGateway();
restartGateway.restoreExecutionLedger(durableLedger);
const replay = await restartGateway.executeTool(
  'sandbox.notification.send',
  groundedDecision.input,
  'workpass91-grounded-memory-action',
  { idempotencyKey: 'workpass91-notification-1', decisionId: 'decision-workpass91-1', autonomous: false },
);
assert.equal(replay.executionId, first.executionId,
  'restart/replay must preserve the logical execution identity');
assert.equal(executions, 1, 'replay after ledger restore must not repeat the side effect');
assert.equal(replay.idempotentReplay, true, 'the gateway must mark the restored receipt as a replay');
assert.equal(unsupportedDecision.input, null, 'an ungrounded decision must not produce action arguments');

console.log('WORKPASS91_MEMORY_TO_ACTION=PASS', JSON.stringify({
  correctedPreferenceRetrieved: liveHits.some(item => item.id === correction.id),
  supersededPreferenceSuppressed: !staleHits.some(item => item.id === original.id),
  memorySurvivesRestore: restoredHits.some(item => item.id === correction.id),
  missingEvidenceDecision: unsupportedDecision.decision,
  actionVerified: first.verified,
  replayPreservedExecutionId: replay.executionId === first.executionId,
  sideEffectExecutions: executions,
  sandboxOnly: true,
  liveMemoryMutationByBenchmark: false,
}));
