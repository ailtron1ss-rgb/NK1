import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const cfg={enableWorldModel:true,enableLanguage:false,includeAdvancedCycleSnapshot:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64};
const core=new OrganismCore(new MemoryStateStore(),cfg); await core.init();
for(let i=0;i<36;i++) core.consolidateB365Experience({tick:i+1,action:'verify',reward01:.92,predictionError01:.09,salience01:.84,verified01:1,independent01:1,evidenceQuality01:.99,continuity01:.93,goalId:'runtime-goal',context01:[.9,.82,.88,.8,.91,.86,.94,.89]});
const d=core.b384AutobiographicalValueGoalDiagnostics(); assert.equal(d.verifiedEpisodes,36); assert.ok(d.valueRevisionCount>0); const q=core.queryB384AutobiographicalDevelopment([.9,.82,.88,.8,.91,.86,.94,.89],'verify','runtime-goal'); assert.ok(q.rows.length>0);
const restored=new OrganismCore(new MemoryStateStore({initial:core.snapshot()}),cfg); await restored.init(); const r=restored.b384AutobiographicalValueGoalDiagnostics(); assert.equal(r.verifiedEpisodes,d.verifiedEpisodes); assert.equal(r.valueRevisionCount,d.valueRevisionCount);
console.log(JSON.stringify({pass:true,status:'B384_RUNTIME_PERSISTENCE_PASS',verifiedEpisodes:d.verifiedEpisodes,valueRevisionCount:d.valueRevisionCount,restartEqual:true,retrievalRows:q.rows.length},null,2));
