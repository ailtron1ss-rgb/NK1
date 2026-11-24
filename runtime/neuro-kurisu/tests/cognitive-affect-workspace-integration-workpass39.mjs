import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

async function run(name, lowEnergy) {
  const core = new OrganismCore(new MemoryStateStore(), {
    enableLanguage: false,
    performanceProfile: 'mobile',
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
  });
  await core.init();
  core.cognitiveRuntime?.cognitiveNetwork?.updateCapacity(5);
  for (let i = 0; i < 4; i++) {
    const energy = lowEnergy ? 0.12 : 0.92;
    const capacity = lowEnergy ? 0.20 : 0.92;
    const load = lowEnergy ? 0.94 : 0.10;
    await core.observe({
      text: `${name} ${lowEnergy ? 'overheat critical battery depletion' : 'stable calibration complete'} ${i}`,
      novelty: lowEnergy ? 0.82 : 0.22,
      surprise: lowEnergy ? 0.91 : 0.08,
      success: lowEnergy ? 0.08 : 0.96,
      embodiment: {
        bodyEnergy01: energy,
        cognitiveCapacity01: capacity,
        thermalStrain01: lowEnergy ? 0.96 : 0.08,
        sensoryFreshness01: 0.92,
        awake: true,
        battery01: energy,
        cpuLoad01: load,
        ramPressure01: load,
      },
      worldContext: {
        location: 'lab',
        facts: [lowEnergy ? 'thermal strain critical' : 'body stable', lowEnergy ? 'battery critical' : 'battery stable'],
        objects: ['sensor', 'power system'],
        events: [lowEnergy ? 'overheat' : 'calibration complete'],
        energy,
        attention: capacity,
        uncertainty: lowEnergy ? 0.96 : 0.08,
      },
    }, 'operational');
    await core.feedback({ success: lowEnergy ? 0.08 : 0.96, reward: lowEnergy ? -0.25 : 0.65, surprise: lowEnergy ? 0.9 : 0.08, evidenceSource: 'device' });
  }
  const state = core.snapshot();
  const episode = core.emotionAppraisalSnapshot().history?.[0];
  const broadcast = state.facets?.evolution?.network?.lastBroadcast;
  return { core, episode, broadcast };
}

const stressed = await run('affect-workspace', true);
assert.ok(stressed.episode, 'emotion appraisal must be produced by the real OrganismCore cycle');
assert.ok(stressed.broadcast, 'cognitive network must broadcast through the real cycle');
const affect = stressed.broadcast.selected.find((item) => item.specialist === 'affect');
assert.ok(affect, `high affective relevance should compete successfully for global workspace; selected=${stressed.broadcast.selected.map(x=>x.specialist).join(',')}`);
assert.equal(affect.target, stressed.episode.label, 'workspace target must refer to the live appraisal, not a duplicate emotion state');
assert.ok(affect.evidence.some((item) => item.startsWith('tendency=')), 'action tendency must be visible to downstream workspace consumers');
assert.ok(affect.evidence.some((item) => item.startsWith('stress=')), 'interoceptive stress must be included in evidence');
assert.ok(affect.evidence.some((item) => item.startsWith('feeling-intensity=')) && affect.evidence.some((item) => item.startsWith('body-focus=')), 'feeling access must contribute body-linked intensity and focus to the workspace evidence');
assert.ok(Number.isFinite(affect.score) && affect.score >= 0 && affect.score <= 1);
const salience = stressed.broadcast.selected.find((item) => item.specialist === 'salience');
assert.ok(salience, 'real perceptual salience should remain represented in the broadcast');
assert.ok(salience.evidence.some((item) => item.startsWith('surprise=')) && salience.evidence.some((item) => item.startsWith('perception=')), 'merged salience signal must preserve internal and perception evidence instead of dropping one duplicate');

const calm = await run('affect-workspace', false);
const calmEpisode = calm.episode;
assert.ok(calmEpisode);
assert.ok(stressed.episode.interoceptiveDelta.stress01 > calmEpisode.interoceptiveDelta.stress01, 'real bodily state must change the affective appraisal');
assert.ok(stressed.episode.arousal01 >= calmEpisode.arousal01 - 0.05, 'stressful input should maintain an affectively relevant arousal signal');

stressed.core.stop?.();
calm.core.stop?.();
console.log(JSON.stringify({ status:'PASS', pass:'cognitive-affect-workspace-integration-workpass39', stressedLabel:stressed.episode.label, calmLabel:calmEpisode.label, stressedArousal:stressed.episode.arousal01, calmArousal:calmEpisode.arousal01, stressedWorkspaceSpecialists:stressed.broadcast.selected.map(x=>x.specialist), affectScore:affect.score, affectEvidence:affect.evidence }, null, 2));
