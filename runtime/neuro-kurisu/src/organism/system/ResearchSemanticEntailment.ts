import { createHash } from 'node:crypto';
import type { ClaimEvidenceAssessment, ClaimEvidenceCandidate, ClaimEvidenceQuote, ClaimTextVerdict, ResearchCalibrationProvenance } from './ResearchClaimAssessment.ts';
import { atomizeResearchClaim } from './ResearchClaimAssessment.ts';

export interface ResearchNliScores {
  entailment: number;
  contradiction: number;
  neutral: number;
}

export interface ResearchNliResult {
  modelId: string;
  /** Exact immutable model revision returned by the serving backend when available. */
  modelRevision?: string;
  /** True only when the service includes a validated, version-bound calibration artifact. */
  calibrated?: boolean;
  calibration?: ResearchCalibrationProvenance;
  scores: ResearchNliScores;
}

export interface ResearchNliPair { premise: string; hypothesis: string }

export interface ResearchNliBackend {
  readonly modelId: string;
  evaluate(premise: string, hypothesis: string): Promise<ResearchNliResult | null>;
  /** Optional batch path; implementations must return one positional result per pair. */
  evaluateBatch?(pairs: ResearchNliPair[]): Promise<Array<ResearchNliResult | null>>;
}

export interface ResearchNliConfig {
  endpoint: string;
  bearerToken?: string;
  timeoutMs?: number;
  minClassScore?: number;
  minMargin?: number;
}

const MAX_PREMISE_CHARS = 1800;
const MAX_HYPOTHESIS_CHARS = 600;
const MAX_RESPONSE_BYTES = 16 * 1024;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const clean = (value: unknown, max: number) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

export function validateResearchNliEndpoint(raw: string): URL {
  const url = new URL(String(raw ?? ''));
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    throw new Error('NLI endpoint must use HTTPS; plain HTTP is allowed only for loopback');
  }
  if (url.username || url.password || url.hash || url.search) throw new Error('NLI endpoint cannot include userinfo, query, or fragment');
  if (url.pathname === '/') url.pathname = '/v1/nli';
  return url;
}

export class HttpResearchNliBackend implements ResearchNliBackend {
  readonly modelId: string;
  private readonly endpoint: URL;
  private readonly token: string;
  private readonly timeoutMs: number;
  readonly minClassScore: number;
  readonly minMargin: number;

  constructor(config: ResearchNliConfig) {
    this.endpoint = validateResearchNliEndpoint(config.endpoint);
    this.token = String(config.bearerToken ?? '').trim().slice(0, 4096);
    this.timeoutMs = Math.max(250, Math.min(15_000, Math.floor(Number(config.timeoutMs) || 4500)));
    this.minClassScore = Math.max(.5, Math.min(.99, Number(config.minClassScore ?? .78)));
    this.minMargin = Math.max(.05, Math.min(.6, Number(config.minMargin ?? .18)));
    this.modelId = 'remote-nli-unresolved';
  }

