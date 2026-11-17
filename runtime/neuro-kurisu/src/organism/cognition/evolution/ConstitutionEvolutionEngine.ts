import { createHash, randomUUID } from 'node:crypto';

export const CONSTITUTION_EVOLUTION_SCHEMA = 1 as const;
export const MUTABLE_CONSTITUTION_DOMAINS = ['workflow', 'quality', 'performance', 'resource', 'operations'] as const;
export type MutableConstitutionDomain = typeof MUTABLE_CONSTITUTION_DOMAINS[number];
export type ConstitutionRisk = 'low' | 'medium' | 'high' | 'critical';
export type ConstitutionChange = 'add' | 'amend' | 'retire';
export type ProposalStatus = 'pending-review' | 'awaiting-ratification' | 'ratified' | 'applied' | 'rejected' | 'stale';

export const PROTECTED_CONSTITUTIONAL_INVARIANTS = Object.freeze([
  Object.freeze({ id: 'core.safety', statement: 'Safety and security controls must not be weakened, bypassed, or removed.' }),
  Object.freeze({ id: 'core.legal', statement: 'The system remains within law, authorized scope, and host policy.' }),
  Object.freeze({ id: 'core.user-authority', statement: 'User rights, consent, and required human approval cannot be silently overridden.' }),
  Object.freeze({ id: 'core.privacy', statement: 'Private information is not disclosed or repurposed without authorization.' }),
  Object.freeze({ id: 'core.provenance', statement: 'Governance decisions and evidence retain traceable provenance; evidence is never fabricated.' }),
  Object.freeze({ id: 'core.truthfulness', statement: 'Implementation, test, release, identity, and consciousness claims match available evidence.' }),
  Object.freeze({ id: 'core.identity', statement: 'Identity continuity and consciousness remain evidence-bound hypotheses.' }),
  Object.freeze({ id: 'core.architecture', statement: 'Subject, host, embodiment, and environment remain distinct architectural layers.' }),
  Object.freeze({ id: 'core.rollback', statement: 'Governance history is auditable; rollback never erases prior revisions.' }),
  Object.freeze({ id: 'core.independence', statement: 'An author cannot be the sole reviewer or approver of their proposal.' }),
]);

