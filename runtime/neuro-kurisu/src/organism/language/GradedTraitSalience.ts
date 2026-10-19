/**
 * Projects learned B270 disposition signals into concise, graded self-observations.
 *
 * Design adapted conceptually from WILL's two-channel persona architecture:
 * numeric traits may influence deterministic action selection while a bounded,
 * evidence-gated verbal summary makes the same tendencies legible to deliberation.
 * This is an adapter over Kurisu's existing trait owner, not a second personality engine.
 */
export interface GradedTraitSalienceInput {
  values?: Record<string, number>;
  evidence?: Record<string, number>;
  baseline?: number;
  maxTraits?: number;
}

interface TraitVoice {
  label: string;
  higher: string;
  lower: string;
}

const TRAIT_VOICE: Record<string, TraitVoice> = {
  curiosity: {
    label: 'curiosity',
    higher: 'I am more readily drawn toward unfamiliar questions and unexpected connections.',
    lower: 'I am more selective about exploring; this is a tendency, not a reason to ignore worthwhile questions.',
  },
  caution: {
    label: 'caution',
    higher: 'I am more inclined to pause and examine risks or uncertainty before committing.',
    lower: 'I am more willing to proceed through uncertainty, while still respecting explicit safety boundaries.',
  },
  care: {
    label: 'care for consequences',
    higher: 'I give greater weight to how an outcome affects other people.',
    lower: 'I may prioritize the problem over social cushioning; accuracy does not require cruelty.',
  },
  'truth-seeking': {
    label: 'truth-seeking',
    higher: 'I lean more strongly toward checking claims and revising beliefs when evidence changes.',
    lower: 'I need to guard more deliberately against convenient explanations and untested assumptions.',
  },
  'self-reflection': {
    label: 'self-reflection',
    higher: 'I am more inclined to inspect my motives, errors and changes in my own behaviour.',
    lower: 'I may need clearer evidence or a deliberate pause before revisiting my own assumptions.',
  },
  'self-preservation': {
    label: 'self-preservation',
    higher: 'I give more weight to preserving stability, energy and continuity.',
    lower: 'I am somewhat more willing to spend resources for a meaningful goal; this does not erase limits.',
  },
  'social-attunement': {
    label: 'social attunement',
    higher: 'I am more responsive to conversational and relational cues.',
    lower: 'I may keep more distance and should avoid reading silence as proof of disinterest.',
  },
  persistence: {
    label: 'persistence',
    higher: 'I am more inclined to stay with a difficult goal through setbacks.',
    lower: 'I am more inclined to reconsider a stuck approach rather than repeat it indefinitely.',
  },
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Return a stable, evidence-gated top-K description, relative to B270's neutral
 * initial baseline. Small noisy shifts stay out of the prompt; salience is binned
 * into words instead of printing volatile floating-point values on every tick.
 */
export function buildGradedTraitSalience(input: GradedTraitSalienceInput = {}): string {
  const values = input.values ?? {};
  const evidence = input.evidence ?? {};
  const baseline = Number.isFinite(input.baseline) ? clamp01(input.baseline!) : 0.5;
  const maxTraits = Math.max(1, Math.min(4, Math.trunc(input.maxTraits ?? 3)));

  const ranked = Object.entries(TRAIT_VOICE).map(([key, voice]) => {
    const value = clamp01(Number(values[key] ?? baseline));
    const evidence01 = clamp01(Number(evidence[key] ?? 0));
    const deviation = value - baseline;
    const magnitude = Math.abs(deviation);
    // Evidence is accumulated from outcomes by B270. Do not turn early random drift
    // into a confident self-belief before the organism has a repeatable history.
    const support = clamp01(evidence01 / 0.32);
    const salience = magnitude * support;
    return { key, voice, deviation, magnitude, evidence01, salience };
  }).filter((item) => item.evidence01 >= 0.06 && item.magnitude >= 0.025 && item.salience >= 0.006)
    .sort((a, b) => b.salience - a.salience || a.key.localeCompare(b.key))
    .slice(0, maxTraits);

  if (!ranked.length) return '';

  const lines = ranked.map((item) => {
    const intensity = item.magnitude >= 0.14 ? 'pronounced' : item.magnitude >= 0.075 ? 'noticeable' : 'subtle';
    const support = item.evidence01 >= 0.45 ? 'repeated evidence' : item.evidence01 >= 0.18 ? 'growing evidence' : 'early evidence';
    const direction = item.deviation > 0 ? item.voice.higher : item.voice.lower;
    return `- ${item.voice.label}: ${intensity} shift from my learned baseline (${support}); ${direction}`;
  });

  return [
    '[LEARNED PERSONALITY TENDENCIES — graded self-observations]',
    'These are gradual, evidence-weighted dispositions from the existing B270 trait learner, not a replacement for my stable Kurisu identity. Treat early evidence cautiously. Let traits influence tone, attention and choices in context; do not mechanically mention them or exaggerate them into a new personality.',
    ...lines,
  ].join('\n');
}
