const TOP_KEYS = [
  "type", "protocolVersion", "stateVersion", "sentAtEpochMs", "speechEventId",
  "audioClockId", "speechPhase", "audioTimeMs", "clockSource", "priority",
  "cancellationToken", "expression", "expressionIntensity", "mouth", "gaze",
  "body", "voiceEmphasis",
];
const MOUTH_KEYS = ["open", "form", "viseme"];
const GAZE_KEYS = ["x", "y", "driven"];
const BODY_KEYS = ["headTilt", "gesture", "motionGroup", "motionIndex", "motionToken"];
const OPTIONAL_BODY_KEYS = ["headAngleX", "headAngleY", "bodyAngleX", "bodyAngleY", "bodyAngleZ", "breathIntensity"];
const ALLOWED_BODY_KEYS = [...BODY_KEYS, ...OPTIONAL_BODY_KEYS];
const MOTION_COUNTS = Object.freeze({ Idle: 1, TapHead: 1, TapBody: 1, Special: 2 });
const PHASES = new Set(["idle", "starting", "speaking", "ended", "cancelled", "unknown"]);
const CLOCK_SOURCES = new Set([
  "speech-synthesis-elapsed-time-anchored-monotonic",
  "speech-synthesis-boundary-anchored-monotonic",
  "none",
]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const finiteBetween = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const validId = (value, max) => value === null || (typeof value === "string" && value.length > 0 && value.length <= max);

/** Strict protocol-v1 validation, including the motion groups actually shipped with the rig. */
export function isEmbodimentIntentV1(value) {
  if (!exactKeys(value, TOP_KEYS)) return false;
  if (value.type !== "kurisu_embodiment_intent" || value.protocolVersion !== 1) return false;
  if (!Number.isSafeInteger(value.stateVersion) || value.stateVersion < 1) return false;
  if (!finiteBetween(value.sentAtEpochMs, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!PHASES.has(value.speechPhase) || !finiteBetween(value.audioTimeMs, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!CLOCK_SOURCES.has(value.clockSource) || !finiteBetween(value.priority, 0, 100)) return false;
  if (!validId(value.speechEventId, 180) || !validId(value.audioClockId, 220)) return false;
  if (value.cancellationToken !== null && (typeof value.cancellationToken !== "string" || value.cancellationToken.length > 220)) return false;
  if (typeof value.expression !== "string" || value.expression.length < 1 || value.expression.length > 32) return false;
  if (!finiteBetween(value.expressionIntensity, 0, 1) || !finiteBetween(value.voiceEmphasis, 0, 1)) return false;

  if (!exactKeys(value.mouth, MOUTH_KEYS) ||
      !finiteBetween(value.mouth.open, 0, 1) ||
      !finiteBetween(value.mouth.form, -1, 1) ||
      typeof value.mouth.viseme !== "string" || !/^[a-z]{1,16}$/.test(value.mouth.viseme)) return false;

  if (!exactKeys(value.gaze, GAZE_KEYS) ||
      !finiteBetween(value.gaze.x, -1, 1) ||
      !finiteBetween(value.gaze.y, -1, 1) ||
      typeof value.gaze.driven !== "boolean") return false;

  if (!isRecord(value.body) ||
      !BODY_KEYS.every((key) => Object.hasOwn(value.body, key)) ||
      !Object.keys(value.body).every((key) => ALLOWED_BODY_KEYS.includes(key)) ||
      !finiteBetween(value.body.headTilt, -0.15, 0.15) ||
      typeof value.body.gesture !== "boolean" ||
      typeof value.body.motionGroup !== "string" ||
      !Object.hasOwn(MOTION_COUNTS, value.body.motionGroup) ||
      !Number.isSafeInteger(value.body.motionIndex) ||
      value.body.motionIndex < 0 || value.body.motionIndex >= MOTION_COUNTS[value.body.motionGroup] ||
      !Number.isSafeInteger(value.body.motionToken) || value.body.motionToken < 0) return false;
  for (const [key, min, max] of [
    ["headAngleX", -1, 1], ["headAngleY", -1, 1],
    ["bodyAngleX", -1, 1], ["bodyAngleY", -1, 1], ["bodyAngleZ", -1, 1],
    ["breathIntensity", 0, 1],
  ]) {
    if (Object.hasOwn(value.body, key) && !finiteBetween(value.body[key], min, max)) return false;
  }

  if (value.speechPhase === "speaking" && (!value.speechEventId || !value.audioClockId)) return false;
  if (value.speechPhase === "cancelled" &&
      (!value.speechEventId || typeof value.cancellationToken !== "string" || !value.cancellationToken.startsWith("cancel:"))) return false;
  return true;
}

/** Convert protocol-v1 state into the small parameter bag consumed by the viewer. */
export function normalizeEmbodimentIntentV1(value) {
  if (!isEmbodimentIntentV1(value)) return null;
  const speaking = value.speechPhase === "speaking";
  return {
    stateVersion: value.stateVersion,
    expression: value.expression,
    expressionIntensity: value.expressionIntensity,
    speaking,
    mouthOpen: speaking ? value.mouth.open : 0,
    gazeX: value.gaze.x,
    gazeY: value.gaze.y,
    headTilt: value.body.headTilt,
    headAngleX: value.body.headAngleX ?? value.gaze.x,
    headAngleY: value.body.headAngleY ?? value.gaze.y,
    bodyAngleX: value.body.bodyAngleX ?? 0,
    bodyAngleY: value.body.bodyAngleY ?? 0,
    bodyAngleZ: value.body.bodyAngleZ ?? 0,
    breathIntensity: value.body.breathIntensity ?? value.expressionIntensity,
    gesture: value.body.gesture && value.speechPhase !== "cancelled",
    motionGroup: value.body.motionGroup,
    motionIndex: value.body.motionIndex,
    motionToken: value.body.motionToken,
    voiceEmphasis: speaking ? value.voiceEmphasis : 0,
  };
}
