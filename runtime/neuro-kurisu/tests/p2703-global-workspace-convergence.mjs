import assert from 'node:assert/strict';
import { P2703GlobalWorkspaceConvergence } from '../src/organism/cognition/P2703GlobalWorkspaceConvergence.ts';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const bias=(v)=>({respond:v,explore:v*.8,verify:v*.6,rest:v*.2,reflect:v*.5,wait:v*.1,defer:v*.3});
const w=new P2703GlobalWorkspaceConvergence();
const before=w.snapshot();
const out=w.step({tick:1,uncertainty01:.35,predictionError01:.25,computeBudget01:.8,candidates:[
 {id:'goal',source:'goal',vector:new Array(16).fill(.8),salience01:.95,uncertainty01:.2,predictionError01:.1,actionBias:bias(.05)},
 {id:'memory',source:'memory',vector:new Array(16).fill(.2),salience01:.7,uncertainty01:.3,predictionError01:.2,actionBias:bias(.02)},
 {id:'self',source:'self',vector:new Array(16).fill(.6),salience01:.82,uncertainty01:.25,predictionError01:.12,actionBias:bias(.04)},
 {id:'world',source:'world',vector:new Array(16).fill(.4),salience01:.76,uncertainty01:.4,predictionError01:.3,actionBias:bias(.03)},
 {id:'personality',source:'personality',vector:new Array(16).fill(.7),salience01:.9,uncertainty01:.18,predictionError01:.08,actionBias:bias(.06)},
 {id:'noise',source:'neural',vector:new Array(16).fill(.05),salience01:.1,uncertainty01:.9,predictionError01:.8,actionBias:bias(-.02)}
]});
assert(out.selectedSources.length===4);
assert(out.ignition01>0);
assert(out.broadcast01>0);
const beforeWeights=w.snapshot().sourceWeights;
w.learnOutcome({reward01:.95,verified01:1,predictionError01:.05});
const after=w.snapshot();
assert(after.learningUpdates===before.learningUpdates+1);
assert(Object.values(after.sourceWeights).some((v,i)=>v!==Object.values(beforeWeights)[i]));
const restored=new P2703GlobalWorkspaceConvergence();restored.restore(after);assert.deepEqual(restored.snapshot(),after);

// P2704 causal-broadcast ablation: selected content, not source-name metadata,
// must reach the action readout.
const contentBias=(verify,explore)=>({respond:0,explore,verify,rest:0,reflect:0,wait:0,defer:0});
const contentOut=w.step({tick:2,uncertainty01:.1,predictionError01:.1,computeBudget01:.9,candidates:[
 {id:'verify-content',source:'goal',vector:new Array(16).fill(.4),salience01:.95,uncertainty01:.05,predictionError01:.05,actionBias:contentBias(.9,0)},
 {id:'explore-content',source:'world',vector:new Array(16).fill(.3),salience01:.90,uncertainty01:.05,predictionError01:.05,actionBias:contentBias(0,.7)}
]});
assert(contentOut.selectedSources.length>0);
assert(contentOut.broadcastActionBias.verify>contentOut.broadcastActionBias.explore);
assert(w.actionBias('verify')>w.actionBias('explore'));


const branch=new NeuralExperienceBranch();
branch.restore(defaultNeuralExperienceBranch());
const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const d=branch.beforeDecision({tick:1,input:new Array(64).fill(.15),baseUtilities:actions,predictionError01:.3,novelty01:.8,uncertainty01:.4,homeostasis01:.2,identityGap01:.2,goalPressure01:.8,reward01:.5,identityVector:new Array(24).fill(.3),personalityVector:new Array(24).fill(.2)});
branch.commitAction('explore',actions);
branch.afterOutcome({tick:1,action:'explore',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.15,goalPressure01:.8,identityVector:new Array(24).fill(.4)});
const snap=branch.snapshot();
assert.equal(snap. version,25);
assert(snap.globalWorkspaceConvergence.cycles>0);
assert(snap.globalWorkspaceConvergence.learningUpdates>0);
assert(snap.globalWorkspaceConvergence.selectedSources.length>0);
const branch2=new NeuralExperienceBranch();branch2.restore(snap);assert.deepEqual(branch2.snapshot().globalWorkspaceConvergence,snap.globalWorkspaceConvergence);
console.log(JSON.stringify({pass:true,workspaceCycles:snap.globalWorkspaceConvergence.cycles,learningUpdates:snap.globalWorkspaceConvergence.learningUpdates,ignition01:snap.globalWorkspaceConvergence.ignition01,broadcast01:snap.globalWorkspaceConvergence.broadcast01,selectedSources:snap.globalWorkspaceConvergence.selectedSources}));
