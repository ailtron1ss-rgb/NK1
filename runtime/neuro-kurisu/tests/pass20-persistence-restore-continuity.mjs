import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const pick = (value, paths) => Object.fromEntries(paths.map((key) => {
  const parts = key.split('.');
  let current = value;
  for (const part of parts) current = current?.[part];
  return [key, current];
}));

const compare = (name, before, after, paths) => {
  const left = pick(before, paths);
  const right = pick(after, paths);
  const a = JSON.stringify(left);
  const b = JSON.stringify(right);
  if (a !== b) throw new Error(`${name} restore mismatch: ${a} != ${b}`);
};

const checks = {
  p48Awareness: ['cycles', 'ignitionCount'],
  p49TemporalLife: ['eventCursor', 'seenEventIds.length'],
  p51GroundedCausalWorkspace: ['cycles', 'concepts.length'],
  p52CounterfactualDevelopment: ['samples', 'trajectory.length', 'counterfactualCalibration01'],
  p53DevelopmentalSelfModification: ['proposals', 'tests', 'promotions'],
  p54LongHorizonEvidence: ['cycles', 'windows.length'],
  p55DevelopmentalForkUniverse: ['generations', 'simulated', 'forks.length'],
  p56IntegratedDevelopmentalMind: ['cycles', 'assessments', 'history.length'],
  p58CognitiveKernel: ['cycles', 'frames.length'],
  p61IntegratedMind: ['cycles', 'ignitions', 'frames.length'],
  p63DevelopmentalOperatingSystem: ['cycles', 'lastMode'],
  p64IntegratedOrganismDynamics: ['cycles', 'modeChanges', 'lastMode'],
  p67AutonomousGoalGenesis: ['cycles', 'proposals', 'history.length'],
  p68GoalEcology: ['cycles', 'history.length', 'activeCount'],
  p71SelfConsistency: ['cycles', 'history.length'],
  p74IntegratedOrganismKernel: ['ticks', 'lastMode'],
  p76IdentityLifeOS: ['samples', 'recentEvents.length'],
  p77RealityExperimentOS: ['observations', 'unresolved'],
  p78AutobiographicalSelfContinuity: ['chapters', 'samples'],
  p80UnifiedSelfState: ['cycles', 'lastTick', 'lastAction'],
  p81PredictiveAttention: ['cycles', 'recentFocus.length'],
  p82RealityProgress: ['observations', 'recentProgress.length'],
  p84AutobiographicalContinuity: ['revision', 'moments.length'],
};

const aStore = new MemoryStateStore();
const a = new OrganismCore(aStore, { enableLanguage: false, performanceProfile: 'mobile' });
await a.init();
for (let i = 0; i < 2; i += 1) await a.observe();
await a.flush();
const persisted = await aStore.load();
const beforeSnapshot = a.snapshot();
const before = beforeSnapshot.facets.advanced;
const beforeTick = beforeSnapshot.state.tick;

const bStore = new MemoryStateStore({ initial: persisted });
const b = new OrganismCore(bStore, { enableLanguage: false, performanceProfile: 'mobile' });
await b.init();
const after = b.snapshot().facets.advanced;
for (const [facet, paths] of Object.entries(checks)) compare(facet, before[facet], after[facet], paths);

if (after.p51GroundedCausalWorkspace?.concepts?.length > 64) throw new Error('P51 persisted projection exceeded compact bound');
if (after.p56IntegratedDevelopmentalMind?.history?.length > 32) throw new Error('P56 persisted projection exceeded compact bound');
if (after.p61IntegratedMind?.frames?.length > 32) throw new Error('P61 persisted projection exceeded compact bound');
if (after.p64IntegratedOrganismDynamics?.history?.length > 32) throw new Error('P64 persisted projection exceeded compact bound');
if (after.p68GoalEcology?.history?.length > 64) throw new Error('P68 persisted projection exceeded compact bound');
if (after.p78AutobiographicalSelfContinuity?.chaptersData?.length > 32) throw new Error('P78 persisted projection exceeded compact bound');

await b.observe({ text: 'continuity regression after restore' });
if (b.snapshot().state.tick <= beforeTick) throw new Error('post-restore step did not advance');
console.log(`PASS20_PERSISTENCE_RESTORE=PASS tick=${beforeTick}->${b.snapshot().state.tick}`);
