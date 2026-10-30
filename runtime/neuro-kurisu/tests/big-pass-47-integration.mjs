import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { SkillAcquisitionBenchmark } from '../src/organism/system/SkillAcquisitionBenchmark.ts';

const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode:'operational', enableLanguage:false, checkpointMinIntervalMs:0 });
await core.init();
const before = core.skillAcquisitionBenchmarkSnapshot().samples;
core.agencySubsystem.selfProjects.propose({intrinsicOverall:.7,dominant:'competence',uncertainty:.7,predictionError:.7,identityDrift:.1,unresolvedExperiments:1,activeGoals:[]});
const p = core.activeProjectSnapshot();
assert.ok(p);
let result = await core.executeNextProjectStep('integration-test');
assert.equal(result.tool,'organism.project.context');
assert.equal(result.ok,true);
assert.ok(core.skillAcquisitionBenchmarkSnapshot().samples > before);
const subs=core.cognitiveSubsystemManifest();
assert.deepEqual(subs.map(x=>x.name),['self','world','memory','agency','embodiment','research','governance']);

const raw = core.snapshot();
const migrated = migratePersistedOrganism({...raw, schemaVersion:89, state:{...raw.state, version:89}, system:{...raw.system, schemaVersion:89, skillAcquisitionBenchmark:undefined}});
assert.ok(migrated.schemaVersion>=90);
assert.equal(migrated.system.skillAcquisitionBenchmark,undefined);

const skill = new SkillAcquisitionBenchmark();
for(let i=0;i<4;i++) skill.observe({action:'explore',contextKey:`baseline-${i}`,outcome01:.4,phase:'baseline'});
for(let i=0;i<8;i++) skill.observe({action:'explore',contextKey:`holdout-${i}`,outcome01:.86,phase:'holdout'});
const ss=skill.summary();
assert.equal(ss.samples,12);
assert.ok(ss.novelContexts>=12);
assert.equal(ss.holdoutEligible,true);
assert.ok(ss.holdoutMean01>ss.baselineMean01);
assert.ok(ss.gain01>=0);

console.log('BIG_PASS_47_INTEGRATION=PASS');
