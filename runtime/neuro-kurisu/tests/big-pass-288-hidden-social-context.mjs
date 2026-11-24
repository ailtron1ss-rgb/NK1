import assert from 'node:assert/strict';
import { B288SocialPredictiveSelfOtherBrain } from '../src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts';

const n=new B288SocialPredictiveSelfOtherBrain();
for(let t=1;t<=240;t++){
  const person=t%3===0?'A':t%3===1?'B':'C';
  const hidden=person==='A'?.9:person==='B'?.18:.55;
  const action=(t%4===0?'respond':t%4===1?'verify':t%4===2?'reflect':'wait');
  const desired=hidden>.68?'respond':hidden<.32?'verify':'reflect';
  const reward=desired===action?.96:.18;
  n.step(person,{selfLatent:[...Array(24)].map((_,i)=>Math.sin(t*.09+i*.08+hidden)),worldLatent:[...Array(24)].map((_,i)=>Math.cos(t*.04+i*.07+hidden*2)),goalVector:[hidden,1-hidden,.2],futureSelf:[...Array(32)].map((_,i)=>Math.sin(t*.03+i*.05)),personalityVector:[...Array(24)].map((_,i)=>Math.cos(i*.12+hidden)),relationshipLatent:[hidden,.7-hidden*.3,.2+hidden*.7],action,reward01:reward,predictionError01:Math.abs(reward-.6),surprise01:Math.abs(reward-.6),importance01:.68,socialPredictionError01:Math.abs(reward-.64),socialState:{trust01:hidden,warmth01:hidden,predictability01:.5+hidden*.4,guardedness01:1-hidden,agency01:.6,intentUncertainty01:1-hidden,relationshipStrength01:.2+hidden*.6}});
}
const before=n.diagnostics();
const ab=n.actionBias('respond','A'); const bb=n.actionBias('respond','B'); const cb=n.actionBias('respond','C');
assert(Math.max(ab,bb,cb)-Math.min(ab,bb,cb)>.001);
assert(before.relationshipDifferentiation01>.08);
console.log(JSON.stringify({pass:true,diagnostics:before,respondBias:{A:ab,B:bb,C:cb},range:Math.max(ab,bb,cb)-Math.min(ab,bb,cb)}));
