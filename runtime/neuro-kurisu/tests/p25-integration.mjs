import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore());
await core.init();
await core.observe({text:'исследуй новый вариант', novelty:.7, surprise:.2, success:.8});
const snap = core.p25Snapshot();
assert.ok(snap.metrics.runtimeSamples >= 0);
const exp = core.p25RecordControlledExperiment({name:'integration',controlLabel:'A',treatmentLabel:'B',metric:'success',controlValue:.4,treatmentValue:.7,sampleSize:10,independentConditions:true});
assert.ok(exp.id);
const evalRecord = core.p25RecordEvaluation({taskId:'integration-task',suite:'integration',phase:'regression',score01:.9,criteriaPassed:9,criteriaTotal:10,evaluator:'integration-test',evidenceLevel:'repeated'});
assert.equal(evalRecord.score01,.9);
await core.flush();
const after = core.snapshot();
assert.equal(after.facets.advanced.p25.evaluations.length, 1);
console.log('P25_INTEGRATION=PASS', JSON.stringify({runtimeSamples:after.facets.advanced.p25.metrics.runtimeSamples,evaluations:after.facets.advanced.p25.metrics.evaluations}));
