import assert from 'node:assert/strict';
import { B561B620MetaCognitiveEvolutionCore } from '../src/organism/system/B561B620MetaCognitiveEvolutionCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const input=(tick,x,over={})=>({tick,context01:x,baseUtilities:base,uncertainty01:over.uncertainty??.55,predictionError01:over.error??.22,novelty01:over.novelty??.38,surprise01:over.surprise??.24,confidence01:over.confidence??.58,goalVector:x,selfVector:x,motivation01:.54,complexity01:over.complexity??.35});
const envAction=x=>x[0]>.5?'explore':'verify';
const choose=o=>A.reduce((best,a)=>((base[a]+(o.actionBias[a]??0)+(o.predictiveBias[a]??0))>(base[best]+(o.actionBias[best]??0)+(o.predictiveBias[best]??0))?a:best),'respond');
const C=new B561B620MetaCognitiveEvolutionCore();
let hits=0;
for(let e=0;e<900;e++){
 const x=Array.from({length:8},(_,j)=>(((e*7+j*11)%97)/96));
 const o=C.beforeDecision(input(e,x,{uncertainty:(e%19===0)?.92:.28+(e%8)*.06,error:(e%13===0)?.76:.16,novelty:(e%17===0)?.88:.22,confidence:(e%19===0)?.24:.56,complexity:(e%23===0)?.86:.34}));
 const a=choose(o); const target=envAction(x); const success=a===target?1:0; hits+=success;
 C.afterOutcome({tick:e,action:a,context01:x,nextContext01:x.map((v,i)=>(v*.83+(i%3)*.04)%1),reward01:success>.5?.92:.08,predictionError01:success>.5?.08:.72,verified01:success?1:0,success01:success,strategy:o.strategy,confidence01:o.confidence01});
}
const d=C.diagnostics();
const hold=[]; for(let e=0;e<120;e++){const x=Array.from({length:8},(_,j)=>(((e*13+j*7)%101)/100));const o=C.beforeDecision(input(1000+e,x,{uncertainty:.58,error:.22,novelty:.44,confidence:.56})); hold.push(choose(o)===envAction(x)?1:0);}
const holdout=hold.reduce((a,b)=>a+b,0)/hold.length;
const probe=input(5000,[.91,.14,.72,.21,.83,.44,.66,.31],{uncertainty:.81,error:.70,novelty:.79,surprise:.68,confidence:.32,complexity:.84});
const lesions=['meta-policy','dual-memory','world-model','skill-evolution','neural-code','experiment-selector','compute-governor','confidence','provenance'];
const deltas=Object.fromEntries(lesions.map(v=>[v,C.evaluateLesion(probe,{[v]:true}).delta01]));
const snap=C.snapshot(); const R=new B561B620MetaCognitiveEvolutionCore(); R.restore(snap); R.markRestart(); const rr=R.beforeDecision(probe);
assert.equal(R.diagnostics().updates,d.updates); assert(Number.isFinite(rr.confidence01)); assert(holdout>.52); assert(Object.values(deltas).some(v=>v>.0005));
console.log(JSON.stringify({pass:true,status:'B561_B620_CORE_PASS',decisions:d.decisions,updates:d.updates,skills:d.skillUpdates,beliefs:snap.beliefs.length,worldRows:snap.world.length,neuralUpdates:d.neuralUpdates,strategySwitches:d.strategySwitches,trainAccuracy:Number((hits/900).toFixed(4)),holdoutAccuracy:Number(holdout.toFixed(4)),multiLesion:Object.fromEntries(Object.entries(deltas).map(([k,v])=>[k,Number(v.toFixed(6))])),lastStrategy:d.lastStrategy,restartPersistence:true,lastLatencyMs:Number(d.lastLatencyMs.toFixed(4))},null,2));
