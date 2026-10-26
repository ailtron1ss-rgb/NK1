export interface EmbodimentAffectState {
  sampleAtMs: number;
  expressionIntensity: number;
  gazeX: number;
  gazeY: number;
  headTilt: number;
  voiceEmphasis: number;
}
export type EmbodimentAffectTarget = Omit<EmbodimentAffectState, "sampleAtMs">;
export function smoothEmbodimentAffect(
  previous: EmbodimentAffectState | null,
  target: EmbodimentAffectTarget,
  nowMs: number,
  timeConstantMs?: number,
): EmbodimentAffectState;
