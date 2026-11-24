import assert from 'node:assert/strict';
import { B277NeuralOperatorGenesis } from '../src/organism/cognition/B277NeuralOperatorGenesis.ts';
const g=new B277NeuralOperatorGenesis();
const base={goalVector:[.8,.2,.7,.3,.6,.4,.25,.5],selfLatent:Array.from({length:16},(_,i)=>Math.sin(i*.17)),worldLatent:Array.from({length:16},(_,i)=>Math.cos(i*.11)),neuralAssembly:Array.from({length:16},(_,i)=>.15+(i%5)*.03),personalityBias:{explore:.08,verify:.06,reflect:.04,respond:.01},autonomy01:.78,novelty01:.72,predictionError01:.22,programLatent:Array.from({length:12},(_,i)=>Math.sin(i*.13)),programPrimitives:['explore','verify','reflect']};
let last;for(let t=1;t<=220;t++){last=g.step({tick:t,...base,novelty01:.5+(t%7)*.04,predictionError01:.16+(t%5)*.03});g.learnFromOutcome({tick:t,reward01:last.selected==='explore'? .78 : .66,predictionError01:.12+(t%4)*.025,action:last.selected,selfLatent:base.selfLatent,neuralAssembly:base.neuralAssembly,externalEvidence01:t%9===0?1:.5,novelty01:base.novelty01,contextVector:base.goalVector});}
const d=g.diagnostics();assert.ok(d.cycles===220);assert.ok(d.operatorGenerations>=3);assert.ok(d.learningUpdates===220);assert.ok(d.homeostasis01>.55);assert.ok(d.neuralSparsity01>.5);assert.ok(d.selfGrounding01>.5);assert.ok(d.operators.length>=1);
const verified=d.operators[0];assert.ok(verified?.maturity01>=0);
let transfer={success:false,gain01:0}; if(verified) transfer=g.transfer({tick:221,operatorId:verified.id,goalVector:[.2,.7,.3,.6,.1,.65,.4,.5],neuralAssembly:base.neuralAssembly,independentGain01:.12,robustness01:.84});
const snap=g.snapshot();const q=new B277NeuralOperatorGenesis();q.restore(snap);assert.deepEqual(q.snapshot(),snap);
console.log(JSON.stringify({pass:true,diagnostics:d,transfer,roundTrip:true},null,2));
