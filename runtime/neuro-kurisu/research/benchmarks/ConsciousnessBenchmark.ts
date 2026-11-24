import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../../src/organism/persistence/FileStateStore.ts';
import { OrganismCore, type PersistedOrganism } from '../../src/organism/core/OrganismCore.ts';
import { WorldEnvironment } from '../../src/organism/world/WorldEnvironment.ts';
import { PlanEngine } from '../../src/organism/world/PlanEngine.ts';
import { OfflineConsolidation } from '../../src/organism/cognition/OfflineConsolidation.ts';

export interface OrganismBenchmarkCase {
  name: string;
  metrics: Record<string, number>;
  notes: string[];
}

export async function runConsciousnessBenchmark(): Promise<{ version: string; cases: OrganismBenchmarkCase[] }> {
  const cases: OrganismBenchmarkCase[] = [];
  const root = await mkdtemp(join(tmpdir(), 'kurisu-consciousness-bench-'));
  try {
    const run = async (label: string, config: ConstructorParameters<typeof OrganismCore>[1]) => {
      const dir = join(root, label);
      const core = new OrganismCore(new FileStateStore<PersistedOrganism>(join(dir, 'state.json')), config);
      await core.init();
      const env = new WorldEnvironment();
      const plans = new PlanEngine(env);
      const rows = [];
      for (let i = 0; i < 60; i += 1) {
        const envObs = env.toOrganismObservation();
        const result = await core.observe({ ...envObs, text: i % 5 === 0 ? 'ответь на вопрос' : undefined, novelty: i < 20 ? 0.75 : envObs.novelty, surprise: i === 17 ? 0.8 : envObs.surprise });
        if (result.decision.selected) rows.push(result.decision);
        const action = result.decision.selected?.action ?? 'wait';
        const plan = plans.build(result.goals.find(g => g.status === 'active') ?? null, action);
        const step = plan.steps[0]?.environmentAction ?? 'observe';
        const before = env.snapshot();
        const transition = env.step(step);
        await core.feedback({ success: transition.reward, reward: transition.reward, surprise: transition.surprise, notes: transition.after.facts.at(-1), worldTransition: { action: transition.action, before: before as any, after: transition.after as any, reward: transition.reward, surprise: transition.surprise, at: transition.at } });
      }
      const snapshot = core.snapshot();
      const consolidation = new OfflineConsolidation().run(snapshot.traces, snapshot.goals);
      return { snapshot, consolidation, rows };
    };

    const baseline = await run('baseline', {});
    cases.push({
      name: 'baseline',
      metrics: {
        cycles: baseline.snapshot.state.tick,
        autonomousInitiatives: baseline.rows.filter(r => !r.userRequestedAction && r.selected?.action !== 'wait').length,
        overrideRate: baseline.consolidation.selfModel.overrideRate,
        selfPredictionAccuracy: baseline.consolidation.selfModel.predictedActionAccuracy,
        worldTransitions: baseline.snapshot.worldModel.transitions.length,
        consolidatedMemories: baseline.consolidation.memories.length,
      },
      notes: ['Functional benchmark only; does not establish phenomenal consciousness.'],
    });

    const noWorld = await run('no-world', { enableWorldModel: false });
    cases.push({ name: 'ablation:no-world', metrics: { cycles: noWorld.snapshot.state.tick, worldTransitions: noWorld.snapshot.worldModel.transitions.length, overrideRate: noWorld.consolidation.selfModel.overrideRate }, notes: ['Causal control for world-model contribution.'] });
    const noHomeo = await run('no-homeostasis', { enableHomeostasis: false, enableIntrinsicGoals: false });
    cases.push({ name: 'ablation:no-homeostasis', metrics: { cycles: noHomeo.snapshot.state.tick, goalCount: noHomeo.snapshot.goals.length, autonomousInitiatives: noHomeo.rows.filter(r => !r.userRequestedAction && r.selected?.action !== 'wait').length }, notes: ['Causal control for intrinsic motivation.'] });
    const noGws = await run('no-workspace', { enableWorkspace: false });
    cases.push({ name: 'ablation:no-workspace', metrics: { cycles: noGws.snapshot.state.tick, workspaceCycles: 0 }, notes: ['Workspace is architectural in the full build; this case removes recurrent broadcast output.'] });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  return { version: 'organism-v2-benchmark-1', cases };
}
