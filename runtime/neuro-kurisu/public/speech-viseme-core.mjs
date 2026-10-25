// @ts-nocheck -- this browser-safe core is validated by both app and runtime regression suites.
/**
 * Single source of truth for Unicode grapheme segmentation and text-timed
 * Live2D viseme poses. Clock providers (Web Speech vs Termux TTS) remain
 * separate, but both shells sample the exact same timeline and mouth shapes.
 */
const clamp = (n, low, high) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));

export const CLOSED_MOUTH = Object.freeze({ open: 0.015, form: 0, viseme: "rest" });

export function poseForGrapheme(grapheme) {
  const char = String(grapheme ?? "").toLocaleLowerCase().normalize("NFKC");
  if (!char || /^\s$/u.test(char)) return { open: 0.045, form: 0, viseme: "neutral" };
  if (/^[.,!?;:…—–-]$/u.test(char)) return { ...CLOSED_MOUTH };
  if (/[мбп]/u.test(char) || /[bmp]/u.test(char)) return { open: 0.025, form: -0.05, viseme: "closed" };
  if (/[фв]/u.test(char) || /[fv]/u.test(char)) return { open: 0.14, form: 0.18, viseme: "teeth" };
  if (/[оуёю]/u.test(char) || /[ouw]/u.test(char)) return { open: 0.34, form: -0.46, viseme: "round" };
  if (/[аяaæɑɒ]/iu.test(char)) return { open: 0.60, form: 0.10, viseme: "open" };
  if (/[иыиеэ]/u.test(char) || /[eiy]/iu.test(char)) return { open: 0.25, form: 0.32, viseme: "wide" };
  if (/^[\p{L}\p{M}\p{N}]$/u.test(char)) return { open: 0.16, form: 0.02, viseme: "neutral" };
  return { ...CLOSED_MOUTH };
}

function graphemeDurationWeight(char) {
  if (/^\s$/u.test(char)) return 0.55;
  if (/^[.,!?;:…—–-]$/u.test(char)) return char === "," || char === ";" || char === ":" ? 1.8 : 2.4;
  if (/[оуёю]/iu.test(char) || /[ouw]/iu.test(char)) return 1.55;
  if (/[аеёиоуыэюяaeiouy]/iu.test(char)) return 1.35;
  if (/[мбпbmpфвfv]/iu.test(char)) return 0.72;
  if (/^[\p{L}\p{M}\p{N}]$/u.test(char)) return 0.86;
  return 0.6;
}

function segmentGraphemes(source, language) {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(language, { granularity: "grapheme" }).segment(source),
      ({ segment, index }) => ({ segment, index }));
  }
  const result = [];
  let utf16Index = 0;
  let regionalIndicatorsInCluster = 0;
  for (const codePoint of source) {
    const isMark = /^\p{M}$/u.test(codePoint);
    const isVariation = /^[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u.test(codePoint);
    const isEmojiModifier = /^[\u{1F3FB}-\u{1F3FF}]$/u.test(codePoint);
    const isRegionalIndicator = /^[\u{1F1E6}-\u{1F1FF}]$/u.test(codePoint);
    const previous = result[result.length - 1];
    const previousEndsInJoiner = previous?.segment.endsWith("\u200D") ?? false;
    const joinsRegionalPair = isRegionalIndicator && regionalIndicatorsInCluster === 1;
    if (previous && (isMark || isVariation || isEmojiModifier || codePoint === "\u200D" || previousEndsInJoiner || joinsRegionalPair)) {
      previous.segment += codePoint;
    } else {
      result.push({ segment: codePoint, index: utf16Index });
      regionalIndicatorsInCluster = 0;
    }
    if (isRegionalIndicator) regionalIndicatorsInCluster = joinsRegionalPair ? 0 : 1;
    else if (codePoint !== "\u200D" && !isMark && !isVariation && !isEmojiModifier) regionalIndicatorsInCluster = 0;
    utf16Index += codePoint.length;
  }
  return result;
}

export function buildVisemeTimeline(text, rate = 0.96, language = "ru-RU") {
  const source = String(text ?? "").replace(/[\r\n\t]/gu, " ");
  if (!source.length) return [];
  const graphemes = segmentGraphemes(source, language);
  const validRate = clamp(rate, 0.5, 2);
  const charsPerSecond = String(language).toLowerCase().startsWith("ru") ? 12.2 : 14.0;
  const targetDurationMs = Math.max(180, (graphemes.length / (charsPerSecond * validRate)) * 1000);
  const rawWeights = graphemes.map(({ segment }) => graphemeDurationWeight(segment));
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const msPerWeight = targetDurationMs / Math.max(1, totalWeight);
  let atMs = 0;
  return graphemes.map(({ segment, index }, frameIndex) => {
    const startMs = atMs;
    const endMs = startMs + rawWeights[frameIndex] * msPerWeight;
    atMs = endMs;
    return {
      charIndex: index,
      endCharIndex: index + segment.length,
      startMs,
      endMs,
      pose: poseForGrapheme(segment),
    };
  });
}

export function timelineOffsetForCharIndex(timeline, charIndex) {
  if (!timeline.length || !Number.isFinite(charIndex) || charIndex <= 0) return 0;
  const target = Math.floor(charIndex);
  const last = timeline[timeline.length - 1];
  if (target >= last.endCharIndex) return last.endMs;
  let low = 0, high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const frame = timeline[mid];
    if (target < frame.charIndex) high = mid - 1;
    else if (target >= frame.endCharIndex) low = mid + 1;
    else return frame.startMs;
  }
  return timeline[0].startMs;
}

export function sampleVisemeTimeline(timeline, timeMs) {
  if (!Array.isArray(timeline) || !timeline.length || !Number.isFinite(timeMs) || timeMs < 0) return { ...CLOSED_MOUTH };
  let low = 0, high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const frame = timeline[mid];
    if (timeMs < frame.startMs) high = mid - 1;
    else if (timeMs >= frame.endMs) low = mid + 1;
    else return { ...frame.pose };
  }
  return { ...CLOSED_MOUTH };
}
