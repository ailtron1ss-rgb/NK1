import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldModelEnsembleController } from '../src/organism/system/WorldModelEnsembleController.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const opts={enableLanguage:false,performanceProfile:'mobile',enableWorldModel:true,enableLearnedResidualWorld:true,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const d=await mkdtemp(join(tmpdir(),'nk166-fast-')); const file=join(d,'state.json');
const unit=new WorldModelEnsembleController();
const p=unit.arbitrate('explore',[
  {member:'worldModel2',prediction01:.84,confidence01:.8},
  {member:'p27',prediction01:.25,confidence01:.35},
  {member:'residual',prediction01:.62,confidence01:.55},
]);
assert.ok(p.agreement01<1 && p.uncertainty01>0);
unit.observeOutcome([
  {member:'worldModel2',prediction01:.84,confidence01:.8},
  {member:'p27',prediction01:.25,confidence01:.35},
  {member:'residual',prediction01:.62,confidence01:.55},
],.8);
assert.ok(unit.member('worldModel2').reliability01>unit.member('p27').reliability01);

const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
const context={location:'lab',facts:['terminal-online'],events:['observation'],objects:[{id:'terminal',label:'terminal',location:'lab',value:.5,visible:true,collected:false}],energy:.74,attention:.67,uncertainty:.58};
const provider=core.worldModelProvider().predict('explore',.55,context);
assert.ok(provider.ensemble?.selected && Number.isFinite(provider.predicted));
const r=await core.observe({text:'BIG PASS 166 world ensemble integration',worldContext:context,novelty:.84});
const action=r.decision?.selected?.action ?? 'wait';
await core.feedback({success:.82,reward:.45,surprise:.1,evidenceSource:'device',worldTransition:{action,before:context,after:{...context,energy:.8,uncertainty:.49,facts:[...context.facts,'verified-outcome'],events:[...context.events,'verified-outcome']},reward:.45,surprise:.1,at:Date.now()}});
const live=core.worldModelEnsembleSnapshot();
assert.ok((live?.predictions??0)>0);
assert.ok((live?.outcomes??0)>0);
assert.ok((live?.disagreements??0)>0);
await core.flush(); core.stop?.();
const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
const restored=resumed.worldModelEnsembleSnapshot();
assert.ok((restored?.predictions??0)>0);
assert.ok((restored?.outcomes??0)>0);
resumed.stop?.();
console.log(JSON.stringify({pass:166,status:'PASS',controller:{selected:p.selected,agreement01:p.agreement01,uncertainty01:p.uncertainty01,worldModel2Reliability:unit.member('worldModel2').reliability01,p27Reliability:unit.member('p27').reliability01},runtime:{predictions:live?.predictions,outcomes:live?.outcomes,disagreements:live?.disagreements,selected:live?.lastDecision?.selected},restart:{predictions:restored?.predictions,outcomes:restored?.outcomes,selected:restored?.lastDecision?.selected}},null,2));
