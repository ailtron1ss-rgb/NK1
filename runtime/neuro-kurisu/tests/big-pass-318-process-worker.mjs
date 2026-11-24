import assert from 'node:assert/strict';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const [, , phase, stateFile] = process.argv;
assert.ok(phase === 'write' || phase === 'restart', `invalid phase: ${phase}`);
assert.ok(stateFile, 'state file required');

const config = {
  performanceProfile:'mobile', cycleResultMode:'operational', enableTemporalResolutionGovernor:true,
  operationalPulseEvery:2, checkpointMaxDirtyCycles:1, checkpointMinIntervalMs:0,
};
const store = new FileStateStore(stateFile, { backupEverySaves:2, directoryFsyncEverySaves:1, strictDirectoryFsync:false });
const core = new OrganismCore(store, config);
await core.init();

const observations = [
  { embodiment:{bodyEnergy01:.88,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.84,battery01:.86,cpuLoad01:.22,ramPressure01:.22,awake:true}, novelty:.40, surprise:.10, text:'Verify a consequence and learn from the observed result.' },
  { embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.80,thermalStrain01:.22,sensoryFreshness01:.82,battery01:.80,cpuLoad01:.28,ramPressure01:.25,awake:true}, novelty:.48, surprise:.14, text:'Prefer evidence-backed action and update from outcome.' },
  { embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.74,thermalStrain01:.28,sensoryFreshness01:.80,battery01:.74,cpuLoad01:.33,ramPressure01:.29,awake:true}, novelty:.56, surprise:.21, text:'Reconsider uncertain action before committing.' },
];

async function tickOnce(i) {
  const before = core.b305CriticalPathDiagnostics();
  const result = await core.observeOperational(observations[i % observations.length]);
  const action = result.decision?.selected?.action ?? result.decision?.action ?? 'wait';
  const reward = action === 'verify' ? .93 : action === 'explore' ? .86 : action === 'reflect' ? .79 : .68;
  await core.feedback({
    success:reward,
    reward:reward*.9,
    surprise:reward>.7?.08:.22,
    evidenceSource:'device',
    worldTransition:{
      action,
      before:{tick:core.snapshot().state.tick,location:'b318',energy:.80,attention:.72,uncertainty:.55,facts:[`before-${i}`],objects:[],events:[]},
      after:{tick:core.snapshot().state.tick+1,location:'b318',energy:.76,attention:.75,uncertainty:.30,facts:[`after-${i}`,`action:${action}`],objects:[],events:['verified-transition']},
      reward,surprise:reward>.7?.08:.22,at:Date.now(),
    },
  });
  const after = core.b305CriticalPathDiagnostics();
  assert.ok(after.cycles >= before.cycles, 'B318 critical path regressed');
  return action;
}

if (phase === 'write') {
  const actions = [];
  for (let i=0;i<3;i++) actions.push(await tickOnce(i));
  await core.flush();
  const closure = core.cognitiveDomainClosureDiagnostics();
  const learning = core.b296NeuralPersonalityAgencyDiagnostics();
  const personality = core.b299CausalPersonalityDiagnostics();
  const persisted = await store.load();
  assert.ok(persisted?.state?.tick >= 3, 'B318 write phase did not persist cycles');
  console.log('B318_RESULT ' + JSON.stringify({
    phase, processPid:process.pid, tick:core.snapshot().state.tick,
    learningUpdates:learning.learningUpdates, synapticUpdates:learning.synapticUpdates,
    closureCycles:closure.totalCycles, completeClosureCycles:closure.completeCycles,
    lastAction:core.snapshot().state.lastAction, actions,
    personalityInfluence01:personality.personalityInfluence01,
    storeSaves:store.metrics().saves,
  }));
} else {
  const loaded = await store.load();
  assert.ok(loaded, 'B318 restart worker could not load durable state');
  const loadedTick = loaded.state.tick;
  const coreLoaded = core.snapshot();
  const loadedLearningUpdates = core.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
  const loadedClosureCycles = core.cognitiveDomainClosureDiagnostics().totalCycles;
  const loadedLastAction = coreLoaded.state.lastAction;
  await tickOnce(0);
  await core.flush();
  const resumed = core.snapshot();
  const resumedLearningUpdates = core.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
  const resumedClosureCycles = core.cognitiveDomainClosureDiagnostics().totalCycles;
  console.log('B318_RESULT ' + JSON.stringify({
    phase, processPid:process.pid, loadedTick, loadedLearningUpdates, loadedClosureCycles,
    loadedAction:loadedLastAction, resumedTick:resumed.state.tick,
    resumedLearningUpdates, resumedClosureCycles,
  }));
}
