/**
 * Canonical owner for proactive conversational intent. B288 consumes this state as an
 * adapter; this engine does not contact other people or external services.
 */
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export type SocialInitiativeKind = 'check-in' | 'help' | 'collaborate' | 'follow-up' | 'share-thought' | 'start-topic' | 'ask-question' | 'continue-interest';
export type SocialInitiativeStatus = 'planned' | 'ready' | 'executed' | 'deferred';
export type SocialInitiativeTopicSource = 'active-goal' | 'curiosity' | 'reflection' | 'memory';
export type SocialEmotionLabel = 'curiosity' | 'calm' | 'joy' | 'anxiety' | 'frustration' | 'sadness' | 'anger' | 'protective';
export type SocialToneHint = 'curious' | 'playful' | 'direct' | 'reflective' | 'careful' | 'warm' | 'neutral';

export interface SocialInterestContext { domainId: string; label: string; strength01: number; confidence01: number; evidenceCount: number; }

export interface SocialInitiative {
  id: string;
  /** A known contact only. A null value means this is a direct user-facing thought, not a fake network peer. */
  contact: string | null;
  kind: SocialInitiativeKind;
  priority01: number;
  status: SocialInitiativeStatus;
  createdAt: number;
  reason: string;
  topic: string;
  topicSource: SocialInitiativeTopicSource;
  openingIntent: 'share-observation' | 'ask-a-real-question' | 'offer-an-idea' | 'continue-a-thread';
  /** Low-bandwidth affect snapshot from the existing appraisal engine, not a second emotion owner. */
  affect?: { label: SocialEmotionLabel; valence01: number; arousal01: number; confidence01: number };
  /** Conversational influence only; it never overrides safety policy or the stable Kurisu profile. */
  toneHint?: SocialToneHint;
  message?: string;
  stagedAt?: number;
  resolvedAt?: number;
  /** Explicit user feedback is evidence about this conversational thread, not a global emotion label. */
  feedbackAt?: number;
  feedbackSignal?: 'positive' | 'engaged' | 'negative';
  feedbackRelevance01?: number;
  /** Snapshot of the selected topic's canonical P33 interest profile; not a second interest owner. */
  interestContext?: SocialInterestContext;
}


export interface SocialInitiativeState {
  version: 1;
  cycles: number;
  planned: number;
  executed: number;
  deferred: number;
  reciprocity01: number;
  initiative01: number;
  initiatives: SocialInitiative[];
  /** Durable debounce clocks prevent repeated unsolicited messages after restart. */
  startedAt: number;
  lastExternalInputAt: number;
  lastInitiativeAt: number;
}

export interface SocialTopicCandidate { topic: string; source?: SocialInitiativeTopicSource; salience01?: number; freshness01?: number; interestFit01?: number; affectFit01?: number; interestDomain?: string; interestContext?: SocialInterestContext; }
export const defaultAutonomousSocialInitiative = (): SocialInitiativeState => ({
  version: 1, cycles: 0, planned: 0, executed: 0, deferred: 0,
  reciprocity01: .54, initiative01: .34, initiatives: [],
  startedAt: 0, lastExternalInputAt: 0, lastInitiativeAt: 0,
});

const validSource = (value: unknown): SocialInitiativeTopicSource =>
  value === 'active-goal' || value === 'memory' || value === 'reflection' ? value : 'curiosity';
