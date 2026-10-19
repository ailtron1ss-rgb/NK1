import assert from 'node:assert/strict';
import { B276LatentActionProgramSynthesizer } from '../src/organism/cognition/B276LatentActionProgramSynthesizer.ts';
const p=new B276LatentActionProgramSynthesizer();
const r=p.propose({tick:1,goalVector:[.7,.2,.6,.4,.5,.3,.2,.8],selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.3),neuralAssembly:Array(16).fill(.4),personalityBias:{explore:.04,verify:.02},autonomy01:.74,noveltyNeed01:.78,promotedSkills:[{id:'s1',actions:['explore','verify'],reliability01:.8},{id:'s2',actions:['reflect','respond'],reliability01:.76}]});
p.observeTrial({tick:2,programId:r.programId,reward01:.8,independentGain01:.1,predictionError01:.12,robustness01:.86,personalityAlignment01:.78,selfAlignment01:.8});
const snap=p.snapshot();const q=new B276LatentActionProgramSynthesizer();q.restore(JSON.parse(JSON.stringify(snap)));assert.deepEqual(q.snapshot(),snap);console.log(JSON.stringify({pass:true,roundTrip:true,diagnostics:q.diagnostics()},null,2));
