import assert from 'node:assert/strict';
import { MultiProjectScheduler } from '../src/organism/system/MultiProjectScheduler.ts';
import { ModelOlympics } from '../src/organism/system/ModelOlympics.ts';
import { SelfProjectEngine, defaultSelfProjectState } from '../src/organism/cognition/evolution/SelfProjectEngine.ts';

const scheduler = new MultiProjectScheduler();
const projects = [
  { id:'a', title:'A', origin:'intrinsic', status:'active', commitment:.62, priority:.55, identityRelevance:.44, progress:.12, setbacks:0, successes:1, evidenceCount:1, validatedEvidenceCount:0, replicatedEvidenceCount:0, skillGain01:.1, milestones:[], nextMilestone:'', linkedGoalId:undefined, createdAt:1, lastWorkedAt:1, updatedAt:1 },
  { id:'b', title:'B', origin:'unresolved', status:'active', commitment:.84, priority:.88, identityRelevance:.75, progress:.20, setbacks:0, successes:0, evidenceCount:1, validatedEvidenceCount:0, replicatedEvidenceCount:0, skillGain01:.05, milestones:[], nextMilestone:'', linkedGoalId:undefined, createdAt:2, lastWorkedAt:1, updatedAt:2 },
];
let decision = scheduler.choose(projects, {tick:10,energy01:.82,cognitiveLoad01:.22,uncertainty01:.70,goalPressure01:.58,budget01:.76,selectedProjectId:'a',at:10_000_000});
assert.equal(decision.projectId,'b','higher urgency/evidence need project should win');
assert.equal(decision.switched,true);

decision = scheduler.choose(projects, {tick:10,energy01:.22,cognitiveLoad01:.88,uncertainty01:.10,goalPressure01:.10,budget01:.12,selectedProjectId:'a',at:10_000_000});
assert.equal(decision.projectId,'b','resource pressure must not create non-deterministic selection');

const nearTie=scheduler.choose([{...projects[0],priority:.69},{...projects[1],priority:.70}],{tick:10,at:10_000_000,energy01:.8,cognitiveLoad01:.2,uncertainty01:.3,goalPressure01:.2,budget01:.8,selectedProjectId:'a'});
assert.equal(nearTie.projectId,'a','continuity hysteresis should avoid unnecessary project churn');

const olympics = new ModelOlympics();
for(let i=0;i<120;i++) olympics.scoreRound({predictions:{stale:{predicted01:.9},fresh:{predicted01:i<12?.9:.55}},actual01:.55,at:i});
const s=olympics.snapshot().scores;
assert.ok(s.stale && s.fresh);
assert.ok(s.fresh.meanBrier01 <= s.stale.meanBrier01 || s.fresh.accuracy01 >= s.stale.accuracy01,'rolling scores should privilege currently useful model');
const calibrated = olympics.calibrate('fresh',.9);
assert.ok(calibrated < .9,'empirical calibration must temper overconfident predictions');

const projectsEngine = new SelfProjectEngine();
const state = defaultSelfProjectState();
state.projects = projects.map(p=>({...p,milestones:[]}));
state.selectedProjectId='a';
projectsEngine.restore(state);
assert.equal(projectsEngine.activeProjects().length,2);
const selected=projectsEngine.selectProject('b');
assert.equal(selected?.id,'b');
assert.equal(projectsEngine.activeProject()?.id,'b');

// Neglected projects get bounded starvation-prevention boost without mutating scheduler input.
const neglected=[{...projects[0],lastWorkedAt:1_000},{...projects[1],lastWorkedAt:9_999_000}];
const neglectedDecision=scheduler.choose(neglected,{tick:10,at:10_000_000,energy01:.8,cognitiveLoad01:.2,uncertainty01:.3,goalPressure01:.2,budget01:.8,selectedProjectId:'b'});
const recentA=scheduler.choose([{...projects[0],lastWorkedAt:9_950_000},{...projects[1],lastWorkedAt:9_999_000}],{tick:10,at:10_000_000,energy01:.8,cognitiveLoad01:.2,uncertainty01:.3,goalPressure01:.2,budget01:.8,selectedProjectId:'b'});
assert.ok(neglectedDecision.scoreByProject.a > recentA.scoreByProject.a,'recency debt should reward neglected project');


// Integration: the selected project is persisted through the core and switching is event-sourced.
const core = new (await import('../src/organism/core/OrganismCore.ts')).OrganismCore(new (await import('../src/organism/persistence/MemoryStateStore.ts')).MemoryStateStore(), {cycleResultMode:'operational',checkpointMinIntervalMs:60_000});
await core.init();
const injected = {
  version: 1, projects: projects.map((p)=>({...p,milestones:[],status:'active'})), selectedProjectId:'a', completedProjects:0, abandonedProjects:0,
  ownProjectContinuity:.6, authorshipScore:.5, lastCreatedAt:2,
};
core.agencySubsystem.restore({ selfProjects: injected });
await core.observeOperational({worldContext:{tick:1,location:'bench',energy:.8,attention:.8,uncertainty:.7,facts:[],objects:[],events:[]},embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.8,thermalStrain01:.15,sensoryFreshness01:.9,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2}});
const selectedCore=(core).activeProjectSnapshot();
assert.equal(selectedCore?.id,'b');
const events=core.snapshot().facets.memory.eventLog.filter((e)=>e.type==='project-switch');
assert.ok(events.length>=1,'multi-project selection must be event-sourced');

console.log('BIG_PASS_46_MULTI_PROJECT_MODELS=PASS');
