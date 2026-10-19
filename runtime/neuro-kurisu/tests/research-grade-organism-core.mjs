import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
const stateFile=`/tmp/nk-research-grade-core-${process.pid}.json`;
const runtime=new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,cycleResultMode:'operational'});
await runtime.init();
for(let i=0;i<4;i++) await runtime.step(`research-grade ${i}`);
const d=runtime.core.researchGradeOrganismDiagnostics(); const a=runtime.core.researchGradeOrganismSelfAudit(); assert.equal(a.pass,true); assert.ok(a.decisions>=4); assert.ok(a.outcomes>=4); assert.ok(d.metrics.overall01>0);
console.log(`RESEARCH_GRADE_CORE=PASS cycles=${a.cycles} decisions=${a.decisions} outcomes=${a.outcomes} audit=${a.pass}`);
