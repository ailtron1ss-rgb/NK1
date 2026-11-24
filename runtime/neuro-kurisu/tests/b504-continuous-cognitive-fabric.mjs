import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ContinuousCognitiveFabric } from '../src/organism/system/ContinuousCognitiveFabric.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { B502ContinuousIdentityLifecycleEngine } from '../src/organism/cognition/B502ContinuousIdentityLifecycleEngine.ts';
import { B503ExperienceIntegrationLayer } from '../src/organism/cognition/B503ExperienceIntegrationLayer.ts';
import { AdaptiveExperienceConsolidator } from '../src/organism/memory/AdaptiveExperienceConsolidator.ts';
import { DreamConsolidationLayer } from '../src/organism/cognition/b504/DreamConsolidationLayer.ts';
import { PersonalityConflictEngine } from '../src/organism/cognition/b504/PersonalityConflictEngine.ts';
import { UnifiedCognitiveSpine } from '../src/organism/cognition/b504/UnifiedCognitiveSpine.ts';

const work = await mkdtemp(path.join(tmpdir(), 'neuro-kurisu-b504-'));
let runtime = null;
let runtime2 = null;
try {
  // Direct component probes: explicit behavioral evidence for every non-constructor method.
  const directB502 = new B502ContinuousIdentityLifecycleEngine();
  directB502.absorb({ id:'direct-id', timestamp:Date.now(), significance:.7, emotionalWeight:.4, tags:['direct'] });
  const directB502State = directB502.snapshot();
  directB502.restore(directB502State);
  assert.equal(directB502.snapshot().history.at(-1)?.id, 'direct-id');

  const directB503 = new B503ExperienceIntegrationLayer();
  const directB503Result = directB503.process({ id:'direct-exp', timestamp:Date.now(), source:'test', meaning:.7, novelty:.6, emotionalImpact:.3, tags:['direct'] });
  assert(directB503Result.importance > 0 && directB503.stats().processed === 1);
  directB503.restore(directB503.snapshot());
  assert.equal(directB503.stats().processed, 1);

  const directMemory = new AdaptiveExperienceConsolidator(4);
  directMemory.ingest({ id:'m1', timestamp:Date.now(), novelty:.6, utility:.8, uncertainty:.2, tags:['direct'] });
  assert.equal(directMemory.size(), 1);
  const directConsolidated = directMemory.consolidate();
  directMemory.restore(directMemory.snapshot());
  assert(directConsolidated.length === 1 && directMemory.size() >= 0);

  const directDream = new DreamConsolidationLayer();
  const dream = directDream.consolidate([{ id:'dream-1', importance:.8, strength:.5 }]);
  assert.equal(dream.length, 1);
  const directConflict = new PersonalityConflictEngine();
  const conflict = directConflict.analyze({ id:'b', confidence:.9, content:'direct' }, { support01:.1, contradicts:true });
  assert(conflict.intensity > 0);
  const directSpine = new UnifiedCognitiveSpine();
  const spineValue = directSpine.integrate([{ source:'direct', value:.75 }]);
  assert(spineValue >= 0 && spineValue <= 1);

  const fabric = new ContinuousCognitiveFabric();
  const first = fabric.step({
    tick: 1, at: Date.now(),
    signal: { id:'exp-1', timestamp:Date.now(), source:'test', meaning:.8, novelty:.7, emotionalImpact:.4, tags:['learning','challenge'] },
    identityEvent: { id:'id-1', timestamp:Date.now(), significance:.75, emotionalWeight:.35, tags:['learning','challenge'] },
    belief:{ id:'belief-1', confidence:.8, content:'test belief' }, evidenceSupport01:.15,
  });
  assert.equal(first.processed, 1);
  assert(first.continuity01 >= 0 && first.continuity01 <= 1);
  assert(first.lastResult?.memoryPriority > 0);
  assert(first.lastConflict?.intensity > 0);

  const restored = new ContinuousCognitiveFabric();
  restored.restore(first);
  const second = restored.step({
    tick: 2, at: Date.now(),
    signal: { id:'exp-2', timestamp:Date.now(), source:'test', meaning:.6, novelty:.2, emotionalImpact:.2, tags:['reflection'] },
    identityEvent: { id:'id-2', timestamp:Date.now(), significance:.55, emotionalWeight:.2, tags:['reflection'] },
  });
  assert.equal(second.processed, 2);
  assert(second.recentIds.includes('exp-1') && second.recentIds.includes('exp-2'));

  const stateFile = path.join(work, 'organism.json');
  runtime = new OrganismRuntime({ stateFile, intervalMs:5000, enableLanguage:false, autoRun:false });
  await runtime.init();
  const step1 = await runtime.step(undefined, { deliberate:false });
  const snap1 = runtime.core.systemSnapshot().continuousCognitiveFabric;
  assert(snap1 && snap1.processed >= 1, 'runtime did not execute continuous cognitive fabric');
  assert.equal(snap1.tick, step1.cycle.state.tick);
  await runtime.flush();

  runtime2 = new OrganismRuntime({ stateFile, intervalMs:5000, enableLanguage:false, autoRun:false });
  await runtime2.init();
  const restoredRuntime = runtime2.core.systemSnapshot().continuousCognitiveFabric;
  assert(restoredRuntime && restoredRuntime.processed >= snap1.processed, 'fabric state did not persist across restart');
  assert((restoredRuntime.memoryBuffer?.length ?? 0) >= (snap1.memoryBuffer?.length ?? 0), 'memory buffer did not persist across restart');
  assert(runtime2.continuousCognitiveDiagnostics().continuity01 >= 0);

  const raw = JSON.parse(await readFile(stateFile, 'utf8'));
  assert(raw.system?.continuousCognitiveFabric?.version === 1);

  console.log(JSON.stringify({
    pass:'B504_CONTINUOUS_COGNITIVE_FABRIC',
    standalone:{processed:second.processed, continuity01:second.continuity01, conflict01:first.lastConflict?.intensity ?? 0, retainedMemory:second.memoryBuffer.length},
    runtime:{tick:step1.cycle.state.tick, processed:snap1.processed, restoredProcessed:restoredRuntime?.processed ?? 0},
    persistence:true,
  }, null, 2));
} finally {
  runtime?.stop();
  runtime2?.stop();
  await rm(work, { recursive:true, force:true });
}
