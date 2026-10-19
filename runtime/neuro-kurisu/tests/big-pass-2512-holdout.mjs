import assert from 'node:assert/strict';
import { B2512EpistemicSemanticAutobiographicalConsolidator } from '../src/organism/cognition/B2512EpistemicSemanticAutobiographicalConsolidator.ts';

const c=new B2512EpistemicSemanticAutobiographicalConsolidator();
let naiveVerify=.5,naiveRespond=.5;
for(let t=0;t<900;t++){
  const action=t%2?'respond':'verify';
  const verified=t%5===0 || t%7===0;
  let reward;
  if(action==='verify') reward=verified ? .92 : ([.05,.18,.72,.41][t%4]);
  else reward=verified ? .26 : ([.85,.10,.34,.62][t%4]);
  const targetMean=action==='verify'?.92:.26;
  if(action==='verify') naiveVerify=.98*naiveVerify+.02*reward; else naiveRespond=.98*naiveRespond+.02*reward;
  c.afterOutcome({tick:t,action,reward01:reward,predictionError01:Math.abs(targetMean-reward),verified01:verified?1:0,autonomous01:verified?.8:.2,informationGain01:verified?.68:.03,novelty01:verified?.65:.12,uncertainty01:.55,selfLatent:Array(24).fill(.3),worldLatent:Array(24).fill(.4),goalLatent:Array(24).fill(.6),memoryLatent:Array(24).fill(.2),traitVector:[.7,.6,.5],identityRevision:4,source:verified?'external':'runtime'});
}
const d=c.diagnostics();
const snap=c.snapshot();
const facts=snap.facts;
const gatedVerify=Math.abs((facts['action:verify']?.value01??.5)-.92);
const gatedRespond=Math.abs((facts['action:respond']?.value01??.5)-.26);
const naiveErr=Math.abs(naiveVerify-.92)+Math.abs(naiveRespond-.26);
const gatedErr=gatedVerify+gatedRespond;
const improvement=(naiveErr-gatedErr)/naiveErr;
assert.ok(improvement>.20,`gated improvement ${improvement}`);
assert.ok(d.rawRetentionCount===192);
assert.ok(d.identityFirewall01===1);
assert.ok(d.memoryIntegrity01>.70);
console.log(JSON.stringify({pass:true,status:'B2512_HOLDOUT_PASS',gatedErr,naiveErr,improvement01:improvement,gatedVerify,gatedRespond,diagnostics:d,facts},null,2));
