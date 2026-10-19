import assert from 'node:assert/strict';
import { DevelopmentalIdentityFabric } from '../src/organism/cognition/evolution/DevelopmentalIdentityFabric.ts';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';
import { AutobiographicalNarrativeEngine } from '../src/organism/cognition/evolution/AutobiographicalNarrative.ts';
import { P80UnifiedSelfState } from '../src/organism/cognition/P80UnifiedSelfState.ts';

const f=new DevelopmentalIdentityFabric();
const frame=f.build({
 identity:{continuity01:.9,stability01:.88,drift01:.08,goalContinuity01:.8,memoryContinuity01:.82,authorshipContinuity01:.7,valueDistance01:.1},
 p76:{continuity01:.87,conservation01:.9,drift01:.08,protectedViolations:0},
 p78:{continuity01:.82,narrativeCoherence01:.76,selfAuthorship01:.72,turningPoints:2,chapters:2},
 p84:{lifeContinuity01:.83,causalContinuity01:.8,autobiographicalIntegrity01:.78,beliefContinuity01:.74,socialBinding01:.68,selfChangeLoad01:.15,memoryBinding01:.75,identityChangeCount:2,evidenceQuality01:.84,counterEvidence01:.12},
 p80:{continuity01:.86,coherence01:.79,agency01:.7,noveltyPressure01:.35,currentMode:'reflect'},
 p71:{consistency01:.81,repairPressure01:.2,identityDrift01:.1,goalConflict01:.12,valueConflict01:.08,actionMismatch01:.05},
 p32:{selfCausalCoherence01:.65,agencyCalibration01:.7,selfPredictionAccuracy01:.66,causalSpecificity01:.62,revisionReadiness01:.24},
 trajectory:{continuity:.8,trajectoryStability:.84,projectContinuity:.8,valueContinuity:.9,narrativeContinuity:.78,authoredContinuity:.7},
 narrative:{continuity:.77,chapterCount:2,salience01:.68},
 social:{personCount:1,predictionError01:.22,trust01:.72,warmth01:.7,predictability01:.76},
 immune:{acceptedCount:10,quarantineCount:0,reviewCount:1},
});
assert.equal(frame.nonConsciousnessClaim,true); assert.ok(frame.integrity01>.55); assert.ok(frame.autobiographicalBinding01>.55); assert.ok(frame.socialContinuity01>.5);

const p78=new P78AutobiographicalSelfContinuity();
const events=[{at:1,tick:1,action:'respond',outcome:.7,text:'x',mode:'respond'},{at:2,tick:2,action:'verify',outcome:.8,text:'y',mode:'verify'}];
const a=p78.observe(events); const b=p78.observe(events); assert.equal(a.samples,b.samples,'repeated event window must not inflate developmental samples'); assert.equal(a.chapters,b.chapters,'repeated window must not create duplicate turning points');

const narrative=new AutobiographicalNarrativeEngine();
const ev=[{id:'e1',type:'decision',at:1,payload:{}},{id:'e2',type:'world-transition',at:2,payload:{}}];
const project={id:'p1',title:'Контакт с миром',status:'active'};
const n1=narrative.update({events:ev,activeProjects:[project],identityContinuity:.8,revisionCount:1});
const n2=narrative.update({events:ev,activeProjects:[project],identityContinuity:.8,revisionCount:1});
assert.equal(n1.chapters.length,n2.chapters.length); assert.equal(n1.chapters[0].salience,n2.chapters[0].salience,'same evidence must not inflate salience repeatedly');

const self=new P80UnifiedSelfState();
assert.equal(typeof self.summary().coherence01,'number');
console.log(`BIG_PASS_80_DEVELOPMENTAL_IDENTITY=PASS integrity=${frame.integrity01.toFixed(3)} p78Samples=${a.samples} chapters=${n1.chapters.length}`);
