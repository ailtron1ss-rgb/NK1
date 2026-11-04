import { types as nodeUtilTypes } from 'node:util';

export const NEKO_SILERO_SAMPLE_RATE_HZ = 16_000;
export const NEKO_SILERO_FRAME_SAMPLES = 512;

export interface NekoSpeechProbabilityWindowV1 {
  readonly sampleRateHz: number;
  readonly startSample: number;
  readonly endSample: number;
  readonly probability01: number;
}

export interface NekoSpeechAdmissionSnapshotV1 {
  readonly protocol: 'neko.speech.admission';
  readonly version: 1;
  readonly scopeId: string;
  readonly candidateId: number;
  readonly sampleRateHz: 16_000;
  readonly audioStartSample: number;
  readonly audioEndSample: number;
  readonly observedSamples: number;
  readonly voicedSamples: number;
  readonly observedAudioMs: number;
  readonly voicedAudioMs: number;
  readonly probabilityMean01: number;
  readonly probabilityPeak01: number;
  readonly longestSpeechRunSamples: number;
  readonly longestGapSamples: number;
  readonly missingSamples: number;
  readonly windowVoicedSamples: number;
  readonly windowSpanSamples: number;
  readonly terminalAudioEndSample: number | null;
  readonly decision: 'pending' | 'admit' | 'reject';
  readonly reason: 'collecting' | 'speech_window' | 'speech_gap' | 'candidate_timeout';
}

export interface NekoSpeechAdmissionConfig {
  readonly onsetProbability?: number;
  readonly minimumVoicedMs?: number;
  readonly windowMs?: number;
  readonly minimumOccupancy?: number;
  readonly maximumGapMs?: number;
  readonly maximumCandidateMs?: number;
}

interface NormalizedWindow extends NekoSpeechProbabilityWindowV1 {}
interface RollingFrame {
  startSample: number;
  endSample: number;
  voiced: boolean;
}
interface MutableCandidate {
  readonly candidateId: number;
  readonly audioStartSample: number;
  audioEndSample: number;
  observedSamples: number;
  voicedSamples: number;
  longestSpeechRunSamples: number;
  longestGapSamples: number;
  missingSamples: number;
  probabilityWeightedSum: number;
  probabilityPeak01: number;
  currentSpeechRunSamples: number;
  currentGapSamples: number;
  rollingFrames: RollingFrame[];
  windowVoicedSamples: number;
  windowSpanSamples: number;
  decision: 'pending' | 'admit' | 'reject';
  reason: NekoSpeechAdmissionSnapshotV1['reason'];
  terminalAudioEndSample: number | null;
}

const WINDOW_KEYS = new Set(['sampleRateHz', 'startSample', 'endSample', 'probability01']);
const SAFE_SCOPE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;

function normalizedWindow(value: unknown): NormalizedWindow {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
      throw new TypeError('invalid-speech-probability-window');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('invalid-speech-probability-window');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== WINDOW_KEYS.size) throw new TypeError('invalid-speech-probability-window');
    const record: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || !WINDOW_KEYS.has(key)) throw new TypeError('invalid-speech-probability-window');
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) {
        throw new TypeError('invalid-speech-probability-window');
      }
      record[key] = descriptor.value;
    }
    const { sampleRateHz, startSample, endSample, probability01 } = record;
    if (sampleRateHz !== NEKO_SILERO_SAMPLE_RATE_HZ ||
        !Number.isSafeInteger(startSample) || (startSample as number) < 0 ||
        !Number.isSafeInteger(endSample) || (endSample as number) <= (startSample as number) ||
        (endSample as number) - (startSample as number) !== NEKO_SILERO_FRAME_SAMPLES ||
        typeof probability01 !== 'number' || !Number.isFinite(probability01) ||
        probability01 < 0 || probability01 > 1) {
      throw new TypeError('invalid-speech-probability-window');
    }
    return {
      sampleRateHz: NEKO_SILERO_SAMPLE_RATE_HZ,
      startSample: startSample as number,
      endSample: endSample as number,
      probability01,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'invalid-speech-probability-window') throw error;
    throw new TypeError('invalid-speech-probability-window');
  }
}

