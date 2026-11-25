import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

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
  deliveryAdmission: record => {
    if (!runtime || record.kind !== 'social-initiative' || record.initiativeId !== expectedInitiativeId) return false;
    const policy = runtime.core.autonomousInitiativeDeliveryPolicy();
    return policy.mayDeliverUserVisible === true
      && runtime.core.pendingAutonomousSocialInitiativeMessage()?.id === expectedInitiativeId;
  },
};

function plan(at, topic) {
  return runtime.core.organismSystemFabric.agency.autonomousSocialInitiative.cycle({
    at, externalInput: false, socialNeed01: .95, relationship01: .4,
    energy01: .9, identity01: .96, novelty01: .6,
    topics: [{ topic, source: 'reflection', salience01: .9, freshness01: .9, interestFit01: .7, affectFit01: .6 }],
    quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
  }).initiative;
}

async function stage(initiative, message) {
  assert.ok(initiative);
  expectedInitiativeId = initiative.id;
  assert.equal(runtime.core.stageAutonomousSocialInitiativeMessage(
    initiative.id, message, initiative.createdAt + 1,
  ), true);
  await runtime.core.flush();
}

try {
  runtime = new OrganismRuntime(runtimeConfig);
  await runtime.init();

  const firstInitiative = plan(Date.now() - 2_000, 'Investigate a bounded unresolved question about durable memory and evidence');
  assert.ok(firstInitiative, 'the canonical social engine creates an initiative');
  await stage(firstInitiative, 'Есть проверяемая связь между инициативой и долговечным подтверждением доставки.');
  const firstDelivery = await runtime.autonomousDialogueReady();
  assert.equal(firstDelivery?.id, firstInitiative.id, 'the old UI API response shape remains intact');
  const firstObligation = (await runtime.deliveryOutboxSnapshot()).records
    .find(record => record.initiativeId === firstInitiative.id);
  assert.ok(firstObligation, 'Runtime persists a durable outbox obligation before returning the proactive turn');
  assert.equal(firstObligation.kind, 'social-initiative');
  assert.equal(firstObligation.payloadRef, `nk1:social-initiative/${firstInitiative.id}`);
  assert.equal(firstObligation.status, 'leased');
  assert.equal(firstObligation.attemptCount, 1);
  assert.equal(await runtime.autonomousDialogueReady(), null, 'an active lease suppresses a duplicate poll');
  assert.equal(await runtime.acknowledgeAutonomousDialogue(firstInitiative.id), true);
  assert.equal(await runtime.acknowledgeAutonomousDialogue(firstInitiative.id), true, 'repeat ACK is idempotent');
  assert.equal((await runtime.deliveryOutboxSnapshot()).records
    .find(record => record.initiativeId === firstInitiative.id)?.status, 'delivered');
  assert.equal(await runtime.autonomousDialogueReady(), null, 'an acknowledged item cannot be exposed again');

  const secondInitiative = plan(Date.now() - 2_000,
    'Compare two independent ways to validate a local reranker without changing canonical retrieval');
  await stage(secondInitiative, 'Важен раздельный тест локальной модели и канонического механизма памяти.');
  assert.equal((await runtime.autonomousDialogueReady())?.id, secondInitiative.id);
  assert.equal(await runtime.prepareNextDeliveryObligation('lease-expiry-probe', 1_000, Date.now() + 31_000), null);
  assert.equal((await runtime.deliveryOutboxSnapshot()).records
    .find(record => record.initiativeId === secondInitiative.id)?.status,
    'reconciliation-required', 'an expired ambiguous lease is quarantined');
  assert.equal((await runtime.autonomousDialogueReady())?.id, secondInitiative.id,
    'the same stable initiative ID can be replayed to the idempotent browser recipient');
  assert.equal(await runtime.acknowledgeAutonomousDialogue(secondInitiative.id), true,
    'the browser transcript ACK reconciles the expired lease');
  assert.equal((await runtime.deliveryOutboxSnapshot()).records
    .find(record => record.initiativeId === secondInitiative.id)?.status, 'delivered');

  const thirdInitiative = plan(Date.now() - 2_000,
    'Check whether revoked delivery consent suppresses a queued social message');
  await stage(thirdInitiative, 'Это сообщение не должно обходить отозванное согласие.');
  assert.equal((await runtime.autonomousDialogueReady())?.id, thirdInitiative.id);
  runtime.core.setAutonomousInitiativeConsent(false);
  assert.equal(await runtime.autonomousDialogueReady(), null, 'revoked consent blocks subsequent proactive exposure');
  assert.equal((await runtime.deliveryOutboxSnapshot()).records
    .find(record => record.initiativeId === thirdInitiative.id)?.status,
    'leased', 'an already exposed lease remains auditable after consent revocation');
  await runtime.stop();
  runtime = null;
  console.log(JSON.stringify({ test: 'autonomous-social-delivery-runtime', assertions: 16, status: 'PASS' }));
} finally {
  await runtime?.stop().catch(() => {});
  await fs.rm(runtimeDirectory, { recursive: true, force: true });
}
