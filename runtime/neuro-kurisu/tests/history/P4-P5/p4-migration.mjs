import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p4-migration-'));
const file=path.join(dir,'state.json');
const legacy={schemaVersion:5,state:{version:2,tick:12,at:Date.now(),needs:{energy:.6,cognitiveLoad:.3,uncertainty:.4,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.2},predictionError:.2,attentionBudget:.8,lastAction:'explore',lastActionSuccess:.7,autonomyScore:.4,selfPredictionError:.1,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:3},goals:[],traces:[],memories:[],worldModel:{belief:null,transitions:[]},p1:{},p2:{},p3:{}};
await writeFile(file,JSON.stringify(legacy),'utf8');
const core=new OrganismCore(new FileStateStore(file));
await core.init();
const s=core.snapshot();
if(s.schemaVersion!==7) throw new Error('schema did not migrate to 7');
if(!s.facets.consciousness?.identityContinuity?.anchorValues) throw new Error('p4 identity anchors missing');
await rm(dir,{recursive:true,force:true});
console.log('P4_MIGRATION=PASS');
