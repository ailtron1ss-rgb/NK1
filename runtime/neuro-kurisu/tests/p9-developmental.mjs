import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(tmpdir(),'nk-p9-'));
try {
  const file = path.join(dir,'state.json');
  const core = new OrganismCore(new FileStateStore(file));
  await core.init();
  for(let i=0;i<24;i++){
    await core.observe({text:i%3===0?`Need verify research hypothesis ${i}`:undefined, surprise:i%5===0?.72:.22, novelty:.35, socialSignal:.45});
    await core.feedback({success:i%4===0?.35:.74,reward:i%4===0?.28:.78,surprise:i%4===0?.68:.16});
  }
  const snap=core.snapshot();
  assert.ok(snap.facets.advanced.memoryOS.items.length>0);
  assert.ok(snap.facets.advanced.worldModel2.rollouts>=0);
  assert.ok(snap.facets.advanced.regret.records.length>0);
  assert.ok(snap.facets.advanced.valueProvenance.records.length>0);
  assert.ok(snap.facets.advanced.relationshipSelf.models.length>0);
  assert.ok(snap.facets.advanced.multiHypothesisPersonality.hypotheses.length>0);
  assert.ok(snap.facets.advanced.futureSimulator.runs>0);
  assert.ok(snap.facets.advanced.longTermSocialMind.version===1);
  assert.ok(snap.facets.advanced.developmentalForks.forks.length>=0);
  assert.ok(snap.facets.advanced.microDreams.cycles>=1);
  console.log(`P9_DEVELOPMENTAL=PASS memory=${snap.facets.advanced.memoryOS.items.length} regret=${snap.facets.advanced.regret.records.length} dreams=${snap.facets.advanced.microDreams.cycles} values=${snap.facets.advanced.valueProvenance.records.length}`);
} finally { await rm(dir,{recursive:true,force:true}); }
