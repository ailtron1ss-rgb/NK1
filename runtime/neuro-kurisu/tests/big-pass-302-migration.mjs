import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
const marker={
  version:1,ticks:96,pulses:30,microCycles:66,learningUpdates:30,synapticUpdates:4680,verifiedUpdates:4,autonomousUpdates:8,
  consolidationWindows:1,
  epochs:[{id:1,kind:'autonomous',startTick:89,endTick:96,pulses:8,microCycles:0,learningUpdates:8,synapticUpdates:1248,verifiedUpdates:2,autonomousUpdates:8,meanReward01:.71,meanPredictionError01:.24,meanPersonalityInfluence01:.02,meanNeuralPlasticity01:.30,meanCausalIntegrity01:.62,meanResourcePressure01:.24,actionDistribution:{respond:0,explore:1,verify:0,rest:0,reflect:0,wait:0,defer:0},consolidated:true}],
  currentStartLearningUpdates:22,currentStartSynapticUpdates:3432,currentStartVerifiedUpdates:2,currentStartAutonomousUpdates:0,currentEpochKind:'autonomous',currentEpochStartTick:97,currentEpochMicroCycles:0,
  currentActionCounts:{respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},currentRewards:[],currentPredictionErrors:[],currentPersonalityInfluence:[],currentNeuralPlasticity:[],currentCausalIntegrity:[],currentResourcePressure:[],
  baselineActionDistribution:{respond:1,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},recentActionDistribution:{respond:0,explore:1,verify:0,rest:0,reflect:0,wait:0,defer:0},
  baselinePolicyBias:{respond:.001,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},recentPolicyBias:{respond:.003,explore:.004,verify:0,rest:0,reflect:0,wait:0,defer:0},
  behaviorShift01:1,personalityShift01:.025,neuralPlasticityShift01:.30,causalIntegrity01:.62,autonomousBehaviorFraction01:.266,consolidationHealth01:.38,longHorizonReadiness01:.42,maxResourcePressure01:.25,lastConsolidationTick:96,lastReason:'marker'
};
const migrated=migratePersistedOrganism({schemaVersion:127,system:{longHorizonDevelopmentB302:marker}});
assert.deepEqual(migrated.system.longHorizonDevelopmentB302,marker,'B302 migration did not preserve state');
console.log(JSON.stringify({pass:true,schema:migrated.schemaVersion,ticks:migrated.system.longHorizonDevelopmentB302.ticks,pulses:migrated.system.longHorizonDevelopmentB302.pulses,consolidationWindows:migrated.system.longHorizonDevelopmentB302.consolidationWindows}));
