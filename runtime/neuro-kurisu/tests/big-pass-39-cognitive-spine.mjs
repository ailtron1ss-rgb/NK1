import assert from 'node:assert/strict';
import { CognitiveSpineScheduler } from '../src/organism/system/CognitiveSpineScheduler.ts';
import { SelfPredictionBenchmark } from '../src/organism/system/SelfPredictionBenchmark.ts';
import { ModelOlympics } from '../src/organism/system/ModelOlympics.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const scheduler=new CognitiveSpineScheduler();
const quiet=scheduler.decide({tick:1,surprise01:.05,predictionError01:.05,novelty01:.05,goalPressure01:.05,budgetMode:'sleep',remainingBudget01:.05,externalInput:false,awake:false});
assert.equal(quiet.mode,'protect');
const urgent=scheduler.decide({tick:2,surprise01:.95,predictionError01:.9,novelty01:.9,goalPressure01:.85,budgetMode:'balanced',remainingBudget01:.9,externalInput:true,awake:true});
assert.equal(urgent.mode,'deep');
assert.ok(urgent.run.shadow && urgent.run.project);

// Protective budget mode is a hard stop for optional secondary work, even
// when an urgent external event arrives on a tick that normally runs all loops.
const protectScheduler = new CognitiveSpineScheduler();
const protectedUrgent = protectScheduler.decide({
  tick: 6, surprise01: .95, predictionError01: .9, novelty01: .9,
  goalPressure01: .85, budgetMode: 'sleep', remainingBudget01: .05,
  externalInput: true, awake: true,
});
assert.equal(protectedUrgent.mode, 'protect');
assert.deepEqual(protectedUrgent.run, { research: false, 'world-rollout': false, shadow: false, project: false });
const protectedSnapshot = protectScheduler.snapshot();
for (const operation of ['research', 'world-rollout', 'shadow', 'project']) {
  assert.equal(protectedSnapshot.runs[operation], 0, operation + ' must not run in protect mode');
  assert.equal(protectedSnapshot.skips[operation], 1, operation + ' must record the deferral');
  assert.equal(protectedSnapshot.opportunities[operation], 1, operation + ' opportunity must remain observable');
}

// Resource-pressure protection is also authoritative when urgency is high.
const constrainedScheduler = new CognitiveSpineScheduler();
const constrainedUrgent = constrainedScheduler.decide({
  tick: 3, surprise01: .95, predictionError01: .9, novelty01: .9,
  goalPressure01: .85, budgetMode: 'defer', remainingBudget01: .1,
  externalInput: true, awake: true,
});
assert.equal(constrainedUrgent.mode, 'protect');
assert.ok(Object.values(constrainedUrgent.run).every(value => value === false));


// Restore is a trust boundary: persisted counters are normalized and accessors are never executed.
const scheduleSource = new CognitiveSpineScheduler();
scheduleSource.decide({ tick: 4, surprise01: .1, predictionError01: .1, novelty01: .1, goalPressure01: .1, budgetMode: 'balanced', remainingBudget01: .9, externalInput: false, awake: false });
const scheduleSnapshot = scheduleSource.snapshot();
const scheduleRestored = new CognitiveSpineScheduler();
scheduleRestored.restore(scheduleSnapshot);
assert.deepEqual(scheduleRestored.snapshot(), scheduleSnapshot, 'valid scheduler snapshots must round-trip');

let restoreGetterReads = 0;
const accessorRuns = { 'world-rollout': 2, shadow: 3, project: 4 };
Object.defineProperty(accessorRuns, 'research', { enumerable: true, get() { restoreGetterReads += 1; return 99; } });
const accessorSchedule = { version: 1, mode: 'deep', lastDecisionAt: 12, runs: accessorRuns, skips: {}, opportunities: {}, savings01: 4, lastReason: 'x'.repeat(512) };
Object.defineProperty(accessorSchedule, 'lastTick', { enumerable: true, get() { restoreGetterReads += 1; return 999; } });
const accessorRestored = new CognitiveSpineScheduler();
assert.doesNotThrow(() => accessorRestored.restore(accessorSchedule));
const accessorState = accessorRestored.snapshot();
assert.equal(restoreGetterReads, 0, 'restore must not execute root or nested getters');
assert.equal(accessorState.mode, 'deep');
assert.equal(accessorState.lastTick, 0, 'accessor-backed tick must use the safe default');
assert.equal(accessorState.runs.research, 0, 'accessor-backed counter must use the safe default');
assert.equal(accessorState.runs['world-rollout'], 2);
assert.equal(accessorState.savings01, 1, 'finite metrics must be clamped');
assert.equal(accessorState.lastReason.length, 180, 'restored diagnostic text must be bounded');

