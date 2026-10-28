/**
 * P3351-P3500 Closed Loop Runtime Orchestrator
 *
 * Engineering purpose: connect observable runtime events into a measurable
 * cognition loop. This is an orchestration layer, not a claim of sentience.
 */
import { LifeCycleIntegrationKernel } from './LifeCycleIntegrationKernel.ts';
// `LifeCycleExperience` and `LifeCycleState` are erased interface declarations, so they
// must not appear in a runtime import under Node's strip-only TypeScript loader.
import type { LifeCycleExperience, LifeCycleState } from './LifeCycleIntegrationKernel.ts';

export interface RuntimeObservation {
  source: string;
  novelty: number;
  predictionError: number;
  outcomeValue: number;
}

export interface RuntimeCycleResult {
  cycle: number;
  lifecycle: LifeCycleState;
  changed: boolean;
}

export class ClosedLoopRuntimeOrchestrator {
  private cycle = 0;
  private readonly kernel = new LifeCycleIntegrationKernel();
  private previousAdaptation = 0;

  processObservation(observation: RuntimeObservation): RuntimeCycleResult {
    const experience: LifeCycleExperience = {
      id: `${observation.source}-${this.cycle}`,
      timestamp: Date.now(),
      novelty: observation.novelty,
      predictionError: observation.predictionError,
      outcomeValue: observation.outcomeValue,
    };

    const lifecycle = this.kernel.processExperience(experience);
    const changed = Math.abs(lifecycle.adaptationSignal - this.previousAdaptation) > 0.01;
    this.previousAdaptation = lifecycle.adaptationSignal;
    this.cycle += 1;

    return { cycle: this.cycle, lifecycle, changed };
  }

  snapshot(): { cycle: number; state: LifeCycleState } {
    return { cycle: this.cycle, state: this.kernel.snapshot() };
  }
}
