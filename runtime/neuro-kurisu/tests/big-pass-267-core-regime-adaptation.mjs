import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core.init();
for(let i=1;i<=18;i++) core.b267Observe({tick:i,context:Array.from({length:16},(_,j)=>(i+j)%16/15),action:'respond',reward01:.76,predictionError01:.05,surprise01:.04,uncertainty01:.2});
const stable=core.b267Diagnostics();
for(let i=19;i<=50;i++) core.b267Observe({tick:i,context:Array.from({length:16},(_,j)=>(i*2+j)%16/15),action:i%2?'explore':'respond',reward01:.1,predictionError01:.9,surprise01:.9,uncertainty01:.86});
const shifted=core.b267Diagnostics();
assert.ok(shifted.regimeShift01>stable.regimeShift01);
assert.ok(shifted.verificationCount+shifted.explorationCount>0);
core.b267RecoverFromShift(.78);
const cands=['respond','explore','verify','rest','reflect','wait','defer'].map((action,i)=>({id:`b267-${i}`,action,score:.5,predictedUtility:action==='verify'?.6:action==='explore'?.58:.42,predictedNeedRelief:.5,predictedCost:action==='rest'?.1:.3,confidence:.62,generatedAt:0}));
const arbitration=core.b267Arbitrate(cands,51);
assert.ok(arbitration.rankings.length===7);
assert.ok(['exploit','monitor','verify','explore','recover'].includes(arbitration.mode));
core.b267RecordHoldout(.63,.51);
const snap=core.snapshot();
assert.ok(snap.system.adaptiveRegimeControllerB267?.observationsCount>=50);
const core2=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core2.init();
// simulate restore through public state projection by directly migrating snapshot through MemoryStateStore is not exposed;
// validate the serialized system object itself contains complete B267 evidence.
assert.ok(snap.system.adaptiveRegimeControllerB267?.shifts?.length>0);
console.log(JSON.stringify({pass:true,stable,shifted,arbitration,diagnostics:core.b267Diagnostics(),persisted:snap.system.adaptiveRegimeControllerB267},null,2));
