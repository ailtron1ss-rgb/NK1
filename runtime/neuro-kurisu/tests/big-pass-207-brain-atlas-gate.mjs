import assert from 'node:assert/strict';
import { ArtificialBrainAtlas } from '../src/organism/system/ArtificialBrainAtlas.ts';
import { ThalamocorticalGate } from '../src/organism/system/ThalamocorticalGate.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';

const atlas = new ArtificialBrainAtlas();
const atlasSnap = atlas.snapshot();
assert.equal(atlasSnap.version, 1);
assert.ok(atlasSnap.regionCount >= 18);
assert.ok(atlasSnap.edgeCount >= 18);
assert.ok(atlasSnap.criticalGapCount >= 1);
assert.equal(new Set(atlasSnap.regions.map(r=>r.id)).size, atlasSnap.regionCount);
assert.ok(atlas.implementationCoverage01() > 0.45);
assert.ok(atlas.get('thalamus.gateway'));
assert.ok(atlas.edgesFor('thalamus.gateway').length >= 2);

const gate = new ThalamocorticalGate();
const low = gate.gate({
  bodyEnergy01:.2, thermal01:.82, cognitiveCapacity01:.3, memoryPressure01:.75,
  uncertainty01:.55, predictionError01:.45, grounding01:.45, causal01:.4, metacognitive01:.35,
  memoryHealth01:.5, goalPressure01:.5, socialNeed01:.2, novelty01:.3, externalInput:false, identityDecision:'allow'
});
const high = gate.gate({
  bodyEnergy01:.88, thermal01:.08, cognitiveCapacity01:.9, memoryPressure01:.2,
  uncertainty01:.72, predictionError01:.68, grounding01:.82, causal01:.8, metacognitive01:.78,
  memoryHealth01:.85, goalPressure01:.72, socialNeed01:.62, novelty01:.8, externalInput:true, identityDecision:'allow'
});
assert.ok(high.broadcast01 > low.broadcast01);
assert.ok(high.actionGain.explore > low.actionGain.explore);
assert.ok(high.channelGain.research > low.channelGain.research);
assert.ok(low.channelGain.interoception >= low.channelGain.action * .75);
const snapBefore = gate.snapshot();
const restored = new ThalamocorticalGate();
restored.restore(snapBefore);
assert.equal(restored.snapshot().cycles, snapBefore.cycles);

const p61 = new P61IntegratedMindKernel();
const p64 = new P64IntegratedOrganismDynamics();
const coordinator = new CognitiveKernelCoordinator(p61,p64);
const baseP64 = {
  identity01:.8, workspace01:.75, metacognitive01:.7, predictionError01:.5, uncertainty01:.4,
  novelty01:.5, grounding01:.8, causal01:.75, bodyEnergy01:.82, thermal01:.1,
  cognitiveCapacity01:.88, memoryPressure01:.25, socialNeed01:.2, goalPressure01:.7,
  realityGap01:.15, memoryHealth01:.82, agency01:.7, externalInput:true, identityDecision:'allow'
};
const candidates=[
  {action:'explore',score:.72,confidence01:.7,predictedUtility:.7,source:'world'},
  {action:'verify',score:.64,confidence01:.76,predictedUtility:.68,source:'research'},
  {action:'rest',score:.2,confidence01:.9,predictedUtility:.2,source:'body'},
];
const result = coordinator.integrateAndArbitrate(
  {tick:1,at:Date.now(),observationId:'b207',externalInput:true,identity01:.8,workspace01:.75,metacognitive01:.7,predictionError01:.5,uncertainty01:.4,novelty01:.5,grounding01:.8,causal01:.75,bodyEnergy01:.82,thermal01:.1,cognitiveCapacity01:.88,memoryPressure01:.25,socialNeed01:.2,goalPressure01:.7,realityGap01:.15,memoryHealth01:.82,developmentalPriority01:.2,identityDecision:'allow',candidates:[...candidates]},
  baseP64,
  [...candidates]
);
assert.ok(result.p61 && result.p64);
assert.equal(result.candidates.length,3);
assert.ok(result.p64.integration01 >= 0 && result.p64.integration01 <= 1);
const coordinatorSnap = coordinator.snapshot();
assert.ok(coordinatorSnap.thalamus.cycles >= 1);
assert.ok(coordinatorSnap.thalamus.last?.channelGain?.observation > 0);

console.log(JSON.stringify({
  pass:'BIG_PASS_207_BRAIN_ATLAS_GATE',
  atlas:{regions:atlasSnap.regionCount,edges:atlasSnap.edgeCount,implementationCoverage01:atlas.implementationCoverage01(),criticalGaps:atlasSnap.criticalGapCount},
  gate:{lowBroadcast01:low.broadcast01,highBroadcast01:high.broadcast01,exploreGainLow:low.actionGain.explore,exploreGainHigh:high.actionGain.explore,restore:'PASS'},
  integration:{p61Mode:result.p61.mode,p64Mode:result.p64.mode,thalamusCycles:coordinatorSnap.thalamus.cycles},
  verified:true
},null,2));
