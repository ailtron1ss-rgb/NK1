import assert from 'node:assert/strict';
import { AutonomousResourceToolLifeController } from '../src/organism/system/AutonomousResourceToolLifeController.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const ctl=new AutonomousResourceToolLifeController();
const tools=[{id:'organism.inspect',capability:'core.read',destructive:false,projectAllowed:true},{id:'danger.tool',capability:'device.write',destructive:true,projectAllowed:false}];
const plan=ctl.plan({tick:1,at:100,energy01:.84,thermal01:.18,ramPressure01:.2,externalInteractionBudget01:.72,initiative01:.82,uncertainty01:.7,goalPressure01:.75,homeostaticPressure01:.16,tools});
assert.ok(plan.allowed && plan.tool?.id==='organism.inspect','safe autonomous tool was not selected');
ctl.record({tick:1,at:100,tool:plan.tool,ok:true,verified:true,cost01:plan.cost01,reason:plan.reason});
const blocked=ctl.plan({tick:2,at:200,energy01:.12,thermal01:.9,ramPressure01:.9,externalInteractionBudget01:.2,initiative01:.8,uncertainty01:.8,goalPressure01:.8,homeostaticPressure01:.88,tools});
assert.equal(blocked.allowed,false,'resource safety gate failed');
const restored=new AutonomousResourceToolLifeController();restored.restore(ctl.snapshot());
assert.equal(restored.summary().toolSuccesses,1,'tool-life persistence failed');
const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);await core.init();
for(let i=0;i<18;i++){
 await core.observe({worldContext:{location:'autonomy-resource-lab',facts:['no external request','internal research need'],objects:[],events:[]},novelty:.72,surprise:.28,embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.9,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.2}});
 if(i%3===0) await core.feedback({success:.8,reward:.82,evidenceSource:'b223-resource-tool-life',surprise:.12});
}
await core.flush();
const snap=core.systemSnapshot();const st=snap.autonomousResourceToolLife;
assert.ok((st?.toolPlans??0)>=1,'core did not plan autonomous tool use');
assert.ok((st?.toolExecutions??0)>=1,'core did not execute autonomous safe tool');
assert.ok((st?.blockedDestructive??0)>=0,'tool safety counter missing');
const restoredCore=new OrganismCore(store,cfg);await restoredCore.init();
assert.equal(restoredCore.systemSnapshot().autonomousResourceToolLife?.toolExecutions,st?.toolExecutions,'autonomous tool-life state did not persist');
console.log(JSON.stringify({pass:'BIG_PASS_223_AUTONOMOUS_RESOURCE_TOOL_LIFE',controller:{toolPlans:ctl.summary().toolPlans,toolExecutions:ctl.summary().toolExecutions,toolSuccesses:ctl.summary().toolSuccesses,budgetBlocked:ctl.summary().budgetBlocked,selfStops:ctl.summary().selfStops,resourceEfficiency01:ctl.summary().resourceEfficiency01},core:{toolPlans:st?.toolPlans,toolExecutions:st?.toolExecutions,toolSuccesses:st?.toolSuccesses,toolFailures:st?.toolFailures,selfStops:st?.selfStops,resourceEfficiency01:st?.resourceEfficiency01,persistedExecutions:restoredCore.systemSnapshot().autonomousResourceToolLife?.toolExecutions},verified:true},null,2));