const malformedSchedule = new CognitiveSpineScheduler();
malformedSchedule.restore({ version: 99, mode: 'deep', lastTick: Number.MAX_SAFE_INTEGER + 1, runs: { research: -1 } });
assert.deepEqual(malformedSchedule.snapshot(), {
  version: 1, mode: 'balanced', lastTick: 0, lastDecisionAt: 0,
  runs: { research: 0, 'world-rollout': 0, shadow: 0, project: 0 },
  skips: { research: 0, 'world-rollout': 0, shadow: 0, project: 0 },
  opportunities: { research: 0, 'world-rollout': 0, shadow: 0, project: 0 },
  savings01: 0, lastReason: 'initial',
}, 'unsupported scheduler snapshots must reset to a clean baseline');

const malformedCounters = new CognitiveSpineScheduler();
malformedCounters.restore({ version: 1, mode: 'unknown', lastTick: -1, lastDecisionAt: Number.MAX_SAFE_INTEGER + 1, runs: { research: -1, 'world-rollout': 2.5, shadow: Number.MAX_SAFE_INTEGER + 1, project: 2 }, skips: { research: 3 }, opportunities: {} });
const normalizedCounters = malformedCounters.snapshot();
assert.equal(normalizedCounters.mode, 'balanced', 'unknown modes must use the safe default');
assert.equal(normalizedCounters.lastTick, 0);
assert.equal(normalizedCounters.lastDecisionAt, 0);
assert.deepEqual(normalizedCounters.runs, { research: 0, 'world-rollout': 0, shadow: 0, project: 2 });
assert.equal(normalizedCounters.skips.research, 3);

const hostileProxy = new Proxy({}, { getPrototypeOf() { throw new Error('hostile-reflection'); } });
assert.doesNotThrow(() => malformedCounters.restore(hostileProxy), 'hostile Proxy reflection must not escape restore');
assert.equal(malformedCounters.snapshot().lastReason, 'initial');

const revokedSchedule = Proxy.revocable({}, {});
revokedSchedule.revoke();
assert.doesNotThrow(() => malformedSchedule.restore(revokedSchedule.proxy), 'revoked proxies must not escape restore');
assert.equal(malformedSchedule.snapshot().lastReason, 'initial');

const self=new SelfPredictionBenchmark();
self.seed({tick:1,predicted:'verify',confidence01:.8,horizon:1,at:1});
assert.equal(self.snapshot().pending.length,1);
assert.equal(self.resolveDue({tick:2,actual:'verify',at:2}),1);
self.seed({tick:3,predicted:'verify',confidence01:.8,horizon:1,at:3});
assert.equal(self.resolveDue({tick:4,actual:'explore',at:4}),1);
assert.equal(self.snapshot().samples,2);
assert.ok(self.snapshot().accuracy01 < 1);

const olympics=new ModelOlympics();
for(let i=0;i<12;i++) olympics.scoreRound({actual01:.9, predictions:{good:{predicted01:.9},poor:{predicted01:.2}},at:i});
const snap=olympics.snapshot();
assert.equal(snap.winner,'good');
assert.ok(snap.scores.good.accuracy01 > snap.scores.poor.accuracy01);
assert.ok(snap.scores.good.meanBrier01 < snap.scores.poor.meanBrier01);
assert.ok(olympics.calibrate('poor',.95) < .95);
assert.ok(olympics.calibrate('good',.95) > olympics.calibrate('poor',.95));
console.log('BIG_PASS_39_SPINE_UNITS=PASS',JSON.stringify({winner:snap.winner,accuracy:snap.scores.good.accuracy01,selfSamples:self.snapshot().samples,protectMode:quiet.mode,deepMode:urgent.mode}));

const gateway=new ActionGateway({live:true});
gateway.registerTool({id:'project.safe',capability:'project.safe',destructive:false,projectAllowed:true,execute:async()=>({ok:true})});
gateway.registerTool({id:'project.danger',capability:'project.danger',destructive:true,projectAllowed:true,execute:async()=>({ok:true})});
assert.equal(gateway.listTools().find(x=>x.id==='project.safe')?.projectAllowed,true);
assert.equal(gateway.listTools().find(x=>x.id==='project.danger')?.destructive,true);
