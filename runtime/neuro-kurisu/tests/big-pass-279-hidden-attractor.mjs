import assert from 'node:assert/strict';
import { B279NeuralAttractorAssemblies } from '../src/organism/cognition/B279NeuralAttractorAssemblies.ts';

const train=new B279NeuralAttractorAssemblies();
const hidden=[];
const actions=['explore','verify','reflect','respond','rest','wait','defer','explore'];
for(let task=0;task<8;task++){
  const p=Array.from({length:16},(_,i)=>Math.tanh(Math.sin((task+1)*(i+2)*.71)));
  hidden.push(p);
  for(let e=0;e<60;e++){
    train.step({tick:task*100+e,vector:p,goalVector:p.slice(0,8),selfLatent:p.slice(0,8),worldLatent:p.slice(8),novelty01:.2,uncertainty01:.2,autonomy01:.7,action:['explore','verify','reflect','respond','rest','wait','defer','explore'][task]});
    train.learnFromOutcome({tick:task*100+e,reward01:.82,predictionError01:.14,action:['explore','verify','reflect','respond','rest','wait','defer','explore'][task],externalEvidence01:.9});
  }
}
const trainedRefs=hidden.slice(0,5).map((p,i)=>train.probe(p,actions[i],8));
const scores=hidden.slice(0,5).map((p,i)=>train.recall(p,.12,8,trainedRefs[i]).similarity01);
const hiddenScores=hidden.slice(5).map(p=>train.recall(p,.12,8).similarity01);
const meanTrain=scores.reduce((a,b)=>a+b,0)/scores.length; const meanHidden=hiddenScores.reduce((a,b)=>a+b,0)/hiddenScores.length;
assert.ok(meanTrain>.52,'trained attractors should reactivate above chance');
assert.ok(meanHidden>.5,'hidden cues should preserve basic attractor dynamics');
const baseline=.5;
const snap=train.snapshot(); const noRec=new B279NeuralAttractorAssemblies(); noRec.restore({...snap,recurrentWeights:snap.recurrentWeights.map(r=>r.map(()=>0)),recentAssemblies:[],recentInputs:[]});
const ref=hidden[0]; const refAssembly=trainedRefs[0]; const learned=train.recall(ref,.12,8,refAssembly).similarity01; const ablated=noRec.recall(ref,.12,8,refAssembly).similarity01;
const recurrentGain=learned-ablated;
assert.ok(recurrentGain>.05,'recurrent weights must add measurable recall value');
const bitSets=trainedRefs.map(v=>v.map(x=>x>.4));
let diversitySum=0,pairs=0; for(let i=0;i<bitSets.length;i++) for(let j=i+1;j<bitSets.length;j++){let inter=0,uni=0;for(let k=0;k<bitSets[i].length;k++){inter+=bitSets[i][k]&&bitSets[j][k]?1:0;uni+=bitSets[i][k]||bitSets[j][k]?1:0;}diversitySum+=1-inter/Math.max(1,uni);pairs++;}
const assemblyDiversity=diversitySum/Math.max(1,pairs); assert.ok(assemblyDiversity>.2,'learned assemblies should differentiate contexts');
console.log(JSON.stringify({ok:true,meanTrainRecall:meanTrain,meanHiddenRecall:meanHidden,baseline,hiddenGain:meanHidden-baseline,learnedRecall:learned,ablatedRecall:ablated,recurrentGain,assemblyDiversity,diag:train.diagnostics()},null,2));
