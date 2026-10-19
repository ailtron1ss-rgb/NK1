import assert from 'node:assert/strict';
import { B277NeuralOperatorGenesis } from '../src/organism/cognition/B277NeuralOperatorGenesis.ts';
const p=new B277NeuralOperatorGenesis();
const x={tick:1,goalVector:[.7,.3,.6,.4,.5,.2,.3,.8],selfLatent:Array(16).fill(.25),worldLatent:Array(16).fill(.32),neuralAssembly:Array(16).fill(.4),personalityBias:{explore:.04,verify:.06},autonomy01:.74,novelty01:.76,predictionError01:.18,programLatent:Array(12).fill(.2),programPrimitives:['explore','verify']};
for(let t=1;t<20;t++){const r=p.step({...x,tick:t});p.learnFromOutcome({tick:t,reward01:.75,predictionError01:.12,action:r.selected,selfLatent:x.selfLatent,neuralAssembly:x.neuralAssembly,externalEvidence01:1,novelty01:x.novelty01,contextVector:x.goalVector});
}
const s=JSON.parse(JSON.stringify(p.snapshot()));const q=new B277NeuralOperatorGenesis();q.restore(s);assert.deepEqual(q.snapshot(),p.snapshot());console.log(JSON.stringify({pass:true,roundTrip:true,diagnostics:q.diagnostics()},null,2));