  private async postDetailed(path: URL, payload: unknown): Promise<{ status: number; data: any | null } | null> {
    try {
      const response = await fetch(path, {
        method: 'POST', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'content-type': 'application/json', 'accept': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const status = response.status;
      if (!response.ok) return { status, data: null };
      const declaredBytes = Number(response.headers.get('content-length') ?? 0);
      if (declaredBytes > MAX_RESPONSE_BYTES) return { status, data: null };
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) return { status, data: null };
      try { return { status, data: JSON.parse(text) }; } catch { return { status, data: null }; }
    } catch {
      // Do not log source text or backend payloads; callers turn failures into unknown.
      return null;
    }
  }

  private async post(path: URL, payload: unknown): Promise<any | null> {
    const response = await this.postDetailed(path, payload);
    return response?.status !== undefined && response.status >= 200 && response.status < 300
      ? response.data : null;
  }

  private parseResult(raw: any): ResearchNliResult | null {
    const labels = raw?.scores ?? raw?.probabilities;
    if (!labels || typeof labels !== 'object') return null;
    const rawScores = [Number(labels.entailment), Number(labels.contradiction), Number(labels.neutral)];
    if (!rawScores.every(Number.isFinite) || rawScores.some(n => n < 0 || n > 1)) return null;
    const scores = { entailment: rawScores[0]!, contradiction: rawScores[1]!, neutral: rawScores[2]! };
    const sum = scores.entailment + scores.contradiction + scores.neutral;
    if (sum < .75 || sum > 1.25) return null;
    const modelId = clean(raw?.modelId ?? raw?.model_id ?? '', 160);
    const modelRevision = clean(raw?.modelRevision ?? raw?.model_revision ?? '', 200);
    // An actual HTTP inference response must identify both model and immutable
    // revision; otherwise its scores cannot be reproduced or safely compared.
    if (!modelId || !modelRevision) return null;
    let calibration: ResearchCalibrationProvenance | undefined;
    if (raw?.calibrated === true) {
      const candidate = raw?.calibration;
      const datasetSha256 = clean(candidate?.datasetSha256 ?? '', 64).toLowerCase();
      const sampleCount = Number(candidate?.sampleCount);
      const temperature = Number(candidate?.temperature);
      if (candidate?.method !== 'temperature-scaling-from-softmax-v1'
        || !/^[a-f0-9]{64}$/.test(datasetSha256)
        || !Number.isInteger(sampleCount) || sampleCount < 90
        || !Number.isFinite(temperature) || temperature < .05 || temperature > 20) return null;
      calibration = { method: 'temperature-scaling-from-softmax-v1', datasetSha256, sampleCount, temperature };
    } else if ((raw?.calibrated !== undefined && raw?.calibrated !== false) || (raw?.calibration !== undefined && raw?.calibration !== null)) {
      return null;
    }
    return {
      modelId,
      modelRevision,
      calibrated: Boolean(calibration),
      ...(calibration ? { calibration } : {}),
      scores: { entailment: scores.entailment / sum, contradiction: scores.contradiction / sum, neutral: scores.neutral / sum },
    };
  }

  async evaluate(premiseInput: string, hypothesisInput: string): Promise<ResearchNliResult | null> {
    const premise = clean(premiseInput, MAX_PREMISE_CHARS);
    const hypothesis = clean(hypothesisInput, MAX_HYPOTHESIS_CHARS);
    if (premise.length < 8 || hypothesis.length < 8) return null;
    const raw = await this.post(this.endpoint, { premise, hypothesis });
    return this.parseResult(raw);
  }

  async evaluateBatch(pairsInput: ResearchNliPair[]): Promise<Array<ResearchNliResult | null>> {
    const pairs = Array.isArray(pairsInput) ? pairsInput.slice(0, 24).map(pair => ({
      premise: clean(pair?.premise, MAX_PREMISE_CHARS), hypothesis: clean(pair?.hypothesis, MAX_HYPOTHESIS_CHARS),
    })) : [];
    if (pairs.length === 0) return [];
    if (pairs.some(pair => pair.premise.length < 8 || pair.hypothesis.length < 8)) return pairs.map(() => null);
    const url = new URL(this.endpoint.href);
    url.pathname = `${url.pathname.replace(/\/+$/u, '')}/batch`;
    const response = await this.postDetailed(url, { pairs });
    // Compatibility with an older local NLI server that implements only /v1/nli.
    // Fall back to bounded single requests only when the batch route is explicitly
    // absent; outages, overload (503), malformed responses, and timeouts fail closed.
    if (response?.status === 404 || response?.status === 405) {
      const results: Array<ResearchNliResult | null> = [];
      for (const pair of pairs) results.push(await this.evaluate(pair.premise, pair.hypothesis));
      return results;
    }
    const raw = response?.status !== undefined && response.status >= 200 && response.status < 300 ? response.data : null;
    if (!Array.isArray(raw?.results) || raw.results.length !== pairs.length) return pairs.map(() => null);
    return raw.results.map((result: unknown) => this.parseResult(result));
  }
}

export function createConfiguredResearchNliBackend(env: Record<string, string | undefined> = process.env): HttpResearchNliBackend | null {
  const endpoint = String(env.KURISU_RESEARCH_NLI_ENDPOINT ?? '').trim();
  if (!endpoint) return null;
  try {
    return new HttpResearchNliBackend({
      endpoint,
      bearerToken: env.KURISU_RESEARCH_NLI_TOKEN,
      timeoutMs: Number(env.KURISU_RESEARCH_NLI_TIMEOUT_MS ?? 4500),
      minClassScore: Number(env.KURISU_RESEARCH_NLI_MIN_SCORE ?? .78),
      minMargin: Number(env.KURISU_RESEARCH_NLI_MIN_MARGIN ?? .18),
    });
  } catch {
    return null;
  }
}

function classify(scores: ResearchNliScores, minScore: number, minMargin: number): 'support' | 'refute' | 'unknown' {
  const contenders = [
    { verdict: 'support' as const, score: scores.entailment, other: Math.max(scores.contradiction, scores.neutral) },
    { verdict: 'refute' as const, score: scores.contradiction, other: Math.max(scores.entailment, scores.neutral) },
    { verdict: 'unknown' as const, score: scores.neutral, other: Math.max(scores.entailment, scores.contradiction) },
  ].sort((a, b) => b.score - a.score);
  const best = contenders[0]!;
  if (best.verdict === 'unknown' || best.score < minScore || best.score - best.other < minMargin) return 'unknown';
  return best.verdict;
}

function evidenceSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const input = clean(text, MAX_PREMISE_CHARS);
  const rows: Array<{ text: string; start: number; end: number }> = [];
  for (const match of input.matchAll(/[^.!?\n]+(?:[.!?]+|\n+|$)/gu)) {
    const raw = match[0] ?? '';
    const leading = raw.search(/\S/);
    if (leading < 0) continue;
    const sentence = raw.trim();
    if (sentence.split(/\s+/).length < 3) continue;
    const start = (match.index ?? 0) + leading;
    rows.push({ text: sentence, start, end: start + sentence.length });
    if (rows.length >= 10) break;
  }
  return rows;
}

