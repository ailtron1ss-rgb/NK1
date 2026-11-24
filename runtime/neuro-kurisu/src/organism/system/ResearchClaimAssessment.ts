import { createHash } from 'node:crypto';

/**
 * Conservative claim-to-source anchoring for external research.
 *
 * This is deliberately NOT an NLI model and does not determine whether a claim is
 * true in the world. It can only detect direct text support / direct polarity
 * conflicts in the captured excerpt. Paraphrases, entailment, sarcasm, tables,
 * quotations-with-unclear-speaker and claims requiring multi-hop reasoning remain
 * `unknown` until a calibrated semantic backend is connected.
 */
export type ClaimTextVerdict = 'support' | 'refute' | 'mixed' | 'unknown';
export type ClaimAssessmentMethod = 'exact-text-anchor-v1' | 'nli-cross-encoder-v1' | 'hybrid-text-nli-v1';

export interface ResearchCalibrationProvenance {
  method: 'temperature-scaling-from-softmax-v1';
  datasetSha256: string;
  sampleCount: number;
  temperature: number;
}

export interface ClaimEvidenceQuote {
  verdict: 'support' | 'refute';
  quote: string;
  /** Character offsets in the stored, cleaned snippet (not offsets in the original HTML). */
  start: number;
  end: number;
  url: string;
  title: string;
  documentKey: string;
  contentHash: string;
  sourceKey: string;
  /** Cluster identity for canonical documents / exact copies / detected syndication. */
  sourceLineageKey?: string;
  fetchedAt: number;
  /** Raw cross-encoder scores are diagnostic, never calibrated probabilities. */
  semantic?: { modelId: string; modelRevision?: string; entailmentScore: number; contradictionScore: number; neutralScore: number; threshold: number; calibrated?: boolean; calibration?: ResearchCalibrationProvenance };
}

export interface ClaimEvidenceAssessment {
  version: 1;
  claimId: string;
  claim: string;
  verdict: ClaimTextVerdict;
  method: ClaimAssessmentMethod;
  scope: 'textual-anchor-only' | 'model-assisted-entailment';
  calibratedProbability: null;
  reason: string;
  quotes: ClaimEvidenceQuote[];
  /** Present only when a real, explicitly configured NLI backend evaluated claim atoms. */
  modelId?: string;
  /** Immutable serving revision; absent only for legacy or non-versioned injected test adapters. */
  modelRevision?: string;
  /** Optional calibrated-score provenance, bound to the same pinned model revision. */
  calibration?: ResearchCalibrationProvenance;
  atomAssessments?: Array<{ claimId: string; claim: string; verdict: ClaimTextVerdict; modelId?: string; modelRevision?: string; calibrated?: boolean; calibration?: ResearchCalibrationProvenance; reason: string; scores?: { entailment: number; contradiction: number; neutral: number } }>
}

export interface ClaimEvidenceCandidate {
  url: string;
  title: string;
  documentKey: string;
  contentHash: string;
  sourceKey: string;
  sourceLineageKey?: string;
  snippet: string;
  fetchedAt: number;
  claim?: string;
}

export interface ClaimVerificationSummary {
  version: 1;
  claimId: string | null;
  claim: string | null;
  verdict: ClaimTextVerdict;
  method: ClaimAssessmentMethod;
  scope: 'textual-anchor-only' | 'model-assisted-entailment';
  calibratedProbability: null;
  independentSupportSources: number;
  independentRefuteSources: number;
  /** Independent lineages whose quote has an actual model score, not only a text anchor. */
  semanticSupportSources: number;
  semanticRefuteSources: number;
  /** Unique model artifact identities that produced evidence for this aggregate. */
  modelVersions?: Array<{ modelId: string; modelRevision: string | null; calibrationDatasetSha256?: string; calibrationTemperature?: number }>;
  evidence: ClaimEvidenceQuote[];
  reason: string;
}

const MAX_CLAIM_CHARS = 600;
const MAX_QUOTES = 12;
const NEGATION = new Set(['not', 'no', 'never', 'without', 'cannot', "can't", "isn't", "aren't", "wasn't", "weren't", "doesn't", "don't", "didn't", 'не', 'нет', 'ни', 'никогда', 'без', 'нельзя', 'невозможно']);
const QUESTION_OR_INSTRUCTION = /^(?:who|what|when|where|why|how|which|find|search|research|investigate|compare|explain|check|verify|расскажи|найди|исследуй|изучи|сравни|объясни|проверь|кто|что|когда|где|почему|зачем|как|какой|какая|какие)(?=$|[\s,:;])/i;

