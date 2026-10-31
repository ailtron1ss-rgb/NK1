import assert from 'node:assert/strict';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';
import { UnifiedCognitiveSubstrate, defaultUnifiedCognitiveSubstrate } from '../src/organism/core/UnifiedCognitiveSubstrate.ts';

const legacy={observation:'obs-1',prediction:'pred-1',action:'act-1',outcome:'out-1',learning:'learn-1','self-update':'self-1'};
const extended={...legacy,appraisal:'app-1',attention:'attention-1',memory:'memory-1',goal:'goal-1',plan:'plan-1'};
const cycle=new UnifiedCognitiveCycle();
assert.equal(cycle.evaluate({tick:1,stageIds:legacy,parentIntegrity01:1}).complete,true,'legacy six-stage integrations remain compatible');
const partial=cycle.evaluate({tick:2,stageIds:{...legacy,appraisal:'app-2'},parentIntegrity01:1});
assert.equal(partial.complete,false,'advertising any extended phase requires the complete eleven-stage contract');
assert.deepEqual(partial.missingStages,['attention','memory','goal','plan']);
assert.equal(partial.stageCoverage01,7/11);
const full=cycle.evaluate({tick:3,stageIds:{...extended,observation:'obs-3',prediction:'pred-3',action:'act-3',outcome:'out-3',learning:'learn-3','self-update':'self-3'},parentIntegrity01:1});
assert.equal(full.complete,true);
const duplicate=cycle.evaluate({tick:4,stageIds:{...extended,observation:'same',prediction:'same'},parentIntegrity01:1});
assert.equal(duplicate.complete,false);
assert.deepEqual(duplicate.missingStages.filter(x=>x==='observation'||x==='prediction'),['observation','prediction']);
const inherited=Object.assign(Object.create({observation:'spoof',prediction:'spoof',action:'spoof',outcome:'spoof',learning:'spoof','self-update':'spoof'}),{});
const inheritedResult=cycle.evaluate({tick:5,stageIds:inherited,parentIntegrity01:1});
assert.equal(inheritedResult.complete,false,'prototype properties cannot satisfy stage evidence');
const beforeReplay=cycle.snapshot();
assert.throws(()=>cycle.evaluate({tick:5,stageIds:legacy,parentIntegrity01:1}),/strictly increase/);
assert.deepEqual(cycle.snapshot(),beforeReplay,'rejected replay must not mutate cycle state');
const poisoned=Object.assign(Object.create({cycles:999,lastTick:999,lastComplete:true}),{
  version:1,cycles:-3,completeCycles:500,brokenLineages:900,meanStageCoverage01:NaN,
  meanCausalContinuity01:Infinity,lastTick:'999',lastComplete:true,lastMissingStages:['forged-stage']
});
const restoredCycle=new UnifiedCognitiveCycle();
restoredCycle.restore(poisoned);
assert.equal(restoredCycle.snapshot().cycles,0);
assert.equal(restoredCycle.snapshot().lastTick,-1);
assert.equal(restoredCycle.snapshot().lastComplete,false);
assert.throws(()=>restoredCycle.restore({version:2}),/unsupported/);
assert.equal(restoredCycle.snapshot().cycles,0,'unsupported version must preserve the prior valid state');

const substrate=new UnifiedCognitiveSubstrate();
const d=defaultUnifiedCognitiveSubstrate();
const bad=Object.assign(Object.create({cycles:500,lastTick:900,self:{agency01:1}}),{
  version:1,cycles:-1,lastTick:'77',self:{agency01:NaN,coherence01:Infinity,mode:'',lastAction:'bad\u0001'},
  world:{entityCount:1.5,eventCount:-2,confidence01:Infinity},resources:{computeCapacity01:2},
  lastReason:'x'.repeat(600),unexpectedOwner:'must-not-survive'
});
substrate.restore(bad);
const restored=substrate.snapshot();
assert.equal(restored.cycles,0);
assert.equal(restored.lastTick,0);
assert.equal(restored.self.agency01,d.self.agency01);
assert.equal(restored.self.mode,d.self.mode);
assert.equal(restored.world.entityCount,0);
assert.equal(restored.world.confidence01,d.world.confidence01);
assert.equal(restored.resources.computeCapacity01,1);
assert.equal(restored.lastReason,d.lastReason);
assert.equal(Object.hasOwn(restored,'unexpectedOwner'),false);
const input={tick:1,self:d.self,world:d.world,prediction:d.prediction,resources:d.resources,
  memoryPressure01:.2,evidenceCoverage01:.8,realObservationCoverage01:.7,unknown01:.1};
const integrated=substrate.integrate(input);
assert.equal(integrated.cycles,1);
assert.equal(integrated.lastTick,1);
const beforeInvalid=substrate.snapshot();
assert.throws(()=>substrate.integrate({...input,tick:1}),/strictly increase/);
assert.deepEqual(substrate.snapshot(),beforeInvalid,'duplicate tick must not mutate the substrate');
assert.throws(()=>substrate.integrate({...input,tick:2,self:null}),/self input/);
assert.deepEqual(substrate.snapshot(),beforeInvalid,'invalid input must not mutate the substrate');
assert.throws(()=>substrate.restore({version:2}),/unsupported/);
assert.deepEqual(substrate.snapshot(),beforeInvalid,'unsupported restore must preserve the prior valid state');
const inheritedInput=Object.assign(Object.create({agency01:1}),{continuity01:.4,coherence01:.5,realityAlignment01:.6,mode:'test',lastAction:'test'});
const next=substrate.integrate({...input,tick:2,self:inheritedInput});
assert.equal(next.self.agency01,d.self.agency01,'inherited nested fields must not enter the live projection');
assert.equal(next.lastTick,2);
console.log(JSON.stringify({pass:true,checks:25,legacyCycleCompatibility:true,elevenPhaseContract:true,prototypeSafeRestore:true,monotonicTickOwnership:true,invalidInputNonMutation:true}));
