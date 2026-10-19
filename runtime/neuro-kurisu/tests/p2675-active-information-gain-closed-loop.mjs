import assert from 'node:assert/strict';
import { ActiveInformationGainController } from '../src/organism/cognition/ActiveInformationGainController.ts';
import { ClosedLoopEvidenceLedger } from '../src/organism/cognition/ClosedLoopEvidenceLedger.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=()=>Object.fromEntries(actions.map((a,i)=>[a,.48+(i%3)*.02]));
const c=new ActiveInformationGainController();
for(let t=1;t<=1800;t++){
 const u=c.beforeDecision({tick:t,baseUtilities:utilities(),uncertainty01:t%13===0?.86:.24, predictionError01:t%17===0?.82:.18, novelty01:t%11===0?.72:.25,computeBudget01:.82,risk01:t%29===0?.72:.12,grounding01:t%19===0?.28:.74,consensus01:t%23===0?.38:.86,externalQuery:t%19===0?'camera':'motion'});
 const a=u.selectedAction??'respond';
 c.afterOutcome({tick:t,action:a,reward01:a==='verify'&&t%19===0?.9:.63,verified01:a==='verify'&&t%19===0?.9:.74,predictionError01:t%17===0?.68:.21,observedChange01:a==='verify'? .72:.18,contradiction01:t%23===0?.7:.04,hypothesisId:u.selectedHypothesis});
}
const m=c.metrics();assert.equal(m.decisions,1800);assert.ok(m.experiments>0);assert.ok(m.modelUpdates>0);assert.ok(m.informationGain01>.15);assert.ok(m.actionCoverage01>.2);
const snap=c.snapshot(),r=new ActiveInformationGainController();r.restore(snap);assert.deepEqual(r.snapshot(),snap);
const ledger=new ClosedLoopEvidenceLedger();for(let t=1;t<=400;t++)ledger.record({tick:t,action:t%5===0?'verify':'respond',predicted01:.5+(t%7)/30,observed01:.5+(t%9)/40,reward01:t%5===0?.86:.62,verified01:t%5===0?.9:.72,predictionError01:t%17===0?.75:.18,contradiction01:t%23===0?.72:.03,grounding01:.7,informationGain01:.4,causalCredit01:.6,sourceIds:['camera','motion']});
const lm=ledger.metrics();assert.equal(lm.writes,400);assert.ok(lm.episodeCount===400);assert.ok(lm.closedLoopQuality01>.35);
const branch=new NeuralExperienceBranch();
const mk=t=>Array.from({length:64},(_,i)=>Math.sin(t*.061+i*.17)*.5+.5);
const sensor=(tick,f=.9,c=.8)=>({tick,values:[.2,.4,.8],freshness01:f,confidence01:c,ageTicks:Math.round((1-f)*100),source:'android-termux'});
for(let t=1;t<=900;t++){
 const sensors={camera:sensor(t,t%31===0?.25:.91,.8),motion:sensor(t,t%23===0?.38:.88,.74)};
 const u=utilities();const out=branch.beforeDecision({tick:t,input:mk(t),baseUtilities:u,predictionError01:t%17===0?.78:.2,novelty01:t%11===0?.7:.24,uncertainty01:t%19===0?.84:.24,homeostasis01:.2,identityGap01:.2,goalPressure01:.5,identityVector:mk(t+2).slice(0,24),personalityVector:mk(t+3).slice(0,24),embodied:{sensors,sensorFeatures:mk(t),sensorFreshness01:.82}});
 const a=actions.slice().sort((x,y)=>(u[y]+out.actionBias[y])-(u[x]+out.actionBias[x]))[0];branch.commitAction(a,u);
 branch.afterOutcome({tick:t,action:a,reward01:a==='verify'&&t%19===0?.88:.63,predictionError01:t%17===0?.78:.2,verified01:t%19===0?.86:.72,nextInput:mk(t+1),identityGap01:.2,goalPressure01:.5,identityVector:mk(t+2).slice(0,24),embodied:{sensors,sensorFreshness01:.82}});
}
const bm=branch.continuityMetrics();assert.ok(bm.activeInformationGain.decisions>=900);assert.ok(bm.activeInformationGain.experiments>0);assert.ok(bm.evidenceLedger.writes>=900);assert.ok(bm.evidenceLedger.closedLoopQuality01>.25);assert.ok(bm.crossLayerArbiter.fusionQuality01>.4);
const round=branch.snapshot();const branch2=new NeuralExperienceBranch();branch2.restore(round);assert.deepEqual(branch2.snapshot().activeInformationGain,round.activeInformationGain);assert.deepEqual(branch2.snapshot().evidenceLedger,round.evidenceLedger);
console.log(JSON.stringify({standalone:{decisions:m.decisions,experiments:m.experiments,informationGain01:m.informationGain01,epistemicValue01:m.epistemicValue01,calibration01:m.calibration01,actionCoverage01:m.actionCoverage01},ledger:{writes:lm.writes,closedLoopQuality01:lm.closedLoopQuality01,verificationRate:lm.verificationRate},branch:{cycles:bm.cycles,experiments:bm.activeInformationGain.experiments,informationGain01:bm.activeInformationGain.informationGain01,evidenceWrites:bm.evidenceLedger.writes,evidenceQuality01:bm.evidenceLedger.closedLoopQuality01,arbiterFusion01:bm.crossLayerArbiter.fusionQuality01}}));
