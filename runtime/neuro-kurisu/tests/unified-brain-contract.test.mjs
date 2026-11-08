/**
 * Unified Brain System Contract Test
 * Verifies that the UnifiedBrainSystem faithfully executes:
 * 1. The canonical 11-phase causal cognitive loop in exact order:
 *    Perceive -> UpdateBeliefs -> Recall -> Appraise -> SelectGoal -> Plan -> Gate -> Act -> Observe -> Reflect -> Consolidate
 * 2. Damasio somatic marker evaluation (valence, arousal, dominance, risk)
 * 3. Neuromodulatory dynamic regulation (dopamine, serotonin, noradrenaline, acetylcholine)
 * 4. Homeostatic drive balancing (curiosity, energy, affiliation, coherence)
 * 5. Somatic motor posture generation (thinking_chin, arms_crossed, embarrassed, etc.)
 */

import assert from 'node:assert/strict';
import { UnifiedBrainSystem } from '../src/organism/brain/UnifiedBrainSystem.ts';

console.log('--- Starting Unified Brain System Contract Test ---');

const brain = new UnifiedBrainSystem();
assert.equal(brain.getCycleCount(), 0, 'Initial cycle count must be 0');

// Initial neuromodulators check
const initialNeuromodulators = brain.getNeuromodulators();
assert.ok(initialNeuromodulators.dopamine > 0 && initialNeuromodulators.dopamine <= 1.0, 'Dopamine must be in (0, 1]');
assert.ok(initialNeuromodulators.serotonin > 0 && initialNeuromodulators.serotonin <= 1.0, 'Serotonin must be in (0, 1]');

// Initial drives check
const initialDrives = brain.getHomeostaticDrives();
assert.ok(initialDrives.curiosity > 0.7, 'Kurisu initial curiosity must be high');
assert.ok(initialDrives.cognitiveEnergy > 0.8, 'Initial energy must be near maximum');

// Test 1: Damasio Somatic Marker Evaluation
const somatic1 = brain.evaluateSomaticMarker(0.5, 0.4, 0.1);
assert.equal(somatic1.valence, 0.5, 'Valence must match input');
assert.equal(somatic1.arousal, 0.4, 'Arousal must match input');
assert.ok(somatic1.somaticBomaticRisk >= 0 && somatic1.somaticBomaticRisk <= 1.0, 'Risk must be within [0, 1]');
console.log('[PASS] Test 1: Damasio Somatic Marker Evaluation');

// Test 2: Full 11-Phase Causal Cognitive Cycle execution
const cycle1 = brain.runCognitiveCycle({
  visualFeatures: ['lab_screen', 'oscilloscope', 'divergence_meter'],
  auditoryTranscript: 'Окабэ, что ты снова натворил с микроволновкой?',
  sourceTimestamp: Date.now(),
  environmentalNovelty: 0.85
});

assert.equal(cycle1.stepIndex, 1, 'Cycle index must be 1');
assert.deepEqual(cycle1.phaseOrder, [
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
], 'All 11 phases must execute in canonical causal order');

assert.ok(cycle1.neuromodulation.dopamine >= 0.7, 'High novelty input must trigger dopamine release');
assert.ok(cycle1.motorIntent.posture === 'thinking_chin' || cycle1.motorIntent.posture === 'arms_crossed', 'Must trigger characteristic posture');
assert.ok(cycle1.motorIntent.speechUtterance !== undefined, 'Speech utterance must be generated');
console.log('[PASS] Test 2: Canonical 11-Phase Cognitive Loop');

// Test 3: Multiple consecutive cycles and memory consolidation
for (let i = 2; i <= 5; i++) {
  const result = brain.runCognitiveCycle({
    visualFeatures: ['whiteboard_diagram'],
    environmentalNovelty: 0.3,
    sourceTimestamp: Date.now() + i * 1000
  });
  assert.equal(result.stepIndex, i, `Cycle index must increment to ${i}`);
  assert.equal(result.phaseOrder.length, 11, 'Each cycle must execute all 11 phases');
}

assert.equal(brain.getCycleCount(), 5, 'Final cycle count must be 5');
console.log('[PASS] Test 3: Consecutive Cycles & Continuity');

console.log('--- All Unified Brain System Contract Tests Passed Successfully! ---');
