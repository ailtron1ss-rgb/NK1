import assert from 'node:assert/strict';
import { UnifiedBrainSystem } from '../src/organism/brain/UnifiedBrainSystem.ts';
import { UserModelEvidenceModel } from '../src/organism/cognition/UserModelEvidenceModel.ts';
import { EmbodiedMotorController } from '../src/organism/system/EmbodiedMotorController.ts';
import { validateSkeleton3D, forwardKinematics3D } from '../src/organism/system/SkeletalKinematics3D.ts';

console.log('--- Starting Unified Brain System Contract Test ---');

const brain = new UnifiedBrainSystem();

// Test 1: Damasio Somatic Marker Evaluation
const marker = brain.evaluateSomaticMarker(0.4, 0.6, 0.1);
assert.equal(typeof marker.valence, 'number');
assert.equal(typeof marker.arousal, 'number');
assert.equal(typeof marker.dominance, 'number');
assert.equal(typeof marker.somaticRisk, 'number');
assert.ok(marker.valence >= -1.0 && marker.valence <= 1.0);
assert.ok(marker.arousal >= 0.0 && marker.arousal <= 1.0);
console.log('[PASS] Test 1: Damasio Somatic Marker Evaluation');

// Test 2: Canonical 11-Phase Cognitive Loop
const cycleResult = brain.runCognitiveCycle({
  visualFeatures: ['lab_coat', 'computer_terminal', 'amadeus_screen'],
  auditoryTranscript: 'Привет, Курису. Как продвигаются расчёты дивергенции?',
  sourceTimestamp: Date.now(),
  environmentalNovelty: 0.65
});

assert.equal(cycleResult.stepIndex, 1);
assert.equal(cycleResult.phaseOrder.length, 11);
assert.deepEqual(cycleResult.phaseOrder, [
  'Perceive',
  'UpdateBeliefs',
  'Recall',
  'Appraise',
  'SelectGoal',
  'Plan',
  'Gate',
  'Act',
  'Observe',
  'Reflect',
  'Consolidate'
]);
assert.ok(cycleResult.motorIntent.posture);
assert.ok(cycleResult.motorIntent.facialExpression);
assert.ok(cycleResult.motorIntent.gazeTarget);
assert.ok(cycleResult.motorIntent.speechUtterance);
assert.ok(cycleResult.actionGated !== undefined);
assert.ok(cycleResult.patternSeparated !== undefined);
console.log('[PASS] Test 2: Canonical 11-Phase Cognitive Loop');

// Test 3: Consecutive Cycles & Continuity
const cycleResult2 = brain.runCognitiveCycle({
  visualFeatures: ['divergence_meter'],
  sourceTimestamp: Date.now() + 1000,
  environmentalNovelty: 0.2
});
assert.equal(cycleResult2.stepIndex, 2);
assert.equal(brain.getCycleCount(), 2);
console.log('[PASS] Test 3: Consecutive Cycles & Continuity');

// Test 4: Hippocampal Pattern Separation & CA3 Auto-association
const recallResult = brain.recallHippocampalPattern(['divergence_meter'], 0.2);
assert.ok(recallResult.matches.length >= 1, 'Should find previous memory match via CA3 completion');
console.log('[PASS] Test 4: Hippocampal Trisynaptic Circuit (DG Pattern Separation / CA3 Completion)');

// Test 5: Basal Ganglia Action Gating
const goDecision = brain.gateBasalGangliaAction(0.1, 0.8);
assert.equal(goDecision, true, 'High dopamine and low risk should trigger direct pathway Go');
const noGoDecision = brain.gateBasalGangliaAction(0.95, 0.1);
assert.equal(noGoDecision, false, 'Low dopamine and high risk should trigger indirect pathway NoGo');
console.log('[PASS] Test 5: Basal Ganglia Corticostriatal D1/D2 Gating');

// Test 6: UserModel v2 Evidence & Epistemic Grounding Integration
const userModel = new UserModelEvidenceModel();
const res = userModel.recordExplicit({
  key: 'user.dialogue_mode',
  domain: 'interaction-style',
  value: 'scientific-academic',
  tick: 1,
  evidenceRef: 'session-turn:1',
  explicit: true,
  sensitivity: 'low-risk'
});
assert.equal(res.accepted, true);
assert.equal(userModel.confirmedValue('user.dialogue_mode', 'interaction-style'), 'scientific-academic');
console.log('[PASS] Test 6: UserModel v2 Evidence & Epistemic Grounding Integration');

// Test 7: Bio-Kinematic 3D Skeletal Coupling
const joints = [
  { id: 'root', parentId: null, offset: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 1, z: 0 }, minAngleRad: -1, maxAngleRad: 1 },
  { id: 'neck', parentId: 'root', offset: { x: 0, y: 1, z: 0 }, axis: { x: 1, y: 0, z: 0 }, minAngleRad: -1, maxAngleRad: 1 },
  { id: 'head', parentId: 'neck', offset: { x: 0, y: 0.5, z: 0 }, axis: { x: 0, y: 0, z: 1 }, minAngleRad: -1, maxAngleRad: 1 }
];
validateSkeleton3D(joints);
const fk = forwardKinematics3D(joints, { root: 0, neck: 0.2, head: -0.1 }, 'head');
assert.ok(fk.joints.head, 'Head transform must be calculated by FK');
console.log('[PASS] Test 7: Bio-Kinematic 3D Skeletal Coupling');

console.log('--- All Unified Brain System Contract Tests Passed Successfully! ---');
