/**
 * Bounded BM25 repetition scoring adapted from N.E.K.O.'s AntiRepeatCorpus.
 * This module is intentionally stateless: callers supply already-retained,
 * successfully delivered outputs from the canonical social initiative owner.
 */
export interface SocialRepetitionDocument {
  text: string;
  at: number;
}

export interface SocialRepetitionScore {
  total: number;
  perTerm: Record<string, number>;
}

export interface SocialRepetitionOptions {
  backgroundWindow?: number;
  foregroundWindow?: number;
  foregroundTtlMs?: number;
  k1?: number;
  b?: number;
}

const DEFAULT_BACKGROUND_WINDOW = 64;
const DEFAULT_FOREGROUND_WINDOW = 5;
const DEFAULT_FOREGROUND_TTL_MS = 3 * 24 * 60 * 60_000;
const DEFAULT_K1 = 1.2;
const DEFAULT_B = 0.75;
const MAX_TEXT_LENGTH = 2_000;
const MAX_TERMS_PER_DOCUMENT = 64;
const STOPWORDS = new Set((
  'a an the and or but of to in on for from with how what why when where which who can could should would that this these those about into through between becomes become becoming is are was were be been being we i my our your its their it as than then without after before worth possible idea question connection ' +
  'а без более бы быть в во вот все всего где да для до его ее если за здесь из или их к как когда кто ли либо мне на над не него нее нет ни но о об от по под при про раз с со так такой там те то того тогда тоже той только том у уже что чтобы это этот эти я мы они он она вы вас ваш моя мой мои нам наш наша наши само сама сами свой свою свои своего этому этой ещё еще'
).split(/\s+/u));

/** Extracts bounded, unique Unicode terms; one document contributes at most one TF per term. */
export function tokenizeSocialRepetitionText(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const tokens = value.normalize('NFKC').toLocaleLowerCase('en-US').slice(0, MAX_TEXT_LENGTH)
    .match(/[\p{L}\p{N}]{2,48}/gu) ?? [];
  const unique = new Set<string>();
  for (const token of tokens) {
    if (token.length <= 2 || STOPWORDS.has(token)) continue;
    unique.add(token);
    if (unique.size >= MAX_TERMS_PER_DOCUMENT) break;
  }
  return [...unique].sort();
}

/**
 * Scores a candidate against delivered-output history. IDF comes from the
 * longer background window; term frequency comes only from the recent TTL
 * window. Expired/future records cannot keep the organism in a repeat loop.
 */
export function scoreSocialRepetition(
  draft: string,
  documents: readonly SocialRepetitionDocument[],
  now: number,
  options: SocialRepetitionOptions = {},
): SocialRepetitionScore {
  const draftTerms = tokenizeSocialRepetitionText(draft);
  if (!draftTerms.length || !Array.isArray(documents) || !Number.isFinite(now) || now < 0) {
    return { total: 0, perTerm: {} };
  }

  const backgroundWindow = Number.isSafeInteger(options.backgroundWindow)
    ? Math.max(1, Math.min(128, options.backgroundWindow!)) : DEFAULT_BACKGROUND_WINDOW;
  const foregroundWindow = Number.isSafeInteger(options.foregroundWindow)
    ? Math.max(1, Math.min(16, options.foregroundWindow!)) : DEFAULT_FOREGROUND_WINDOW;
  const foregroundTtlMs = Number.isFinite(options.foregroundTtlMs)
    ? Math.max(0, Math.min(30 * 24 * 60 * 60_000, options.foregroundTtlMs!)) : DEFAULT_FOREGROUND_TTL_MS;
  const k1 = Number.isFinite(options.k1) ? Math.max(0.1, Math.min(3, options.k1!)) : DEFAULT_K1;
  const b = Number.isFinite(options.b) ? Math.max(0, Math.min(1, options.b!)) : DEFAULT_B;

  const background = documents
    .filter((item): item is SocialRepetitionDocument => !!item
      && typeof item.text === 'string'
      && Number.isFinite(item.at)
      && item.at >= 0
      && item.at <= now)
    .sort((left, right) => left.at - right.at)
    .slice(-backgroundWindow)
    .map((item) => ({ at: item.at, terms: tokenizeSocialRepetitionText(item.text) }))
    .filter((item) => item.terms.length > 0);
  if (!background.length) return { total: 0, perTerm: {} };

  const foreground = background
    .filter((item) => now - item.at <= foregroundTtlMs)
    .slice(-foregroundWindow);
  if (!foreground.length) return { total: 0, perTerm: {} };

  const documentFrequency = new Map<string, number>();
  for (const document of background) {
    for (const term of document.terms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const averageLength = foreground.reduce((sum, item) => sum + item.terms.length, 0) / foreground.length;
  if (!Number.isFinite(averageLength) || averageLength <= 0) return { total: 0, perTerm: {} };

  const foregroundTerms = foreground.map((document) => new Set(document.terms));
  const foregroundLengths = foreground.map((document) => Math.max(1, document.terms.length));
  const perTerm: Record<string, number> = {};
  let total = 0;

  for (const term of draftTerms) {
    const df = documentFrequency.get(term) ?? 0;
    // Terms absent from history are novelty, not repeat evidence.
    if (df <= 0) continue;
    const idf = Math.log((background.length - df + 0.5) / (df + 0.5) + 1);
    if (!Number.isFinite(idf) || idf <= 0) continue;
    let termScore = 0;
    for (let index = 0; index < foreground.length; index += 1) {
      if (!foregroundTerms[index]!.has(term)) continue;
      const length = foregroundLengths[index]!;
      const normalization = 1 - b + b * length / averageLength;
      termScore += idf * ((k1 + 1) / (1 + k1 * normalization));
    }
    if (termScore > 0 && Number.isFinite(termScore)) {
      perTerm[term] = termScore;
      total += termScore;
    }
  }

  const sorted = Object.fromEntries(Object.entries(perTerm).sort((left, right) =>
    right[1] - left[1] || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0)));
  return { total: Number.isFinite(total) ? total : 0, perTerm: sorted };
}

/** A bounded saturation curve suitable for subtracting from a candidate's rank. */
export function socialRepetitionPenalty01(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.max(0, Math.min(1, score / (score + 8)));
}
