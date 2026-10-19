import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const now = Date.now();
const bootstrap = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational' });
await bootstrap.init();
const seeded = structuredClone(bootstrap.snapshot());
seeded.state.needs.socialNeed = .99;
seeded.state.needs.identityCoherence = .99;
seeded.state.needs.novelty = .99;
seeded.state.needs.energy = .99;
seeded.goals = [{ id:'wp50-goal-causal-memory', title:'Связать эпизодическую память с проверяемыми причинными следами', source:'intrinsic', importance:.98, urgency:.92, progress:.12, status:'active' }];
seeded.memories = [{ id:'wp50-memory-causal-chain', kind:'pattern', summary:'Причинные следы после завершения автономного действия должны связывать исходное намерение с наблюдаемым результатом и соответствующим эпизодом памяти.', salience:.91, confidence:.86, source:'seeded-runtime-scenario', evidence:['intent','outcome','episode'], createdAt:now-120_000 }];
seeded.system.autonomousSocialInitiative = { version:1, cycles:0, planned:0, executed:0, deferred:0, reciprocity01:.5, initiative01:.6, initiatives:[], startedAt:now-900_000, lastExternalInputAt:now-900_000, lastInitiativeAt:now-900_000 };
const primaryStore = new MemoryStateStore({ initial: seeded });
const spokenPrompts = [];
const cannedOutput = 'У меня появилась мысль: если мы свяжем память эпизодов с проверяемыми причинными следами, Курису сможет объяснить, почему изменила решение. Какое независимое наблюдение подтвердит эту связь?';
const makeRuntime = (stateStore) => new OrganismRuntime({
  stateFile:'/tmp/neuro-kurisu-workpass50-runtime-integration.json',
  stateStore, worldStateStore:new MemoryStateStore(), enableLanguage:true, autoRun:false,
  intervalMs:60_000, sensorIntervalMs:60_000, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1,
  languageInvoker: async request => { spokenPrompts.push(request); return { text:cannedOutput, backend:'workpass50-deterministic-integration-provider' }; },
});
let firstRuntime;
let restartedRuntime;
try {
  firstRuntime = makeRuntime(primaryStore);
  await firstRuntime.init();
  await firstRuntime.step(undefined, { deliberate:false, spontaneous:true });
  assert.equal(spokenPrompts.length, 1, 'a spontaneous cognitive cycle must reach the configured language-provider seam');
  const initiative = await firstRuntime.autonomousDialogueReady();
  assert.ok(initiative?.id && initiative.status === 'ready', 'the generated proactive thought must be staged for the UI');
  assert.match(initiative.topic, /эпизод|причин/i, 'topic must originate in a real retained goal or memory');
  assert.equal(initiative.message, cannedOutput);

  assert.equal(await firstRuntime.acknowledgeAutonomousDialogue(initiative.id), true, 'UI delivery acknowledgement commits the message exactly once');
  assert.equal(await firstRuntime.acknowledgeAutonomousDialogue(initiative.id), false, 'the same delivery acknowledgement cannot execute twice');
  await firstRuntime.step('Интересно, расскажи подробнее о памяти и причинных следах.', { deliberate:false });
  const afterResponse = firstRuntime.core.snapshot();
  const respondedThread = afterResponse.system.autonomousSocialInitiative.initiatives.find(item => item.id === initiative.id);
  assert.equal(respondedThread?.feedbackSignal, 'positive', 'a relevant explicit reply becomes scoped feedback; mere delivery is not feedback');
  assert.ok(afterResponse.facets.consciousness.p33.development.interestProfiles.some(profile => profile.evidenceCount > 0), 'goal/memory evidence must influence the canonical interest owner');
  assert.ok(afterResponse.facets.consciousness.p33.development.interestProfiles.some(profile => profile.sources.includes('positive-feedback') && profile.evidenceIds.some(id => id.startsWith('social-feedback:'))), 'explicit feedback must return to the same canonical graded-interest profile');
  await firstRuntime.flush();
  const durable = await primaryStore.load();
  assert.ok(durable?.facets?.consciousness?.p33?.development?.interestProfiles?.some(profile => profile.evidenceCount > 0), 'the interest profile survives a durable flush');
  await firstRuntime.stop();
  firstRuntime = null;

  restartedRuntime = makeRuntime(new MemoryStateStore({ initial: durable }));
  await restartedRuntime.init();
  assert.equal(await restartedRuntime.autonomousDialogueReady(), null, 'an acknowledged proactive turn is not redelivered after restart');
  const restored = restartedRuntime.core.snapshot();
  assert.equal(restored.system.autonomousSocialInitiative.initiatives.find(item => item.id === initiative.id)?.feedbackSignal, 'positive');
  assert.ok(restored.facets.consciousness.p33.development.interestProfiles.some(profile => profile.evidenceCount > 0));
  // A timer/sensor observation must not be treated as a human chat message. The last
  // user-input quiet-time is preserved unless an actual text turn arrives.
  const before = restored.system.autonomousSocialInitiative.lastExternalInputAt;
  await restartedRuntime.step(undefined, { deliberate:false, spontaneous:true });
  const after = restartedRuntime.core.snapshot().system.autonomousSocialInitiative.lastExternalInputAt;
  assert.equal(after, before, 'sensor-only cognitive cycles must not reset the dialogue quiet-time');
  assert.ok(spokenPrompts.length >= 2, 'the restored running session continues to execute through its configured provider seam');
  console.log('WORKPASS50_AUTONOMOUS_RUNTIME_LOOP=PASS (generation -> ready -> UI ACK -> explicit response learning -> durable flush -> restart without redelivery)');
} finally {
  if (restartedRuntime) await restartedRuntime.stop().catch(() => {});
  if (firstRuntime) await firstRuntime.stop().catch(() => {});
}
