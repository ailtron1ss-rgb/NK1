import assert from 'node:assert/strict';
import fs from 'node:fs';
const files=[
  'src/organism/memory/ExperienceContinuumFabric.ts',
  'src/organism/learning/CausalExperienceStream.ts',
  'src/organism/learning/UnifiedLearningSubstrate.ts',
  'src/organism/core/OrganismCore.ts',
  'src/organism/persistence/StateMigrations.ts',
  'src/organism/system/ReleaseContract.ts'
];
for(const f of files) assert.ok(fs.existsSync(f),`missing:${f}`);
const exp=fs.readFileSync(files[0],'utf8');
const cx=fs.readFileSync(files[1],'utf8');
const ul=fs.readFileSync(files[2],'utf8');
const core=fs.readFileSync(files[3],'utf8');
assert.match(exp,/stateGrounded:boolean/); assert.match(exp,/recordReplayValidation/); assert.match(exp,/recordReplayExperimentTrial/); assert.match(exp,/activeGoalIds/); assert.match(exp,/lastReplayedAt/);
assert.match(cx,/provenance:'runtime-outcome'\|'experience-replay'\|'skill-repair'\|'external'/); assert.match(cx,/stateGrounded:boolean/);
assert.match(ul,/recordTransferProbe/); assert.match(ul,/negativeTransferSamples/); assert.match(ul,/interference01/); assert.match(ul,/provenanceCounts/);
assert.match(core,/Replay creates an explicitly ungrounded learning signal/); assert.match(core,/unifiedLearningRecordTransferProbe/); assert.match(core,/experienceContinuumReplayValidate/);
console.log('AUDIT_PASS103=PASS');
