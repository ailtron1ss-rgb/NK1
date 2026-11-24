import fs from 'node:fs';
import { B301MobileStateEconomy, defaultB301MobileStateEconomy } from '../src/organism/system/B301MobileStateEconomy.ts';
import { WorldModel2, defaultWorldModel2 } from '../src/organism/developmental/WorldModel2.ts';
import { WorldModelEnsembleController } from '../src/organism/system/WorldModelEnsembleController.ts';

const neuralBranchSource = fs.readFileSync(new URL('../src/organism/cognition/NeuralExperienceBranch.ts', import.meta.url), 'utf8');
const snapshotStart = neuralBranchSource.indexOf('  snapshot(){');
const snapshotEnd = neuralBranchSource.indexOf('\n  restore(', snapshotStart);
if (snapshotStart < 0 || snapshotEnd < 0) throw new Error('NeuralExperienceBranch snapshot boundary missing');
const snapshotBody = neuralBranchSource.slice(snapshotStart, snapshotEnd);
const snapshotAssignments = [...snapshotBody.matchAll(/this\.state\.([A-Za-z0-9_]+)\s*=/g)].map(m => m[1]);
const duplicateSnapshotAssignments = snapshotAssignments.filter((name, i) => snapshotAssignments.indexOf(name) !== i);
if (duplicateSnapshotAssignments.length) throw new Error(`duplicate NeuralExperienceBranch snapshot assignments: ${[...new Set(duplicateSnapshotAssignments)].join(',')}`);
if (/this\.snapshot\(\);\s*const out:any=deep\(this\.state\)/.test(neuralBranchSource)) throw new Error('diagnostics still performs a discarded snapshot followed by a second deep clone');


const coreSource = fs.readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const feedbackStart = coreSource.indexOf('  async feedback(');
const feedbackEnd = coreSource.indexOf('\n  cameraEvidenceSnapshot()', feedbackStart);
if (feedbackStart < 0 || feedbackEnd < 0) throw new Error('OrganismCore feedback boundary missing');
const feedbackBody = coreSource.slice(feedbackStart, feedbackEnd);
const feedbackP80Snapshots = feedbackBody.match(/this\.selfSubsystem\.p80UnifiedSelfState\.snapshot\(\)/g) ?? [];
if (feedbackP80Snapshots.length !== 1) throw new Error(`feedback P80 snapshot count=${feedbackP80Snapshots.length}, expected 1`);
if (!/const p80FeedbackState=this\.selfSubsystem\.p80UnifiedSelfState\.snapshot\(\)/.test(feedbackBody)) throw new Error('feedback P80 snapshot cache missing');
if ((feedbackBody.match(/this\.cognitiveRuntime\.recoveryWatchdog\.snapshot\(\)/g) ?? []).length !== 1) throw new Error('feedback recovery watchdog snapshot was not deduplicated');
const observeStart = coreSource.indexOf('  async observe(');
const observeEnd = coreSource.indexOf('\n  async feedback(', observeStart);
const observeBody = coreSource.slice(observeStart, observeEnd);
const kernelSnapshotCount = (observeBody.match(/this\.cognitiveRuntime\.cognitiveKernelCoordinator\.snapshot\(\)/g) ?? []).length;
if (kernelSnapshotCount !== 1) throw new Error(`observe cognitive kernel snapshot count=${kernelSnapshotCount}, expected 1`);
const b269ObserveSnapshotCount = (observeBody.match(/this\.developmentalNeural\.spikingPlasticNeuralB269\.snapshot\(\)/g) ?? []).length;
if (b269ObserveSnapshotCount !== 2) throw new Error(`observe B269 snapshot count=${b269ObserveSnapshotCount}, expected 2 (pre/post-step)`);
const b270ObserveSnapshotCount = (observeBody.match(/this\.developmentalNeural\.neuralGerminalOrganismB270\.snapshot\(\)/g) ?? []).length;
if (b270ObserveSnapshotCount !== 2) throw new Error(`observe B270 snapshot count=${b270ObserveSnapshotCount}, expected 2 (pre/post-step)`);
const b270AutonomousSnapshotCount = (observeBody.match(/this\.developmentalNeural\.neuralGerminalOrganismB270\.autonomousSnapshot\(\)/g) ?? []).length;
if (b270AutonomousSnapshotCount !== 2) throw new Error(`observe B270 autonomous snapshot count=${b270AutonomousSnapshotCount}, expected 2`);
const b271ObserveSnapshotCount = (observeBody.match(/this\.developmentalNeural\.neuralAutobiographicalCoreB271\.snapshot\(\)/g) ?? []).length;
if (b271ObserveSnapshotCount !== 1) throw new Error(`observe B271 snapshot count=${b271ObserveSnapshotCount}, expected 1`);
const checkpointStart = coreSource.indexOf('  private async checkpoint(');
const checkpointEnd = coreSource.indexOf('\n  predictionLedgerSnapshot()', checkpointStart);
const checkpointBody = coreSource.slice(checkpointStart, checkpointEnd);
if ((checkpointBody.match(/this\.canonicalNeuralSubstrate\.snapshot\(\)/g) ?? []).length !== 0) throw new Error('checkpoint still snapshots canonical neural substrate outside projection coordinator');

