import assert from 'node:assert/strict';
import { ExternalProjectResearchTool } from '../src/organism/system/ExternalProjectResearchTool.ts';
import { SkillAcquisitionBenchmark } from '../src/organism/system/SkillAcquisitionBenchmark.ts';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';

const disabled = new ExternalProjectResearchTool({enabled:false,allowHosts:['example.com']});
let r = await disabled.fetchUrl({url:'https://example.com'});
assert.equal(r.ok,false);
assert.equal(r.error,'project-network-disabled');

const unsafe = new ExternalProjectResearchTool({enabled:true,allowHosts:['localhost','example.com']});
r = await unsafe.fetchUrl({url:'https://127.0.0.1'});
assert.equal(r.ok,false);
assert.equal(r.error,'private-host-blocked');

const blockedHost = new ExternalProjectResearchTool({enabled:true,allowHosts:['example.com']});
r = await blockedHost.fetchUrl({url:'https://not-allowlisted.invalid'});
assert.equal(r.ok,false);
assert.equal(r.error,'host-not-allowlisted');

const skill = new SkillAcquisitionBenchmark();
for (let i=0;i<8;i++) skill.observe({action:'verify',contextKey:`ctx-${i}`,outcome01:i<3?.45:.85});
const ss = skill.snapshot();
assert.equal(ss.samples,8);
assert.ok(ss.novelContexts>=8);
assert.ok(ss.gain01>=0);

const exec = new AutonomousProjectExecutor();
exec.restore();
exec.ensure({id:'p1',origin:'unresolved'});
const step=exec.currentStep();
assert.ok(step);
assert.equal(step.preferredTool,'organism.project.evidence');
exec.observeToolResult({tick:1,tool:'organism.project.evidence',ok:false,error:'failed'});
assert.equal(exec.currentStep()?.failureAttempts,1);
assert.ok((exec.currentStep()?.retryAfterTick??0)>1);
console.log('BIG_PASS_47_EXTERNAL_SKILL=PASS');
