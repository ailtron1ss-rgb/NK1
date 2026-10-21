import type { ReplayExperience, ReplayTrainingReport } from './ContinualReplayBuffer.ts';
import { ContinualReplayBuffer, trainWithExperienceReplay } from './ContinualReplayBuffer.ts';
import type { ParametricPolicyLearner } from './ParametricPolicyLearner.ts';
import { AdaptiveWindowDriftDetector, type AdaptiveWindowOptions, type AdaptiveWindowSnapshot } from './AdaptiveWindowDriftDetector.ts';
import { PageHinkleyDriftDetector, type PageHinkleyOptions, type PageHinkleySnapshot } from './PageHinkleyDriftDetector.ts';

export type DriftDetectorKind = 'adaptive-window' | 'page-hinkley' | 'either';

export interface DriftAwareTrainingOptions {
  detector?: AdaptiveWindowOptions;
  pageHinkley?: PageHinkleyOptions;
  detectorKind?: DriftDetectorKind;
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
    kind: DriftDetectorKind;
    adaptiveWindowDetected: boolean;
    pageHinkleyDetected: boolean;
  };
  replay: ReplayTrainingReport;
  selectedPolicy: 'balanced-stable' | 'prioritized-after-drift';
  replayBatchSize: number;
}

/**
 * Converts trusted held-out quality to error and chooses replay policy.
 * Adaptive-window mode is the conservative default. Page-Hinkley is a
 * constant-memory alternative for mean shifts; "either" trades sensitivity
 * for potentially more false alarms, so it must be validated on held-out data.
 */
export class DriftAwareLearningController {
  private readonly detector: AdaptiveWindowDriftDetector;
  private readonly pageHinkley: PageHinkleyDriftDetector;
  private readonly detectorKind: DriftDetectorKind;
  private readonly driftReplayMultiplier: number;

  constructor(options: DriftAwareTrainingOptions = {}) {
    this.detector = new AdaptiveWindowDriftDetector(options.detector);
    this.pageHinkley = new PageHinkleyDriftDetector(options.pageHinkley);
    this.detectorKind = options.detectorKind ?? 'adaptive-window';
    if (!['adaptive-window', 'page-hinkley', 'either'].includes(this.detectorKind)) {
      throw new RangeError('drift-detector-kind-invalid');
    }
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

    const error = 1 - input.heldOutQuality01;
    // Avoid running the O(window²) exact-window scan when its detector is
    // not selected. In "either" mode both algorithms are intentionally active.
    const adaptive = this.detectorKind === 'page-hinkley' ? null : this.detector.update(error);
    const pageHinkley = this.detectorKind === 'adaptive-window' ? null : this.pageHinkley.update(error);
    const adaptiveWindowDetected = adaptive?.driftDetected ?? false;
    const pageHinkleyDetected = pageHinkley?.driftDetected ?? false;
    const driftDetected = adaptiveWindowDetected || pageHinkleyDetected;
    const replayBatchSize = driftDetected
      ? Math.min(input.buffer.capacity, Math.ceil(input.replayBatchSize * this.driftReplayMultiplier))
      : Math.min(input.buffer.capacity, input.replayBatchSize);
    const replayStrategy = driftDetected ? 'prioritized' : 'balanced';
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
    const chosenEstimate = this.detectorKind === 'page-hinkley'
      ? pageHinkley?.mean
      : adaptive?.estimation;
    return {
      detector: {
        driftDetected,
        detections: (adaptive?.detections ?? this.detector.nDetections) +
          (pageHinkley?.detections ?? (this.detectorKind === 'adaptive-window' ? 0 : this.pageHinkley.nDetections)),
        width: adaptive?.width ?? pageHinkley?.count ?? this.detector.width,
        heldOutError01: chosenEstimate ?? 0,
        kind: this.detectorKind,
        adaptiveWindowDetected,
        pageHinkleyDetected,
      },
      replay,
      selectedPolicy: driftDetected ? 'prioritized-after-drift' : 'balanced-stable',
      replayBatchSize,
    };
  }

  snapshot(): {
    version: 2;
    detector: AdaptiveWindowSnapshot;
    pageHinkley: PageHinkleySnapshot;
    detectorKind: DriftDetectorKind;
    driftReplayMultiplier: number;
  } {
    return {
      version: 2,
      detector: this.detector.snapshot(),
      pageHinkley: this.pageHinkley.snapshot(),
      detectorKind: this.detectorKind,
      driftReplayMultiplier: this.driftReplayMultiplier,
    };
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new TypeError('drift-controller-snapshot-invalid');
    const snapshot = raw as {
      version?: number;
      detector?: AdaptiveWindowSnapshot;
      pageHinkley?: PageHinkleySnapshot;
      detectorKind?: DriftDetectorKind;
      driftReplayMultiplier?: number;
    };
    if (snapshot.version !== 2 || !snapshot.detector || !snapshot.pageHinkley ||
        snapshot.detectorKind !== this.detectorKind ||
        snapshot.driftReplayMultiplier !== this.driftReplayMultiplier) {
      throw new TypeError('drift-controller-snapshot-invalid');
    }
    // Validate both snapshots before mutating either state.
    const adaptiveProbe = new AdaptiveWindowDriftDetector(this.detector.options);
    const pageHinkleyProbe = new PageHinkleyDriftDetector(this.pageHinkley.options);
    adaptiveProbe.restore(snapshot.detector);
    pageHinkleyProbe.restore(snapshot.pageHinkley);
    this.detector.restore(snapshot.detector);
    this.pageHinkley.restore(snapshot.pageHinkley);
  }

  reset(): void {
    this.detector.reset();
    this.pageHinkley.reset();
  }
}
