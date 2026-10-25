/**
 * WorkPass319 — bounded, evidence-aware internal dialogue.
 *
 * This is a structured review pass, not a transcript of hidden chain-of-thought and
 * not a second action selector. It compares supplied claims, examines only explicitly
 * linked evidence, records knowledge gaps, calibrates ranking confidence, and returns
 * a compact advisory that the canonical organism core may accept or reject.
 */

export type InternalDialogueAction = 'respond' | 'explore' | 'verify' | 'rest' | 'reflect' | 'wait' | 'defer';
export type InternalDialogueEvidenceKind = 'observation' | 'outcome' | 'memory' | 'prediction' | 'goal' | 'user' | 'tool';
export type InternalDialogueRole = 'frame' | 'hypothesis' | 'critic' | 'evidence-audit' | 'metacognition' | 'synthesis';
export type InternalDialogueStatus = 'reviewed' | 'provisional' | 'needs-evidence';
export type InternalDialogueNextStep = 'accept-provisionally' | 'seek-evidence' | 'explore' | 'pause';

export interface InternalDialogueEvidence {
  id: string;
  kind: InternalDialogueEvidenceKind;
  confidence01: number;
  /** Optional identity shared by evidence derived from the same source. */
  sourceGroup?: string;
}

export interface InternalDialogueClaim {
  id: string;
  action?: InternalDialogueAction;
  priorConfidence01?: number;
  actionability01?: number;
  risk01?: number;
  supportingEvidenceIds?: string[];
  contradictingEvidenceIds?: string[];
}

export interface InternalDialogueInput {
  tick: number;
  focus: string;
  goal?: string;
  claims: InternalDialogueClaim[];
  evidence: InternalDialogueEvidence[];
  knownUnknowns?: string[];
  cognitiveLoad01?: number;
  maxTurns?: number;
}

export interface InternalDialogueTurn {
  role: InternalDialogueRole;
  note: string;
  evidenceIds: string[];
}

export interface InternalDialogueCandidateScore {
  id: string;
  action: InternalDialogueAction | null;
  score01: number;
  evidenceCoverage01: number;
  contradiction01: number;
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
}

export interface InternalDialogueReview {
  version: 1;
  tick: number;
  turnCount: number;
  status: InternalDialogueStatus;
  rankingConfidence01: number;
  uncertainty01: number;
  evidenceCoverage01: number;
  contradiction01: number;
  leadingClaimId: string | null;
  suggestedAction: InternalDialogueAction;
  recommendedNextStep: InternalDialogueNextStep;
  unresolvedQuestions: string[];
  candidateScores: InternalDialogueCandidateScore[];
  turns: InternalDialogueTurn[];
  summary: string;
  advisoryOnly: true;
}

const clamp01 = (value: unknown): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
};
const round3 = (value: number): number => Math.round(clamp01(value) * 1000) / 1000;
const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 96 && /^[A-Za-z0-9:_-]+$/.test(value);
const allowedActions = new Set<InternalDialogueAction>(['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']);
const sourceWeight: Record<InternalDialogueEvidenceKind, number> = {
  observation: 0.85,
  outcome: 1,
  memory: 0.55,
  prediction: 0.38,
  goal: 0.25,
  user: 0.65,
  tool: 0.8,
};
const sensitiveText = /\b(?:password|passphrase|credential|api[_ -]?key|private key|access token|secret key|medical record|diagnos(?:is|ed))\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{12,})\b|парол(?:ь|я|ем|и|ей)|ключ доступа|токен доступа|диагноз|медицинск(?:ая карта|ие данные)/iu;

/** Do not quote private-looking or control-bearing text into the internal review record. */
export function sanitizeInternalDialogueText(value: unknown, maxLength = 220): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(12, Math.min(360, Math.floor(maxLength))));
  if (clean.length < 12 || sensitiveText.test(clean)) return null;
  return clean;
}

interface WeightedLinks {
  support: number;
  contradiction: number;
  supportCount: number;
  contradictionCount: number;
  evidenceIds: string[];
  sources: Set<string>;
}

