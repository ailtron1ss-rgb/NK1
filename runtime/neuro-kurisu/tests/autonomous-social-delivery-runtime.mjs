import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const at = Date.now() - 2_000;
const runtimeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-social-delivery-runtime-'));
let runtime;
let expectedInitiativeId = null;
const runtimeConfig = {
  stateFile: path.join(runtimeDirectory, 'organism.json'),
  worldStateFile: path.join(runtimeDirectory, 'world.json'),
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  intervalMs: 60_000,
  enableLanguage: false,
  autoRun: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  deliveryAdmission: (record) => {
    if (!runtime || record.kind !== 'social-initiative' || record.initiativeId !== expectedInitiativeId) return false;
    return runtime.core.pendingAutonomousSocialInitiativeMessage()?.id === expectedInitiativeId;
  },
};

try {
  runtime = new OrganismRuntime(runtimeConfig);
  await runtime.init();

  const engine = runtime.core.organismSystemFabric.agency.autonomousSocialInitiative;
  const planned = engine.cycle({
    at,
    externalInput: false,
    socialNeed01: .95,
    relationship01: .4,
    energy01: .9,
    identity01: .96,
    novelty01: .6,
    topics: [{
      topic: 'Investigate a bounded unresolved question about durable memory and evidence',
      source: 'reflection',
      salience01: .9,
      freshness01: .9,
      interestFit01: .7,
      affectFit01: .6,
    }],
    quietPeriodMs: 0,
    cooldownMs: 0,
    startupGraceMs: 0,
  });
  assert.ok(planned.initiative, 'the canonical social engine should produce a test initiative');
  expectedInitiativeId = planned.initiative.id;
  assert.equal(
    engine.stageMessage(expectedInitiativeId, 'Есть проверяемая связь между инициативой и долговечным подтверждением доставки.', at + 1),
    true,
  );
  await runtime.core.flush();

  const firstDelivery = await runtime.autonomousDialogueReady();
  assert.equal(firstDelivery?.id, expectedInitiativeId, 'the existing proactive-message API retains its initiative response shape');
  const firstSnapshot = await runtime.deliveryOutboxSnapshot();
  const obligation = firstSnapshot.records.find(record => record.initiativeId === expectedInitiativeId);
  assert.ok(obligation, 'Runtime must persist a durable outbox obligation before exposing the proactive message');
  assert.equal(obligation.kind, 'social-initiative');
  assert.equal(obligation.payloadRef, `nk1:social-initiative/${expectedInitiativeId}`);
  assert.equal(obligation.status, 'leased', 'the host admission gate must be applied before the UI receives the initiative');
  assert.equal(obligation.attemptCount, 1);

  assert.equal(await runtime.autonomousDialogueReady(), null,
    'a second poll must not lease the same proactive message while its durable lease is active');
  assert.equal(await runtime.acknowledgeAutonomousDialogue(expectedInitiativeId), true,
    'the existing ACK API closes both the social initiative and its durable delivery obligation');
  const afterAck = (await runtime.deliveryOutboxSnapshot()).records.find(record => record.initiativeId === expectedInitiativeId);
  assert.equal(afterAck?.status, 'delivered');
  assert.equal(await runtime.autonomousDialogueReady(), null,
    'an acknowledged initiative must not be exposed again');

  await runtime.stop();
  runtime = null;
  console.log(JSON.stringify({ test: 'autonomous-social-delivery-runtime', assertions: 11, status: 'PASS' }));
} finally {
  await runtime?.stop().catch(() => {});
  await fs.rm(runtimeDirectory, { recursive: true, force: true });
}
