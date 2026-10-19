import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStateStore} from '../src/organism/persistence/FileStateStore.ts';
import {OrganismCore} from '../src/organism/core/OrganismCore.ts';
import {WorldModelEnsembleController} from '../src/organism/system/WorldModelEnsembleController.ts';

const root=await mkdtemp(join(tmpdir(),'nk173-')); const file=join(root,'state.json');
const opts={enableLanguage:false,enableWorldModel:true,enableLearnedResidualWorld:true,enableValueEvolution:true,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'};

// Unit: ensemble must learn member reliability from genuine pre-outcome predictions.
const unit=new WorldModelEnsembleController();
const first=unit.arbitrate('explore',[
  {member:'worldModel2',prediction01:.9,confidence01:.8},
  {member:'p27',prediction01:.55,confidence01:.4},
  {member:'residual',prediction01:.6,confidence01:.5},
  {member:'contextual',prediction01:.7,confidence01:.6},
]);
unit.observeOutcome([
  {member:'worldModel2',prediction01:.9,confidence01:.8},
  {member:'p27',prediction01:.55,confidence01:.4},
  {member:'residual',prediction01:.6,confidence01:.5},
  {member:'contextual',prediction01:.7,confidence01:.6},
],.82);
assert.ok(first.agreement01<1);
assert.ok(unit.member('worldModel2').reliability01>unit.member('p27').reliability01);

const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
const context={location:'lab',facts:['causal calibration'],events:['observation'],objects:[{id:'terminal',label:'terminal',location:'lab',value:.5,visible:true,collected:false}],energy:.78,attention:.69,uncertainty:.47};
const obs=await core.observe({text:'evaluate the experimental terminal',worldContext:context,novelty:.72});
const action=obs.decision?.selected?.action ?? 'verify';
const provider=core.worldModelProvider().predict(action,.5,context);
assert.equal(provider.modelAgreement01>=0,true);
assert.ok(provider.ensemble?.selected,'ensemble did not participate in provider');

const beforePrediction=provider.ensemble;
const afterContext={...context,energy:.70,uncertainty:.61,facts:[...context.facts,'observed outcome'],events:[...context.events,'observed outcome']};
await core.feedback({success:.86,reward:.88,surprise:.12,evidenceSource:'device',worldTransition:{action,before:context,after:afterContext,reward:.88,surprise:.12,at:Date.now()}});
const evidence=core.worldPredictionEvidenceSnapshot();
assert.ok(evidence.ensemble.outcomes>0,'world ensemble outcome was not recorded');
assert.ok(evidence.ensemble.predictions>0,'world ensemble prediction was not recorded');
assert.ok((evidence.worldModel2.predictionSequence??0)>0,'WorldModel2 prediction ticket missing');
assert.ok(Object.keys(evidence.worldModel2.pendingPredictions??{}).length<=256,'pending WorldModel2 tickets were not bounded');
assert.ok(beforePrediction.uncertainty01>=0 && beforePrediction.uncertainty01<=1);

// The runtime snapshot must include the ensemble and pending-ticket boundary.
const ws=core.systemSnapshot();
assert.ok(ws.worldModelEnsemble?.outcomes>0);
await core.flush(); core.stop?.();
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
const restored=resumed.worldPredictionEvidenceSnapshot();
assert.equal(restored.ensemble.outcomes,evidence.ensemble.outcomes);
assert.equal(restored.worldModel2.predictionSequence,evidence.worldModel2.predictionSequence);
resumed.stop?.(); await rm(root,{recursive:true,force:true});
console.log(JSON.stringify({pass:173,status:'PASS',ensemble:{predictions:evidence.ensemble.predictions,outcomes:evidence.ensemble.outcomes,disagreements:evidence.ensemble.disagreements,reliability:evidence.ensemble.reliability},wm2:{predictionSequence:evidence.worldModel2.predictionSequence,pending:Object.keys(evidence.worldModel2.pendingPredictions??{}).length},restart:'PASS',antiLeakBoundary:'PASS'}));
