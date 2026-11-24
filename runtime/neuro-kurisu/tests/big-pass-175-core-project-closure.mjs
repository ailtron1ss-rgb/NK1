import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
await core.init();
await core.observe({text:'исследуй неизвестное',worldContext:{location:'lab',facts:['novel'],objects:[{id:'n',label:'novel',location:'lab',value:.9,visible:true,collected:false}],events:['novel']},embodiment:{bodyEnergy01:.95,cognitiveCapacity01:.94,thermalStrain01:.06,sensoryFreshness01:.98,awake:true,battery01:.95,cpuLoad01:.1,ramPressure01:.1}});
let life=core.autonomousProjectLifeSnapshot(); assert(life.project); const id=life.project.id;
const results=[];
for(let i=0;i<7;i++){ const r=await core.executeNextProjectStep(`closure-${i}`); results.push({ok:r.ok,verified:r.verified,tool:r.tool}); life=core.autonomousProjectLifeSnapshot(); if(life.project?.id!==id) break; }
assert(life.project?.id===id,'project selection changed unexpectedly during single-project execution');
assert(life.executor.completed>=1,'no project executor step completed');
assert(life.project.progress>0,'project did not accumulate progress');
assert(life.linkedGoal?.progress===life.project.progress,'project and linked goal progress diverged');
assert(life.projectEvents>=1,'project event accounting did not advance');
console.log(JSON.stringify({pass:175,status:'PASS',projectId:id,completed:life.executor.completed,total:life.executor.total,projectProgress:life.project.progress,goalProgress:life.linkedGoal?.progress??null,projectEvents:life.projectEvents,results}));
