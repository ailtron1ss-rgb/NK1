import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const now = Date.now();
const bootstrap = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational' });
await bootstrap.init();
const seed = structuredClone(bootstrap.snapshot());
seed.state.needs.socialNeed = .99;
seed.state.needs.identityCoherence = .99;
seed.state.needs.novelty = .99;
seed.state.needs.energy = .99;
seed.goals = [{ id:'clock-goal', title:'Исследовать, как причины связывают память и выбор действия', source:'intrinsic', importance:.95, urgency:.9, progress:.1, status:'active' }];
seed.memories = [{ id:'clock-memory', kind:'pattern', summary:'Проверка результата действия связывает цель, внешнее наблюдение и последующее автобиографическое воспоминание.', salience:.9, confidence:.82, source:'clock-integration', evidence:['goal','observation'], createdAt:now-120_000 }];
seed.system.autonomousSocialInitiative = { version:1, cycles:0, planned:0, executed:0, deferred:0, reciprocity01:.5, initiative01:.6, initiatives:[], startedAt:now-900_000, lastExternalInputAt:now-900_000, lastInitiativeAt:now-900_000 };
const stateStore = new MemoryStateStore({ initial:seed });
let providerCalls = 0;
const runtime = new OrganismRuntime({
  stateFile:'/tmp/neuro-kurisu-workpass50-background-clock.json', stateStore, worldStateStore:new MemoryStateStore(),
  enableLanguage:true, autoRun:true, intervalMs:60_000, sensorIntervalMs:60_000, checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1,
  languageInvoker:async request => { providerCalls++; assert.ok(request.system && request.user); return { text:'Я хочу продолжить мысль: чтобы связать память и действие, нужно проверить причинную цепочку на независимом наблюдении. Иначе мы лишь поверим собственной симуляции.', backend:'workpass50-background-clock-provider-seam' }; },
});
try {
  await runtime.init();
  const deadline = Date.now() + 12_000;
  let ready = null;
  while (Date.now() < deadline) {
    ready = await runtime.autonomousDialogueReady();
    if (providerCalls > 0 && ready?.message) break;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  const clock = runtime.longitudinalSnapshot().runtimeClocks.cognitive;
  assert.ok(clock.executions >= 1, 'autoRun scheduler must execute the canonical cognitive loop');
  assert.ok(providerCalls >= 1, 'the real background clock must reach the configured provider seam without a manual step()');
  assert.ok(ready?.message && ready.status === 'ready', 'the background runtime must stage an unsolicited turn for the app polling endpoint');
  assert.ok(ready.interestContext?.label, 'the produced turn retains its canonical personal-interest context');
  const id = ready.id;
  assert.equal(await runtime.acknowledgeAutonomousDialogue(id), true);
  await runtime.stop();
  const persisted = await stateStore.load();
  assert.equal(persisted.system.autonomousSocialInitiative.initiatives.find(item => item.id === id)?.status, 'executed');
  assert.ok(persisted.facets.consciousness.p33.development.interestProfiles.some(profile => profile.evidenceCount > 0));
  console.log(`WORKPASS50_BACKGROUND_CLOCK=PASS (clockExecutions=${clock.executions}; providerCalls=${providerCalls}; staged+acked+persisted=true)`);
} finally {
  await runtime.stop().catch(() => {});
}
