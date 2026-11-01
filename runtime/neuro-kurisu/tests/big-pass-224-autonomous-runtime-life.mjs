import assert from 'node:assert/strict';
import { AutonomousRuntimeLifeController } from '../src/organism/system/AutonomousRuntimeLifeController.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const ctl=new AutonomousRuntimeLifeController();
let r=ctl.tick({tick:1,at:10000,externalSignal:false,energy01:.82,uncertainty01:.52,novelty01:.72,goalPressure01:.61,homeostaticPressure01:.18,initiative01:.79,predictionError01:.31,resourcePressure01:.2});
assert.equal(r.autonomous,true); assert.equal(r.shouldAct,true);
r=ctl.tick({tick:2,at:25000,externalSignal:false,energy01:.79,uncertainty01:.38,novelty01:.64,goalPressure01:.55,homeostaticPressure01:.16,initiative01:.74,predictionError01:.22,resourcePressure01:.18});
assert.equal(r.autonomous,true); assert.ok(ctl.summary().selfStartedCycles>=2); assert.ok(ctl.summary().temporalPersistence01>.28);
const blocked=ctl.tick({tick:3,at:40000,externalSignal:false,energy01:.11,uncertainty01:.7,novelty01:.4,goalPressure01:.8,homeostaticPressure01:.95,initiative01:.9,predictionError01:.7,resourcePressure01:.9});
assert.equal(blocked.shouldAct,false);assert.equal(blocked.mode,'recover');
const restoredCtl=new AutonomousRuntimeLifeController();restoredCtl.restore(ctl.snapshot());assert.equal(restoredCtl.summary().selfStartedCycles,ctl.summary().selfStartedCycles);
const store=new MemoryStateStore();const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);await core.init();await core.autonomousHeartbeat(100000);await core.flush();
const s1=core.systemSnapshot().autonomousRuntimeLife;assert.ok((s1?.ambientCycles??0)>=1);assert.ok((s1?.selfStartedCycles??0)>=1);assert.ok((s1?.selfAuthoredActivity01??0)>.35);
const core2=new OrganismCore(store,cfg);await core2.init();const s2=core2.systemSnapshot().autonomousRuntimeLife;assert.equal(s2?.selfStartedCycles,s1?.selfStartedCycles);assert.equal(s2?.ambientCycles,s1?.ambientCycles);
console.log(JSON.stringify({pass:'BIG_PASS_224_AUTONOMOUS_RUNTIME_LIFE',controller:{selfStartedCycles:ctl.summary().selfStartedCycles,idleGapCycles:ctl.summary().idleGapCycles,temporalPersistence01:ctl.summary().temporalPersistence01,environmentalAgency01:ctl.summary().environmentalAgency01,longestStreak:ctl.summary().longestStreak},core:{ambientCycles:s1?.ambientCycles,selfStartedCycles:s1?.selfStartedCycles,selfAuthoredActivity01:s1?.selfAuthoredActivity01,temporalPersistence01:s1?.temporalPersistence01,persistedSelfStartedCycles:s2?.selfStartedCycles},verified:true},null,2));

const cadenceCtl=new AutonomousRuntimeLifeController();
const cadenceInput={energy01:.82,uncertainty01:.52,novelty01:.72,goalPressure01:.61,homeostaticPressure01:.18,initiative01:.79,predictionError01:.31,resourcePressure01:.2};
const firstAmbient=cadenceCtl.tick({tick:1,at:10000,externalSignal:false,...cadenceInput});
assert.equal(firstAmbient.shouldAct,true);
assert.equal(firstAmbient.autonomous,true);
const earlyAmbient=cadenceCtl.tick({tick:2,at:11000,externalSignal:false,...cadenceInput});
assert.equal(earlyAmbient.shouldAct,false,"silent work must wait for the next internal cadence");
assert.equal(earlyAmbient.reason,"waiting-for-cadence");
assert.equal(cadenceCtl.summary().selfStartedCycles,1,"a skipped heartbeat is not a self-started action");
const reactive=cadenceCtl.tick({tick:3,at:12000,externalSignal:true,...cadenceInput});
assert.equal(reactive.shouldAct,true,"external input must bypass the ambient cadence");
assert.equal(reactive.autonomous,false);
assert.equal(cadenceCtl.summary().externallyTriggeredCycles,1);
const stillEarly=cadenceCtl.tick({tick:4,at:13000,externalSignal:false,...cadenceInput});
assert.equal(stillEarly.shouldAct,false);
const resumed=cadenceCtl.tick({tick:5,at:30000,externalSignal:false,...cadenceInput});
assert.equal(resumed.shouldAct,true,"internal initiative resumes once its cadence is due");
assert.equal(resumed.autonomous,true);
assert.equal(cadenceCtl.summary().selfStartedCycles,2);
assert.equal(cadenceCtl.summary().continuedAfterSilence,1,"silence continuation compares against the prior activity timestamp");


// Persisted autonomy snapshots are an untrusted boundary: never execute accessors
// and never allow malformed counters, ratios or history rows into live state.
const safeRestore = new AutonomousRuntimeLifeController();
const malformedSnapshot = {
  ...ctl.snapshot(),
  ticks: -4,
  selfAuthoredActivity01: Number.NaN,
  lastMode: 'sleep',
  recent: [
    { tick: 7, mode: 'reflect', reason: 'valid-row', autonomous: true, outcome01: 2, at: 70000 },
    { tick: 'bad', mode: 'reflect', reason: 'invalid-row', autonomous: true, outcome01: 0.5, at: 71000 },
  ],
};
safeRestore.restore(malformedSnapshot);
assert.equal(safeRestore.summary().ticks, 0, 'negative persisted counters fall back to safe defaults');
assert.equal(safeRestore.summary().selfAuthoredActivity01, 0.35, 'non-finite persisted ratios fall back to defaults');
assert.equal(safeRestore.summary().lastMode, 'idle', 'unknown persisted modes are rejected');
assert.equal(safeRestore.snapshot().recent.length, 1, 'malformed history rows are skipped');
assert.equal(safeRestore.snapshot().recent[0].outcome01, 1, 'persisted outcome values are clamped');

let restoreGetterCalls = 0;
const accessorSnapshot = ctl.snapshot();
Object.defineProperty(accessorSnapshot, 'ticks', {
  enumerable: true,
  get() { restoreGetterCalls += 1; return 999; },
});
safeRestore.restore(accessorSnapshot);
assert.equal(restoreGetterCalls, 0, 'restore must not execute snapshot getters');
assert.equal(safeRestore.summary().ticks, 0, 'accessor-backed counters use safe defaults');

const hostileSnapshot = new Proxy(ctl.snapshot(), {
  getOwnPropertyDescriptor() { throw new Error('hostile snapshot trap'); },
});
assert.doesNotThrow(() => safeRestore.restore(hostileSnapshot));
assert.equal(safeRestore.summary().ticks, 0, 'hostile snapshots reset to safe defaults');
