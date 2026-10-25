import { CLOSED_MOUTH, buildVisemeTimeline, sampleVisemeTimeline } from './speech-viseme-core.mjs';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clamp = (value, low, high, fallback = 0) =>
  Math.max(low, Math.min(high, typeof value === 'number' && Number.isFinite(value) ? value : fallback));

const ACTIONS = new Set(['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']);
const EXPRESSIONS = {
  calm: 'neutral',
  curiosity: 'thinking',
  joy: 'happy',
  anxiety: 'thinking',
  frustration: 'angry',
  sadness: 'sad',
  anger: 'angry',
  protective: 'focused',
};
const ACTION_EXPRESSIONS = {
  respond: 'tender',
  explore: 'thinking',
  verify: 'focused',
  rest: 'tired',
  reflect: 'thinking',
  wait: 'neutral',
  defer: 'thinking',
};
const GAZE = {
  explore: [0.24, 0.04],
  verify: [0.14, -0.10],
  reflect: [-0.19, -0.14],
  respond: [0.01, 0.01],
  wait: [-0.035, -0.005],
  rest: [-0.06, 0.075],
  defer: [-0.06, 0.02],
};
const HEAD_TILT = {
  calm: 0,
  curiosity: -0.045,
  joy: 0.018,
  anxiety: -0.018,
  frustration: 0.035,
  sadness: 0.055,
  anger: 0.025,
  protective: -0.01,
};

/**
 * Convert the real /api/organism/ui-snapshot payload into the legacy viewer's
 * small, explicit message contract. Only bounded plain values cross the iframe.
 */
export function buildAvatarPresentation(snapshot) {
  if (!isRecord(snapshot) || snapshot.ok !== true || !isRecord(snapshot.state) || !isRecord(snapshot.emotion)) {
    return null;
  }

  const state = snapshot.state;
  const emotion = snapshot.emotion;
  const voice = isRecord(snapshot.voice) ? snapshot.voice : {};
  const rawAction = state.lastAction;
  const action = ACTIONS.has(rawAction) ? rawAction : 'wait';
  const emotionLabel = Object.prototype.hasOwnProperty.call(EXPRESSIONS, emotion.label) ? emotion.label : 'calm';
  const speaking = typeof voice.speaking === 'boolean' ? voice.speaking : false;
  const valence = clamp(emotion.valence, 0, 1, 0.5);
  const arousal = clamp(emotion.arousal, 0, 1, 0.2);
  const [baseGazeX, baseGazeY] = GAZE[action];
  const gazeX = clamp(baseGazeX + (valence - 0.5) * 0.16, -0.4, 0.4);
  const gesture = speaking || ['respond', 'explore', 'verify', 'reflect'].includes(action);
  const motionGroup = speaking || action === 'respond'
    ? 'Special'
    : action === 'explore'
      ? 'TapBody'
      : action === 'verify' || action === 'reflect'
        ? 'TapHead'
        : 'Idle';

  return {
    tick: Number.isSafeInteger(snapshot.tick) && snapshot.tick >= 0 ? snapshot.tick : 0,
    awake: typeof snapshot.awake === 'boolean' ? snapshot.awake : true,
    action,
    emotion: emotionLabel,
    expression: EXPRESSIONS[emotionLabel] ?? ACTION_EXPRESSIONS[action],
    // The mouth is driven by the time-indexed speech timeline, not a constant speaking amplitude.
    lipsync: 0,
    body: {
      gazeX,
      gazeY: clamp(baseGazeY, -0.4, 0.4),
      gazeDriven: true,
      headTilt: HEAD_TILT[emotionLabel],
      expressionIntensity: arousal,
      speaking,
      gesture,
      motionGroup,
      motionIndex: 0,
      voiceEmphasis: speaking ? arousal : 0,
    },
  };
}


const CLOSED_POSE = Object.freeze({ open: CLOSED_MOUTH.open, form: CLOSED_MOUTH.form, viseme: CLOSED_MOUTH.viseme });

/**
 * Runtime/Termux speech uses the exact same grapheme segmentation, pose map and
 * timeline math as the React/Web-Speech avatar. Its start clock is provider-
 * anchored; it simply has no provider character-boundary events to re-anchor.
 */
export function buildAvatarSpeechTimeline(text, rate = 1, language = 'ru-RU') {
  if (typeof text !== 'string') return [];
  // The canonical timeline replaces control whitespace before calculating UTF-16 offsets.
  // Normalize here too so grapheme labels use the exact same source string as the frames.
  const normalized = text.slice(0, 2000).replace(/[\\r\\n\\t]/gu, ' ');
  if (!normalized.trim()) return [];
  return buildVisemeTimeline(normalized, rate, language).map(frame => ({
    ...frame,
    pose: { ...frame.pose },
    grapheme: normalized.slice(frame.charIndex, frame.endCharIndex),
  }));
}

export function sampleAvatarSpeechTimeline(timeline, elapsedMs) {
  if (!Array.isArray(timeline) || timeline.length === 0 || typeof elapsedMs !== 'number'
      || !Number.isFinite(elapsedMs) || elapsedMs < 0) return { ...CLOSED_POSE };
  return sampleVisemeTimeline(timeline, elapsedMs);
}
