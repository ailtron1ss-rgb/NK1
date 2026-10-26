/**
 * Renderer-neutral, bounded posture policy shared by the React and standalone
 * avatar producers. Values are normalized semantic controls, not raw model
 * parameter units; the Live2D adapter maps them to the selected model rig.
 */
const ACTION_POSES = Object.freeze({
  explore: Object.freeze({ headAngleX: 0.26, headAngleY: 0.07, bodyAngleX: 0.10, bodyAngleY: 0.10, bodyAngleZ: -0.025 }),
  verify: Object.freeze({ headAngleX: 0.14, headAngleY: -0.04, bodyAngleX: 0.06, bodyAngleY: 0.035, bodyAngleZ: -0.01 }),
  reflect: Object.freeze({ headAngleX: -0.20, headAngleY: -0.14, bodyAngleX: -0.08, bodyAngleY: -0.03, bodyAngleZ: 0.025 }),
  respond: Object.freeze({ headAngleX: 0.02, headAngleY: 0.01, bodyAngleX: 0.005, bodyAngleY: 0.02, bodyAngleZ: 0 }),
  wait: Object.freeze({ headAngleX: -0.035, headAngleY: -0.01, bodyAngleX: -0.02, bodyAngleY: 0, bodyAngleZ: 0 }),
  rest: Object.freeze({ headAngleX: -0.09, headAngleY: 0.09, bodyAngleX: -0.04, bodyAngleY: -0.06, bodyAngleZ: 0.025 }),
  defer: Object.freeze({ headAngleX: -0.07, headAngleY: 0.04, bodyAngleX: -0.03, bodyAngleY: -0.02, bodyAngleZ: 0.02 }),
});

const EMOTION_OFFSETS = Object.freeze({
  calm: Object.freeze({}),
  curiosity: Object.freeze({ headAngleX: 0.025, headAngleY: -0.025, bodyAngleY: 0.025 }),
  joy: Object.freeze({ headAngleY: 0.02, bodyAngleY: 0.015, bodyAngleZ: -0.02 }),
  anxiety: Object.freeze({ headAngleX: -0.03, headAngleY: 0.035, bodyAngleY: -0.025, bodyAngleZ: 0.02 }),
  frustration: Object.freeze({ headAngleX: 0.035, headAngleY: -0.015, bodyAngleY: 0.065, bodyAngleZ: -0.02 }),
  sadness: Object.freeze({ headAngleY: 0.04, bodyAngleY: -0.045, bodyAngleZ: 0.025 }),
  anger: Object.freeze({ headAngleX: 0.025, headAngleY: -0.02, bodyAngleY: 0.07, bodyAngleZ: -0.025 }),
  protective: Object.freeze({ headAngleX: 0.03, headAngleY: -0.015, bodyAngleY: 0.05, bodyAngleZ: 0.005 }),
});

const clamp = (value, min, max, fallback = 0) =>
  Math.max(min, Math.min(max, typeof value === "number" && Number.isFinite(value) ? value : fallback));

/**
 * Convert an organism action/emotion into small, intentional head/body poses.
 * Eye gaze remains a separate channel; this function controls head orientation,
 * torso orientation, and the amplitude of the model's breathing parameter.
 */
export function deriveEmbodimentPose(action, emotion, arousal) {
  const actionKey = Object.prototype.hasOwnProperty.call(ACTION_POSES, action) ? action : "wait";
  const emotionKey = Object.prototype.hasOwnProperty.call(EMOTION_OFFSETS, emotion) ? emotion : "calm";
  const base = ACTION_POSES[actionKey];
  const offset = EMOTION_OFFSETS[emotionKey];
  const intensity = clamp(arousal, 0, 1, 0.2);
  const get = (key) => base[key] + (typeof offset[key] === "number" ? offset[key] : 0);
  const stressBoost = ["anxiety", "frustration", "anger"].includes(emotionKey) ? 0.10 : 0;

  return Object.freeze({
    headAngleX: clamp(get("headAngleX"), -1, 1),
    headAngleY: clamp(get("headAngleY"), -1, 1),
    bodyAngleX: clamp(get("bodyAngleX"), -1, 1),
    bodyAngleY: clamp(get("bodyAngleY") + (intensity - 0.35) * 0.06, -1, 1),
    bodyAngleZ: clamp(get("bodyAngleZ"), -1, 1),
    breathIntensity: clamp(0.18 + intensity * 0.64 + stressBoost, 0, 1),
  });
}