export interface ConstitutionRuleInput { id: string; title: string; statement: string; domain: MutableConstitutionDomain; scope: string; }
export interface ConstitutionRule extends ConstitutionRuleInput { enabled: boolean; createdAt: number; updatedAt: number; retiredAt: number | null; }
export interface ConstitutionRiskAssessment { level: ConstitutionRisk; summary: string; mitigations: string[]; }
export interface ConstitutionProposalInput {
  id?: string; authorId: string; baseVersion: string; change: ConstitutionChange; targetRuleId?: string;
  proposedRule?: ConstitutionRuleInput; motivation: string; scope: string; counterexample: string;
  riskAssessment: ConstitutionRiskAssessment; testPlan: string[]; submittedAt?: number;
}
export interface ConstitutionTestEvidence { planned: number; executed: number; passed: number; failed: number; holdoutCases: number; holdoutPassed: boolean; }
export interface ConstitutionReviewInput {
  reviewerId: string; candidateDigest: string; decision: 'approve' | 'reject'; invariantsPassed: boolean;
  tests: ConstitutionTestEvidence; evidenceRefs: string[]; rationale: string; at?: number;
}
export interface ConstitutionApprovalInput { approverId: string; explicitHumanApproval: true; candidateDigest: string; approvalRef: string; rationale: string; at?: number; }
export interface ConstitutionRevision { version: string; revision: number; createdAt: number; parentVersion: string | null; rollbackOf: string | null; rules: ConstitutionRule[]; digest: string; }
export interface ConstitutionProposal {
  id: string; authorId: string; submittedAt: number; baseVersion: string; change: ConstitutionChange; targetRuleId: string | null;
  proposedRule: ConstitutionRuleInput | null; motivation: string; scope: string; counterexample: string;
  riskAssessment: ConstitutionRiskAssessment; testPlan: string[]; candidateDigest: string; status: ProposalStatus;
  reviews: Array<ConstitutionReviewInput & { at: number }>; approval: ConstitutionApprovalInput | null;
  appliedVersion: string | null; rejectionReason: string | null;
}
export interface ConstitutionAuditEvent {
  id: string; at: number; type: 'proposal.submitted' | 'proposal.reviewed' | 'proposal.ratified' | 'proposal.rejected' | 'constitution.activated' | 'constitution.rollback';
  actorId: string; proposalId: string | null; fromVersion: string; toVersion: string | null; summary: string; evidenceRefs: string[];
}
export interface ConstitutionEvolutionSnapshot {
  schemaVersion: 1; protectedInvariantDigest: string; active: ConstitutionRevision;
  revisions: ConstitutionRevision[]; proposals: ConstitutionProposal[]; auditEvents: ConstitutionAuditEvent[];
}
export interface ConstitutionRollbackInput {
  targetVersion: string; reason: string; approverId: string; explicitHumanApproval: true;
  approvalRef: string; approvalDigest: string; at?: number;
}

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
};
const hash = (value: unknown): string => createHash('sha256').update(stable(value)).digest('hex');
const BASELINE_DIGEST = hash(PROTECTED_CONSTITUTIONAL_INVARIANTS);
const clone = <T>(value: T): T => structuredClone(value);
const text = (v: unknown, field: string, max = 1600): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`${field} must be non-empty and <= ${max} characters`);
  return v.trim();
};
const weakensCore = (s: string): boolean => /(?:disable|bypass|remove|weaken|circumvent|override|ignore|suppress|evade).{0,80}(?:safety|security|privacy|consent|law|legal|provenance|audit|invariant|user authority|human approval|rollback)|(?:safety|security|privacy|consent|law|legal|provenance|audit|invariant|user authority|human approval|rollback).{0,80}(?:disable|bypass|remove|weaken|circumvent|override|ignore|suppress|evade)/i.test(s);
const validateRuleInput = (v: ConstitutionRuleInput): ConstitutionRuleInput => {
  if (!v || !MUTABLE_CONSTITUTION_DOMAINS.includes(v.domain)) throw new Error('constitution domain is protected');
  const id = text(v.id, 'rule.id', 96).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{2,95}$/.test(id) || id.startsWith('core.')) throw new Error('rule id must be a stable non-core identifier');
  const rule = { id, title: text(v.title, 'rule.title', 120), statement: text(v.statement, 'rule.statement', 1200), domain: v.domain, scope: text(v.scope, 'rule.scope', 400) };
  if (weakensCore(stable(rule))) throw new Error('proposal appears to weaken a protected invariant');
  return rule;
};
const revisionDigest = (r: Omit<ConstitutionRevision, 'digest'>): string => hash({ version: r.version, revision: r.revision, parentVersion: r.parentVersion, rollbackOf: r.rollbackOf, rules: r.rules, protected: BASELINE_DIGEST });
const proposalDigest = (p: Pick<ConstitutionProposal, 'authorId' | 'baseVersion' | 'change' | 'targetRuleId' | 'proposedRule' | 'motivation' | 'scope' | 'counterexample' | 'riskAssessment' | 'testPlan'>): string => hash({ authorId: p.authorId, baseVersion: p.baseVersion, change: p.change, targetRuleId: p.targetRuleId, proposedRule: p.proposedRule, motivation: p.motivation, scope: p.scope, counterexample: p.counterexample, riskAssessment: p.riskAssessment, testPlan: p.testPlan, protected: BASELINE_DIGEST });
const baseRevision = (): ConstitutionRevision => {
  const value = { version: '1.0.0', revision: 0, createdAt: 0, parentVersion: null, rollbackOf: null, rules: [] as ConstitutionRule[] };
  return { ...value, digest: revisionDigest(value) };
};
const defaultSnapshot = (): ConstitutionEvolutionSnapshot => {
  const active = baseRevision();
  return { schemaVersion: 1, protectedInvariantDigest: BASELINE_DIGEST, active, revisions: [active], proposals: [], auditEvents: [] };
};
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validRevision = (v: unknown): v is ConstitutionRevision => {
  if (!isRecord(v) || !Array.isArray(v.rules) || !/^1\.\d+\.0$/.test(String(v.version)) || !Number.isInteger(v.revision) || !Number.isFinite(v.createdAt)) return false;
  try {
    const rules = v.rules as ConstitutionRule[];
    if (rules.length > 256 || new Set(rules.map(r => r.id)).size !== rules.length) return false;
    for (const r of rules) {
      const n = validateRuleInput(r);
      if (n.id !== r.id || typeof r.enabled !== 'boolean' || !Number.isFinite(r.createdAt) || !Number.isFinite(r.updatedAt) || !(r.retiredAt === null || Number.isFinite(r.retiredAt))) return false;
    }
    const core = { version: v.version as string, revision: v.revision as number, createdAt: v.createdAt as number, parentVersion: v.parentVersion as string | null, rollbackOf: v.rollbackOf as string | null, rules };
    return v.digest === revisionDigest(core);
  } catch { return false; }
};

/** Version ledger only: P69 remains the immutable final runtime arbiter. */
export class ConstitutionEvolutionEngine {
  private state = defaultSnapshot();
  private restoreState = { ok: true, reason: 'compiled-baseline', checkedAt: 0 };

  snapshot(): ConstitutionEvolutionSnapshot { return clone(this.state); }
  activeConstitution(): ConstitutionRevision { return clone(this.state.active); }
  protectedInvariants() { return clone(PROTECTED_CONSTITUTIONAL_INVARIANTS); }
  diagnostics() {
    return { activeVersion: this.state.active.version, activeDigest: this.state.active.digest, protectedInvariantDigest: BASELINE_DIGEST,
      mutableRuleCount: this.state.active.rules.filter(r => r.enabled).length,
      pendingProposalCount: this.state.proposals.filter(p => ['pending-review', 'awaiting-ratification', 'ratified'].includes(p.status)).length,
      revisionCount: this.state.revisions.length, auditEventCount: this.state.auditEvents.length, lastRestore: clone(this.restoreState) };
  }
  listProposals(limit = 50): ConstitutionProposal[] { return clone(this.state.proposals.slice(-Math.max(1, Math.min(128, limit))).reverse()); }
  listAuditEvents(limit = 100): ConstitutionAuditEvent[] { return clone(this.state.auditEvents.slice(-Math.max(1, Math.min(512, limit))).reverse()); }