function getWeightedLinks(claim: InternalDialogueClaim, evidenceById: Map<string, InternalDialogueEvidence>): WeightedLinks {
  const result: WeightedLinks = { support: 0, contradiction: 0, supportCount: 0, contradictionCount: 0, evidenceIds: [], sources: new Set() };
  const seen = new Set<string>();
  const add = (rawId: unknown, relation: 'support' | 'contradiction') => {
    if (!validId(rawId) || seen.has(rawId)) return;
    const record = evidenceById.get(rawId);
    if (!record) return;
    seen.add(rawId);
    const weight = clamp01(record.confidence01) * sourceWeight[record.kind];
    if (relation === 'support') {
      result.support += weight;
      result.supportCount++;
    } else {
      result.contradiction += weight;
      result.contradictionCount++;
    }
    result.evidenceIds.push(record.id);
    if (relation === 'support') result.sources.add(record.sourceGroup || record.id);
  };
  const supporting = [...new Set((Array.isArray(claim.supportingEvidenceIds) ? claim.supportingEvidenceIds : []).filter(validId))];
  const contradicting = [...new Set((Array.isArray(claim.contradictingEvidenceIds) ? claim.contradictingEvidenceIds : []).filter(validId))];
  const contradictionSet = new Set(contradicting);
  // Fail closed if one source is simultaneously declared supportive and contradictory.
  // The conservative relation wins; an ambiguous evidence identity never boosts support.
  for (const id of contradicting) add(id, 'contradiction');
  for (const id of supporting) if (!contradictionSet.has(id)) add(id, 'support');
  return result;
}

/**
 * Bounded internal dialogue engine. Every returned turn is an auditable summary of a
 * review operation; it does not dump private free-form reasoning into logs or prompts.
 */
