import assert from 'node:assert/strict';
import { B280MultiAreaNeuralCircuit } from '../src/organism/cognition/B280MultiAreaNeuralCircuit.ts';

const makeVec=(tick,phase=0)=>Array.from({length:16},(_,i)=>Math.tanh(Math.sin(tick*.13+i*.41+phase)));
const brain=new B280MultiAreaNeuralCircuit();
let learning=0;
for(let t=1;t<=320;t++){
  const r=brain.step({tick:t,vector:makeVec(t),selfLatent:makeVec(t,.7),worldLatent:makeVec(t,1.4),goalVector:makeVec(t,2.1),action:t%3===0?'explore':t%3===1?'verify':'reflect',dopamine01:.65,norepinephrine01:.55,acetylcholine01:.62,novelty01:t<80?.8:.45,uncertainty01:.4,autonomy01:.7,predictionError01:.15,learningEnabled:true});
  const l=brain.learnFromOutcome({tick:t,reward01:.55+.35*Math.sin(t*.19),predictionError01:.12+.08*Math.cos(t*.11),action:r.selectedAction}); learning+=l.updates;
}
const d=brain.diagnostics();
assert.equal(d.areaNames.length,4);
assert.ok(d.causalIntegration01>0.25);
assert.ok(d.excitationInhibitionBalance01>0.2);
assert.ok(d.shortTermPlasticity01>0.2);
assert.ok(d.cycles===320 && d.learningUpdates===320);
const lesion=brain.lesionArea('association',.5);
assert.ok(lesion.causalDrop01>0.01);
const crossLesion=brain.lesionCrossArea('association','selfAction',.5);
assert.ok(crossLesion.causalDrop01>.005);
const c1=brain.step({tick:401,vector:makeVec(401),selfLatent:Array(16).fill(.8),worldLatent:Array(16).fill(-.2),goalVector:Array(16).fill(.1),novelty01:.6,uncertainty01:.2,autonomy01:.8,learningEnabled:false});
const c2=brain.step({tick:402,vector:makeVec(401),selfLatent:Array(16).fill(-.6),worldLatent:Array(16).fill(.5),goalVector:Array(16).fill(-.4),novelty01:.2,uncertainty01:.7,autonomy01:.3,learningEnabled:false});
let contextDiff=0; for(let i=0;i<c1.spikes.length;i++) contextDiff+=Math.abs(c1.spikes[i]-c2.spikes[i]); contextDiff/=c1.spikes.length; assert.ok(contextDiff>.01,'neural output must depend on context');
const snap=brain.snapshot();
const restored=new B280MultiAreaNeuralCircuit(); restored.restore(snap);
assert.deepEqual(restored.snapshotCircuit(),brain.snapshotCircuit());
console.log(JSON.stringify({ok:true,cycles:d.cycles,learningUpdates:d.learningUpdates,updates:learning,causalIntegration01:d.causalIntegration01,eiBalance01:d.excitationInhibitionBalance01,shortTermPlasticity01:d.shortTermPlasticity01,crossAreaCoherence01:d.crossAreaCoherence01,lesionDrop01:lesion.causalDrop01,crossLesionDrop01:crossLesion.causalDrop01,contextDiff01:contextDiff,sparseActivity01:d.sparseActivity01,dendriticContext01:d.dendriticContext01},null,2));