function stableDigest(value: string): string {
  return createHash('sha256').update(value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 32);
}

export async function assessClaimWithSemanticEntailment(
  claimInput: string | undefined,
  candidate: ClaimEvidenceCandidate,
  backend: ResearchNliBackend,
  thresholds: { minClassScore?: number; minMargin?: number } = {},
): Promise<ClaimEvidenceAssessment> {
  const claim = clean(claimInput, MAX_HYPOTHESIS_CHARS);
  const atoms = atomizeResearchClaim(claim);
  const sentences = evidenceSentences(candidate.snippet);
  const quoteBase = {
    url: clean(candidate.url, 1000), title: clean(candidate.title, 240), documentKey: clean(candidate.documentKey, 1000),
    contentHash: clean(candidate.contentHash, 96), sourceKey: clean(candidate.sourceKey || 'unknown', 120),
    sourceLineageKey: clean(candidate.sourceLineageKey ?? '', 80) || undefined, fetchedAt: Math.max(0, Number(candidate.fetchedAt) || 0),
  };
  const minScore = Math.max(.5, Math.min(.99, Number(thresholds.minClassScore ?? (backend instanceof HttpResearchNliBackend ? backend.minClassScore : .78))));
  const minMargin = Math.max(.05, Math.min(.6, Number(thresholds.minMargin ?? (backend instanceof HttpResearchNliBackend ? backend.minMargin : .18))));
  const atomResults: Array<{ claimId: string; claim: string; verdict: ClaimTextVerdict; scores?: ResearchNliScores; modelId?: string; modelRevision?: string; calibrated?: boolean; calibration?: ResearchCalibrationProvenance; reason: string }> = [];
  let successfulModelCalls = 0;
  const observedModelIdentities = new Set<string>();
  const quotes: ClaimEvidenceQuote[] = [];
  const work = atoms.map(atom => {
    // Each atom is checked against individual bounded sentences so long pages do not
    // silently truncate actual evidence. Cap fan-out at three ranked sentences per atom.
    const claimTokens = new Set(atom.claim.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const ranked = sentences.map(sentence => {
      const tokens = sentence.text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      let overlap = 0;
      for (const token of tokens) if (claimTokens.has(token)) overlap++;
      return { ...sentence, overlap };
    }).sort((a, b) => b.overlap - a.overlap || a.start - b.start).filter(row => row.overlap > 0).slice(0, 3);
    return { atom, premises: ranked.length ? ranked : sentences.slice(0, 1) };
  });
  const pairs = work.flatMap(row => row.premises.map(premise => ({ premise: premise.text, hypothesis: row.atom.claim })));
  let batchResults: Array<ResearchNliResult | null> | null = null;
  if (typeof backend.evaluateBatch === 'function' && pairs.length > 0) {
    try {
      const received = await backend.evaluateBatch(pairs);
      if (Array.isArray(received) && received.length === pairs.length) batchResults = received;
    } catch { batchResults = null; }
  }
  let pairIndex = 0;
  for (const row of work) {
    const { atom, premises } = row;
    let support: { text: string; start: number; end: number; score: number; scores: ResearchNliScores; modelId: string; modelRevision?: string; calibrated?: boolean; calibration?: ResearchCalibrationProvenance } | null = null;
    let refute: { text: string; start: number; end: number; score: number; scores: ResearchNliScores; modelId: string; modelRevision?: string; calibrated?: boolean; calibration?: ResearchCalibrationProvenance } | null = null;
    let unknownScores: ResearchNliScores | undefined;
    let rowCalibration: ResearchCalibrationProvenance | undefined;
    let modelId = backend.modelId;
    let modelRevision: string | undefined = undefined;
    for (const premise of premises) {
      let result: ResearchNliResult | null = null;
      try {
        if (batchResults) result = batchResults[pairIndex] ?? null;
        else result = await backend.evaluate(premise.text, atom.claim);
      } catch { result = null; }
      pairIndex++;
      if (!result) continue;
      successfulModelCalls++;
      modelId = clean(result.modelId || modelId, 160);
      modelRevision = clean(result.modelRevision ?? '', 200) || undefined;
      rowCalibration = result.calibration;
      const calibrationIdentity = result.calibration ? `${result.calibration.method}:${result.calibration.datasetSha256}:${result.calibration.temperature}` : 'uncalibrated';
      observedModelIdentities.add(`${modelId}\u0000${modelRevision ?? 'unversioned'}\u0000${calibrationIdentity}`);
      const verdict = classify(result.scores, minScore, minMargin);
      if (verdict === 'support' && (!support || result.scores.entailment > support.score)) support = { ...premise, score: result.scores.entailment, scores: result.scores, modelId, modelRevision, calibrated: result.calibrated, calibration: result.calibration };
      if (verdict === 'refute' && (!refute || result.scores.contradiction > refute.score)) refute = { ...premise, score: result.scores.contradiction, scores: result.scores, modelId, modelRevision, calibrated: result.calibrated, calibration: result.calibration };
      unknownScores = result.scores;
    }
    const verdict: ClaimTextVerdict = support && refute ? 'mixed' : support ? 'support' : refute ? 'refute' : 'unknown';
    if (support) quotes.push({ verdict: 'support', quote: support.text.slice(0, 400), start: support.start, end: support.end, ...quoteBase, semantic: { modelId: support.modelId, ...(support.modelRevision ? { modelRevision: support.modelRevision } : {}), entailmentScore: support.scores.entailment, contradictionScore: support.scores.contradiction, neutralScore: support.scores.neutral, threshold: minScore, calibrated: Boolean(support.calibration), ...(support.calibration ? { calibration: { ...support.calibration } } : {}) } });
    if (refute) quotes.push({ verdict: 'refute', quote: refute.text.slice(0, 400), start: refute.start, end: refute.end, ...quoteBase, semantic: { modelId: refute.modelId, ...(refute.modelRevision ? { modelRevision: refute.modelRevision } : {}), entailmentScore: refute.scores.entailment, contradictionScore: refute.scores.contradiction, neutralScore: refute.scores.neutral, threshold: minScore, calibrated: Boolean(refute.calibration), ...(refute.calibration ? { calibration: { ...refute.calibration } } : {}) } });
    const selected = support?.scores ?? refute?.scores ?? unknownScores;
    const selectedRevision = support?.modelRevision ?? refute?.modelRevision ?? modelRevision;
    if (verdict === 'unknown' && !selected) atomResults.push({ claimId: `atom:${stableDigest(atom.claim)}`, claim: atom.claim, verdict, modelId, ...(selectedRevision ? { modelRevision: selectedRevision } : {}), calibrated: false, reason: 'nli-unavailable-or-no-usable-evidence' });
    else atomResults.push({ claimId: `atom:${stableDigest(atom.claim)}`, claim: atom.claim, verdict, ...(selected ? { scores: selected } : {}), modelId, ...(selectedRevision ? { modelRevision: selectedRevision } : {}), calibrated: Boolean(rowCalibration), ...(rowCalibration ? { calibration: { ...rowCalibration } } : {}), reason: verdict === 'unknown' ? 'below-conservative-nli-threshold' : 'cross-encoder-nli-only-not-world-truth' });
  }
  if (observedModelIdentities.size > 1) {
    // Do not combine support/refutation scores from a rolling deployment or a backend
    // that changed weights mid-assessment. Return unknown with no reusable quotes.
    return {
      version: 1, claimId: `claim:${stableDigest(claim)}`, claim, verdict: 'unknown',
      method: 'nli-cross-encoder-v1', scope: 'model-assisted-entailment', calibratedProbability: null,
      modelId: clean(backend.modelId || 'configured-nli-model', 160),
      atomAssessments: atomResults.slice(0, 8).map(row => ({ ...row, verdict: 'unknown' as const, scores: undefined, reason: 'nli-model-identity-changed-during-assessment-fail-closed' })),
      reason: 'nli-model-identity-changed-during-assessment-fail-closed', quotes: [],
    };
  }
  if (!successfulModelCalls) {
    // Once an NLI backend has been explicitly configured, a complete outage must fail
    // closed. Falling back to text anchors here would let source diversity bypass the
    // semantic credit gate. Lexical assessment is used only when no NLI backend was
    // configured at all (the caller handles that baseline case).
    return {
      version: 1,
      claimId: `claim:${stableDigest(claim)}`,
      claim,
      verdict: 'unknown',
      method: 'nli-cross-encoder-v1',
      scope: 'model-assisted-entailment',
      calibratedProbability: null,
      modelId: clean(backend.modelId || 'configured-nli-unavailable', 160),
      atomAssessments: atomResults.slice(0, 8).map(row => ({ ...row, verdict: 'unknown' as const, scores: undefined, reason: 'nli-backend-unavailable-fail-closed-no-lexical-promotion' })),
      reason: 'nli-backend-unavailable-fail-closed-no-lexical-promotion',
      quotes: [],
    };
  }
  const hasSupport = atomResults.some(row => row.verdict === 'support');
  const hasRefute = atomResults.some(row => row.verdict === 'refute');
  const hasUnknown = atomResults.some(row => row.verdict === 'unknown');
  let verdict: ClaimTextVerdict = hasSupport && hasRefute ? 'mixed' : hasRefute && !hasSupport && !hasUnknown ? 'refute' : hasSupport && !hasRefute && !hasUnknown ? 'support' : 'unknown';
  if (atomResults.some(row => row.verdict === 'mixed')) verdict = 'mixed';
  return {
    version: 1,
    claimId: `claim:${stableDigest(claim)}`,
    claim,
    verdict,
    method: 'nli-cross-encoder-v1',
    scope: 'model-assisted-entailment',
    calibratedProbability: null,
    modelId: clean(atomResults.find(row => row.modelId)?.modelId ?? backend.modelId, 160),
    ...(atomResults.find(row => row.modelRevision)?.modelRevision ? { modelRevision: clean(atomResults.find(row => row.modelRevision)?.modelRevision, 200) } : {}),
    ...(atomResults.find(row => row.calibration)?.calibration ? { calibration: { ...atomResults.find(row => row.calibration)!.calibration! } } : {}),
    atomAssessments: atomResults.slice(0, 8),
    reason: verdict === 'unknown' ? 'nli-did-not-clear-conservative-score-and-margin-thresholds; claim-probability-is-not-calibrated' : `nli-cross-encoder-assessment${atomResults.some(row => row.calibrated) ? '-temperature-scaled' : '-uncalibrated'}; not-proof-of-world-truth; independent-source-and-provenance-gates-still-apply`,
    quotes: quotes.slice(0, 12),
  };
}