function canonicalClaimText(text: string): string {
  return String(text ?? '').normalize('NFKC').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}
function normalizeTokens(text: string): string[] {
  return canonicalClaimText(text)
    .replace(/[’‘`]/g, "'")
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}
function isNegated(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    if (!NEGATION.has(tokens[i]!)) continue;
    // Avoid treating the common scalar phrase "not only" as negation.
    if (tokens[i] === 'not' && (tokens[i + 1] === 'only' || tokens[i + 1] === 'just')) continue;
    return true;
  }
  return false;
}
function withoutNegation(tokens: string[]): string[] {
  return tokens.filter((token, index) => {
    if (!NEGATION.has(token)) return true;
    if (token === 'not' && (tokens[index + 1] === 'only' || tokens[index + 1] === 'just')) return true;
    return false;
  });
}
function containsSequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
function stableClaimId(claim: string): string {
  // Use a cryptographic digest so claim identity does not collapse at 32-bit collision rates.
  const canonical = canonicalClaimText(claim);
  return `claim:${createHash('sha256').update(canonical).digest('hex').slice(0, 32)}`;
}
function sequenceIndex(haystack: string[], needle: string[]): number {
  if (!needle.length || needle.length > haystack.length) return -1;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
function isAmbiguousQuotedOrCaveatedAnchor(sentence: string, tokens: string[], claimStart: number, claimLength: number): boolean {
  // Attribution/quotation and uncertainty are intentionally not promoted as support.
  if (/["“”‘’«»]/u.test(sentence)) return true;
  const before = tokens.slice(Math.max(0, claimStart - 6), claimStart);
  const after = tokens.slice(claimStart + claimLength, claimStart + claimLength + 8);
  const uncertainty = new Set(['not','no','never','cannot','whether','unclear','uncertain','unknown','unproven','without','allegedly','purportedly','не','нет','неизвестно','неясно','сомнительно','неподтверждено','без']);
  const denial = new Set(['false','untrue','refutes','refuted','denies','deny','contradicts','contradicted','ошибочно','ложно','опровергает','опровергнуто']);
  const discourse = new Set(['but','however','although','though','yet','nevertheless','except','unless','но','однако','хотя','зато','впрочем']);
  if (before.some(t => uncertainty.has(t)) || before.some(t => discourse.has(t)) || after.some(t => discourse.has(t))) return true;
  if (before.some(t => denial.has(t))) return false; // explicit denial is evidence against the claim
  if (before.length >= 2 && before.at(-2) === 'not' && before.at(-1) === 'true') return false;
  return false;
}
function sentencesWithOffsets(text: string): Array<{ text: string; start: number; end: number }> {
  const input = String(text ?? '').slice(0, 1200);
  const output: Array<{ text: string; start: number; end: number }> = [];
  const regex = /[^.!?\n]+(?:[.!?]+|\n+|$)/gu;
  for (const match of input.matchAll(regex)) {
    const raw = match[0] ?? '';
    const leading = raw.search(/\S/);
    if (leading < 0) continue;
    const sentence = raw.trim();
    const start = (match.index ?? 0) + leading;
    if (normalizeTokens(sentence).length >= 3) output.push({ text: sentence, start, end: start + sentence.length });
    if (output.length >= 32) break;
  }
  return output;
}
function claimLooksAssertive(claim: string): boolean {
  const value = claim.trim();
  if (!value || value.length > MAX_CLAIM_CHARS || value.endsWith('?') || QUESTION_OR_INSTRUCTION.test(value)) return false;
  const tokens = normalizeTokens(value);
  return tokens.length >= 4 && tokens.length <= 80;
}

/**
 * Conservative claim atomizer. It splits explicit sentence/semicolon boundaries and a
 * small set of clause connectives only when both sides look like complete clauses.
 * It deliberately does not split adjective lists, alternatives, or short fragments.
 */
export function atomizeResearchClaim(claimInput: string | undefined): Array<{ claim: string; ordinal: number }> {
  const input = String(claimInput ?? '').normalize('NFKC').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CLAIM_CHARS);
  if (!input) return [];
  const rawParts = input.split(/(?:;|(?<=[.!?])\s+|\s+(?:but|whereas|although|while|however|но|однако|хотя|в то время как)\s+)/iu);
  const parts: string[] = [];
  for (const raw of rawParts) {
    const part = raw.trim().replace(/^[,;:.\s]+|[,;:.\s]+$/g, '');
    if (!part) continue;
    const tokens = normalizeTokens(part);
    // Keep very short clauses intact in the parent claim instead of fabricating an atom.
    if (tokens.length < 4) return [{ claim: input, ordinal: 0 }];
    parts.push(part);
  }
  // Split an additive conjunction only when its right side begins a new explicit subject;
  // phrases such as "fast and reliable" remain one atomic assertion.
  const expanded: string[] = [];
  for (const part of parts) {
    const match = part.match(/^(.+?)\s+and\s+((?:(?:the|a|an|this|that|these|those|it|they|we|our|their|company|system|project|model|study|report|organization|the company|the system|the project|система|проект|модель|исследование|отчёт|отчет|организация|он|она|они|этот|эта|эти|данная|данный|компания)\b|[A-Z][\p{L}\p{N}_-]{2,})\s+.+)$/iu);
    if (match && normalizeTokens(match[1]).length >= 4 && normalizeTokens(match[2]).length >= 4) expanded.push(match[1].trim(), match[2].trim());
    else expanded.push(part);
  }
  const normalized = [...new Set(expanded.map(p => p.replace(/\s+/g, ' ').trim()))].slice(0, 6);
  return (normalized.length ? normalized : [input]).map((claim, ordinal) => ({ claim, ordinal }));
}

export function assessClaimAgainstExcerpt(claimInput: string | undefined, candidate: ClaimEvidenceCandidate): ClaimEvidenceAssessment {
  const claim = String(claimInput ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CLAIM_CHARS);
  const claimId = claim ? stableClaimId(claim) : 'claim:unknown';
  if (!claimLooksAssertive(claim)) {
    return { version: 1, claimId, claim, verdict: 'unknown', method: 'exact-text-anchor-v1', scope: 'textual-anchor-only', calibratedProbability: null, reason: 'no-explicit-assertive-claim-or-query-is-not-an-atomic-assertion', quotes: [] };
  }
  const claimTokens = normalizeTokens(claim);
  const claimBase = withoutNegation(claimTokens);
  const claimNegated = isNegated(claimTokens);
  const quotes: ClaimEvidenceQuote[] = [];
  for (const sentence of sentencesWithOffsets(candidate.snippet)) {
    const evidenceTokens = normalizeTokens(sentence.text);
    const evidenceBase = withoutNegation(evidenceTokens);
    const evidenceNegated = isNegated(evidenceTokens);
    let verdict: 'support' | 'refute' | null = null;
    const claimStart = sequenceIndex(evidenceTokens, claimTokens);
    if (claimStart >= 0) {
      const ambiguous = isAmbiguousQuotedOrCaveatedAnchor(sentence.text, evidenceTokens, claimStart, claimTokens.length);
      const leadingTokens = evidenceTokens.slice(Math.max(0, claimStart - 6), claimStart);
      const explicitDenial = leadingTokens.some(t => ['false','untrue','refutes','refuted','denies','deny','contradicts','contradicted','ошибочно','ложно','опровергает','опровергнуто'].includes(t)) || (leadingTokens.length >= 2 && leadingTokens.at(-2) === 'not' && leadingTokens.at(-1) === 'true');
      if (explicitDenial) verdict = 'refute';
      else if (!ambiguous) verdict = 'support';
    } else if (claimBase.length >= 4 && claimBase.join(' ') === evidenceBase.join(' ') && claimNegated !== evidenceNegated) verdict = 'refute';
    else if (claimBase.length >= 4 && containsSequence(evidenceBase, claimBase) && claimNegated !== evidenceNegated) verdict = 'refute';
    if (!verdict) continue;
    quotes.push({ verdict, quote: sentence.text.slice(0, 400), start: sentence.start, end: sentence.end, url: String(candidate.url ?? '').slice(0, 1000), title: String(candidate.title ?? '').slice(0, 240), documentKey: String(candidate.documentKey ?? '').slice(0, 1000), contentHash: String(candidate.contentHash ?? '').slice(0, 96), sourceKey: String(candidate.sourceKey ?? 'unknown').slice(0, 120), sourceLineageKey: String(candidate.sourceLineageKey ?? '').slice(0, 80) || undefined, fetchedAt: Math.max(0, Number(candidate.fetchedAt) || 0) });
  }
  const hasSupport = quotes.some(q => q.verdict === 'support');
  const hasRefute = quotes.some(q => q.verdict === 'refute');
  const verdict: ClaimTextVerdict = hasSupport && hasRefute ? 'mixed' : hasSupport ? 'support' : hasRefute ? 'refute' : 'unknown';
  return { version: 1, claimId, claim, verdict, method: 'exact-text-anchor-v1', scope: 'textual-anchor-only', calibratedProbability: null, reason: verdict === 'unknown' ? 'no-direct-textual-anchor-found; paraphrase-and-entailment-not-inferred' : 'direct-text-anchor-found; does-not-establish-world-truth', quotes: quotes.slice(0, MAX_QUOTES) };
}

export function aggregateClaimEvidence(claimInput: string | undefined, candidates: ClaimEvidenceCandidate[], overrides?: Array<ClaimEvidenceAssessment | undefined>): ClaimVerificationSummary {
  const claim = String(claimInput ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CLAIM_CHARS);
  const canonicalClaim = canonicalClaimText(claim);
  const exemplar = candidates.find(row => row.claim && canonicalClaimText(row.claim) === canonicalClaim) ?? candidates[0];
  const perSource = candidates.map((row, index) => {
    const override = overrides?.[index];
    if (override && canonicalClaimText(override.claim) === canonicalClaim && override.claimId === stableClaimId(claim)) return override;
    return claimLooksAssertive(claim) && canonicalClaimText(String(row.claim ?? '')) === canonicalClaim ? assessClaimAgainstExcerpt(claim, row) : { version: 1 as const, claimId: stableClaimId(claim), claim, verdict: 'unknown' as const, method: 'exact-text-anchor-v1' as const, scope: 'textual-anchor-only' as const, calibratedProbability: null, reason: 'claim-does-not-match-session-claim', quotes: [] };
  });
  const allQuotes: ClaimEvidenceQuote[] = [];
  for (const assessment of perSource) allQuotes.push(...assessment.quotes);
  // Count independent evidence lineages, not merely different hostnames. A copied
  // syndicated article can appear under several publisher domains but remains one
  // underlying evidence family. Connected components over publisher↔lineage edges
  // conservatively collapse any publisher families linked by the same story lineage.
  const independentLineageFamilies = (verdict: 'support' | 'refute'): number => {
    const graph = new Map<string, Set<string>>();
    for (const quote of allQuotes) {
      if (quote.verdict !== verdict) continue;
      const source = `source:${String(quote.sourceKey || 'unknown').toLowerCase()}`;
      const lineage = `lineage:${String(quote.sourceLineageKey || (quote.documentKey ? `doc:${quote.documentKey}` : quote.contentHash ? `hash:${quote.contentHash}` : `url:${quote.url}`)).slice(0, 1100)}`;
      const sourceEdges = graph.get(source) ?? new Set<string>(); sourceEdges.add(lineage); graph.set(source, sourceEdges);
      const lineageEdges = graph.get(lineage) ?? new Set<string>(); lineageEdges.add(source); graph.set(lineage, lineageEdges);
    }
    let components = 0;
    const visited = new Set<string>();
    for (const node of graph.keys()) {
      if (visited.has(node)) continue;
      components++;
      const queue = [node]; visited.add(node);
      while (queue.length) {
        const current = queue.pop()!;
        for (const adjacent of graph.get(current) ?? []) if (!visited.has(adjacent)) { visited.add(adjacent); queue.push(adjacent); }
      }
    }
    return components;
  };
  const independentSupportSources = independentLineageFamilies('support');
  const independentRefuteSources = independentLineageFamilies('refute');
  const independentSemanticFamilies = (verdict: 'support' | 'refute'): number => {
    const rows = allQuotes.filter(quote => quote.verdict === verdict && quote.semantic);
    const graph = new Map<string, Set<string>>();
    for (const quote of rows) {
      const source = `source:${String(quote.sourceKey || 'unknown').toLowerCase()}`;
      const lineage = `lineage:${String(quote.sourceLineageKey || (quote.documentKey ? `doc:${quote.documentKey}` : quote.contentHash ? `hash:${quote.contentHash}` : `url:${quote.url}`)).slice(0, 1100)}`;
      const sourceEdges = graph.get(source) ?? new Set<string>(); sourceEdges.add(lineage); graph.set(source, sourceEdges);
      const lineageEdges = graph.get(lineage) ?? new Set<string>(); lineageEdges.add(source); graph.set(lineage, lineageEdges);
    }
    let count = 0; const visited = new Set<string>();
    for (const node of graph.keys()) {
      if (visited.has(node)) continue; count++; const queue = [node]; visited.add(node);
      while (queue.length) for (const next of graph.get(queue.pop()!) ?? []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    return count;
  };
  const semanticSupportSources = independentSemanticFamilies('support');
  const semanticRefuteSources = independentSemanticFamilies('refute');
  let verdict: ClaimTextVerdict = 'unknown';
  let reason = 'insufficient-independent-direct-text-evidence';
  // Independent publisher identity is only a minimum corroboration screen. Syndication
  // and copied press releases still require lineage detection before factual promotion.
  if (independentSupportSources > 0 && independentRefuteSources > 0) {
    verdict = 'mixed'; reason = 'supporting-and-refuting-text-anchors-coexist';
  } else if (independentSupportSources >= 2) {
    verdict = 'support'; reason = 'two-or-more-publisher-families-have-direct-text-anchors; textual-support-only';
  } else if (independentRefuteSources >= 2) {
    verdict = 'refute'; reason = 'two-or-more-publisher-families-have-direct-polarity-conflicts; textual-refutation-only';
  }
  const uniqueQuotes = new Map<string, ClaimEvidenceQuote>();
  for (const quote of allQuotes) uniqueQuotes.set(`${quote.verdict}|${quote.sourceKey}|${quote.sourceLineageKey ?? ''}|${quote.documentKey}|${quote.start}|${quote.contentHash}`, quote);
  return {
    version: 1,
    claimId: claimLooksAssertive(claim) ? stableClaimId(claim) : exemplar?.claim ? stableClaimId(exemplar.claim) : null,
    claim: claim || null,
    verdict,
    method: perSource.some(row => row.method === 'nli-cross-encoder-v1') && perSource.some(row => row.method === 'exact-text-anchor-v1') ? 'hybrid-text-nli-v1' : perSource.some(row => row.method === 'nli-cross-encoder-v1') ? 'nli-cross-encoder-v1' : 'exact-text-anchor-v1',
    scope: perSource.some(row => row.method === 'nli-cross-encoder-v1') ? 'model-assisted-entailment' : 'textual-anchor-only',
    calibratedProbability: null,
    independentSupportSources,
    independentRefuteSources,
    semanticSupportSources,
    semanticRefuteSources,
    modelVersions: [...new Map(allQuotes.filter(quote => quote.semantic).map(quote => {
      const modelId = String(quote.semantic?.modelId ?? '').trim();
      const modelRevision = String(quote.semantic?.modelRevision ?? '').trim() || null;
      const calibrationDatasetSha256 = quote.semantic?.calibration?.datasetSha256;
      const calibrationTemperature = quote.semantic?.calibration?.temperature;
      const key = `${modelId}\u0000${modelRevision ?? 'unversioned'}\u0000${calibrationDatasetSha256 ?? 'uncalibrated'}\u0000${calibrationTemperature ?? 1}`;
      return [key, { modelId, modelRevision, ...(calibrationDatasetSha256 ? { calibrationDatasetSha256 } : {}), ...(typeof calibrationTemperature === 'number' ? { calibrationTemperature } : {}) }] as const;
    }).filter(([, identity]) => Boolean(identity.modelId))).values()].sort((a, b) => a.modelId.localeCompare(b.modelId) || String(a.modelRevision ?? '').localeCompare(String(b.modelRevision ?? ''))),
    evidence: [...uniqueQuotes.values()].slice(0, MAX_QUOTES),
    reason: claimLooksAssertive(claim) ? reason : 'no-explicit-assertive-claim-provided',
  };
}
