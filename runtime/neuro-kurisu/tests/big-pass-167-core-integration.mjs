import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(join(tmpdir(),'nk167-core-')); const file=join(dir,'state.json');
const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
try{
 const c=new OrganismCore(new FileStateStore(file),opts); await c.init();
 const r1=await c.observe({text:'BIG PASS 167 memory causal integration',worldContext:{location:'lab',facts:['sensor-safe'],objects:['sensor'],events:['check'],energy:.78,attention:.68,uncertainty:.45},novelty:.75});
 await c.feedback({success:.84,reward:.46,surprise:.18,evidenceSource:'device',notes:'device corroborated the observation'});
 const r2=await c.observe({text:'BIG PASS 167 repeated corroboration',worldContext:{location:'lab',facts:['sensor-safe'],objects:['sensor'],events:['repeat-check'],energy:.76,attention:.64,uncertainty:.39},novelty:.55});
 await c.feedback({success:.8,reward:.4,surprise:.15,evidenceSource:'external-api',notes:'independent external confirmation'});
 const causal=c.memoryCausalEconomySnapshot();
 assert.ok(causal.totalObservations>=2);
 assert.ok(causal.totalOutcomes>=2);
 assert.ok(causal.totalEffects>=2);
 assert.ok(causal.claims.length>=1);
 assert.ok(causal.meanInfluence01>0);
 const identity=c.snapshot().facets.evolution.identityTrajectory;
 assert.ok(identity.samples>0);
 await c.flush(); c.stop?.();
 const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
 const restored=resumed.memoryCausalEconomySnapshot();
 assert.equal(restored.totalObservations,causal.totalObservations);
 assert.equal(restored.totalOutcomes,causal.totalOutcomes);
 assert.equal(restored.totalEffects,causal.totalEffects);
 assert.equal(restored.claims.length,causal.claims.length);
 const post=await resumed.observe({text:'BIG PASS 167 post-restart causal continuity',novelty:.42});
 assert.ok(post.state.tick>0);
 resumed.stop?.();
 console.log(JSON.stringify({pass:167,status:'PASS',runtime:{observations:causal.totalObservations,outcomes:causal.totalOutcomes,effects:causal.totalEffects,claims:causal.claims.length,meanInfluence01:causal.meanInfluence01},identity:{samples:identity.samples,pathDependence01:identity.pathDependence01},restart:{observations:restored.totalObservations,outcomes:restored.totalOutcomes,effects:restored.totalEffects,claims:restored.claims.length},actions:[r1.decision?.selected?.action??'wait',r2.decision?.selected?.action??'wait']},null,2));
} finally {await rm(dir,{recursive:true,force:true});}
