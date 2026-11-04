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
  readonly sampleRateHz: 16000;
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
  readonly reason: string;
}
export interface NekoSpeechAdmissionConfig {
  readonly onsetProbability?: number;
  readonly minimumVoicedMs?: number;
  readonly windowMs?: number;
  readonly minimumOccupancy?: number;
  readonly maximumGapMs?: number;
  readonly maximumCandidateMs?: number;
}
export class NekoSpeechAdmissionGate {
  constructor(readonly scopeId: string, readonly config: NekoSpeechAdmissionConfig = {}) {}
  get snapshot(): NekoSpeechAdmissionSnapshotV1 | null { return null; }
  observe(_input: unknown): NekoSpeechAdmissionSnapshotV1 | null { return null; }
  seal(): NekoSpeechAdmissionSnapshotV1 | null { return null; }
  diagnostics() { return { rollingFrames: 0, sampleRateHz: 16_000 }; }
}
