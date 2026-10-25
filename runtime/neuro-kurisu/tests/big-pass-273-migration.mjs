import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';
const a=new B273AutonomousGoalLifecycle();
const r=a.step({tick:1,endogenousGoalVector:[.3,-.2,.6,.1,-.4,.5,.2,-.1],selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.1),neuralAssembly:Array(16).fill(.15),needs:{energy01:.72,uncertainty01:.48,novelty01:.61,goalPressure01:.46,socialNeed01:.35,autonomy01:.62,coherence01:.71},traits:{curiosity:.7,caution:.6,'truth-seeking':.7,'self-reflection':.65,'self-preservation':.68,care:.55,'social-attunation':.5,persistence:.72},predictionError01:.3,identityContinuity01:.8,autobiographicalContinuity01:.76});
a.learnFromOutcome({tick:1,action:r.action,plan:r.plan,reward01:.74,predictionError01:.22,independentGain01:.11,personalityAlignment01:.61,externalEvidence01:1});
const snap=a.snapshot(); const b=new B273AutonomousGoalLifecycle(); b.restore(snap); assert.deepEqual(b.snapshot(),snap,'B273 migration round-trip mismatch');

const old=structuredClone(snap);
old.outcomeHistory=old.outcomeHistory.map(row=>{const {plannedAction,success01,reusedSkillId,...legacyRow}=row;return legacyRow;});
delete old.skillUseEvidenceVersion;
old.skillUses=99;
old.skills=[{id:'legacy-plan',actions:['respond','explore'],support01:.9,success01:.99,expectedGain01:.9,uses:2,createdTick:1,lastUsedTick:1,goalFingerprint:old.activeGoalId}];
const migrated=new B273AutonomousGoalLifecycle(); migrated.restore(old);
assert.equal(migrated.snapshot().outcomeHistory[0].plannedAction,null,'legacy outcome history must not invent a planned action');
assert.equal(migrated.snapshot().outcomeHistory[0].success01,null,'legacy outcome must not invent a distinct success signal');
assert.equal(migrated.snapshot().outcomeHistory[0].reusedSkillId,null,'legacy outcome must not invent actual skill-use provenance');
assert.equal(migrated.snapshot().skills[0].actualUses,0,'legacy skill entries default actual execution count to zero');
assert.equal(migrated.diagnostics().skillUses,0,'legacy plan-use counters must not be interpreted as actual execution evidence');
assert.equal(migrated.diagnostics().planBoundOutcomes,0,'legacy actions without plan provenance must not be counted as aligned');
assert.equal(migrated.diagnostics().legacySequenceCandidateCount,1,'legacy multi-action plan should be retained but quarantined');
assert.equal(migrated.diagnostics().singleActionSkillCount,0,'legacy speculative plan must not become an active skill');

console.log(JSON.stringify({pass:true,diagnostics:b.diagnostics(),legacyDiagnostics:migrated.diagnostics()},null,2));