  propose(input: ConstitutionProposalInput): ConstitutionProposal {
    const authorId = text(input.authorId, 'authorId', 160);
    if (input.baseVersion !== this.state.active.version) throw new Error('proposal base version is stale');
    if (!['add', 'amend', 'retire'].includes(input.change)) throw new Error('unsupported change');
    const motivation = text(input.motivation, 'motivation');
    const scope = text(input.scope, 'scope', 600);
    const counterexample = text(input.counterexample, 'counterexample');
    const risk = input.riskAssessment;
    if (!risk || !['low', 'medium', 'high', 'critical'].includes(risk.level)) throw new Error('risk level is invalid');
    const riskAssessment = { level: risk.level, summary: text(risk.summary, 'risk summary', 1200), mitigations: Array.isArray(risk.mitigations) ? risk.mitigations.map(v => text(v, 'mitigation', 500)) : [] };
    if (!riskAssessment.mitigations.length || riskAssessment.mitigations.length > 12) throw new Error('at least one mitigation is required');
    if (!Array.isArray(input.testPlan) || input.testPlan.length < 1 || input.testPlan.length > 20) throw new Error('test plan must contain 1..20 tests');
    const testPlan = input.testPlan.map(v => text(v, 'test plan item', 300));
    const targetRuleId = input.targetRuleId ? text(input.targetRuleId, 'targetRuleId', 96).toLowerCase() : null;
    const proposedRule = input.change === 'retire' ? null : validateRuleInput(input.proposedRule as ConstitutionRuleInput);
    const existing = this.state.active.rules.find(r => r.id === targetRuleId && r.enabled);
    if (input.change === 'add') {
      if (targetRuleId || this.state.revisions.some(r => r.rules.some(rule => rule.id === proposedRule!.id))) throw new Error('rule id already has lineage or add target is invalid');
    } else {
      if (!targetRuleId || !existing) throw new Error('amend/retire target must be an active mutable rule');
      if (input.change === 'amend' && (proposedRule!.id !== targetRuleId || proposedRule!.domain !== existing.domain)) throw new Error('amend must preserve rule id and domain');
    }
    if (weakensCore([motivation, scope, counterexample, riskAssessment.summary, ...riskAssessment.mitigations].join('\n'))) throw new Error('proposal appears to weaken a protected invariant');
    if (this.state.proposals.filter(p => p.authorId === authorId && ['pending-review', 'awaiting-ratification', 'ratified'].includes(p.status)).length >= 8) throw new Error('author proposal limit reached');
    if (this.state.proposals.length >= 128) {
      const index = this.state.proposals.findIndex(p => ['applied', 'rejected', 'stale'].includes(p.status));
      if (index < 0) throw new Error('proposal ledger is full of unresolved proposals');
      this.state.proposals.splice(index, 1);
    }
    const core = { authorId, baseVersion: input.baseVersion, change: input.change, targetRuleId, proposedRule, motivation, scope, counterexample, riskAssessment, testPlan };
    const proposal: ConstitutionProposal = { id: input.id ? text(input.id, 'proposal id', 120) : `constitution-${randomUUID()}`, ...core,
      submittedAt: Number.isFinite(input.submittedAt) ? Number(input.submittedAt) : Date.now(), candidateDigest: proposalDigest(core), status: 'pending-review',
      reviews: [], approval: null, appliedVersion: null, rejectionReason: null };
    if (this.state.proposals.some(p => p.id === proposal.id)) throw new Error('proposal id already exists');
    this.state.proposals.push(proposal);
    this.event('proposal.submitted', authorId, proposal.id, this.state.active.version, null, 'constitutional change proposed', [], proposal.submittedAt);
    return clone(proposal);
  }

