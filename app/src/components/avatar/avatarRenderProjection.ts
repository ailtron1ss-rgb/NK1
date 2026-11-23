import type { ActionKind, OrganismSnapshot } from "@/organism/types";
import type { AvatarMotorIntentPlan } from "./motorIntent";
import type { EmbodimentIntentV1, MouthPose, SpeechPhase } from "./embodimentTimeline";

export interface AvatarRenderProjectionInput {
  snapshot: OrganismSnapshot;
  thinking: boolean;
  speaking: boolean;
  hasFreshTurn: boolean;
  turnText: string;
  speechPhase: SpeechPhase;
  speechEventId: string | null;
  audioClockId: string | null;
  audioTimeMs: number;
  clockSource: EmbodimentIntentV1["clockSource"];
  mouthPose: MouthPose;
  voiceEmphasis: number;
}

export interface AvatarRenderProjection {
  action: ActionKind;
  motorPlan: AvatarMotorIntentPlan;
  expression: string;
  expressionIntensity: number;
  gaze: { x: number; y: number };
  speech: {
    phase: SpeechPhase;
    speechEventId: string | null;
    audioClockId: string | null;
    audioTimeMs: number;
    clockSource: EmbodimentIntentV1["clockSource"];
  };
  speaking: boolean;
  mouthPose: MouthPose;
  voiceEmphasis: number;
}

/** Shared semantic projection consumed by the renderer-specific adapters. */
export function buildAvatarRenderProjection(_input: AvatarRenderProjectionInput): AvatarRenderProjection {
  return {} as AvatarRenderProjection;
}
