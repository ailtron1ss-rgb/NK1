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


const CLOSED_POSE = Object.freeze({ open: 0.015, form: 0, viseme: 'rest' });

function segmentSpeech(text, language) {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(text), part => part.segment);
  }
  // Fallback at least preserves Unicode code points when grapheme segmentation is unavailable.
  return Array.from(text);
}

function poseForSpeechGrapheme(grapheme) {
  const char = String(grapheme ?? '').toLocaleLowerCase().normalize('NFKC');
  if (!char || /^\s$/u.test(char)) return { open: 0.045, form: 0, viseme: 'neutral' };
  if (/^[.,!?;:…—–-]$/u.test(char)) return { ...CLOSED_POSE };
  if (/[мбп]/u.test(char) || /[bmp]/u.test(char)) return { open: 0.025, form: -0.05, viseme: 'closed' };
  if (/[фв]/u.test(char) || /[fv]/u.test(char)) return { open: 0.14, form: 0.18, viseme: 'teeth' };
  if (/[оуёю]/u.test(char) || /[ouw]/u.test(char)) return { open: 0.34, form: -0.46, viseme: 'round' };
  if (/[аяaæɑɒ]/iu.test(char)) return { open: 0.60, form: 0.10, viseme: 'open' };
  if (/[иыиеэ]/u.test(char) || /[eiy]/iu.test(char)) return { open: 0.25, form: 0.32, viseme: 'wide' };
  if (/^[\p{L}\p{M}\p{N}]$/u.test(char)) return { open: 0.16, form: 0.02, viseme: 'neutral' };
  return { ...CLOSED_POSE };
}

function speechWeight(grapheme) {
  if (/^\s$/u.test(grapheme)) return 0.55;
  if (/^[.,!?;:…—–-]$/u.test(grapheme)) return grapheme === ',' || grapheme === ';' || grapheme === ':' ? 1.8 : 2.4;
  if (/[оуёю]/iu.test(grapheme) || /[ouw]/iu.test(grapheme)) return 1.55;
  if (/[аеёиоуыэюяaeiouy]/iu.test(grapheme)) return 1.35;
  if (/[мбпbmpфвfv]/iu.test(grapheme)) return 0.72;
  if (/^[\p{L}\p{M}\p{N}]$/u.test(grapheme)) return 0.86;
  return 0.6;
}

/**
 * Estimate grapheme viseme windows for the active utterance. Web/Termux TTS
 * does not supply phoneme/audio-buffer timestamps, so these are timing estimates,
 * re-anchored to the real runtime speech-start timestamp.
 */
export function buildAvatarSpeechTimeline(text, rate = 1, language = 'ru-RU') {
  if (typeof text !== 'string') return [];
  const normalized = text.slice(0, 2000).replace(/[\r\n\t]+/gu, ' ').trim();
  if (!normalized) return [];
  const graphemes = segmentSpeech(normalized, language);
  const safeRate = clamp(rate, 0.5, 2, 1);
  const cps = language.toLowerCase().startsWith('ru') ? 12.2 : 14;
  const duration = Math.max(180, (graphemes.length / (cps * safeRate)) * 1000);
  const weights = graphemes.map(speechWeight);
  const totalWeight = Math.max(1, weights.reduce((sum, value) => sum + value, 0));
  const millisPerWeight = duration / totalWeight;
  let at = 0;
  return graphemes.map((grapheme, index) => {
    const startMs = at;
    const endMs = startMs + weights[index] * millisPerWeight;
    at = endMs;
    return { startMs, endMs, pose: poseForSpeechGrapheme(grapheme), grapheme };
  });
}

export function sampleAvatarSpeechTimeline(timeline, elapsedMs) {
  if (!Array.isArray(timeline) || timeline.length === 0 || typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0) return { ...CLOSED_POSE };
  let low = 0, high = timeline.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const frame = timeline[middle];
    if (elapsedMs < frame.startMs) high = middle - 1;
    else if (elapsedMs >= frame.endMs) low = middle + 1;
    else return { ...frame.pose };
  }
  return { ...CLOSED_POSE };
}
