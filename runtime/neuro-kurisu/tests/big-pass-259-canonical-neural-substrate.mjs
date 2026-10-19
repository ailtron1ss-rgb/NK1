import assert from 'node:assert/strict';
import { CanonicalNeuralSubstrate } from '../src/organism/cognition/CanonicalNeuralSubstrate.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const vec=(pattern,noise=0)=>Array.from({length:24},(_,i)=>Math.tanh((pattern===0?Math.sin(i*.7):Math.cos(i*.47)+pattern*.08)+noise*Math.sin(i*1.9)));
const actions=['respond','explore','verify','rest','reflect','wait','defer'];

const brain=new CanonicalNeuralSubstrate();
const holdout=[];
for(let i=0;i<40;i++){
  const action=actions[i%7];
  const target=action==='verify' && i%2===0 ? .92 : .16;
  const x=vec(i%3);
  brain.step({vector:x,tick:i,action,learningEnabled:false});
  if(i<20) brain.learnFromOutcome({reward01:target,action,tick:i});
  else holdout.push({vector:x,action,reward01:target,tick:i});
}
const before=brain.diagnostics();
const hold=brain.holdout(holdout);
const lesion=brain.lesion();
assert.ok(before.learningUpdates>=20);
assert.equal(hold.samples,20);
assert.ok(Number.isFinite(hold.after01));
assert.ok(Number.isFinite(lesion.drop01));
assert.ok(lesion.drop01>0);

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);
await core.init();
for(let i=0;i<8;i++) await core.autonomousHeartbeat(900000+i*10000);
await core.flush();
const d1=core.canonicalNeuralDiagnostics();
const snap=core.canonicalNeuralSnapshot();
assert.ok(d1.cycles>=8);
assert.ok(snap.learningUpdates>=0);
const core2=new OrganismCore(store,cfg);
await core2.init();
const d2=core2.canonicalNeuralDiagnostics();
assert.equal(d2.cycles,d1.cycles);
assert.equal(d2.learningUpdates,d1.learningUpdates);

console.log(JSON.stringify({pass:'BIG_PASS_259_CANONICAL_NEURAL_SUBSTRATE',verified:true,learningUpdates:before.learningUpdates,trainError01:before.trainPredictionError01,holdoutError01:hold.after01,holdoutDelta01:hold.delta01,generalization01:brain.diagnostics().generalization01,lesionDrop01:lesion.drop01,coreCycles:d2.cycles,restartPreserved:true},null,2));