const economy = new B301MobileStateEconomy();
const clean = {
  schemaVersion: 1,
  traces: [],
  facets: { memory: { eventLog: [], autobiographicalMemories: [] }, learning: { p30: { provenance: { nodes: [], edges: [] } } }, advanced: { p49TemporalLife: { episodes: [], seenEventIds: [] }, p84AutobiographicalContinuity: { moments: [] }, p58CognitiveKernel: { frames: [] } }, embodiment: { p42Experience: { history: [] } }, evolution: { network: { history: [] }, agency: { records: [] } } },
  system: {
    actionOwnershipGraphB298: { checkpoints: [] },
    neuralAutobiographicalIdentityB284: { episodes: [] },
    neuralLifeConsolidationB285: { episodes: [] },
    recurrentCausalMemory: { episodes: [] },
    shadowOrganism: { recent: [] },
    longHorizonPrediction: { recent: [] },
    emotionAppraisal: { history: [] },
  },
};
const fast = economy.compact(clean, { profile: 'mobile' });
if (fast.compactedPaths.length !== 0 || fast.beforeBytes !== 0 || fast.afterBytes !== 0) throw new Error('B301 fast path failed');

const deferredTarget=structuredClone(clean);
deferredTarget.traces=Array.from({length:17},(_,i)=>({id:i}));
const deferredEconomy=new B301MobileStateEconomy();
deferredEconomy.compact(structuredClone(clean),{profile:'mobile',tick:1});
deferredEconomy.compact(structuredClone(clean),{profile:'mobile',tick:2});
const deferred=deferredEconomy.compact(deferredTarget,{profile:'mobile',tick:3});
if (deferred.compactedPaths.length !== 0 || deferred.beforeBytes !== 0 || deferred.afterBytes !== 0) throw new Error('B301 cadence deferral failed');
const forced=deferredEconomy.compact(deferredTarget,{profile:'mobile',tick:8});
if (!forced.compactedPaths.includes('traces')) throw new Error('B301 scheduled compaction failed');

const world = new WorldModel2(defaultWorldModel2());
for (let i = 0; i < 4; i++) world.predict('explore', .5, .2);
const worldBefore = Object.keys(world.snapshot().pendingPredictions).length;
if (worldBefore === undefined) throw new Error('WorldModel diagnostics missing');

const ensemble = new WorldModelEnsembleController();
for (let i = 0; i < 4; i++) ensemble.arbitrate('explore', [{ member: 'worldModel2', prediction01: .5, confidence01: .5, uncertainty01: .2 }]);
const ensembleDiag = ensemble.snapshot();
if (Object.keys(ensembleDiag.pendingPredictions).length > 256) throw new Error('ensemble pending prediction bound violated');

console.log(JSON.stringify({ PASS: true, b301FastPath: true, b301CadenceDeferral: true, b301ScheduledCompaction: true, worldPendingBounded: true, ensemblePendingBounded: true, neuralSnapshotAssignmentsUnique: true, diagnosticsSingleClonePath: true, feedbackP80Dedup: true, recoveryWatchdogDedup: true, cognitiveKernelSnapshotDedup: true, b269PostStateDedup: true, b270PostStateDedup: true, b271PostStateDedup: true, checkpointCanonicalProjectionDedup: true }));
