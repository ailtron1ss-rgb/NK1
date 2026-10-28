import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine, sanitizeAutonomousTopicText, sanitizeAutonomousDialogueMessage } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const inputs = (at, overrides = {}) => ({
  at, externalInput: false, socialNeed01: .82, relationship01: .68,
  energy01: .88, identity01: .91, novelty01: .86,
  topics: [
    { topic: 'How an intention becomes a verified result and then a lasting memory', source: 'curiosity', salience01: .76, freshness01: .7 },
    { topic: 'What makes a programming change a real improvement rather than a passing test', source: 'reflection', salience01: .75, freshness01: .8 },
  ],
  quietPeriodMs: 1000, cooldownMs: 2000, startupGraceMs: 0,
  ...overrides,
});

const engine = new AutonomousSocialInitiativeEngine();
// Explicit input resets the quiet-time window and must not itself create an unsolicited turn.
assert.equal(engine.cycle(inputs(1000, { externalInput: true })).initiative, null);
assert.equal(engine.cycle(inputs(1999)).initiative, null, 'must respect quiet period');
const selected = engine.cycle(inputs(2001));
assert.equal(selected.shouldInitiate, true);
assert.ok(selected.initiative);
assert.equal(selected.initiative.contact, null, 'must not invent an ambient network contact');
assert.ok(selected.initiative.topic.length > 20);
assert.equal(engine.latestPlanned(2001)?.id, selected.initiative.id);
assert.equal(engine.cycle(inputs(2002)).initiative, null, 'a pending item must prevent duplicate initiatives');

assert.equal(engine.stageMessage(selected.initiative.id, 'Есть любопытная связь между намерением, причиной и доказанным результатом.'), true);
assert.equal(engine.stageMessage(selected.initiative.id, 'duplicate'), false, 'a message can only be staged once');
assert.equal(engine.latestReady()?.message, 'Есть любопытная связь между намерением, причиной и доказанным результатом.');
assert.equal(engine.acknowledge(selected.initiative.id, 2100), true);
assert.equal(engine.acknowledge(selected.initiative.id, 2101), false, 'ack must be idempotent');
assert.equal(engine.summary().executed, 1);
assert.equal(engine.snapshot().reciprocity01, .54, 'UI delivery is not evidence of reciprocal response or positive reception');

const restored = new AutonomousSocialInitiativeEngine();
restored.restore(engine.snapshot());
assert.equal(restored.latestReady(), null, 'acknowledged messages are not redelivered after restore');
assert.equal(restored.summary().executed, 1);

const migration = new AutonomousSocialInitiativeEngine();
migration.restore({ version: 1, cycles: 5, planned: 1, executed: 0, deferred: 0, reciprocity01: .5, initiative01: .4, initiatives: [{ id: 'legacy-1', contact: 'ambient-network', kind: 'follow-up', status: 'planned', createdAt: 100, reason: 'legacy' }] });
assert.equal(migration.latestPlanned(101)?.contact, null, 'legacy fake contact must be normalized');
assert.equal(migration.latestPlanned(101)?.topicSource, 'curiosity');
assert.equal(migration.defer('legacy-1', 200), true);
assert.equal(migration.defer('legacy-1', 201), false, 'deferral must not count twice');
assert.equal(migration.summary().deferred, 1);

const repeated = new AutonomousSocialInitiativeEngine();
const repeatedInput = inputs(1, { startupGraceMs: 0, quietPeriodMs: 0, cooldownMs: 0, emotionLabel: 'curiosity', emotionConfidence01: .9, topics: [{ topic: 'How causal evidence changes a scientific model over time', source: 'curiosity' }] });
assert.equal(repeated.cycle(repeatedInput).initiative?.toneHint, 'curious');
repeated.stageMessage(repeated.latestPlanned(1).id, 'Похоже, это стоит обсудить.');
repeated.acknowledge(repeated.latestReady().id, 2);
const noRepeat = repeated.cycle({ ...repeatedInput, at: 3, topics: [{ topic: 'A scientific model changes over time when new causal evidence appears', source: 'curiosity' }] });
assert.equal(noRepeat.initiative, null, 'near-duplicate topics must not be emitted as fresh thoughts');

const privateTopicEngine = new AutonomousSocialInitiativeEngine();
const privateTopic = privateTopicEngine.cycle(inputs(7000, {
  startupGraceMs: 0, quietPeriodMs: 0, cooldownMs: 0,
  topics: [{ topic: 'A useful lesson with password hunter2 and contact curator@example.com', source: 'memory' }],
}));
assert.equal(privateTopic.initiative, null, 'credential/contact-bearing topic candidates must be dropped before language generation');
assert.equal(sanitizeAutonomousTopicText('Пароль пользователя example@example.com'), null, 'Russian secret references must be rejected before provider context assembly');
assert.equal(sanitizeAutonomousTopicText('A verified causal lesson about memory consolidation'), 'A verified causal lesson about memory consolidation');
assert.equal(sanitizeAutonomousDialogueMessage('A useful insight about memory and prediction.'), 'A useful insight about memory and prediction.');
assert.equal(sanitizeAutonomousDialogueMessage('Use this API key sk-abcdefghijklmnopqrstuvwxyz123456'), null, 'generated proactive messages must not stage obvious credentials');

