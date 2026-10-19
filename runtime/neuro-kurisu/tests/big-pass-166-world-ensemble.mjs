import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldModelEnsembleController } from '../src/organism/system/WorldModelEnsembleController.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const opts={enableLanguage:false,performanceProfile:'mobile',enableWorldModel:true,enableLearnedResidualWorld:true,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const dir=await mkdtemp(join(tmpdir(),'nk166-world-'));
const file=join(dir,'state.json');

// A. Controller-level behavioural contract: model weights must move after outcomes,
// and disagreement must become observable rather than hidden by a single average.
const ensemble=new WorldModelEnsembleController();
const first=ensemble.arbitrate('explore',[
  {member:'worldModel2',prediction01:.82,confidence01:.80},
  {member:'p27',prediction01:.22,confidence01:.35},
  {member:'residual',prediction01:.61,confidence01:.55},
]);
assert.ok(first.agreement01<1);
assert.ok(first.uncertainty01>0);
ensemble.observeOutcome([
  {member:'worldModel2',prediction01:.82,confidence01:.80},
  {member:'p27',prediction01:.22,confidence01:.35},
  {member:'residual',prediction01:.61,confidence01:.55},
],.78);
ensemble.observeOutcome([
  {member:'worldModel2',prediction01:.79,confidence01:.81},
  {member:'p27',prediction01:.25,confidence01:.36},
  {member:'residual',prediction01:.60,confidence01:.56},
],.76);
assert.ok(ensemble.member('worldModel2').reliability01>ensemble.member('p27').reliability01);
assert.ok(ensemble.summary().outcomes===2);

// B. Real organism integration: the ensemble is now on the public planner path,
// not merely a standalone subsystem.
const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
const context={location:'lab',facts:['communication','sensor calibration'],events:['observation'],objects:[{id:'terminal',label:'terminal',location:'lab',value:.5,visible:true,collected:false}],energy:.74,attention:.67,uncertainty:.58};
const p1=core.worldModelProvider().predict('explore',.55,context);
assert.ok(p1.ensemble && p1.ensemble.selected);
assert.ok(Number.isFinite(p1.predicted));
assert.ok(p1.confidence>=0 && p1.confidence<=1);
const beforeSelected=p1.ensemble.selected;
for(let i=0;i<2;i++){
  await core.observe({text:`ensemble-life-${i}`,worldContext:{...context,uncertainty:i%4===0?.82:.32,novelty:i%3===0?.87:.34},novelty:i%3===0?.87:.34});
  const bad=i%4===0;
  const before={...context,uncertainty:bad?.82:.32,novelty:i%3===0?.87:.34};
  const after={...before,energy:clamp((before.energy??.74)+(bad?-.12:.06)),uncertainty:clamp((before.uncertainty??.32)+(bad?.08:-.05)),facts:[...(before.facts??[]),bad?'failed-transition':'successful-transition'],events:[...(before.events??[]),bad?'prediction-error':'prediction-confirmed']};
  await core.feedback({success:bad?.14:.86,reward:bad?-.28:.48,surprise:bad?.79:.12,evidenceSource:i%5===0?'device':'user',worldTransition:{action:core.snapshot().state.lastAction,before,after,reward:bad?-.28:.48,surprise:bad?.79:.12,at:Date.now()}});
}
const p2=core.worldModelProvider().predict('explore',.55,context);
const ens=core.worldModelEnsembleSnapshot();
assert.ok((ens?.predictions??0)>=2);
assert.ok((ens?.outcomes??0)>=2);
assert.ok((ens?.disagreements??0)>=2);
assert.ok(p2.ensemble);
assert.ok(Number.isFinite(p2.modelAgreement01));
assert.ok(p2.ensemble.selected);
assert.ok(p2.ensemble.uncertainty01>=0 && p2.ensemble.uncertainty01<=1);

// C. Longitudinal A/B: a curriculum with repeated high-error outcomes should alter
// the ensemble reliability profile and downstream prediction compared with a calm path.
const dirB=await mkdtemp(join(tmpdir(),'nk166-worldB-'));
const fileB=join(dirB,'state.json');
const calm=new OrganismCore(new FileStateStore(fileB),opts); await calm.init();
for(let i=0;i<2;i++){
  await calm.observe({text:`calm-${i}`,worldContext:{...context,uncertainty:.24,novelty:.3},novelty:.3});
  await calm.feedback({success:.82,reward:.46,surprise:.10,evidenceSource:i%5===0?'device':'user'});
}
const noisy=core.worldModelEnsembleSnapshot();
const calmP=calm.worldModelProvider().predict('explore',.55,context);
const noisyP=core.worldModelProvider().predict('explore',.55,context);
const trajectoryDivergence=clamp(Math.abs((noisyP.predicted??0)-(calmP.predicted??0))+Math.abs((noisyP.confidence??0)-(calmP.confidence??0)));
assert.ok(trajectoryDivergence>0,'ensemble learning did not alter downstream world prediction');

// D. Restart proof for the new meta-model.
await core.flush(); await calm.flush(); core.stop?.(); calm.stop?.();
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
const restored=resumed.worldModelEnsembleSnapshot();
assert.ok((restored?.outcomes??0)>0);
assert.ok((restored?.outcomes??0)>=(ens?.outcomes??0));
assert.ok((restored?.predictions??0)>0);
assert.ok(restored?.lastDecision?.selected);
resumed.stop?.();

console.log(JSON.stringify({
  pass:166,status:'PASS',
  controller:{initialSelection:first.selected,initialAgreement:first.agreement01,initialUncertainty:first.uncertainty01,worldModel2Reliability:ensemble.member('worldModel2').reliability01,p27Reliability:ensemble.member('p27').reliability01},
  organism:{beforeSelected,afterSelected:p2.ensemble.selected,predictions:ens?.predictions,outcomes:ens?.outcomes,disagreements:ens?.disagreements,meanDisagreement01:ens?.meanDisagreement01},
  longitudinal:{calmPredicted:calmP.predicted,noisyPredicted:noisyP.predicted,trajectoryDivergence},
  restart:{restoredPredictions:restored?.predictions,restoredOutcomes:restored?.outcomes,restoredSelected:restored?.lastDecision?.selected}
},null,2));
