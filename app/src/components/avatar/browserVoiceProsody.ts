import { buildVoicePlan, inferVoiceLanguage } from "../../../../runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts";
import type { OrganismBodyState } from "../../../../runtime/neuro-kurisu/src/organism/body/EmbodiedBody.ts";

export type BrowserVoiceEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";
export interface BrowserVoiceProsodyInput {
  text: string;
  emotion: BrowserVoiceEmotion | string;
  action: string;
  arousal: number;
  valence: number;
  cognitiveLoad: number;
  uncertainty: number;
  socialNeed: number;
}
export interface BrowserVoiceProsody {
  language: string;
  pitch: number;
  rate: number;
  volume: number;
  pauseMs: number;
  emphasis01: number;
  mode: string;
  tone: string;
  reason: string[];
}

/**
 * Browser adapter for the organism's canonical VoicePlan.
 * The web client has no trusted Android thermal/circadian telemetry, so it supplies
 * a neutral body baseline; the runtime uses its measured OrganismBodyState instead.
 * All affect/action-to-prosody decisions remain in VoiceEmbodiment.buildVoicePlan.
 */
export function inferBrowserVoiceLanguage(text: string): string {
  return inferVoiceLanguage(text);
}

export function buildBrowserVoiceProsody(input: BrowserVoiceProsodyInput): BrowserVoiceProsody {
  const body = {
    thermalStrain01: 0,
    cognitiveCapacity01: 1,
    circadian01: 1,
  } as unknown as OrganismBodyState;
  const plan = buildVoicePlan({
    text: String(input.text ?? ""),
    action: input.action,
    needs: {
      energy: 1,
      cognitiveLoad: input.cognitiveLoad,
      uncertainty: input.uncertainty,
      socialNeed: input.socialNeed,
      novelty: 0.5,
      identityCoherence: 0.8,
      goalPressure: 0.3,
    },
    body,
    continuity01: 0.7,
    grounding01: 0.7,
    uncertainty01: input.uncertainty,
    emotion: {
      label: input.emotion,
      valence01: input.valence,
      arousal01: input.arousal,
    },
  });
  return {
    language: plan.language,
    pitch: plan.prosody.pitch,
    rate: plan.prosody.rate,
    volume: plan.prosody.volume,
    pauseMs: plan.prosody.pauseMs,
    emphasis01: plan.prosody.emphasis01,
    mode: plan.mode,
    tone: plan.tone,
    reason: plan.reason,
  };
}
