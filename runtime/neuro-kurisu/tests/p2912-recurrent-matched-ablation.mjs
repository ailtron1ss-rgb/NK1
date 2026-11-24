import assert from 'node:assert/strict';
import { BoundedRecurrentStateSubstrate } from '../src/organism/cognition/BoundedRecurrentStateSubstrate.ts';

const actions=['respond','explore','verify','rest'];
const utility=(input,action,history01)=>{
  const ai=actions.indexOf(action);
  const local=input[(ai*3)%16]??0;
  const temporal=history01[(ai+2)%history01.length]??0;
  return .25+local*.34+temporal*.21+(action==='verify'&&history01[0]>.45?.15:0);
};
const makeInput=t=>Array.from({length:16},(_,i)=>Math.sin(i*.17+t*.09)*.45+Math.cos(t*.05+i)*.12);
const model=new BoundedRecurrentStateSubstrate(16,'r24-matched-ablation');
let recurrentCorrect=0,statelessCorrect=0,changed=0;
for(let t=0;t<320;t++){
  const input=makeInput(t);
  const step=model.step(input);
  const recurrentScores=actions.map((a,i)=>utility(step.state,a,step.state));
  const statelessScores=actions.map(a=>utility(input,a,new Array(16).fill(0)));
  const recurrentChoice=actions[recurrentScores.indexOf(Math.max(...recurrentScores))];
  const statelessChoice=actions[statelessScores.indexOf(Math.max(...statelessScores))];
  const temporalTruth=actions.map(a=>utility(input,a,makeInput(Math.max(0,t-3))).toFixed(12));
  const truthScores=actions.map((a,i)=>Number(temporalTruth[i]));
  const truthChoice=actions[truthScores.indexOf(Math.max(...truthScores))];
  if(recurrentChoice===truthChoice)recurrentCorrect++;
  if(statelessChoice===truthChoice)statelessCorrect++;
  if(recurrentChoice!==statelessChoice)changed++;
}
const recurrentAccuracy01=recurrentCorrect/320;
const statelessAccuracy01=statelessCorrect/320;
const matchedDelta01=recurrentAccuracy01-statelessAccuracy01;
const d=model.diagnostics();
assert.ok(d.bounded01>=.75);
assert.ok(Number.isFinite(matchedDelta01));
assert.ok(changed>0,'recurrent and stateless paths should produce a measurable matched ablation difference');
console.log(JSON.stringify({pass:true,cycles:320,recurrentAccuracy01,statelessAccuracy01,matchedDelta01,choiceChangeRate01:changed/320,bounded01:d.bounded01,energy01:d.energy01}));