const EMOTIONS: SocialEmotionLabel[] = ['curiosity', 'calm', 'joy', 'anxiety', 'frustration', 'sadness', 'anger', 'protective'];
const TONES: SocialToneHint[] = ['curious', 'playful', 'direct', 'reflective', 'careful', 'warm', 'neutral'];
const validEmotion = (value: unknown): SocialEmotionLabel | null => EMOTIONS.includes(value as SocialEmotionLabel) ? value as SocialEmotionLabel : null;
const validTone = (value: unknown): SocialToneHint | null => TONES.includes(value as SocialToneHint) ? value as SocialToneHint : null;
const validFeedback = (value: unknown): SocialInitiative['feedbackSignal'] => value === 'positive' || value === 'engaged' || value === 'negative' ? value : undefined;
const normalizeTopic = (value: unknown): string => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360);
const TOPIC_STOPWORDS = new Set('a an the and or but of to in on for from with how what why when where which who can could should would that this these those about into through between becomes become becoming is are was were be been being we i my our your its their it as than then without after before worth possible idea question connection а без более бы быть в во вот все всего где да для до его ее если за здесь из или их к как когда кто ли либо мне на над не него нее нет ни но о об от по под при про раз с со так такой там те то того тогда тоже той только том у уже что чтобы это этот эти я мы они он она вы вас ваш моя моей свой своей оно которыми который которая которые которое между через после перед потому при этом однако также ещё еще или же ли потому пусть может могут будет были есть был была было они оно им их мне мой моя мои нам наш наша наши само сама сами собой свой свою свои своего этому этой эти этих такое такие такой какой какие какая какие некоторых некоторый многие много мало всё все именно если иначе например действительно'.split(' '));
const topicTokens = (value: string): Set<string> => new Set(normalizeTopic(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(token => token.length > 2 && !TOPIC_STOPWORDS.has(token)));
const sensitiveEnglishTopicPattern = /\b(?:password|passphrase|secret|credential|api[_ -]?key|private key|access token|diagnos(?:is|ed)|medical record)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/i;
const sensitiveRussianTopicPattern = /парол(?:ь|я|ем|и|ей)|секрет(?:ы|ный|ная|ного|ной)?|уч[её]тн(?:ые данные|ая запись)|ключ доступа|токен доступа|диагноз|медицинск(?:ая карта|ие данные)/iu;
const phoneLikePattern = /(?:^|\D)\+?\d(?:[\d ().-]{7,}\d)(?:$|\D)/;
const isSafeTopic = (topic: string): boolean => !sensitiveEnglishTopicPattern.test(topic) && !sensitiveRussianTopicPattern.test(topic) && !phoneLikePattern.test(topic) && !/\b\d{9,}\b/.test(topic);
/** Shared privacy gate for memory summaries that may reach the language provider. */
export const sanitizeAutonomousTopicText = (value: unknown, maxLength = 280): string | null => {
  const clean = normalizeTopic(value).slice(0, Math.max(12, Math.min(360, Math.floor(maxLength))));
  return clean.length >= 12 && isSafeTopic(clean) ? clean : null;
};
/** Sanitizes an unsolicited outgoing turn before it becomes deliverable to the UI. */
export const sanitizeAutonomousDialogueMessage = (value: unknown, maxLength = 1800): string | null => {
  const limit = Math.max(80, Math.min(1800, Math.floor(maxLength)));
  const clean = String(value ?? '').normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim().slice(0, limit);
  return clean.length > 0 && isSafeTopic(clean) ? clean : null;
};
/** Overlap over the smaller set catches near-duplicate titles even when one adds framing words. */
const topicSimilarity = (a: string, b: string): number => {
  const left = topicTokens(a); const right = topicTokens(b);
  if (!left.size || !right.size) return normalizeTopic(a).toLocaleLowerCase() === normalizeTopic(b).toLocaleLowerCase() ? 1 : 0;
  let overlap = 0; for (const token of left) if (right.has(token)) overlap++;
  return overlap / Math.min(left.size, right.size);
};
const toneFor = (label: SocialEmotionLabel | null, confidence01: number, valence01: number, arousal01: number): SocialToneHint => {
  if (!label || confidence01 < .28) return 'neutral';
  if (label === 'curiosity') return arousal01 < .22 ? 'reflective' : 'curious';
  if (label === 'joy') return arousal01 < .38 ? 'warm' : 'playful';
  if (label === 'frustration' || label === 'anger') return arousal01 >= .58 ? 'direct' : 'reflective';
  if (label === 'anxiety' || label === 'sadness') return valence01 < .38 || arousal01 >= .58 ? 'reflective' : 'careful';
  if (label === 'protective') return 'careful';
  if (label === 'calm' && valence01 >= .64) return 'warm';
  return 'neutral';
};
const validKind = (value: unknown): SocialInitiativeKind => {
  const values: SocialInitiativeKind[] = ['check-in', 'help', 'collaborate', 'follow-up', 'share-thought', 'start-topic', 'ask-question', 'continue-interest'];
  return values.includes(value as SocialInitiativeKind) ? value as SocialInitiativeKind : 'share-thought';
};

export class AutonomousSocialInitiativeEngine {
  private state = defaultAutonomousSocialInitiative();

  restore(raw?: Partial<SocialInitiativeState> | null): void {
    const d = defaultAutonomousSocialInitiative();
    const r = raw ?? {};
    const items = Array.isArray(r.initiatives) ? r.initiatives.slice(0, 64) : [];
    let invalidDeferredCount = 0;
    const initiatives: SocialInitiative[] = items.map((rawItem: any, index: number) => {
      const oldStatus = rawItem?.status;
      let status: SocialInitiativeStatus = oldStatus === 'ready' || oldStatus === 'executed' || oldStatus === 'deferred' ? oldStatus : 'planned';
      const kind = validKind(rawItem?.kind);
      const rawTopic = rawItem?.topic ?? (kind === 'collaborate' ? 'A possible shared idea worth exploring' : 'A thought worth exploring in conversation');
      const safeTopic = sanitizeAutonomousTopicText(rawTopic, 360);
      const safeMessage = typeof rawItem?.message === 'string' ? sanitizeAutonomousDialogueMessage(rawItem.message) : null;
      const unsafeTopic = !safeTopic;
      const unsafeReadyMessage = typeof rawItem?.message === 'string' && !safeMessage && (status === 'ready' || status === 'planned');
      // A restored `ready` row is only valid when it has a deliverable, sanitized message.
      // Otherwise latestReady() cannot deliver it, but hasPending() would block newer work.
      const invalidReadyState = status === 'ready' && !safeMessage;
      if ((unsafeTopic || unsafeReadyMessage || invalidReadyState) && status !== 'executed' && status !== 'deferred') {
        status = 'deferred';
        invalidDeferredCount++;
      }
      const safeReason = sanitizeAutonomousTopicText(rawItem?.reason ?? 'restored autonomous initiative', 240) ?? 'restored autonomous initiative';
      return {
        id: String(rawItem?.id ?? `restored:${index}`).slice(0, 160),
        contact: typeof rawItem?.contact === 'string' && rawItem.contact !== 'ambient-network' ? rawItem.contact.slice(0, 128) : null,
        kind,
        priority01: clamp(Number(rawItem?.priority01 ?? .4)),
        status,
        createdAt: Number.isFinite(Number(rawItem?.createdAt)) ? Number(rawItem.createdAt) : 0,
        reason: unsafeTopic || unsafeReadyMessage ? 'privacy-filtered-restored-initiative' : invalidReadyState ? 'ready-initiative-missing-safe-message' : safeReason,
        topic: safeTopic ?? 'A previously stored topic was withheld after a privacy check',
        topicSource: validSource(rawItem?.topicSource),
        openingIntent: rawItem?.openingIntent === 'ask-a-real-question' || rawItem?.openingIntent === 'offer-an-idea' || rawItem?.openingIntent === 'continue-a-thread' ? rawItem.openingIntent : 'share-observation',
        ...(validTone(rawItem?.toneHint) ? { toneHint: validTone(rawItem?.toneHint)! } : {}),
        ...(rawItem?.affect && validEmotion(rawItem.affect.label) ? { affect: { label: validEmotion(rawItem.affect.label)!, valence01: clamp(Number(rawItem.affect.valence01 ?? .5)), arousal01: clamp(Number(rawItem.affect.arousal01 ?? .3)), confidence01: clamp(Number(rawItem.affect.confidence01 ?? .2)) } } : {}),
        ...(safeMessage ? { message: safeMessage } : {}),
        ...(Number.isFinite(Number(rawItem?.stagedAt)) ? { stagedAt: Number(rawItem.stagedAt) } : {}),
        ...(Number.isFinite(Number(rawItem?.resolvedAt)) ? { resolvedAt: Number(rawItem.resolvedAt) } : {}),
        ...(validFeedback(rawItem?.feedbackSignal) ? { feedbackSignal: validFeedback(rawItem?.feedbackSignal)! } : {}),
        ...(Number.isFinite(Number(rawItem?.feedbackAt)) ? { feedbackAt: Number(rawItem.feedbackAt) } : {}),
        ...(Number.isFinite(Number(rawItem?.feedbackRelevance01)) ? { feedbackRelevance01: clamp(Number(rawItem.feedbackRelevance01)) } : {}),
        ...(rawItem?.interestContext && typeof rawItem.interestContext === 'object' && typeof rawItem.interestContext.domainId === 'string' && typeof rawItem.interestContext.label === 'string' ? {
          interestContext: {
            domainId: rawItem.interestContext.domainId.replace(/[^a-z0-9-]/gi, '').slice(0,64),
            label: sanitizeAutonomousTopicText(rawItem.interestContext.label, 120) ?? 'personal interest',
            strength01: clamp(Number(rawItem.interestContext.strength01 ?? .5)),
            confidence01: clamp(Number(rawItem.interestContext.confidence01 ?? .2)),
            evidenceCount: Math.max(0, Math.min(10000, Math.floor(Number(rawItem.interestContext.evidenceCount ?? 0) || 0))),
          }
        } : {}),
      };
    });
    this.state = {
      ...d,
      ...r,
      version: 1,
      cycles: Math.max(0, Math.floor(Number(r.cycles ?? 0) || 0)),
      planned: Math.max(0, Math.floor(Number(r.planned ?? 0) || 0)),
      executed: Math.max(0, Math.floor(Number(r.executed ?? 0) || 0)),
      deferred: Math.max(0, Math.floor(Number(r.deferred ?? 0) || 0)) + invalidDeferredCount,
      reciprocity01: clamp(Number(r.reciprocity01 ?? d.reciprocity01)),
      initiative01: clamp(Number(r.initiative01 ?? d.initiative01)),
      startedAt: Math.max(0, Number(r.startedAt ?? 0) || 0),
      lastExternalInputAt: Math.max(0, Number(r.lastExternalInputAt ?? 0) || 0),
      lastInitiativeAt: Math.max(0, Number(r.lastInitiativeAt ?? 0) || 0),
      initiatives,
    };
  }

  snapshot(): SocialInitiativeState { return structuredClone(this.state); }

  /**
   * Match one incoming user turn to the latest delivered proactive thought. Silence is
   * never negative evidence; only an explicit stop/negative cue or a topic-linked reply
   * is recorded. Raw inbound text is used transiently and is never persisted here.
   */
  observeExternalResponse(text: string, at = Date.now()): { initiativeId: string; topic: string; signal: 'positive' | 'engaged' | 'negative'; relevance01: number } | null {
    const clean = normalizeTopic(text).slice(0, 360);
    if (clean.length < 2) return null;
    const negative = /\b(?:stop|don't|do not|not interested|boring|drop it|enough)\b|неинтересно|не интересно|не надо(?: об этом)?|прекрати|хватит|не хочу(?: об этом| такой разговор)?|не поднимай(?: эту тему)?/iu.test(clean);
    const positive = /\b(?:interesting|tell me more|go on|good point|i like that|that's useful|great thought)\b|интересно|расскажи подробнее|расскажи ещё|продолжай|хорошая мысль|любопытно|мне нравится эта мысль/iu.test(clean);
    const latest = this.state.initiatives
      .filter(item => item.status === 'executed' && item.resolvedAt != null && !item.feedbackAt && item.resolvedAt <= at && at - item.resolvedAt <= 24 * 60 * 60_000)
      .sort((a, b) => Number(b.resolvedAt ?? 0) - Number(a.resolvedAt ?? 0))[0];
    if (!latest) return null;
    const relevance = Math.max(topicSimilarity(latest.topic, clean), latest.message ? topicSimilarity(latest.message, clean) : 0);
    if (!negative && !positive && relevance < .14) return null;
    const signal = negative ? 'negative' : positive ? 'positive' : 'engaged';
    latest.feedbackAt = at;
    latest.feedbackSignal = signal;
    latest.feedbackRelevance01 = clamp(positive || negative ? Math.max(relevance, .55) : relevance);
    return { initiativeId: latest.id, topic: latest.topic, signal, relevance01: latest.feedbackRelevance01 };
  }

  cycle(input: {
    at: number;
    externalInput: boolean;
    socialNeed01: number;
    relationship01: number;
    energy01: number;
    identity01: number;
    novelty01: number;
    emotionLabel?: SocialEmotionLabel | string;
    emotionValence01?: number;
    emotionArousal01?: number;
    emotionConfidence01?: number;
    knownContact?: string | null;
    topics?: SocialTopicCandidate[];
    quietPeriodMs?: number;
    cooldownMs?: number;
    startupGraceMs?: number;
  }): { shouldInitiate: boolean; initiative: SocialInitiative | null } {
    const at = Math.max(0, Number(input.at) || Date.now());
    this.state.cycles++;
    if (!this.state.startedAt) this.state.startedAt = at;
    if (input.externalInput) this.state.lastExternalInputAt = at;

    // An old unresolved plan cannot permanently block initiative after a provider failure.
    for (const item of this.state.initiatives) {
      if ((item.status === 'planned' || item.status === 'ready') && at - item.createdAt > 20 * 60_000) {
        item.status = 'deferred'; item.resolvedAt = at; this.state.deferred++;
      }
    }
    const hasPending = this.state.initiatives.some(item => item.status === 'planned' || item.status === 'ready');
    const quietPeriodMs = Math.max(0, input.quietPeriodMs ?? 180_000);
    const cooldownMs = Math.max(0, input.cooldownMs ?? 300_000);
    const startupGraceMs = Math.max(0, input.startupGraceMs ?? 45_000);
    const pressure = clamp(input.socialNeed01 * .34 + (1 - input.relationship01) * .12 + input.novelty01 * .28 + input.identity01 * .26);
    const quietSince = Math.max(this.state.startedAt, this.state.lastExternalInputAt);
    const autonomous = !input.externalInput && input.identity01 > .5 && input.energy01 > .28;
    const timingAllows = at - quietSince >= (this.state.lastExternalInputAt ? quietPeriodMs : startupGraceMs)
      && at - this.state.lastInitiativeAt >= cooldownMs;
    const mayInitiate = autonomous && timingAllows && !hasPending && pressure > .48;
    if (!mayInitiate) {
      if (pressure < .25 && !hasPending) this.state.deferred++;
      return { shouldInitiate: false, initiative: null };
    }

    // Topics come from active goals, consolidated learning and reflective curiosity. Do not
    // fall back to a stock sentence when every candidate was already discussed: waiting is
    // better than pretending a repeated topic is a fresh autonomous thought.
    const recentWindowMs = 14 * 24 * 60 * 60_000;
    const recentTopics = this.state.initiatives
      .filter(item => item.createdAt > 0 && at >= item.createdAt && at - item.createdAt <= recentWindowMs)
      .slice(0, 32).map(item => item.topic);
    const candidates: SocialTopicCandidate[] = [];
    for (const raw of (input.topics ?? []).slice(0, 48)) {
      const topic = sanitizeAutonomousTopicText(raw?.topic, 360) ?? '';
      if (topic.length < 18) continue;
      if (recentTopics.some(previous => topicSimilarity(topic, previous) >= .78)) continue;
      if (candidates.some(previous => topicSimilarity(topic, previous.topic) >= .82)) continue;
      const feedback = this.state.initiatives
        .filter(item => item.feedbackSignal && item.feedbackAt && at >= item.feedbackAt && at - item.feedbackAt <= 90 * 24 * 60 * 60_000)
        .map(item => ({ item, similarity: topicSimilarity(topic, item.topic) }))
        .filter(row => row.similarity >= .62)
        .sort((a,b)=>b.similarity-a.similarity)[0];
      // An explicit negative response suppresses only the specific thread, never an entire
      // discipline or personality interest. A positive response gently rewards continuity.
      if (feedback?.item.feedbackSignal === 'negative' && at - Number(feedback.item.feedbackAt) <= 30 * 24 * 60 * 60_000) continue;
      candidates.push({
        topic,
        source: validSource(raw?.source),
        salience01: clamp(Number(raw?.salience01 ?? .5)),
        freshness01: clamp(Number(raw?.freshness01 ?? .5)),
        interestFit01: clamp(Number(raw?.interestFit01 ?? .5)),
        affectFit01: clamp(Number(raw?.affectFit01 ?? .5)),
        ...(typeof raw?.interestDomain === 'string' ? { interestDomain: raw.interestDomain.slice(0,64) } : {}),
        ...(raw?.interestContext && typeof raw.interestContext.domainId === 'string' && typeof raw.interestContext.label === 'string' ? { interestContext: {
          domainId: raw.interestContext.domainId.replace(/[^a-z0-9-]/gi, '').slice(0,64),
          label: sanitizeAutonomousTopicText(raw.interestContext.label, 120) ?? 'personal interest',
          strength01: clamp(Number(raw.interestContext.strength01 ?? .5)),
          confidence01: clamp(Number(raw.interestContext.confidence01 ?? .2)),
          evidenceCount: Math.max(0, Math.min(10000, Math.floor(Number(raw.interestContext.evidenceCount ?? 0) || 0))),
        } } : {}),
      });
    }
    if (!candidates.length) return { shouldInitiate: false, initiative: null };

    const sourceWeight: Record<SocialInitiativeTopicSource, number> = { 'active-goal': .10, memory: .075, reflection: .06, curiosity: .045 };
    const ranked = candidates.map(candidate => {
      const feedback = this.state.initiatives
        .filter(item => item.feedbackSignal && item.feedbackAt && at >= item.feedbackAt && at - item.feedbackAt <= 90 * 24 * 60 * 60_000)
        .map(item => ({ item, similarity: topicSimilarity(candidate.topic, item.topic) }))
        .filter(row => row.similarity >= .3)
        .sort((a,b)=>b.similarity-a.similarity)[0];
      const responseBias = !feedback ? 0 : feedback.item.feedbackSignal === 'positive'
        ? .11 * feedback.similarity * clamp(Number(feedback.item.feedbackRelevance01 ?? .5))
        : feedback.item.feedbackSignal === 'engaged' ? .045 * feedback.similarity : -.12 * feedback.similarity;
      return {
        candidate,
        score: clamp(Number(candidate.salience01 ?? .5)) * .45
          + clamp(Number(candidate.freshness01 ?? .5)) * .14
          + clamp(Number(candidate.interestFit01 ?? .5)) * .19
          + clamp(Number(candidate.affectFit01 ?? .5)) * .14
          + sourceWeight[validSource(candidate.source)] + responseBias,
      };
    }).sort((a, b) => b.score - a.score || a.candidate.topic.localeCompare(b.candidate.topic));
    const topScore = ranked[0]!.score;
    const nearTop = ranked.filter(item => item.score >= topScore - .16);
    // Novelty selects among strong candidates, while ranking remains deterministic for replay.
    const selected = nearTop[Math.floor(clamp(input.novelty01) * Math.max(0, nearTop.length - 1))]!.candidate;
    const topic = selected.topic;
    const source = validSource(selected.source);
    const emotionLabel = validEmotion(input.emotionLabel);
    const emotionConfidence01 = clamp(Number(input.emotionConfidence01 ?? 0));
    const emotionValence01 = clamp(Number(input.emotionValence01 ?? .5));
    const emotionArousal01 = clamp(Number(input.emotionArousal01 ?? .3));
    const toneHint = toneFor(emotionLabel, emotionConfidence01, emotionValence01, emotionArousal01);
    const kind: SocialInitiativeKind = emotionLabel === 'curiosity' || input.socialNeed01 > .66 && input.novelty01 <= .68
      ? 'ask-question'
      : emotionLabel === 'joy' || input.novelty01 > .68
        ? 'share-thought'
        : 'start-topic';
    const openingIntent: SocialInitiative['openingIntent'] = kind === 'ask-question'
      ? 'ask-a-real-question'
      : kind === 'share-thought'
        ? 'offer-an-idea'
        : source === 'active-goal' || source === 'memory' ? 'continue-a-thread' : 'share-observation';
    const initiative: SocialInitiative = {
      id: `soc:${at}:${this.state.cycles}:${kind}`,
      contact: input.knownContact ?? null,
      kind,
      priority01: pressure,
      status: 'planned',
      createdAt: at,
      reason: `endogenous-conversation:${source}:${kind}:affect-${emotionLabel ?? 'unspecified'}`,
      topic,
      topicSource: source,
      openingIntent,
      toneHint,
      ...(emotionLabel ? { affect: { label: emotionLabel, valence01: emotionValence01, arousal01: emotionArousal01, confidence01: emotionConfidence01 } } : {}),
      ...(selected.interestContext ? { interestContext: structuredClone(selected.interestContext) } : {}),
    };
    this.state.initiatives = [initiative, ...this.state.initiatives].slice(0, 64);
    this.state.planned++;
    this.state.lastInitiativeAt = at;
    this.state.initiative01 = clamp(this.state.initiative01 * .9 + pressure * .1);
    return { shouldInitiate: true, initiative: structuredClone(initiative) };
  }

  latestPlanned(now = Date.now()): SocialInitiative | null {
    const item = this.state.initiatives.find(i => i.status === 'planned' && now - i.createdAt <= 20 * 60_000);
    return item ? structuredClone(item) : null;
  }

  stageMessage(id: string, message: string, at = Date.now()): boolean {
    const item = this.state.initiatives.find(i => i.id === id);
    if (!item || item.status !== 'planned') return false;
    const clean = sanitizeAutonomousDialogueMessage(message);
    if (!clean) {
      // A rejected generation must not remain as a hot pending item and spin on every cycle.
      item.status = 'deferred';
      item.resolvedAt = at;
      this.state.deferred++;
      return false;
    }
    item.message = clean;
    item.stagedAt = at;
    item.status = 'ready';
    return true;
  }

  latestReady(): SocialInitiative | null {
    const item = this.state.initiatives.find(i => i.status === 'ready' && Boolean(i.message?.trim()));
    return item ? structuredClone(item) : null;
  }

  acknowledge(id: string, at = Date.now()): boolean {
    const item = this.state.initiatives.find(i => i.id === id);
    if (!item || item.status !== 'ready') return false;
    item.status = 'executed';
    item.resolvedAt = at;
    this.state.executed++;
    // Delivery proves only that the UI received a message. It is not evidence of
    // reciprocity or a positive social outcome, so relationship learning stays unchanged.
    return true;
  }

  defer(id: string, at = Date.now()): boolean {
    const item = this.state.initiatives.find(i => i.id === id);
    if (!item || item.status === 'executed' || item.status === 'deferred') return false;
    item.status = 'deferred'; item.resolvedAt = at; this.state.deferred++;
    return true;
  }

  /** Compatibility surface for older callers; replaying a completed item is idempotent. */
  record(id: string, ok: boolean, at: number): void { if (ok) this.acknowledge(id, at); else this.defer(id, at); }

  summary() {
    return {
      cycles: this.state.cycles, planned: this.state.planned, executed: this.state.executed,
      deferred: this.state.deferred, reciprocity01: this.state.reciprocity01,
      initiative01: this.state.initiative01,
      active: this.state.initiatives.filter(i => i.status === 'planned' || i.status === 'ready').length,
      ready: this.state.initiatives.filter(i => i.status === 'ready').length,
      positiveFeedback: this.state.initiatives.filter(i => i.feedbackSignal === 'positive').length,
      engagedFeedback: this.state.initiatives.filter(i => i.feedbackSignal === 'engaged').length,
      negativeFeedback: this.state.initiatives.filter(i => i.feedbackSignal === 'negative').length,
      lastInitiativeAt: this.state.lastInitiativeAt,
    };
  }
}
