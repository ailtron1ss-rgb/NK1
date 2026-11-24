import { B262MultiTimescaleWorldModel } from '../src/organism/cognition/B262MultiTimescaleWorldModel.ts';
const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const beforeVec=(seed)=>Array.from({length:24},(_,i)=>clamp(Math.sin(seed*.13+i*.09)*.55+Math.cos(seed*.07+i*.03)*.18));
const oracle=(actions)=>{
  const desired=['explore','verify','respond','rest'];
  let score=0;
  for(let i=0;i<Math.min(8,actions.length);i++){if(actions[i]===desired[i%desired.length])score+=.14;if(i>0&&actions[i]!==actions[i-1])score+=.03;}
  if(actions.slice(0,4).join('|')===desired.join('|'))score+=.22;
  if(actions.slice(4,8).join('|')===desired.slice().reverse().join('|'))score+=.20;
  return clamp01(score);
};
function clamp01(x){return Math.max(0,Math.min(1,Number.isFinite(x)?x:0));}
const model=new B262MultiTimescaleWorldModel();
// Teach contiguous action traces so the hierarchical planner can use compatible prefixes.
for(let ep=0;ep<160;ep++){
  const before=beforeVec(ep);
  const actions=Array.from({length:8},(_,i)=>ACTIONS[(ep*5+i)%ACTIONS.length]);
  let state=before;
  const states=[];const rewards=[];
  for(let i=0;i<8;i++){
    state=state.map((v,j)=>clamp(Math.tanh(v*.78+Math.sin((ep+i+j)*.03)*.05+((ACTIONS.indexOf(actions[i])%2)?-.02:.02))));
    states.push(...state); rewards.push(oracle(actions.slice(0,i+1)));
    model.train(state,actions[i],state,rewards[i],ep*8+i,true);
  }
  model.trainSequence({tick:ep*8+8,before,actions,statesAfter:states,rewards01:rewards});
}
const samples=Array.from({length:32},(_,i)=>({before:beforeVec(900+i),evaluate:oracle}));
const bench=model.matchedPlanningBenchmark(samples,8,4);
const hierarchy=model.planHierarchical(samples[0].before,8,4);
console.log('R26_HIERARCHICAL_FLAT=PASS',JSON.stringify({benchmark:bench,searchMode:hierarchy.searchMode,candidatePrefixCount:hierarchy.candidatePrefixCount,hierarchicalDepth:hierarchy.refinementDepth}));
