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

export type AvatarGestureProfile = "none" | "considering" | "presenting" | "examining" | "reassuring" | "emphatic";

export interface AvatarMotorIntentPlan {
  action: AvatarMotorAction;
  gestureProfile: AvatarGestureProfile;
  gestureIntensity: number;
  motionGroup: AvatarMotionGroup;
  motionIndex: 0 | 1;
  headTilt: number;
  gazeX: number;
  gazeY: number;
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
  // Gaze is a semantic motor channel: each intent has a stable attention target.
  // Small valence/arousal offsets add affect without letting emotion override the task.
  const gazeTargets: Record<AvatarMotorAction, { x: number; y: number }> = {
    rest: { x: -0.06, y: 0.075 }, listen: { x: -0.035, y: -0.005 },
    reflect: { x: -0.19, y: -0.14 }, inspect: { x: 0.24, y: 0.04 },
    explain: { x: 0.14, y: -0.035 }, comfort: { x: -0.08, y: 0.065 },
    respond: { x: 0.01, y: 0.01 },
  };
  const gazeTarget = gazeTargets[intent];
  const gazeX = clamp(gazeTarget.x + (valence - 0.5) * 0.12, -0.4, 0.4);
  const gazeY = clamp(gazeTarget.y - arousal * 0.025, -0.4, 0.4);

  const gesture =
    intent === "inspect" || intent === "explain" ||
    (intent === "reflect" && arousal >= 0.28) ||
    (intent === "comfort" && arousal >= 0.2) ||
    (intent === "respond" && arousal >= 0.45);
  // A semantic gesture profile enriches the existing authored motion selection.
  // It deliberately stays inside the current rig's supported channels: no fake arm IK.
  const gestureProfile: AvatarGestureProfile = !gesture ? "none" :
    intent === "reflect" ? "considering" :
    intent === "explain" ? "presenting" :
    intent === "inspect" ? "examining" :
    intent === "comfort" ? "reassuring" : "emphatic";
  const gestureBase = intent === "explain" || intent === "inspect" ? 0.38 :
    intent === "reflect" ? 0.22 : intent === "comfort" ? 0.2 : 0.16;
  const gestureIntensity = gesture ? clamp(gestureBase + arousal * 0.32, 0, 0.8) : 0;

  return { action: intent, motionGroup, motionIndex, headTilt, gazeX, gazeY, gesture, gestureProfile, gestureIntensity, reason };
}
