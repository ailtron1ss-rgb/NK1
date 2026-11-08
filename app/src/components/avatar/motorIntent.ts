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
  const text = (typeof input.turnText === "string" ? input.turnText : "").normalize("NFKC").trim();

  let intent: AvatarMotorAction;
  let reason: string;

  if (!input.awake || action === "rest") {
    intent = "rest";
    reason = "low-activity-or-rest-state";
  } else if (input.thinking || action === "reflect") {
    intent = "reflect";
    reason = input.thinking ? "active-cognitive-workspace" : "organism-selected-reflection";
  } else if (input.speaking || input.hasFreshTurn || action === "respond") {
    if (COMFORT_CUES.test(text) || (emotion === "sadness" || emotion === "anxiety") && valence < 0.48) {
      intent = "comfort";
      reason = "affective-support-context";
    } else if (EXPLANATION_CUES.test(text)) {
      intent = "explain";
      reason = "explanatory-language-and-response-context";
    } else if (QUESTION_CUES.test(text) || emotion === "curiosity") {
      intent = "reflect";
      reason = "question-or-curiosity-cue";
    } else {
      intent = "respond";
      reason = "new-or-active-response";
    }
  } else if (action === "explore" || action === "verify") {
    intent = "inspect";
    reason = action === "explore" ? "organism-selected-exploration" : "organism-selected-verification";
  } else {
    intent = "listen";
    reason = "no-active-motor-goal";
  }

  const motionGroup: AvatarMotionGroup =
    intent === "rest" || intent === "listen" ? "Idle" :
    intent === "reflect" ? "TapHead" :
    intent === "inspect" || intent === "explain" || intent === "comfort" ? "TapBody" : "Special";

  // The bundled model has exactly two Special motions; other groups have one each.
  const motionIndex: 0 | 1 = motionGroup === "Special" &&
    (emotion === "joy" || valence >= 0.68 || /(?:\b(?:great|excellent|excited|happy)\b|отлично|прекрасно|здорово|ура)/iu.test(text))
      ? 1 : 0;

  const actionTilt =
    intent === "reflect" ? -0.016 :
    intent === "inspect" ? -0.008 :
    intent === "comfort" ? 0.018 : 0;
  const headTilt = clamp(EMOTION_TILT[emotion] + actionTilt, -0.15, 0.15);
  const gesture =
    intent === "inspect" || intent === "explain" ||
    (intent === "reflect" && arousal >= 0.28) ||
    (intent === "comfort" && arousal >= 0.2) ||
    (intent === "respond" && arousal >= 0.45);

  return { action: intent, motionGroup, motionIndex, headTilt, gesture, reason };
}
