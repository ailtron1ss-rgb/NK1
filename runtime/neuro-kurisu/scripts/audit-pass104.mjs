import assert from 'node:assert/strict';
import fs from 'node:fs';
const files=['src/organism/memory/ExperienceContinuumFabric.ts','src/organism/learning/CausalExperienceStream.ts','src/organism/learning/UnifiedLearningSubstrate.ts','src/organism/core/OrganismCore.ts','src/organism/persistence/StateMigrations.ts','src/organism/system/ReleaseContract.ts'];
for(const f of files)assert.ok(fs.existsSync(f),`missing:${f}`);
const exp=fs.readFileSync(files[0],'utf8'); const cx=fs.readFileSync(files[1],'utf8'); const ul=fs.readFileSync(files[2],'utf8'); const core=fs.readFileSync(files[3],'utf8'); const mig=fs.readFileSync(files[4],'utf8');
assert.match(exp,/version:7/); assert.match(exp,/delayMs/); assert.match(exp,/retentionGain01/); assert.match(exp,/recomputeRetentionCurve/); assert.match(exp,/pairKey/); assert.match(exp,/matchedPairs/); assert.match(exp,/MemorySkillEvidence/); assert.match(exp,/markClusterReplay/);
assert.match(cx,/stateGrounded:boolean/); assert.match(cx,/sourceMemoryId/); assert.match(ul,/provenanceCounts/); assert.match(ul,/recordTransferProbe/); assert.match(core,/experienceContinuumRetentionSummary/); assert.match(core,/experienceContinuumBindMemoryToSkill/); assert.match(mig,/version:7/); assert.match(mig,/memorySkillBindings/);
console.log('AUDIT_PASS104=PASS');
