import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const baseWorld={tick:1,location:'trajectory-lab',energy:.82,attention:.72,uncertainty:.35,facts:['same-context'],objects:[],events:['neutral']};
async function make(){
  const dir=await mkdtemp(path.join(tmpdir(),'nk-p83-'));
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false,performanceProfile:'mobile'});
  await core.init();
  return {dir,core};
}
const A=await make(); const B=await make();
try {
  let a=await A.core.observe({worldContext:baseWorld,novelty:.25});
  let b=await B.core.observe({worldContext:baseWorld,novelty:.25});
  assert.equal(a.decision.selected?.action,b.decision.selected?.action,'same initial state/context should choose the same action');
  const initialAction=a.decision.selected?.action;
  assert.ok(initialAction,'initial action missing');
  const futureChoices=[];
  for(let i=0;i<8;i++){
    const futureWorld={...baseWorld,tick:i+2};
    await A.core.feedback({success:.95,reward:.9,surprise:.7});
    await B.core.feedback({success:.05,reward:-.9,surprise:.7});
    a=await A.core.observe({worldContext:futureWorld,novelty:.25});
    b=await B.core.observe({worldContext:futureWorld,novelty:.25});
    futureChoices.push([a.decision.selected?.action,b.decision.selected?.action]);
  }
  const ta=A.core.evolutionSnapshot().identityTrajectory;
  const tb=B.core.evolutionSnapshot().identityTrajectory;
  assert.equal(ta.version,2); assert.equal(tb.version,2);
  assert.equal(ta.outcomeSamples,8); assert.equal(tb.outcomeSamples,8);
  assert.ok((ta.actionBiases[initialAction]??0)>(tb.actionBiases[initialAction]??0),'opposite consequences did not create divergent action carry-over');
  assert.ok(futureChoices.some(([x,y])=>x!==y),'same future contexts failed to yield any behavioral divergence after divergent experience');
  assert.ok(ta.pathDependence01>.15 && tb.pathDependence01>.15);

  await A.core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(A.dir,'state.json')),{enableLanguage:false,performanceProfile:'mobile'});
  await restored.init();
  const rt=restored.evolutionSnapshot().identityTrajectory;
  assert.equal(rt.version,2);
  assert.equal(rt.outcomeSamples,8);
  assert.ok((rt.actionBiases[initialAction]??0)>0);
  await restored.flush();
  const divergence=futureChoices.filter(([x,y])=>x!==y).length;
  console.log(`DEVELOPMENTAL_TRAJECTORY_CORE=PASS initial=${initialAction} divergentFutureContexts=${divergence}/8 biasHigh=${(ta.actionBiases[initialAction]??0).toFixed(4)} biasLow=${(tb.actionBiases[initialAction]??0).toFixed(4)} path=${ta.pathDependence01.toFixed(3)}`);
} finally {
  await A.core.flush().catch(()=>{}); await B.core.flush().catch(()=>{});
  await rm(A.dir,{recursive:true,force:true}); await rm(B.dir,{recursive:true,force:true});
}
