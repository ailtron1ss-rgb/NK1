import type { ReplayExperience, ReplayTrainingReport } from './ContinualReplayBuffer.ts';
import { ContinualReplayBuffer, trainWithExperienceReplay } from './ContinualReplayBuffer.ts';
import type { ParametricPolicyLearner } from './ParametricPolicyLearner.ts';
import { AdaptiveWindowDriftDetector, type AdaptiveWindowOptions, type AdaptiveWindowSnapshot } from './AdaptiveWindowDriftDetector.ts';

export interface DriftAwareTrainingOptions {
  detector?: AdaptiveWindowOptions;
  driftReplayMultiplier?: number;
  alpha?: number;
  beta?: number;
}

export interface DriftAwareTrainingReport {
  detector: {
    driftDetected: boolean;
    detections: number;
    width: number;
    heldOutError01: number;
  };
  replay: ReplayTrainingReport;
  selectedPolicy: 'balanced-stable' | 'prioritized-after-drift';
  replayBatchSize: number;
}

/**
 * Connects trusted held-out evaluation to the existing replay trainer.
 *
 * Stable evaluation keeps task-balanced replay. When the adaptive-window
 * detector signals a shift in held-out error, the next training call uses
 * prioritized replay (high prediction-error examples rise in sampling chance)
 * and a bounded larger replay batch. This is a recommendation/control seam,
 * not a replacement for the trusted evaluator that supplies quality01.
 */
export class DriftAwareLearningController {
  private readonly detector: AdaptiveWindowDriftDetector;
  private readonly driftReplayMultiplier: number;

  constructor(options: DriftAwareTrainingOptions = {}) {
    this.detector = new AdaptiveWindowDriftDetector(options.detector);
    const multiplier = options.driftReplayMultiplier ?? 1.5;
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 4) {
      throw new RangeError('drift-replay-multiplier-out-of-range');
    }
    this.driftReplayMultiplier = multiplier;
  }

  observeAndTrain(input: {
    learner: ParametricPolicyLearner;
    buffer: ContinualReplayBuffer;
    current: ReplayExperience[];
    replayBatchSize: number;
    heldOutQuality01: number;
    alpha?: number;
    beta?: number;
  }): DriftAwareTrainingReport {
    if (!Number.isFinite(input.heldOutQuality01) ||
        input.heldOutQuality01 < 0 || input.heldOutQuality01 > 1) {
      throw new RangeError('drift-quality-out-of-range');
    }
    if (!Number.isSafeInteger(input.replayBatchSize) || input.replayBatchSize < 0) {
      throw new RangeError('drift-replay-batch-invalid');
    }

    // Convert quality to error so rising held-out error is a positive drift.
    const observation = this.detector.update(1 - input.heldOutQuality01);
    const replayBatchSize = observation.driftDetected
      ? Math.min(input.buffer.capacity, Math.ceil(input.replayBatchSize * this.driftReplayMultiplier))
      : Math.min(input.buffer.capacity, input.replayBatchSize);
    const replayStrategy = observation.driftDetected ? 'prioritized' : 'balanced';
    const replay = trainWithExperienceReplay(
      input.learner,
      input.buffer,
      input.current,
      replayBatchSize,
      {
        strategy: replayStrategy,
        ...(input.alpha === undefined ? {} : { alpha: input.alpha }),
        ...(input.beta === undefined ? {} : { beta: input.beta }),
      },
    );
    return {
      detector: {
        driftDetected: observation.driftDetected,
        detections: observation.detections,
        width: observation.width,
        heldOutError01: observation.estimation ?? 0,
      },
      replay,
      selectedPolicy: observation.driftDetected ? 'prioritized-after-drift' : 'balanced-stable',
      replayBatchSize,
    };
  }

  snapshot(): { version: 1; detector: AdaptiveWindowSnapshot; driftReplayMultiplier: number } {
    return { version: 1, detector: this.detector.snapshot(), driftReplayMultiplier: this.driftReplayMultiplier };
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new TypeError('drift-controller-snapshot-invalid');
    const snapshot = raw as { version?: number; detector?: AdaptiveWindowSnapshot; driftReplayMultiplier?: number };
    if (snapshot.version !== 1 || !snapshot.detector ||
        snapshot.driftReplayMultiplier !== this.driftReplayMultiplier) {
      throw new TypeError('drift-controller-snapshot-invalid');
    }
    this.detector.restore(snapshot.detector);
  }

  reset(): void { this.detector.reset(); }
}