/**
 * Sample-scoped local speech admission, adapted from the N.E.K.O. voice-turn gate.
 *
 * This gate evaluates whether an acoustic candidate has enough local speech
 * evidence to be considered a possible new user turn. It does NOT decide when
 * a thought is complete; semantic endpointing remains the provider's separate
 * Smart Turn responsibility. Consumers should keep these results in shadow
 * evidence until target-device and holdout calibration is complete.
 */
export class NekoSpeechAdmissionGate {
  readonly scopeId: string;
  readonly config: Required<NekoSpeechAdmissionConfig>;
  private cursor = 0;
  private candidateSequence = 0;
  private active: MutableCandidate | null = null;

  constructor(scopeId: string, config: NekoSpeechAdmissionConfig = {}) {
    if (typeof scopeId !== 'string' || !SAFE_SCOPE_ID.test(scopeId)) {
      throw new TypeError('neko-speech-admission-scope-invalid');
    }
    const normalized = {
      onsetProbability: config.onsetProbability ?? 0.5,
      minimumVoicedMs: config.minimumVoicedMs ?? 224,
      windowMs: config.windowMs ?? 480,
      minimumOccupancy: config.minimumOccupancy ?? 0.65,
      maximumGapMs: config.maximumGapMs ?? 96,
      maximumCandidateMs: config.maximumCandidateMs ?? 640,
    };
    if (
      !Number.isFinite(normalized.onsetProbability) || normalized.onsetProbability <= 0 || normalized.onsetProbability > 1 ||
      !Number.isSafeInteger(normalized.minimumVoicedMs) || normalized.minimumVoicedMs <= 0 ||
      !Number.isSafeInteger(normalized.windowMs) || normalized.windowMs < normalized.minimumVoicedMs ||
      !Number.isFinite(normalized.minimumOccupancy) || normalized.minimumOccupancy <= 0 || normalized.minimumOccupancy > 1 ||
      !Number.isSafeInteger(normalized.maximumGapMs) || normalized.maximumGapMs <= 0 ||
      !Number.isSafeInteger(normalized.maximumCandidateMs) || normalized.maximumCandidateMs < normalized.windowMs ||
      normalized.maximumGapMs >= normalized.maximumCandidateMs
    ) {
      throw new RangeError('neko-speech-admission-config-invalid');
    }
    this.scopeId = scopeId;
    this.config = Object.freeze(normalized);
  }

  get snapshot(): NekoSpeechAdmissionSnapshotV1 | null {
    return this.active ? this.toSnapshot(this.active) : null;
  }

