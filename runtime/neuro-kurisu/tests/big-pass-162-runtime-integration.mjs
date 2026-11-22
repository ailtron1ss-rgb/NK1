import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { RiskAwareRecoveryController } from '../src/organism/cognition/RiskAwareRecoveryController.ts';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'nk162-runtime-'));
const stateStore=new MemoryStateStore();
const worldStore=new MemoryStateStore();
const cognitiveSpineStore=new MemoryStateStore();
const riskAwareRecoveryStore=new MemoryStateStore();
const mk=()=>new OrganismRuntime({
  stateFile:path.join(root,'organism.json'),
  intervalMs:60_000,
  enableLanguage:false,
  autoRun:false,
  stateStore,
  worldStateStore:worldStore,
  cognitiveSpineStore,
  riskAwareRecoveryStore,
  journal:new BoundedOperationalJournal(),
  checkpointMinIntervalMs:0,
  checkpointMaxDirtyCycles:1,
  enableLifelongLearning:true,
  performanceProfile:'mobile',
});
// Missing verification evidence must increase decision risk, all other signals equal.
const riskArgs={
  tick:1,actionUtilities:{respond:.4,explore:.8,verify:.7,rest:.3,reflect:.6,wait:.2,defer:.1},
  predictionError01:.9,uncertainty01:.9,modelDrift01:.8,recoveryGain01:.1,verified01:0,computeBudget01:.7,
};
const unverifiedRisk=new RiskAwareRecoveryController();
const highRisk=unverifiedRisk.beforeDecision(riskArgs);
const verifiedRisk=new RiskAwareRecoveryController().beforeDecision({...riskArgs,verified01:1});
assert.ok(highRisk.risk01>verifiedRisk.risk01,'missing verification evidence must increase estimated decision risk');
assert.equal(highRisk.abstain,true,'very high risk with weak recovery gain must abstain from autonomous action');
assert.equal(highRisk.recoveryAction,'explore','recovery action must use the best available recovery utility');
unverifiedRisk.afterOutcome({reward01:.2,verified01:0,predictionError01:.9,recoveryTriggered:true,recoverySuccessful01:.1,failureSeverity01:.9});
assert.equal(unverifiedRisk.snapshot().failedRecoveries,1,'failed recovery outcomes must feed calibration');
const restoredRisk=new RiskAwareRecoveryController();
restoredRisk.restore(unverifiedRisk.snapshot());
assert.deepEqual(restoredRisk.snapshot(),unverifiedRisk.snapshot(),'risk calibration must round-trip');
let hostileRiskGetterExecuted=false;
const hostileRiskSnapshot={};
Object.defineProperty(hostileRiskSnapshot,'meanRisk01',{enumerable:true,get(){hostileRiskGetterExecuted=true;throw new Error('must-not-run');}});
new RiskAwareRecoveryController().restore(hostileRiskSnapshot);
assert.equal(hostileRiskGetterExecuted,false,'risk state restore must not execute accessors');

const rt=mk();
await rt.init();
const before=rt.unifiedCognitiveCycleSnapshot();
const step=await rt.step('Please investigate the unfamiliar result and learn from the outcome.');
const economy=rt.cognitiveResourceEconomySnapshot();
const spine=rt.cognitiveSpineSchedulerSnapshot();
const riskState=rt.riskAwareRecoverySnapshot();
assert.equal(spine.lastTick,step.cycle.state.tick,'runtime must drive the cognitive-spine scheduler on every cycle');
assert.equal(riskState.tick,step.cycle.state.tick,'runtime must drive risk appraisal on each real cognitive cycle');
assert.equal(riskState.decisions,1,'runtime must call the canonical risk recovery owner once per cycle');
assert.ok(rt.evidenceSnapshot().recent.some(event=>event.source==='risk-aware-recovery-controller'),'risk decisions must be causally visible in runtime evidence');
assert.equal(Object.values(spine.opportunities).reduce((sum,value)=>sum+value,0),4,'one cycle must account for all four optional operations');
assert.ok(rt.evidenceSnapshot().recent.some(event=>event.source==='cognitive-spine-scheduler'),'scheduler decisions must be visible in runtime evidence');
const evidence=rt.realityEvidenceLedgerSnapshot();
const cycle=rt.unifiedCognitiveCycleSnapshot();
assert.ok(step?.cycle?.state?.tick>=1);
assert.ok(cycle.cycles>before.cycles);
assert.equal(cycle.lastComplete,true);
assert.ok(cycle.meanStageCoverage01>0.9);
assert.ok(economy.cycles>=1);
assert.ok(evidence.total>=3);
assert.ok(evidence.simulatorCount>=1);
assert.ok(evidence.externalCount>=1);
await rt.core.flush();
const rt2=mk(); await rt2.init();
assert.equal(rt2.unifiedCognitiveCycleSnapshot().cycles,cycle.cycles);
assert.equal(rt2.cognitiveResourceEconomySnapshot().cycles,economy.cycles);
assert.deepEqual(rt2.cognitiveSpineSchedulerSnapshot(),spine,'cognitive-spine cadence state must survive runtime restart');
assert.deepEqual(rt2.riskAwareRecoverySnapshot(),riskState,'risk calibration and recovery counters must survive runtime restart');
assert.equal(rt2.realityEvidenceLedgerSnapshot().total,evidence.total);
const status=rt2.core.operationalStatusSnapshot();
assert.equal(status.tick,step.cycle.state.tick);
await rt2.stop(); await rt.stop();

const corruptSpineStore = { async load() { throw new Error('corrupt-cognitive-spine-sidecar'); }, async save() {} };
const corruptRiskStore = { async load() { throw new Error('corrupt-risk-recovery-sidecar'); }, async save() {} };
const degradedRuntime = new OrganismRuntime({
  stateFile:path.join(root,'degraded-organism.json'),
  intervalMs:60_000,
  enableLanguage:false,
  autoRun:false,
  stateStore:new MemoryStateStore(),
  worldStateStore:new MemoryStateStore(),
  cognitiveSpineStore:corruptSpineStore,
  riskAwareRecoveryStore:corruptRiskStore,
  journal:new BoundedOperationalJournal(),
  checkpointMinIntervalMs:0,
  checkpointMaxDirtyCycles:1,
  performanceProfile:'mobile',
});
await assert.doesNotReject(()=>degradedRuntime.init(),'corrupt optional cadence sidecar must not block organism startup');
assert.equal(degradedRuntime.cognitiveSpineSchedulerSnapshot().lastReason,'initial');
assert.equal(degradedRuntime.riskAwareRecoverySnapshot().decisions,0,'corrupt optional risk sidecar must fail back to an empty safe controller');
await degradedRuntime.stop();
console.log(JSON.stringify({pass:162,status:'PASS',tick:status.tick,cycle, economy,evidence:{total:evidence.total,externalCount:evidence.externalCount,simulatorCount:evidence.simulatorCount}},null,2));