export class InternalDialogueEngine {
  deliberate(input: InternalDialogueInput): InternalDialogueReview {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('internal-dialogue-input-must-be-object');
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('internal-dialogue-tick-must-be-nonnegative-safe-integer');
    if (typeof input.focus !== 'string' || input.focus.trim().length === 0) throw new TypeError('internal-dialogue-focus-required');
    if (!Array.isArray(input.claims) || !Array.isArray(input.evidence)) throw new TypeError('internal-dialogue-claims-and-evidence-must-be-arrays');

    const evidenceById = new Map<string, InternalDialogueEvidence>();
    for (const item of input.evidence.slice(0, 96)) {
      if (!item || !validId(item.id) || !['observation', 'outcome', 'memory', 'prediction', 'goal', 'user', 'tool'].includes(item.kind)) continue;
      if (evidenceById.has(item.id)) continue; // first-write-wins: duplicate IDs cannot inflate support.
      evidenceById.set(item.id, { id: item.id, kind: item.kind, confidence01: clamp01(item.confidence01), ...(validId(item.sourceGroup) ? { sourceGroup: item.sourceGroup } : {}) });
    }

    const claims = input.claims.slice(0, 12).filter((claim) => claim && validId(claim.id));
    const candidateScores: InternalDialogueCandidateScore[] = claims.map((claim) => {
      const links = getWeightedLinks(claim, evidenceById);
      const total = links.support + links.contradiction;
      const coverage = total > 0 ? Math.min(1, total / 1.25) : 0;
      const balance = total > 0 ? links.support / total : 0;
      const contradiction01 = total > 0 ? links.contradiction / total : 0;
      const independentSources01 = Math.min(1, links.sources.size / 2);
      const prior = clamp01(claim.priorConfidence01 ?? 0.5);
      const actionability = clamp01(claim.actionability01 ?? 0.5);
      const risk = clamp01(claim.risk01 ?? 0.5);
      // A prediction is explicitly weaker than a measured outcome. No linked evidence
      // means a claim cannot score as if it had been verified.
      const score = clamp01(0.25 * prior + 0.45 * coverage * balance + 0.15 * actionability
        + 0.10 * (1 - risk) + 0.05 * independentSources01 - 0.15 * contradiction01);
      return {
        id: claim.id,
        action: allowedActions.has(claim.action as InternalDialogueAction) ? claim.action as InternalDialogueAction : null,
        score01: round3(score),
        evidenceCoverage01: round3(coverage),
        contradiction01: round3(contradiction01),
        supportingEvidenceCount: links.supportCount,
        contradictingEvidenceCount: links.contradictionCount,
      };
    }).sort((a, b) => b.score01 - a.score01 || a.id.localeCompare(b.id));

    // Each candidate contributes exactly once to coverage; unsupported candidates
    // already contribute zero, so multiplying by a second support-rate factor double-penalizes gaps.
    const coverage01 = candidateScores.length
      ? round3(candidateScores.reduce((sum, item) => sum + (item.evidenceCoverage01 * (1 - item.contradiction01)), 0) / candidateScores.length)
      : 0;
    const allLinked = candidateScores.reduce((sum, item) => sum + item.supportingEvidenceCount + item.contradictingEvidenceCount, 0);
    const contradictionCount = candidateScores.reduce((sum, item) => sum + item.contradictingEvidenceCount, 0);
    const contradiction01 = allLinked ? round3(contradictionCount / allLinked) : 0;
    const margin01 = candidateScores.length > 1 ? clamp01(candidateScores[0].score01 - candidateScores[1].score01) : candidateScores.length ? candidateScores[0].score01 : 0;
    const rankingConfidence01 = round3(clamp01(0.10 + 0.40 * coverage01 + 0.25 * margin01 + 0.25 * (1 - contradiction01)));
    const unresolvedQuestions: string[] = [];
    for (const unknown of (Array.isArray(input.knownUnknowns) ? input.knownUnknowns : []).slice(0, 6)) {
      const clean = sanitizeInternalDialogueText(unknown, 180);
      if (clean && !unresolvedQuestions.includes(clean)) unresolvedQuestions.push(clean);
    }
    for (const score of candidateScores) {
      if (!score.supportingEvidenceCount && !score.contradictingEvidenceCount) unresolvedQuestions.push('claim:' + score.id + ' has no linked evidence');
    }
    if (candidateScores.length && coverage01 < 0.45) unresolvedQuestions.push('independent or outcome-level evidence is still needed');

    const cognitiveLoad01 = clamp01(input.cognitiveLoad01 ?? 0.5);
    let recommendedNextStep: InternalDialogueNextStep;
    if (cognitiveLoad01 >= 0.92) recommendedNextStep = 'pause';
    else if (!candidateScores.length) recommendedNextStep = 'explore';
    else if (contradiction01 >= 0.25 || coverage01 < 0.45) recommendedNextStep = 'seek-evidence';
    else if (rankingConfidence01 < 0.48) recommendedNextStep = 'explore';
    else recommendedNextStep = 'accept-provisionally';

    const status: InternalDialogueStatus = !candidateScores.length || coverage01 < 0.25 || contradiction01 >= 0.45
      ? 'needs-evidence'
      : rankingConfidence01 >= 0.62 && coverage01 >= 0.55 && margin01 >= 0.07
        ? 'reviewed'
        : 'provisional';
    const leading = candidateScores[0];
    const suggestedAction: InternalDialogueAction = recommendedNextStep === 'pause' ? 'rest'
      : recommendedNextStep === 'explore' ? 'explore'
        : recommendedNextStep === 'seek-evidence' ? 'verify'
          : (leading?.action ?? 'reflect');

    const turnBudget = Math.max(3, Math.min(6, Math.floor(Number(input.maxTurns ?? 6) || 6)));
    const turns: InternalDialogueTurn[] = [];
    const addTurn = (role: InternalDialogueRole, note: string, evidenceIds: string[] = []) => {
      if (turns.length < turnBudget) turns.push({ role, note, evidenceIds: [...new Set(evidenceIds)].slice(0, 8) });
    };
    addTurn('frame', 'Separate the decision question from assumptions; the selected action remains under canonical planner authority.');
    addTurn('hypothesis', 'Compare ' + candidateScores.length + ' candidate(s); ranking uses only the supplied prior scores and explicitly linked sources.', leading ? [leading.id] : []);
    addTurn('critic', 'Identify ' + contradictionCount + ' contradictory evidence link(s); unsupported hypotheses remain provisional.', candidateScores.filter((x) => x.contradictingEvidenceCount > 0).map((x) => x.id));
    addTurn('evidence-audit', 'Evidence coverage=' + coverage01 + '; prediction-derived support is weaker than an observed outcome.', [...evidenceById.keys()].slice(0, 8));
    addTurn('metacognition', 'Ranking confidence=' + rankingConfidence01 + '; uncertainty=' + round3(1 - rankingConfidence01) + '; unresolved questions=' + unresolvedQuestions.length + '.');
    addTurn('synthesis', 'Advisory next step=' + recommendedNextStep + '; result is not permission to execute an action.');

    const summary = recommendedNextStep === 'seek-evidence'
      ? 'The leading option remains provisional; obtain stronger evidence before treating it as established.'
      : recommendedNextStep === 'pause'
        ? 'Cognitive load is high; defer additional deliberation until the system can continue safely.'
        : recommendedNextStep === 'explore'
          ? 'The current candidates do not support a reliable conclusion; explore the knowledge gap.'
          : 'A provisional ranking is available; the canonical planner and safety gates retain authority.';

    return {
      version: 1,
      tick: input.tick,
      turnCount: turns.length,
      status,
      rankingConfidence01,
      uncertainty01: round3(1 - rankingConfidence01),
      evidenceCoverage01: coverage01,
      contradiction01,
      leadingClaimId: leading?.id ?? null,
      suggestedAction,
      recommendedNextStep,
      unresolvedQuestions: [...new Set(unresolvedQuestions)].slice(0, 10),
      candidateScores: candidateScores.slice(0, 8),
      turns,
      summary,
      advisoryOnly: true,
    };
  }
}
