export type AvatarMotorEmotion =
  | "curiosity" | "calm" | "joy" | "anxiety"
  | "frustration" | "sadness" | "anger" | "protective";

export type AvatarMotionGroup = "Idle" | "TapHead" | "TapBody" | "Special";
export type AvatarMotorAction = "rest" | "listen" | "reflect" | "inspect" | "explain" | "comfort" | "respond";

export interface AvatarMotorIntentInput {
  emotion: AvatarMotorEmotion;
  valence: number;
  arousal: number;
  action: string;
  thinking: boolean;
  speaking: boolean;
  hasFreshTurn: boolean;
  turnText: string;
  awake: boolean;
  energy?: number;
  cognitiveLoad?: number;
  uncertainty?: number;
  socialNeed?: number;
  novelty?: number;
  goalPressure?: number;
  predictionError?: number;
  traits?: Readonly<Record<string, number>>;
}

export interface AvatarMotorIntentPlan {
  action: AvatarMotorAction;
  motionGroup: AvatarMotionGroup;
  motionIndex: 0 | 1;
  headTilt: number;
  gesture: boolean;
  reason: string;
}

const EMOTION_TILT: Record<AvatarMotorEmotion, number> = {
  curiosity: -0.045,
  calm: 0,
  joy: 0.018,
  anxiety: -0.018,
  frustration: 0.035,
  sadness: 0.055,
  anger: 0.025,
  protective: -0.01,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

const EXPLANATION_CUES = /(?:\b(?:because|therefore|let me explain|look at|here is|first|second|the result|the data)\b|потому что|следовательно|объясню|покажу|смотри|посмотри|разбер[её]м|данные показывают|во-первых|во-вторых)/iu;
const QUESTION_CUES = /(?:[?？]|\b(?:why|how|what if|interesting|i wonder)\b|почему|зачем|как устроен|интересно|любопытно|что если)/iu;
const COMFORT_CUES = /(?:\b(?:sorry|that sounds hard|i understand|i'm here|take your time)\b|мне жаль|понимаю тебя|я рядом|не спеши|это тяжело|сочувствую)/iu;

/**
 * Converts organism-level context into a bounded motor intention for the currently
 * available Live2D rig. This is a deterministic intent selector, not a 3D IK solver:
 * it chooses only motion groups that exist in Kurisu.model3.json.
 */
export function planAvatarMotorIntent(input: AvatarMotorIntentInput): AvatarMotorIntentPlan {
  const emotion = input.emotion in EMOTION_TILT ? input.emotion : "calm";
  const action = typeof input.action === "string" ? input.action : "wait";
  const valence = clamp(input.valence, 0, 1);
  const arousal = clamp(input.arousal, 0, 1);
  const energy = clamp(input.energy ?? 0.72, 0, 1);
  const cognitiveLoad = clamp(input.cognitiveLoad ?? 0.22, 0, 1);
  const uncertainty = clamp(input.uncertainty ?? 0.4, 0, 1);
  const socialNeed = clamp(input.socialNeed ?? 0.35, 0, 1);
  const novelty = clamp(input.novelty ?? 0.45, 0, 1);
  const goalPressure = clamp(input.goalPressure ?? 0.2, 0, 1);
  const predictionError = clamp(input.predictionError ?? 0.3, 0, 1);
  const traits = input.traits ?? {};
  const trait = (name: string, fallback: number): number => clamp(traits[name] ?? fallback, 0, 1);
  const curiosityTrait = trait("curiosity", 0.7);
  const warmthTrait = trait("warmth", 0.63);
  const playfulnessTrait = trait("playfulness", 0.45);
  const composureTrait = trait("composure", 0.7);
  const guardednessTrait = trait("guardedness", 0.5);
  const text = (typeof input.turnText === "string" ? input.turnText : "").normalize("NFKC").trim();
  const activeConversation = input.speaking || input.hasFreshTurn || action === "respond";
  const cognitivePressure = cognitiveLoad >= 0.82 || uncertainty >= 0.84 || predictionError >= 0.84;

  let intent: AvatarMotorAction;
  let reason: string;

  if (!input.awake || action === "rest" || (!activeConversation && energy <= 0.12)) {
    intent = "rest";
    reason = !input.awake || action === "rest" ? "low-activity-or-rest-state" : "low-energy-homeostatic-rest";
  } else if (input.thinking || action === "reflect" || (!activeConversation && cognitivePressure)) {
    intent = "reflect";
    reason = cognitivePressure ? "high-cognitive-load-or-uncertainty" : input.thinking ? "active-cognitive-workspace" : "organism-selected-reflection";
  } else if (activeConversation) {
    if (COMFORT_CUES.test(text) || ((emotion === "sadness" || emotion === "anxiety") && valence < 0.48)
      || (socialNeed >= 0.82 && warmthTrait >= 0.62)) {
      intent = "comfort";
      reason = socialNeed >= 0.82 ? "social-need-and-warmth-trait" : "affective-support-context";
    } else if (EXPLANATION_CUES.test(text) || goalPressure >= 0.84) {
      intent = "explain";
      reason = goalPressure >= 0.84 ? "high-goal-pressure-explanatory-intent" : "explanatory-language-and-response-context";
    } else if (QUESTION_CUES.test(text) || emotion === "curiosity") {
      intent = "reflect";
      reason = "question-or-curiosity-cue";
    } else {
      intent = "respond";
      reason = "new-or-active-response";
    }
  } else if (action === "explore" || action === "verify" || (novelty >= 0.82 && curiosityTrait >= 0.68)) {
    intent = "inspect";
    reason = novelty >= 0.82 && curiosityTrait >= 0.68 ? "novelty-and-curiosity-trait" :
      action === "explore" ? "organism-selected-exploration" : "organism-selected-verification";
  } else {
    intent = "listen";
    reason = "no-active-motor-goal";
  }

  const motionGroup: AvatarMotionGroup =
    intent === "rest" || intent === "listen" ? "Idle" :
    intent === "reflect" ? "TapHead" :
    intent === "inspect" || intent === "explain" || intent === "comfort" ? "TapBody" : "Special";

  const positiveCue = emotion === "joy" || valence >= 0.68
    || /(?:\b(?:great|excellent|excited|happy)\b|отлично|прекрасно|здорово|ура)/iu.test(text);
  const motionIndex: 0 | 1 = motionGroup === "Special" && positiveCue && playfulnessTrait >= 0.35 ? 1 : 0;

  const actionTilt =
    intent === "reflect" ? -0.016 :
    intent === "inspect" ? -0.008 :
    intent === "comfort" ? 0.018 : 0;
  const traitTilt = (novelty - 0.45) * (curiosityTrait - 0.5) * 0.035
    + (socialNeed - 0.35) * (warmthTrait - 0.5) * -0.025
    + (uncertainty - 0.4) * (guardednessTrait - 0.5) * 0.018;
  const headTilt = clamp((EMOTION_TILT[emotion] + actionTilt + traitTilt) * (1 - composureTrait * 0.12), -0.15, 0.15);
  const regulationDamping = energy < 0.2 || cognitiveLoad >= 0.9 || uncertainty >= 0.92;
  const gesture =
    !regulationDamping && (
      (intent === "inspect" && (novelty >= 0.55 || action === "explore")) ||
      intent === "explain" ||
      (intent === "reflect" && arousal >= 0.28 && cognitiveLoad < 0.82) ||
      (intent === "comfort" && (arousal >= 0.2 || socialNeed >= 0.82) && warmthTrait >= 0.5) ||
      (intent === "respond" && (arousal >= 0.45 || (socialNeed >= 0.72 && warmthTrait >= 0.7)))
    );

  return { action: intent, motionGroup, motionIndex, headTilt, gesture, reason };
}