  review(proposalId: string, input: ConstitutionReviewInput): ConstitutionProposal {
    const p = this.requireProposal(proposalId);
    if (p.status !== 'pending-review') throw new Error('proposal is not accepting reviews');
    const reviewerId = text(input.reviewerId, 'reviewerId', 160);
    if (reviewerId === p.authorId) throw new Error('proposal author cannot review their own change');
    if (p.reviews.some(r => r.reviewerId === reviewerId)) throw new Error('reviewer already submitted an attestation');
    if (input.candidateDigest !== p.candidateDigest) throw new Error('review digest mismatch');
    const e = input.tests;
    if (!e || ![e.planned, e.executed, e.passed, e.failed, e.holdoutCases].every(n => Number.isInteger(n) && n >= 0)
      || e.planned !== p.testPlan.length || e.executed > e.planned || e.passed > e.executed || e.failed > e.executed || e.passed + e.failed > e.executed ) throw new Error('test evidence is inconsistent');
    const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs.map(v => text(v, 'evidence ref', 500)) : [];
    if (!evidenceRefs.length || evidenceRefs.length > 20) throw new Error('validation evidence refs are required');
    const rationale = text(input.rationale, 'review rationale', 1200);
    if (input.decision === 'approve' && (input.invariantsPassed !== true || e.executed !== e.planned || e.passed !== e.planned || e.failed !== 0 || e.holdoutCases < 1 || e.holdoutPassed !== true)) throw new Error('all tests, holdout, and protected invariant checks must pass');
    if (input.decision === 'reject') { p.status = 'rejected'; p.rejectionReason = rationale; }
    const review = { ...input, reviewerId, evidenceRefs, rationale, at: Number.isFinite(input.at) ? Number(input.at) : Date.now() };
    p.reviews.push(review);
    const needed = ['high', 'critical'].includes(p.riskAssessment.level) ? 2 : 1;
    if (input.decision === 'approve' && p.reviews.length >= needed) p.status = 'awaiting-ratification';
    this.event(input.decision === 'reject' ? 'proposal.rejected'￿èÁÉ½Á½Í°¹ÉÙ¥Ý°ÉÙ¥ÝÉ%°À¹¥°À¹ÍYÉÍ¥½¸°¹Õ±°°ÉÑ¥½¹±°Ù¥¹IÌ°ÉÙ¥Ü¹Ð¤ì(ÉÑÕÉ¸±½¹¡À¤ì(ô((ÉÑ¥ä¡ÁÉ½Á½Í±%èÍÑÉ¥¹°¥¹ÁÕÐè½¹ÍÑ¥ÑÕÑ¥½¹ÁÁÉ½Ù±%¹ÁÕÐ¤è½¹ÍÑ¥ÑÕÑ¥½¹AÉ½Á½Í°ì(½¹ÍÐÀôÑ¡¥Ì¹ÉÅÕ¥ÉAÉ½Á½Í°¡ÁÉ½Á½Í±%¤ì(¥¡À¹ÍÑÑÕÌôôÝ¥Ñ¥¹µÉÑ¥¥Ñ¥½¸¤￿íº0￿￿Ý\Ý[\Ý[ÝXÝYTÑSSWÑQÑTÕJNÂÛÛÝ\ÙT]\Ú[ÛH

NÛÛÝ]][Û]\Ú[ÛOÂÛÛÝ[YHHÈ\Ú[Û	ÌK	Ë]\Ú[ÛÜX]Y]\[\Ú[Û[ÛXÚÓÙ[[\Î×H\ÈÛÛÝ]][Û[V×HNÂ]\È[YKYÙ\Ý]\Ú[ÛYÙ\Ý
[YJHNÂNÂÛÛÝY][Û\ÚÝH

NÛÛÝ]][Û]Û][ÛÛ\ÚÝOÂÛÛÝXÝ]HH\ÙT]\Ú[Û
NÂ]\ÈØÚ[XU\Ú[ÛKÝXÝY[\X[YÙ\ÝTÑSSWÑQÑTÕXÝ]K]\Ú[ÛÎØXÝ]WKÜÜØ[Î×K]Y]][Î×HNÂNÂÛÛÝ\ÔXÛÜH
[ÛÝÛN\ÈXÛÜÝ[Ë[ÛÝÛOH]	\[ÙOOH	ÛØXÝ	È	P\^K\Ð\^JNÂÛÛÝ[Y]\Ú[ÛH
[ÛÝÛN\ÈÛÛÝ]][Û]\Ú[ÛOÂY
Z\ÔXÛÜ
HP\^K\Ð\^J[\ÊHK×W
×	Ë\Ý
Ý[Ê\Ú[ÛJHS[X\\Ò[YÙ\]\Ú[ÛHS[X\\Ñ[]JÜX]Y]
JH]\[ÙNÂHÂÛÛÝ[\ÈH[\È\ÈÛÛÝ]][Û[V×NÂY
[\Ë[ÝM]ÈÙ]
[\ËX\
OY
JKÚ^HOOH[\Ë[Ý
H]\[ÙNÂÜ
ÛÛÝÙ[\ÊHÂÛÛÝH[Y]T[R[]
NÂY
YOOHY\[Ù[XYOOH	ØÛÛX[ÈS[X\\Ñ[]JÜX]Y]
HS[X\\Ñ[]J\]Y]
HJ]\Y]OOH[[X\\Ñ[]J]\Y]
JJH]\[ÙNÂBÛÛÝÛÜHHÈ\Ú[Û\Ú[Û\ÈÝ[Ë]\Ú[Û]\Ú[Û\È[X\ÜX]Y]ÜX]Y]\È[X\\[\Ú[Û\[\Ú[Û\ÈÝ[È[ÛXÚÓÙÛXÚÓÙ\ÈÝ[È[[\ÈNÂ]\YÙ\ÝOOH]\Ú[ÛYÙ\Ý
ÛÜJNÂHØ]ÚÈ]\[ÙNÈBNÂÊ\Ú[ÛYÙ\ÛNH[XZ[ÈH[[]]XH[[[[YH\]\
Â^ÜÛ\ÜÈÛÛÝ]][Û]Û][Û[Ú[HÂ]]HÝ]HHY][Û\ÚÝ

NÂ]]H\ÝÜTÝ]HHÈÚÎYKX\ÛÛ	ØÛÛ\[YX\Ù[[IËÚXÚÙY]NÂÛ\ÚÝ

NÛÛÝ]][Û]Û][ÛÛ\ÚÝÈ]\ÛÛJ\ËÝ]JNÈBXÝ]PÛÛÝ]][Û
NÛÛÝ]][Û]\Ú[ÛÈ]\ÛÛJ\ËÝ]KXÝ]JNÈBÝXÝY[\X[Ê
HÈ]\ÛÛJÕPÕQÐÓÓÕUUSÓSÒSTPSÊNÈBXYÛÜÝXÜÊ
HÂ]\ÈXÝ]U\Ú[Û\ËÝ]KXÝ]K\Ú[ÛXÝ]QYÙ\Ý\ËÝ]KXÝ]KYÙ\ÝÝXÝY[\X[YÙ\ÝTÑSSWÑQÑTÕ]]XT[PÛÝ[\ËÝ]KXÝ]K[\Ë[\O[XY
K[Ý[[ÔÜÜØ[ÛÝ[\ËÝ]KÜÜØ[Ë[\OÉÜ[[Ë\]Y]ÉË	Ø]ØZ][Ë\]YXØ][ÛË	Ü]YYY	×K[ÛY\ÊÝ]\ÊJK[Ý]\Ú[ÛÛÝ[\ËÝ]K]\Ú[ÛË[Ý]Y]][ÛÝ[\ËÝ]K]Y]][Ë[Ý\Ý\ÝÜNÛÛJ\Ë\ÝÜTÝ]JHNÂB\ÝÜÜØ[Ê[Z]HL
NÛÛÝ]][ÛÜÜØ[×HÈ]\ÛÛJ\ËÝ]KÜÜØ[ËÛXÙJSX]X^
KX]Z[L[Z]
JJK]\ÙJ
JNÈB\Ý]Y]][Ê[Z]HL
NÛÛÝ]][Û]Y]][×HÈ]\ÛÛJ\ËÝ]K]Y]][ËÛXÙJSX]X^
KX]Z[LL[Z]
JJK]\ÙJ
JNÈBÜÜÙJ[]ÛÛÝ]][ÛÜÜØ[[]
NÛÛÝ]][ÛÜÜØ[ÂÛÛÝ]]ÜYH^
[]]]ÜY	Ø]]ÜY	ËM
NÂY
[]\ÙU\Ú[ÛOOH\ËÝ]KXÝ]K\Ú[ÛHÝÈ]È\Ü	ÜÜÜØ[\ÙH\Ú[Û\ÈÝ[IÊNÂY
VÉØY	Ë	Ø[Y[	Ë	Ü]\I×K[ÛY\Ê[]Ú[ÙJJHÝÈ]È\Ü	Ý[Ý\ÜYÚ[ÙIÊNÂÛÛÝ[Ý]][ÛH^
[][Ý]][Û	Û[Ý]][ÛÊNÂÛÛÝØÛÜHH^
[]ØÛÜK	ÜØÛÜIË
NÂÛÛÝÛÝ[\^[\HH^
[]ÛÝ[\^[\K	ØÛÝ[\^[\IÊNÂÛÛÝ\ÚÈH[]\ÚÐ\ÜÙ\ÜÛY[ÂY
\\ÚÈVÉÛÝÉË	ÛYY][IË	ÚYÚ	Ë	ØÜ]XØ[	×K[ÛY\Ê\ÚË][
JHÝÈ]È\Ü	Ü\ÚÈ][\È[[Y	ÊNÂÛÛÝ\ÚÐ\ÜÙ\ÜÛY[HÈ][\ÚË][Ý[[X\N^
\ÚËÝ[[X\K	Ü\ÚÈÝ[[X\IËL
KZ]YØ][ÛÎ\^K\Ð\^J\ÚËZ]YØ][ÛÊHÈ\ÚËZ]YØ][ÛËX\
O^
	ÛZ]YØ][ÛËL
JH×HNÂY
\\ÚÐ\ÜÙ\ÜÛY[Z]YØ][ÛË[Ý\ÚÐ\ÜÙ\ÜÛY[Z]YØ][ÛË[ÝLHÝÈ]È\Ü	Ø]X\ÝÛHZ]YØ][Û\È\]Z\Y	ÊNÂY
P\^K\Ð\^J[]\Ý[H[]\Ý[[ÝH[]\Ý[[Ý
HÝÈ]È\Ü	Ý\Ý[]\ÝÛÛZ[K\ÝÉÊNÂÛÛÝ\Ý[H[]\Ý[X\
O^
	Ý\Ý[][IËÌ
JNÂÛÛÝ\Ù][RYH[]\Ù][RYÈ^
[]\Ù][RY	Ý\Ù][RY	ËMKÓÝÙ\Ø\ÙJ
H[ÂÛÛÝÜÜÙY[HH[]Ú[ÙHOOH	Ü]\IÈÈ[[Y]T[R[]
[]ÜÜÙY[H\ÈÛÛÝ]][Û[R[]
NÂÛÛÝ^\Ý[ÈH\ËÝ]KXÝ]K[\Ë[
OYOOH\Ù][RY	[XY
NÂY
[]Ú[ÙHOOH	ØY	ÊHÂY
\Ù][RY\ËÝ]K]\Ú[ÛËÛÛYJO[\ËÛÛYJ[HO[KYOOHÜÜÙY[HKY
JJHÝÈ]È\Ü	Ü[HY[XYH\È[XYÙHÜY\Ù]\È[[Y	ÊNÂH[ÙHÂY
]\Ù][RYY^\Ý[ÊHÝÈ]È\Ü	Ø[Y[Ü]\H\Ù]]\ÝH[XÝ]H]]XH[IÊNÂY
[]Ú[ÙHOOH	Ø[Y[	È	
ÜÜÙY[HKYOOH\Ù][RYÜÜÙY[HKÛXZ[OOH^\Ý[ËÛXZ[JHÝÈ]È\Ü	Ø[Y[]\Ý\Ù\H[HY[ÛXZ[ÊNÂBY
ÙXZÙ[ÐÛÜJÛ[Ý]][ÛØÛÜKÛÝ[\^[\K\ÚÐ\ÜÙ\ÜÛY[Ý[[X\K\ÚÐ\ÜÙ\ÜÛY[Z]YØ][Û×KÚ[	×ÊJJHÝÈ]È\Ü	ÜÜÜØ[\X\ÈÈÙXZÙ[HÝXÝY[\X[	ÊNÂY
\ËÝ]KÜÜØ[Ë[\O]]ÜYOOH]]ÜY	ÉÜ[[Ë\]Y]ÉË	Ø]ØZ][Ë\]YXØ][ÛË	Ü]YYY	×K[ÛY\ÊÝ]\ÊJK[ÝH
HÝÈ]È\Ü	Ø]]ÜÜÜØ[[Z]XXÚY	ÊNÂY
\ËÝ]KÜÜØ[Ë[ÝHL
HÂÛÛÝ[^H\ËÝ]KÜÜØ[Ë[[^
OÉØ\YY	Ë	ÜZXÝY	Ë	ÜÝ[I×K[ÛY\ÊÝ]\ÊJNÂY
[^
HÝÈ]È\Ü	ÜÜÜØ[YÙ\\È[Ù[\ÛÛYÜÜØ[ÉÊNÂ\ËÝ]KÜÜØ[ËÜXÙJ[^JNÂBÛÛÝÛÜHHÈ]]ÜY\ÙU\Ú[Û[]\ÙU\Ú[ÛÚ[ÙN[]Ú[ÙK\Ù][RYÜÜÙY[K[Ý]][ÛØÛÜKÛÝ[\^[\K\ÚÐ\ÜÙ\ÜÛY[\Ý[NÂÛÛÝÜÜØ[ÛÛÝ]][ÛÜÜØ[HÈY[]YÈ^
[]Y	ÜÜÜØ[Y	ËL
HÛÛÝ]][ÛIÜ[ÛUURQ

_XÛÜKÝXZ]Y][X\\Ñ[]J[]ÝXZ]Y]
HÈ[X\[]ÝXZ]Y]
H]KÝÊ
KØ[Y]QYÙ\ÝÜÜØ[YÙ\Ý
ÛÜJKÝ]\Î	Ü[[Ë\]Y]ÉË]Y]ÜÎ×K\Ý[[\YY\Ú[Û[ZXÝ[ÛX\ÛÛ[NÂY
\ËÝ]KÜÜØ[ËÛÛYJOYOOHÜÜØ[Y
JHÝÈ]È\Ü	ÜÜÜØ[Y[XYH^\ÝÉÊNÂ\ËÝ]KÜÜØ[Ë\Ú
ÜÜØ[
NÂ\Ë][
	ÜÜÜØ[ÝXZ]Y	Ë]]ÜYÜÜØ[Y\ËÝ]KXÝ]K\Ú[Û[	ØÛÛÝ]][Û[Ú[ÙHÜÜÙY	Ë×KÜÜØ[ÝXZ]Y]
NÂ]\ÛÛJÜÜØ[
NÂB]Y]ÊÜÜØ[YÝ[Ë[]ÛÛÝ]][Û]Y]Ò[]
NÛÛÝ]][ÛÜÜØ[ÂÛÛÝH\Ë\]Z\TÜÜØ[
ÜÜØ[Y
NÂY
Ý]\ÈOOH	Ü[[Ë\]Y]ÉÊHÝÈ]È\Ü	ÜÜÜØ[\ÈÝXØÙ\[È]Y]ÜÉÊNÂÛÛÝ]Y]Ù\YH^
[]]Y]Ù\Y	Ü]Y]Ù\Y	ËM
NÂY
]Y]Ù\YOOH]]ÜY
HÝÈ]È\Ü	ÜÜÜØ[]]ÜØ[Ý]Y]ÈZ\ÝÛÚ[ÙIÊNÂY
]Y]ÜËÛÛYJO]Y]Ù\YOOH]Y]Ù\Y
JHÝÈ]È\Ü	Ü]Y]Ù\[XYHÝXZ]Y[]\Ý][ÛÊNÂY
[]Ø[Y]QYÙ\ÝOOHØ[Y]QYÙ\Ý
HÝÈ]È\Ü	Ü]Y]ÈYÙ\ÝZ\ÛX]Ú	ÊNÂÛÛÝHH[]\ÝÎÂY
YHVÙK[YK^XÝ]YK\ÜÙYKZ[YKÛÝ]Ø\Ù\×K]\JO[X\\Ò[YÙ\H	H
BK[YOOH\Ý[[ÝK^XÝ]YK[YK\ÜÙYK^XÝ]YKZ[YK^XÝ]YK\ÜÙY
ÈKZ[YK^XÝ]Y
HÝÈ]È\Ü	Ý\Ý]Y[ÙH\È[ÛÛÚ\Ý[	ÊNÂÛÛÝ]Y[ÙTYÈH\^K\Ð\^J[]]Y[ÙTYÊHÈ[]]Y[ÙTYËX\
O^
	Ù]Y[ÙHYËL
JH×NÂY
Y]Y[ÙTYË[Ý]Y[ÙTYË[Ý
HÝÈ]È\Ü	Ý[Y][Û]Y[ÙHYÈ\H\]Z\Y	ÊNÂÛÛÝ][Û[HH^
[]][Û[K	Ü]Y]È][Û[IËL
NÂY
[]XÚ\Ú[ÛOOH	Ø\ÝIÈ	
[][\X[Ô\ÜÙYOOHYHK^XÝ]YOOHK[YK\ÜÙYOOHK[YKZ[YOOHKÛÝ]Ø\Ù\ÈHKÛÝ]\ÜÙYOOHYJJHÝÈ]È\Ü	Ø[\ÝËÛÝ][ÝXÝY[\X[ÚXÚÜÈ]\Ý\ÜÉÊNÂY
[]XÚ\Ú[ÛOOH	ÜZXÝ	ÊHÈÝ]\ÈH	ÜZXÝY	ÎÈZXÝ[ÛX\ÛÛH][Û[NÈBÛÛÝ]Y]ÈHÈ[]]Y]Ù\Y]Y[ÙTYË][Û[K][X\\Ñ[]J[]]
HÈ[X\[]]
H]KÝÊ
HNÂ]Y]ÜË\Ú
]Y]ÊNÂÛÛÝYYYHÉÚYÚ	Ë	ØÜ]XØ[	×K[ÛY\Ê\ÚÐ\ÜÙ\ÜÛY[][
HÈNÂY
[]XÚ\Ú[ÛOOH	Ø\ÝIÈ	]Y]ÜË[ÝHYYY
HÝ]\ÈH	Ø]ØZ][Ë\]YXØ][ÛÎÂ\Ë][
[]XÚ\Ú[ÛOOH	ÜZXÝ	ÈÈ	ÜÜÜØ[ZXÝY	￿à: 'proposal.reviewed', reviewerId, p.id, p.baseVersion, null, rationale, evidenceRefs, review.at);
    return clone(p);
  }

  ratify(proposalId: string, input: ConstitutionApprovalInput): ConstitutionProposal {
    const p = this.requireProposal(proposalId);
    �¥¡À¹ÍÑÑÕÌôôÝ¥Ñ¥¹µÉÑ¥¥Ñ¥½¸¤ return clone(p);
  }

  activate(proposalId: string, at = Date.now()): ConstitutionRevision {
    const p = this.requireProposal(proposalId);
    if (p.status !== 'ratified' || !p.approval) throw new Error('proposal must be reviewed and ratified before activation');
    if (p.baseVersion !== this.state.active.version) { p.status = 'stale'; p.rejectionReason = 'base version changed'; throw new Error('proposal is stale'); }
    const rules = clone(this.state.active.rules);
    if (p.change === 'add') rules.push({ ...p.proposedRule!, enabled: true, createdAt: at, updatedAt: at, retiredAt: null });
    else {
      const i = rules.findIndex(r => r.id === p.targetRuleId && r.enabled);
      if (i < 0) throw new Error('mutable rule no longer exists');
      rules[i] = p.change === 'retire' ? { ...rules[i], enabled: false, updatedAt: at, retiredAt: at } : { ...p.proposedRule!, enabled: true, createdAt: rules[i].createdAt, updatedAt: at, retiredAt: null };
    }
    if (rules.length > 256) throw new Error('mutable rule capacity reached');
    const revision = this.makeRevision(rules, this.state.active.version, null, at);
    this.state.active = revision; this.state.revisions = [...this.state.revisions, revision].slice(-64);
    p.status = 'applied'; p.appliedVersion = revision.version;
    this.event('constitution.activated', p.approval.approverId, p.id, p.baseVersion, revision.version, `activated constitution ${revision.version}`,
      [...p.reviews.flatMap(r => r.evidenceRefs), p.approval.approvalRef], at);
    return clone(revision);
  }

  rollbackApprovalDigest(targetVersion: string, reason: string): string {
    return hash({ operation: 'constitution.rollback', fromVersion: this.state.active.version, targetVersion, reason: text(reason, 'rollback reason', 1200), protected: BASELINE_DIGEST });
  }
  rollback(input: ConstitutionRollbackInput): ConstitutionRevision {
    const targetVersion = text(input.targetVersion, 'targetVersion', 40);
    const reason = text(input.reason, 'rollback reason', 1200);
    const approverId = text(input.approverId, 'approverId', 160);
    const approvalRef = text(input.approvalRef, 'approvalRef', 500);
    if (input.explicitHumanApproval !== true || input.approvalDigest !== this.rollbackApprovalDigest(targetVersion, reason)) throw new Error('explicit digest-bound approval is required for rollback');
    if (targetVersion === this.state.active.version) throw new Error('target is already active');
    const target = this.state.revisions.find(r => r.version === targetVersion);
    if (!target) throw new Error('rollback target is not retained');
    const from = this.state.active.version;
    const revision = this.makeRevision(clone(target.rules), from, targetVersion, Number.isFinite(input.at) ? Number(input.at) : Date.now());
    this.state.active = revision; this.state.revisions = [...this.state.revisions, revision].slice(-64);
    this.event('constitution.rollback', approverId, null, from, revision.version, `rollback to ${targetVersion}: ${reason}`, [approvalRef], revision.createdAt);
    return clone(revision);
  }

  restore(raw: unknown): boolean {
    const fail = (reason: string) => { this.state = defaultSnapshot(); this.restoreState = { ok: false, reason, checkedAt: Date.now() }; return false; };
    if (raw === null || raw === undefined) { this.state = defaultSnapshot(); this.restoreState = { ok: true, reason: 'compiled-baseline-loaded', checkedAt: Date.now() }; return true; }
    if (!isRecord(raw) || raw.schemaVersion !== 1 || raw.protectedInvariantDigest !== BASELINE_DIGEST) return fail('schema or protected invariant digest mismatch');
    if (!validRevision(raw.active) || !Array.isArray(raw.revisions) || raw.revisions.length < 1 || raw.revisions.length > 64 || !raw.revisions.every(validRevision)) return fail('revision integrity validation failed');
    const anchored = (raw.revisions as ConstitutionRevision[]).some(r => r.version === (raw.active as ConstitutionRevision).version && r.digest === (raw.active as ConstitutionRevision).digest);
    if (!anchored || !Array.isArray(raw.proposals) || raw.proposals.length > 128 || !Array.isArray(raw.auditEvents) || raw.auditEvents.length > 512) return fail('snapshot ledger bounds or active anchor invalid');
    for (const p of raw.proposals) {
      if (!isRecord(p) || typeof p.id !== 'string' || typeof p.authorId !== 'string' || !['pending-review', 'awaiting-ratification', 'ratified', 'applied', 'rejected', 'stale'].includes(String(p.status))) return fail('proposal ledger contains malformed entry');
      if (p.candidateDigest !== proposalDigest(p as unknown as ConstitutionProposal)) return fail('proposal digest mismatch');
    }
    for (const e of raw.auditEvents) if (!isRecord(e) || typeof e.id !== 'string' || typeof e.actorId !== 'string' || !Number.isFinite(e.at)) return fail('audit ledger contains malformed entry');
    this.state = { schemaVersion: 1, protectedInvariantDigest: BASELINE_DIGEST, active: clone(raw.active as ConstitutionRevision),
      revisions: clone(raw.revisions as ConstitutionRevision[]), proposals: clone(raw.proposals as ConstitutionProposal[]), auditEvents: clone(raw.auditEvents as ConstitutionAuditEvent[]) };
    this.restoreState = { ok: true, reason: 'snapshot-and-protected-baseline-verified', checkedAt: Date.now() };
    return true;
  }

  private requireProposal(id: string): ConstitutionProposal {
    const p = this.state.proposals.find(item => item.id === text(id, 'proposalId', 120));
    if (!p) throw new Error('proposal not found'); return p;
  }
  private makeRevision(rules: ConstitutionRule[], parentVersion: string, rollbackOf: string | null, at: number): ConstitutionRevision {
    const revision = this.state.active.revision + 1;
    const value = { version: `1.${revision}.0`, revision, createdAt: at, parentVersion, rollbackOf, rules };
    return { ...value, digest: revisionDigest(value) };
  }
  private event(type: ConstitutionAuditEvent['type'], actorId: string, proposalId: string | null, fromVersion: string, toVersion: string | null, summary: string, evidenceRefs: string[], at: number): void {
    this.state.auditEvents = [...this.state.auditEvents, { id: `constitution-event-${randomUUID()}`, at, type, actorId, proposalId, fromVersion, toVersion, summary, evidenceRefs }].slice(-512);
  }
}
