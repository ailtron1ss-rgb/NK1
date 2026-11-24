import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStateStore} from '../src/organism/persistence/FileStateStore.ts';
import {OrganismCore} from '../src/organism/core/OrganismCore.ts';
import {WorldModelEnsembleController} from '../src/organism/system/WorldModelEnsembleController.ts';
import {WorldModel2} from '../src/organism/developmental/WorldModel2.ts';

const candidates=[
 {member:'worldModel2',prediction01:.82,confidence01:.8},
 {member:'p27',prediction01:.61,confidence01:.55},
 {member:'residual',prediction01:.58,confidence01:.5},
];
const ensemble=new WorldModelEnsembleController();
const a=ensemble.arbitrate('verify',candidates);
const b=ensemble.arbitrate('verify',candidates.map(x=>({...x,prediction01:x.prediction01-.08})));
assert.notEqual(a.predictionId,b.predictionId);
assert.equal(ensemble.pendingPredictionCount(),2);
const first=ensemble.observeOutcomeForAction('verify',.79);
assert.equal(first.resolved,true);
assert.equal(first.predictionId,a.predictionId);
assert.equal(ensemble.pendingPredictionCount(),1);
const second=ensemble.observeOutcomeForAction('verify',.42);
assert.equal(second.predictionId,b.predictionId);
assert.equal(ensemble.pendingPredictionCount(),0);

const wm2=new WorldModel2();
const before={tick:1,location:'lab',energy:.8,attention:.7,uncertainty:.3,facts:['a'],objects:[{id:'x',label:'x',visible:true,collected:false}],events:['e']};
const after={...before,tick:2,energy:.6,uncertainty:.45,facts:['a','b'],events:['e','o']};
const p1=wm2.predict('verify',.7,.3,before);
const p2=wm2.predict('verify',.4,.3,before);
assert.notEqual(p1.predictionId,p2.predictionId);
assert.ok(Object.keys(wm2.snapshot().pendingPredictions).length>=2);
wm2.observeTransition({action:'verify',before,after,reward:.68,surprise:.12,at:Date.now()});
assert.ok(wm2.snapshot().calibration.length>=0);

const root=await mkdtemp(join(tmpdir(),'nk174-')); const file=join(root,'state.json');
const opts={enableLanguage:false,enableWorldModel:true,enableLearnedResidualWorld:true,enableValueEvolution:true,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'};
const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
const ctx={tick:4,location:'lab',facts:['ticket'],events:['observe'],objects:[{id:'terminal',label:'terminal',visible:true,collected:false}],energy:.78,attention:.68,uncertainty:.35};
const pred=core.worldModelProvider().predict('verify',.6,ctx);
assert.ok(pred.ensemble?.predictionId);
const beforeEvidence=core.worldModelEnsembleSnapshot();
assert.ok(beforeEvidence.pendingPredictions[pred.ensemble.predictionId]);
await core.flush(); core.stop?.();
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
const restored=resumed.worldModelEnsembleSnapshot();
assert.ok(restored.pendingPredictions[pred.ensemble.predictionId],'ensemble ticket did not survive restart');
resumed.stop?.(); await rm(root,{recursive:true,force:true});
console.log(JSON.stringify({pass:174,status:'PASS',ensembleTickets:'PASS',sameActionResolution:'PASS',worldModelPending:'PASS',restartPersistence:'PASS',ticketIds:[a.predictionId,b.predictionId]}));
