export type VisemeName = "rest" | "closed" | "teeth" | "wide" | "open" | "round" | "neutral";
export interface MouthPose { open: number; form: number; viseme: VisemeName; }
export interface VisemeFrame {
  /** Inclusive UTF-16 offset reported by SpeechSynthesis boundary events. */
  charIndex: number;
  /** Exclusive UTF-16 offset; combining/ZWJ graphemes remain one frame. */
  endCharIndex: number;
  startMs: number;
  endMs: number;
  pose: MouthPose;
}
export const CLOSED_MOUTH: MouthPose;
export function poseForGrapheme(grapheme: string): MouthPose;
export function buildVisemeTimeline(text: string, rate?: number, language?: string): VisemeFrame[];
export function timelineOffsetForCharIndex(timeline: VisemeFrame[], charIndex: number): number;
export function sampleVisemeTimeline(timeline: VisemeFrame[], timeMs: number): MouthPose;
