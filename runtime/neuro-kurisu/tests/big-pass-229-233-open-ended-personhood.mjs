import assert from 'node:assert/strict';
import { AutonomousValueFormationEngine } from '../src/organism/system/AutonomousValueFormationEngine.ts';
import { OpenEndedSkillAcquisitionController } from '../src/organism/system/OpenEndedSkillAcquisitionController.ts';
import { AutobiographicalLifeNarrativeEngine } from '../src/organism/system/AutobiographicalLifeNarrativeEngine.ts';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';
import { LiveSelfImprovementSupervisor } from '../src/organism/system/LiveSelfImprovementSupervisor.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const value=new AutonomousValueFormationEngine();
for(let i=1;i<=12;i++) value.evaluate({at:i*1000,domain:['learning','autonomy','truthfulness'][i%3],pressure01:.64+(i%3)*.06,evidence01:.78,uncertainty01:.28,identity01:.86,relationship01:.54,novelty01:.61});
assert.ok(value.summary().cycles===12); assert.ok(value.summary().accepted>=1); assert.ok(value.summary().stability01>.72);
const valueRestored=new AutonomousValueFormationEngine(); valueRestored.restore(value.snapshot()); assert.equal(valueRestored.summary().revisions,value.summary().revisions);

const skill=new OpenEndedSkillAcquisitionController(); let skillFrame=null;
for(let i=0;i<16;i++) skillFrame=skill.cycle({at:i*1000,domain:'learning',gap01:.78,learningPressure01:.72,resource01:.78,novelty01:.62,identity01:.86,availableSkillNames:['tool-use','prediction','reflection']});
assert.ok(skill.summary().created>=1); assert.ok(skill.summary().practiced>=8); assert.ok(skill.summary().meanMastery01>.2);
if(skillFrame?.track) skill.evaluate(skillFrame.track.id,.88,20000);
const skillRestored=new OpenEndedSkillAcquisitionController();skillRestored.restore(skill.snapshot());assert.equal(skillRestored.summary().created,skill.summary().created);

const narrative=new AutobiographicalLifeNarrativeEngine();
for(let i=0;i<10;i++) narrative.ingest({at:i*1000,theme:['learning','creation','relationship','reflection'][i%4],agency01:.72,outcome01:.7,novelty01:.68,identity01:.84,projectContinuity01:.76,lesson:'validated experience integrated'});
narrative.reflect({at:12000,theme:'reflection',newMeaning01:.82,identity01:.86});
assert.ok(narrative.summary().episodes===10);assert.ok(narrative.summary().reflections===1);assert.ok(narrative.summary().identityCoherence01>.7);

const social=new AutonomousSocialInitiativeEngine(); let socialFrame=null; let createdSocialInitiative=null;
const socialStart=Date.now();
for(let i=0;i<8;i++) {
  socialFrame=social.cycle({at:socialStart+i*1000,externalInput:false,socialNeed01:.74,relationship01:.39,energy01:.82,identity01:.86,novelty01:.65,knownContact:null,quietPeriodMs:0,cooldownMs:0,startupGraceMs:0,topics:[{topic:'A distinct reflection on how causal evidence should change a scientific model',source:'reflection',salience01:.8,freshness01:.8}]});
  if(socialFrame?.initiative) createdSocialInitiative=socialFrame.initiative;
}
assert.ok(social.summary().planned>=1);assert.ok(social.summary().initiative01>.3);
assert.equal(createdSocialInitiative?.contact,null,'the engine must not synthesize an ambient contact');
if(createdSocialInitiative) { social.stageMessage(createdSocialInitiative.id,'Есть причинная связь, которую стоит обдумать.'); social.record(createdSocialInitiative.id,true,socialStart+9000); }
assert.ok(social.summary().executed>=1);
assert.equal(social.snapshot().reciprocity01,.54,'message delivery cannot be counted as reciprocation');

const supervisor=new LiveSelfImprovementSupervisor();
const cont=supervisor.supervise({at:1,predictionError01:.25,resourcePressure01:.18,identity01:.86,goalPressure01:.42,activeRun:true,recoveryPressure01:.12});
const redirect=supervisor.supervise({at:2,predictionError01:.84,resourcePressure01:.62,identity01:.82,goalPressure01:.58,activeRun:true,recoveryPressure01:.58});
const abort=supervisor.supervise({at:3,predictionError01:.92,resourcePressure01:.88,identity01:.62,goalPressure01:.8,activeRun:true,recoveryPressure01:.9});
assert.equal(cont.decision,'continue');assert.equal(redirect.decision,'redirect');assert.equal(abort.decision,'abort');
assert.ok(supervisor.distill({at:4,domain:'prediction',beforeError01:.62,afterError01:.41,validated01:.91}));
assert.ok(supervisor.summary().lessons>=1);

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg); await core.init();
for(let i=0;i<14;i++) await core.autonomousHeartbeat(300000+i*10000);
await core.flush();
const s1=core.systemSnapshot();
assert.ok((s1.autonomousValueFormation?.cycles??0)>=1);assert.ok((s1.openEndedSkillAcquisition?.cycles??0)>=1);assert.ok((s1.autobiographicalLifeNarrative?.episodes??0)>=1);assert.ok((s1.autonomousSocialInitiative?.cycles??0)>=1);assert.ok((s1.liveSelfImprovementSupervisor?.cycles??0)>=1);
const core2=new OrganismCore(store,cfg);await core2.init();const s2=core2.systemSnapshot();
for(const key of ['autonomousValueFormation','openEndedSkillAcquisition','autonomousSocialInitiative','liveSelfImprovementSupervisor']) assert.equal(s2[key]?.cycles,s1[key]?.cycles,`${key} restart mismatch`);
assert.equal(s2.autobiographicalLifeNarrative?.episodes,(s1.autobiographicalLifeNarrative?.episodes ?? 0)+1,'a restored process gap should create exactly one autobiographical recovery episode');
assert.equal(s2.autobiographicalLifeNarrative?.lastTheme,'recovery-after-process-gap','recovery should be explicit in the life narrative rather than silently changing the count');
console.log(JSON.stringify({pass:'BIG_PASS_229_233_OPEN_ENDED_PERSONHOOD',modules:{value:value.summary(),skill:skill.summary(),narrative:narrative.summary(),social:social.summary(),supervisor:supervisor.summary()},core:{cycles:{value:s1.autonomousValueFormation?.cycles,skill:s1.openEndedSkillAcquisition?.cycles,narrative:s1.autobiographicalLifeNarrative?.episodes,social:s1.autonomousSocialInitiative?.cycles,supervisor:s1.liveSelfImprovementSupervisor?.cycles},restartPreserved:true},verified:true},null,2));
