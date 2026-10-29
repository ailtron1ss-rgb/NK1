/**
 * Deterministic, bounded bridge from organism action/affect to continuous body pose.
 * Outputs normalized intents rather than renderer-specific joint angles. Live2D maps
 * them to the parameters available in the current rig; future rigged bodies can map
 * the same contract to bones/morph targets without introducing another emotion model.
 *
 * @typedef {"explore"|"verify"|"reflect"|"respond"|"wait"|"rest"|"defer"} ActionKey
 * @typedef {"calm"|"curiosity"|"joy"|"anxiety"|"frustration"|"sadness"|"anger"|"protective"} EmotionKey
 * @typedef {{
 *   headAngleX:number, headAngleY:number,
 *   bodyAngleX:number, bodyAngleY:number, bodyAngleZ:number,
 *   breathIntensity:number
 * }} EmbodimentPose
 */

/** @type {Readonly<Record<ActionKey, Readonly<Omit<EmbodimentPose, "breathIntensity">>>>} */
const ACTION_POSES = Object.freeze({
  explore: Object.freeze({headAngleX:0.18,headAngleY:0.04,bodyAngleX:0.08,bodyAngleY:-0.02,bodyAngleZ:0.02}),
  verify: Object.freeze({headAngleX:0.12,headAngleY:-0.08,bodyAngleX:0.05,bodyAngleY:-0.06,bodyAngleZ:0}),
  reflect: Object.freeze({headAngleX:-0.12,headAngleY:-0.10,bodyAngleX:-0.06,bodyAngleY:-0.07,bodyAngleZ:-0.02}),
  respond: Object.freeze({headAngleX:0,headAngleY:0,bodyAngleX:0,bodyAngleY:0,bodyAngleZ:0}),
  wait: Object.freeze({headAngleX:-0.035,headAngleY:-0.005,bodyAngleX:0,bodyAngleY:0,bodyAngleZ:0}),
  rest: Object.freeze({headAngleX:-0.05,headAngleY:0.075,bodyAngleX:-0.07,bodyAngleY:0.08,bodyAngleZ:0}),
  defer: Object.freeze({headAngleX:-0.08,headAngleY:-0.035,bodyAngleX:-0.04,bodyAngleY:-0.02,bodyAngleZ:-0.01}),
});

/** @type {Readonly<Record<EmotionKey, Readonly<Partial<Omit<EmbodimentPose, "breathIntensity">>>>>} */
const EMOTION_OFFSETS = Object.freeze({
  calm: Object.freeze({}),
  curiosity: Object.freeze({headAngleX:-0.07,headAngleY:-0.015,bodyAngleX:-0.025,bodyAngleZ:-0.015}),
  joy: Object.freeze({headAngleX:0.02,headAngleY:0.02,bodyAngleX:0.015,bodyAngleY:0.025}),
  anxiety: Object.freeze({headAngleX:0.02,headAngleY:-0.045,bodyAngleY:-0.035,bodyAngleZ:0.02}),
  frustration: Object.freeze({headAngleX:0.045,headAngleY:-0.02,bodyAngleX:0.045,bodyAngleY:-0.025,bodyAngleZ:0.015}),
  sadness: Object.freeze({headAngleX:-0.025,headAngleY:-0.065,bodyAngleX:-0.03,bodyAngleY:-0.04,bodyAngleZ:-0.02}),
  anger: Object.freeze({headAngleX:0.055,bodyAngleX:0.065,bodyAngleZ:0.02}),
  protective: Object.freeze({headAngleY:0.015,bodyAngleX:-0.01,bodyAngleY:0.01}),
});

/** @param {number} value @param {number} min @param {number} max @returns {number} */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/** @param {object} object @param {PropertyKey} key @returns {boolean} */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Map current organism action, emotion and arousal to a bounded continuous pose.
 * The output is intentionally low-amplitude: it complements authored motion clips
 * rather than fighting them. Unknown inputs and non-finite arousal fail safe.
 *
 * @param {string} action
 * @param {string} emotion
 * @param {number} arousal
 * @returns {Readonly<EmbodimentPose>}
 */
export function deriveEmbodimentPose(action, emotion, arousal) {
  const actionKey = hasOwn(ACTION_POSES, action) ? /** @type {ActionKey} */ (action) : "wait";
  const emotionKey = hasOwn(EMOTION_OFFSETS, emotion) ? /** @type {EmotionKey} */ (emotion) : "calm";
  const energy = typeof arousal === "number" && Number.isFinite(arousal) ? clamp(arousal, 0, 1) : 0.25;
  const base = ACTION_POSES[actionKey];
  const offset = EMOTION_OFFSETS[emotionKey];
  const affectScale = 0.35 + energy * 0.65;
  /** @param {"headAngleX"|"headAngleY"|"bodyAngleX"|"bodyAngleY"|"bodyAngleZ"} key @returns {number} */
  const value = (key) => clamp(base[key] + (offset[key] || 0) * affectScale, -1, 1);
  const stress = ["anxiety", "frustration", "anger"].includes(emotionKey) ? 0.10 : 0;
  return Object.freeze({
    headAngleX: value("headAngleX"),
    headAngleY: value("headAngleY"),
    bodyAngleX: value("bodyAngleX"),
    bodyAngleY: value("bodyAngleY"),
    bodyAngleZ: value("bodyAngleZ"),
    breathIntensity: clamp(0.12 + energy * 0.72 + stress, 0, 1),
  });
}