const rejectedOutput = new AutonomousSocialInitiativeEngine();
const rejectedInitiative = rejectedOutput.cycle(inputs(8000, { startupGraceMs: 0, quietPeriodMs: 0, cooldownMs: 0, topics: [{ topic: 'A distinct analysis of memory reliability and evidence', source: 'reflection' }] })).initiative;
assert.ok(rejectedInitiative);
assert.equal(rejectedOutput.stageMessage(rejectedInitiative.id, 'Use this API key sk-abcdefghijklmnopqrstuvwxyz123456', 8001), false);
assert.equal(rejectedOutput.latestReady(), null, 'unsafe generated text must never be marked ready for delivery');
assert.equal(rejectedOutput.summary().deferred, 1, 'a privacy-rejected generation must leave the hot pending queue');

const restoredPrivate = new AutonomousSocialInitiativeEngine();
restoredPrivate.restore({ version: 1, cycles: 1, planned: 1, executed: 0, deferred: 0, reciprocity01: .5, initiative01: .5, startedAt: 1, lastExternalInputAt: 0, lastInitiativeAt: 1, initiatives: [{ id: 'private-restored', kind: 'share-thought', status: 'ready', createdAt: 1, reason: 'old private context', topic: 'A prior note contains password hunter2 and curator@example.com', message: 'Please reuse password hunter2 and contact curator@example.com' }] });
assert.equal(restoredPrivate.latestPlanned(2), null, 'unsafe persisted initiatives must not be restored as active plans');
assert.equal(restoredPrivate.latestReady(), null, 'unsafe persisted message must not be redelivered after restore');
assert.doesNotMatch(JSON.stringify(restoredPrivate.snapshot()), /hunter2|curator@example\.com/, 'private persisted text must be removed from the restored initiative state');
assert.equal(restoredPrivate.summary().deferred, 1, 'privacy-invalid restored work must be visibly deferred');
// Restored ready rows without a safe message are not deliverable. They must be
// deferred immediately instead of remaining in hasPending() until the 20-minute
// expiry and blocking new endogenous dialogue indefinitely after restart.
const orphanedReady = new AutonomousSocialInitiativeEngine();
orphanedReady.restore({
  version: 1, cycles: 1, planned: 1, executed: 0, deferred: 0,
  reciprocity01: .5, initiative01: .5, startedAt: 1,
  lastExternalInputAt: 0, lastInitiativeAt: 100,
  initiatives: [{
    id: 'orphaned-ready-no-message',
    contact: null,
    kind: 'share-thought',
    priority01: .7,
    status: 'ready',
    createdAt: 100,
    reason: 'legacy or interrupted state',
    topic: 'A prior distinct thought about verified memory and causal evidence',
    topicSource: 'reflection',
    openingIntent: 'offer-an-idea',
  }],
});
assert.equal(orphanedReady.latestReady(), null,
  'a ready initiative without a safe message must never be exposed to delivery');
assert.equal(orphanedReady.snapshot().initiatives[0].status, 'deferred',
  'restore must resolve undeliverable ready state immediately');
assert.equal(orphanedReady.summary().deferred, 1,
  'the invalid restored work must be visible in deferred diagnostics');
const resumedAfterRestore = orphanedReady.cycle(inputs(10_000, {
  startupGraceMs: 0, quietPeriodMs: 0, cooldownMs: 0,
  topics: [{ topic: 'A fresh autonomous question about testing a prediction against independent evidence', source: 'curiosity' }],
}));
assert.ok(resumedAfterRestore.initiative,
  'an orphaned ready row must not suppress a valid new initiative after restore');

const expressive = new AutonomousSocialInitiativeEngine();
const direct = expressive.cycle(inputs(5000, { startupGraceMs: 0, quietPeriodMs: 0, cooldownMs: 0, emotionLabel: 'frustration', emotionConfidence01: .8, emotionArousal01: .82, topics: [{ topic: 'A distinct new question about how competing hypotheses should be tested', source: 'reflection' }] }));
assert.equal(direct.initiative?.toneHint, 'direct', 'a high-confidence appraisal should shape expression');
assert.equal(direct.initiative?.affect?.label, 'frustration');
console.log('WorkPass48/49 autonomous dialogue queue and output privacy: PASS (quiet-time, topic novelty, private-topic rejection, affect-linked tone, pending dedupe, staging, honest delivery ACK, restore and legacy migration)');
