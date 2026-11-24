import assert from 'node:assert/strict';
import { B621B720UnifiedAdaptiveMindCore } from '../src/organism/system/B621B720UnifiedAdaptiveMindCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const target=x=>x[0]>.55?'explore':(x[1]>.55?'verify':'respond');
const input=(tick,x,o={})=>({tick,context01:x,baseUtilities:base,uncertainty01:o.u??.35,predictionError01:o.e??.16,novelty01:o.n??.28,surprise01:o.s??.18,confidence01:o.c??.65,goalVector:x,selfVector:x,complexity01:o.cx??.30});
const choose=o=>A.reduce((b,a)=>{const sb=(o.actionBias[b]??0)+(o.predictiveBias[b]??0);const sa=(o.actionBias[a]??0)+(o.predictiveBias[a]??0);return sa>sb?a:b;},'respond');
const C=new B621B720UnifiedAdaptiveMindCore(); let train=0;
for(let t=0;t<1500;t++){
  const x=Array.from({length:8},(_,i)=>(((t*17+i*13)%199)/198));
  const o=C.beforeDecision(input(t,x,{u:t%29===0?.92:.26+(t%7)*.05,e:t%23===0?.74:.12,n:t%31===0?.88:.22,c:t%29===0?.22:.62,cx:t%37===0?.86:.28}));
  const a=choose(o); const ok=a===target(x); train+=ok?1:0;
  C.afterOutcome({tick:t,action:a,context01:x,nextContext01:x.map((v,i)=>((v*.86+(i%3)*.03)%1)),reward01:ok?.94:.06,predictionError01:ok?.08:.75,verified01:ok?1:0,success01:ok?1:0,strategy:o.strategy,confidence01:o.confidence01});
}
const hold=[]; for(let t=1500;t<1740;t++){const x=Array.from({length:8},(_,i)=>(((t*7+i*19)%211)/210)); const o=C.beforeDecision(input(t,x,{u:.55,e:.22,n:.41,c:.56})); hold.push(choose(o)===target(x)?1:0);}
const reversal=[]; for(let t=1740;t<1980;t++){const x=Array.from({length:8},(_,i)=>(((t*11+i*5)%223)/222)); const o=C.beforeDecision(input(t,x,{u:.68,e:.48,n:.62,c:.42})); const reversed=x[0]>.55?'verify':(x[1]>.55?'explore':'respond'); reversal.push(choose(o)===reversed?1:0); C.afterOutcome({tick:t,action:choose(o),context01:x,nextContext01:x.map((v,i)=>(v*.79+(i%2)*.05)%1),reward01:choose(o)===reversed?.9:.1,predictionError01:choose(o)===reversed?.1:.8,verified01:1,success01:choose(o)===reversed?1:0,strategy:o.strategy,confidence01:o.confidence01});}
const probe=input(3000,[.94,.08,.77,.21,.83,.44,.69,.37],{u:.82,e:.71,n:.81,s:.67,c:.29,cx:.88});
const lesions={}; for(const k of ['meta-policy','hierarchical-memory','world-ensemble','skill-transfer','neural-identity','regime-detector','experiment-selector','compute-governor','calibration','counterfactual']) lesions[k]=Number(C.evaluateLesion(probe,{[k]:true}).delta01.toFixed(6));
const snap=C.snapshot(); const R=new B621B720UnifiedAdaptiveMindCore(); R.restore(snap); R.markRestart(); const rr=R.beforeDecision(probe);
assert(train/1500>.45); assert(hold.reduce((a,b)=>a+b,0)/hold.length>.40); assert(reversal.reduce((a,b)=>a+b,0)/reversal.length>.10); assert(C.diagnostics().strategySwitches>40); assert(Object.values(lesions).some(v=>v>.0005)); assert.equal(R.diagnostics().updates,C.diagnostics().updates); assert(Number.isFinite(rr.confidence01));
const diag=C.diagnostics();
console.log(JSON.stringify({pass:true,status:'B621_B720_CORE_PASS',trainAccuracy:Number((train/1500).toFixed(4)),holdoutAccuracy:Number((hold.reduce((a,b)=>a+b,0)/hold.length).toFixed(4)),reversalAccuracy:Number((reversal.reduce((a,b)=>a+b,0)/reversal.length).toFixed(4)),decisions:diag.decisions,updates:diag.updates,consolidations:diag.consolidations,worldUpdates:diag.worldUpdates,skillUpdates:diag.skillUpdates,neuralUpdates:diag.neuralUpdates,strategySwitches:diag.strategySwitches,lesions,restartPersistence:true,lastLatencyMs:Number(diag.lastLatencyMs.toFixed(4))},null,2));