  observe(input: unknown): NekoSpeechAdmissionSnapshotV1 | null {
    const window = normalizedWindow(input);
    if (window.startSample < this.cursor) throw new RangeError('speech-sample-range-overlap');

    const previousCursor = this.cursor;
    this.cursor = window.endSample;
    const voiced = window.probability01 >= this.config.onsetProbability;
    if (this.active?.decision === 'reject') {
      if (!voiced) return this.snapshot;
      this.active = null;
    }
    if (!this.active) {
      if (!voiced) return null;
      this.candidateSequence += 1;
      this.active = {
        candidateId: this.candidateSequence,
        audioStartSample: window.startSample,
        audioEndSample: window.startSample,
        observedSamples: 0,
        voicedSamples: 0,
        longestSpeechRunSamples: 0,
        longestGapSamples: 0,
        missingSamples: 0,
        probabilityWeightedSum: 0,
        probabilityPeak01: 0,
        currentSpeechRunSamples: 0,
        currentGapSamples: 0,
        rollingFrames: [],
        windowVoicedSamples: 0,
        windowSpanSamples: 0,
        decision: 'pending',
        reason: 'collecting',
        terminalAudioEndSample: null,
      };
    }

    const candidate = this.active;
    const missing = Math.max(0, window.startSample - Math.max(previousCursor, candidate.audioStartSample));
    const size = window.endSample - window.startSample;
    candidate.missingSamples += missing;
    candidate.currentGapSamples += missing;
    candidate.longestGapSamples = Math.max(candidate.longestGapSamples, candidate.currentGapSamples);

    if (voiced) {
      candidate.currentSpeechRunSamples = (missing ? 0 : candidate.currentSpeechRunSamples) + size;
      candidate.currentGapSamples = 0;
      candidate.voicedSamples += size;
    } else {
      candidate.currentSpeechRunSamples = 0;
      candidate.currentGapSamples += size;
    }
    candidate.longestSpeechRunSamples = Math.max(
      candidate.longestSpeechRunSamples,
      candidate.currentSpeechRunSamples,
    );
    candidate.longestGapSamples = Math.max(candidate.longestGapSamples, candidate.currentGapSamples);
    candidate.observedSamples += size;
    candidate.probabilityWeightedSum += window.probability01 * size;
    candidate.probabilityPeak01 = Math.max(candidate.probabilityPeak01, window.probability01);
    candidate.audioEndSample = window.endSample;

    candidate.rollingFrames.push({
      startSample: window.startSample,
      endSample: window.endSample,
      voiced,
    });
    const cutoff = window.endSample - this.config.windowMs * 16;
    while (candidate.rollingFrames.length && candidate.rollingFrames[0].endSample <= cutoff) {
      candidate.rollingFrames.shift();
    }
    candidate.windowVoicedSamples = candidate.rollingFrames.reduce((sum, frame) => {
      if (!frame.voiced) return sum;
      return sum + Math.max(0, frame.endSample - Math.max(frame.startSample, cutoff));
    }, 0);
    candidate.windowSpanSamples = window.endSample - Math.max(candidate.audioStartSample, cutoff);

    const previousDecision = candidate.decision;
    if (candidate.decision === 'pending') {
      const candidateSpan = window.endSample - candidate.audioStartSample;
      if (candidate.longestGapSamples > this.config.maximumGapMs * 16) {
        candidate.decision = 'reject';
        candidate.reason = 'speech_gap';
      } else if (candidateSpan > this.config.maximumCandidateMs * 16) {
        candidate.decision = 'reject';
        candidate.reason = 'candidate_timeout';
      } else if (
        candidate.windowVoicedSamples >= this.config.minimumVoicedMs * 16 &&
        candidate.windowSpanSamples > 0 &&
        candidate.windowVoicedSamples / candidate.windowSpanSamples >= this.config.minimumOccupancy
      ) {
        candidate.decision = 'admit';
        candidate.reason = 'speech_window';
      }
    }
    if (previousDecision === 'pending' && candidate.decision !== 'pending') {
      candidate.terminalAudioEndSample = window.endSample;
    }
    return this.toSnapshot(candidate);
  }

  /** Seal this candidate at the owner's boundary without resetting stream time. */
  seal(): NekoSpeechAdmissionSnapshotV1 | null {
    const snapshot = this.snapshot;
    this.active = null;
    return snapshot;
  }

  diagnostics(): { sampleRateHz: 16_000; cursorSamples: number; rollingFrames: number; candidateSequence: number } {
    return {
      sampleRateHz: NEKO_SILERO_SAMPLE_RATE_HZ,
      cursorSamples: this.cursor,
      rollingFrames: this.active?.rollingFrames.length ?? 0,
      candidateSequence: this.candidateSequence,
    };
  }

  private toSnapshot(candidate: MutableCandidate): NekoSpeechAdmissionSnapshotV1 {
    return Object.freeze({
      protocol: 'neko.speech.admission',
      version: 1,
      scopeId: this.scopeId,
      candidateId: candidate.candidateId,
      sampleRateHz: NEKO_SILERO_SAMPLE_RATE_HZ,
      audioStartSample: candidate.audioStartSample,
      audioEndSample: candidate.audioEndSample,
      observedSamples: candidate.observedSamples,
      voicedSamples: candidate.voicedSamples,
      observedAudioMs: candidate.observedSamples / 16,
      voicedAudioMs: candidate.voicedSamples / 16,
      probabilityMean01: candidate.observedSamples
        ? candidate.probabilityWeightedSum / candidate.observedSamples
        : 0,
      probabilityPeak01: candidate.probabilityPeak01,
      longestSpeechRunSamples: candidate.longestSpeechRunSamples,
      longestGapSamples: candidate.longestGapSamples,
      missingSamples: candidate.missingSamples,
      windowVoicedSamples: candidate.windowVoicedSamples,
      windowSpanSamples: candidate.windowSpanSamples,
      terminalAudioEndSample: candidate.terminalAudioEndSample,
      decision: candidate.decision,
      reason: candidate.reason,
    });
  }
}
