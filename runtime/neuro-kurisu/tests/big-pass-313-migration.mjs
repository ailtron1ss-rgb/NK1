import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const raw={
  schemaVersion:127,
  system:{
    b313LongitudinalBehavioralDivergence:{
      version:1,
      cycles:24,
      verifiedCycles:24,
      autonomousCycles:8,
      positiveOutcomes:14,
      negativeOutcomes:10,
      actionCounts:{respond:8,explore:6,verify:4,rest:2,reflect:2,wait:1,defer:1},
      positiveActionCounts:{respond:3,explore:6,verify:3,rest:1,reflect:1,wait:0,defer:0},
      negativeActionCounts:{respond:5,explore:0,verify:1,rest:1,reflect:1,wait:1,defer:1},
      firstNeuralPlasticity01:.44,
      lastNeuralPlasticity01:.37,
      firstPersonalityInfluence01:.01,
      lastPersonalityInfluence01:.17,
      firstPersonalityStability01:.47,
      lastPersonalityStability01:.78,
      firstPolicyBias01:.02,
      lastPolicyBias01:-.01,
      positiveTrajectory01:1,
      negativeTrajectory01:0,
      actionDistributionGap01:.42,
      neuralDelta01:.08,
      personalityDelta01:.12,
      policyDelta01:.21,
      consolidationBridgeUpdates:72,
      consolidationBridgeStrength01:.026,
      history:[]
    }
  }
};

const migrated=migratePersistedOrganism(raw);
const state=migrated.system.b313LongitudinalBehavioralDivergence;
assert.equal(state?.cycles,24);
assert.equal(state?.verifiedCycles,24);
assert.equal(state?.positiveOutcomes,14);
assert.equal(state?.negativeOutcomes,10);
assert.equal(state?.consolidationBridgeUpdates,72);
assert.equal(state?.policyDelta01,.21);
console.log(JSON.stringify({pass:true,schema:ORGANISM_STATE_SCHEMA,restored:state},null,2));
process.exit(0);
