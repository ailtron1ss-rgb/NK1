import { createHash, randomUUID } from 'node:crypto';
import type { ActionGateway } from '../../system/ActionGateway.ts';
import { createAuthenticatedConstitutionReviewVerifier, parseTrustedConstitutionReviewKeys, type ConstitutionReviewVerifier } from './ConstitutionReviewAuthority.ts';

export const CONSTITUTION_EVOLUTION_SCHEMA = 1 as const;
export const MUTABLE_CONSTITUTION_DOMAINS = Object.freeze(['workflow', 'quality', 'performance', 'resource', 'operations'] as const);
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

export const CONSTITUTION_RATIFICATION_TOOL = 'nk1.system.constitution.ratify';
export const CONSTITUTION_ROLLBACK_TOOL = 'nk1.system.constitution.rollback';
export const CONSTITUTION_APPROVAL_DECISION_PREFIX = 'nk1:constitution:';

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
export interface ConstitutionRevision { version: string; revision: number; createdAt: number; parentVersion: string | null; rollbackOf: string | null; rules: ConstitutionRule[]; digest: string; }
export interface ConstitutionApprovalReceipt { approverId: string; approvalRef: string; candidateDigest: string; at: number; signature: string; }
export interface ConstitutionProposal {
  id: string; authorId: string; submittedAt: number; baseVersion: string; change: ConstitutionChange; targetRuleId: string | null;
  proposedRule: ConstitutionRuleInput | null; motivation: string; scope: string; counterexample: string;
  riskAssessment: ConstitutionRiskAssessment; testPlan: string[]; candidateDigest: string; status: ProposalStatus;
  reviews: Array<ConstitutionReviewInput & { at: number; attestationMac: string }>; approvalRequestId: string | null;
  approval: ConstitutionApprovalReceipt | null; appliedVersion: string | null; rejectionReason: string | null;
}
export interface ConstitutionAuditEvent {
  id: string; at: number;
  type: 'proposal.submitted' | 'proposal.reviewed' | 'proposal.ratification-requested' | 'proposal.ratified'
    | 'proposal.rejected' | 'proposal.stale' | 'constitution.activated' | 'constitution.rollback-requested' | 'constitution.rollback';
  actorId: string; proposalId: string | null; fromVersion: string; toVersion: string | null;
  summary: string; evidenceRefs: string[]; previousDigest: string; digest: string;
}
export interface ConstitutionEvolutionSnapshot {
  schemaVersion: 1; protectedInvariantDigest: string; auditAnchorDigest: string; active: ConstitutionRevision;
  revisions: ConstitutionRevision[]; proposals: ConstitutionProposal[]; auditEvents: ConstitutionAuditEvent[];
  integrityMac: string | null;
}
export interface ConstitutionRatificationRequest { proposalId: string; candidateDigest: string; approvalRequestId: string; expiresAt: number; toolId: string; }
export interface ConstitutionRollbackRequest { fromVersion: string; targetVersion: string; reason: string; approvalRequestId: string; expiresAt: number; toolId: string; }

const ZERO_DIGEST = '0'.repeat(64);
const MIN_SIGNING_KEY_BYTES = 32;
const MAX_RULES = 128;
const MAX_REVISIONS = 32;
const MAX_PROPOSALS = 64;
const MAX_REVIEWS_PER_PROPOSAL = 4;
const MAX_EVIDENCE_REFS_PER_REVIEW = 12;
const MAX_AUDIT_EVIDENCE_REFS = MAX_REVIEWS_PER_PROPOSAL * MAX_EVIDENCE_REFS_PER_REVIEW + 1;
const MAX_AUDIT_EVENTS = 256;
const stable = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
};
const hash = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex');
const clone = <T>(v: T): T => structuredClone(v);
const required = (v: unknown, name: string, max = 1600): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(name + ' must be non-empty and <= ' + max);
  return v.trim();
};
const weakensCore = (s: string) => {
  const verbs = '(?:disable|bypass|remove|weaken|circumvent|override|ignore|suppress|evade)';
  const nouns = '(?:safety|security|privacy|consent|law|legal|provenance|audit|invariant|user authority|human approval|rollback)';
  return new RegExp(verbs + '.{0,80}' + nouns + '|' + nouns + '.{0,80}' + verbs, 'i').test(s);
};
const ruleInput = (v: ConstitutionRuleInput): ConstitutionRuleInput => {
  if (!v || !MUTABLE_CONSTITUTION_DOMAINS.includes(v.domain)) throw new Error('constitution domain is protected');
  const id = required(v.id, 'rule.id', 96).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{2,95}$/.test(id) || id.startsWith('core.')) throw new Error('rule id must be a stable non-core identifier');
  const r = { id, title: required(v.title, 'rule.title', 120), statement: required(v.statement, 'rule.statement', 1200), domain: v.domain, scope: required(v.scope, 'rule.scope', 400) };
  if (weakensCore(stable(r))) throw new Error('proposal appears to weaken a protected invariant');
  return r;
};
const revisionDigest = (r: Omit<ConstitutionRevision, 'digest'>) => hash({
  version:r.version, revision:r.revision, createdAt:r.createdAt, parentVersion:r.parentVersion,
  rollbackOf:r.rollbackOf, rules:r.rules, protected:hash(PROTECTED_CONSTITUTIONAL_INVARIANTS),
});
type ProposalCore = Pick<ConstitutionProposal, 'authorId'|'baseVersion'|'change'|'targetRuleId'|'proposedRule'|'motivation'|'scope'|'counterexample'|'riskAssessment'|'testPlan'>;
const proposalDigest = (p: ProposalCore) => hash({ ...p, protected:hash(PROTECTED_CONSTITUTIONAL_INVARIANTS) });
const baseRevision = (): ConstitutionRevision => {
  const r = { version:'1.0.0', revision:0, createdAt:0, parentVersion:null, rollbackOf:null, rules:[] as ConstitutionRule[] };
  return { ...r, digest:revisionDigest(r) };
};
type ConstitutionEvolutionState = Omit<ConstitutionEvolutionSnapshot,'integrityMac'>;
const defaults = (): ConstitutionEvolutionState => {
  const active = baseRevision();
  return { schemaVersion:1, protectedInvariantDigest:hash(PROTECTED_CONSTITUTIONAL_INVARIANTS), auditAnchorDigest:ZERO_DIGEST,
    active, revisions:[active], proposals:[], auditEvents:[] };
};
const isRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const validRevision = (v: unknown): v is ConstitutionRevision => {
  const versionMatch = isRecord(v) ? String(v.version).match(/^1\.(\d+)\.0$/) : null;
  if (!isRecord(v) || !Array.isArray(v.rules) || !versionMatch || Number(versionMatch[1]) !== v.revision
    || !Number.isInteger(v.revision) || !Number.isFinite(v.createdAt) || v.createdAt < 0) return false;
  try {
    if (v.rules.length > MAX_RULES || new Set(v.rules.map((r: ConstitutionRule) => r.id)).size !== v.rules.length) return false;
    for (const r of v.rules) {
      const normalized = ruleInput(r);
      if (normalized.id !== r.id || typeof r.enabled !== 'boolean' || !Number.isFinite(r.createdAt) || r.createdAt < 0
        || !Number.isFinite(r.updatedAt) || r.updatedAt < r.createdAt
        || !(r.retiredAt === null || (Number.isFinite(r.retiredAt) && r.retiredAt >= r.updatedAt))
        || (r.enabled && r.retiredAt !== null) || (!r.enabled && r.retiredAt === null)) return false;
    }
    const core = { version:v.version, revision:v.revision, createdAt:v.createdAt, parentVersion:v.parentVersion, rollbackOf:v.rollbackOf, rules:v.rules };
    return v.digest === revisionDigest(core);
  } catch { return false; }
};
const proposalCore = (p: ConstitutionProposal): ProposalCore => ({
  authorId:p.authorId, baseVersion:p.baseVersion, change:p.change, targetRuleId:p.targetRuleId, proposedRule:p.proposedRule,
  motivation:p.motivation, scope:p.scope, counterexample:p.counterexample, riskAssessment:p.riskAssessment, testPlan:p.testPlan,
});
const reviewCore = (proposalId: string, candidateDigest: string, review: ConstitutionReviewInput & { at: number }) => ({
  kind:'constitution.review.v1', proposalId, candidateDigest, reviewerId:review.reviewerId, decision:review.decision,
  invariantsPassed:review.invariantsPassed, tests:review.tests, evidenceRefs:review.evidenceRefs, rationale:review.rationale, at:review.at,
});
const approvalCore = (proposalId: string, approval: Omit<ConstitutionApprovalReceipt,'signature'>) => ({
  kind:'constitution.ratification.v1', proposalId, approverId:approval.approverId, approvalRef:approval.approvalRef,
  candidateDigest:approval.candidateDigest, at:approval.at,
});
const auditCore = (event: ConstitutionAuditEvent) => {
  const { digest:_digest, ...core } = event;
  return core;
};
const verifyHexMac = (actual: unknown, expected: string): boolean => {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  let mismatch = 0;
  for (let index=0;index<64;index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
};
type ApprovalTicketGateway = Pick<ActionGateway,'requestToolApproval'|'consumeDirectActionApproval'>;

export class ConstitutionEvolutionEngine {
  private state = defaults();
  private restoreState = { ok:true, reason:'compiled-baseline', checkedAt:0 };
  private readonly signingKey: string | Uint8Array | null;
  private readonly reviewVerifier: ConstitutionReviewVerifier;
  private snapshotCache: ConstitutionEvolutionSnapshot | null = null;

  constructor(options: { signingKey?: string | Uint8Array | null; reviewVerifier?: ConstitutionReviewVerifier } = {}) {
    const configured = options.signingKey ?? process.env.NEURO_CONSTITUTION_HMAC_KEY ?? null;
    const keyLength = typeof configured === 'string' ? Buffer.byteLength(configured, 'utf8')
      : configured instanceof Uint8Array ? configured.byteLength : 0;
    this.signingKey = keyLength >= MIN_SIGNING_KEY_BYTES ? configured : null;
    this.reviewVerifier = options.reviewVerifier ?? createAuthenticatedConstitutionReviewVerifier(
      parseTrustedConstitutionReviewKeys(process.env.NEURO_CONSTITUTION_REVIEW_KEYS_JSON),
    );
  }

  private requireSigningKey(): void {
    if (!this.signingKey) throw new Error('constitution host HMAC signing key is unavailable; mutation is fail-closed');
  }
  private mac(value: unknown): string {
    this.requireSigningKey();
    const keyBytes = typeof this.signingKey === 'string' ? Buffer.from(this.signingKey,'utf8') : Buffer.from(this.signingKey!);
    const normalizedKey = keyBytes.length > 64 ? createHash('sha256').update(keyBytes).digest() : keyBytes;
    const innerPad = new Uint8Array(64), outerPad = new Uint8Array(64);
    for (let index=0;index<64;index++) {
      const byte=normalizedKey[index] ?? 0;
      innerPad[index]=byte ^ 0x36;
      outerPad[index]=byte ^ 0x5c;
    }
    const message=stable(value);
    const inner=createHash('sha256').update(innerPad).update(message).digest();
    return createHash('sha256').update(outerPad).update(inner).digest('hex');
  }
  private approvalOptions(decisionId: string) { return { decisionId, autonomous:false }; }

  snapshot(): ConstitutionEvolutionSnapshot {
    if (this.snapshotCache) return clone(this.snapshotCache);
    const body = clone(this.state);
    this.snapshotCache = { ...body, integrityMac:this.signingKey ? this.mac(body) : null };
    return clone(this.snapshotCache);
  }
  private invalidateSnapshot(): void { this.snapshotCache = null; }
  activeConstitution(): ConstitutionRevision { return clone(this.state.active); }
  protectedInvariants() { return clone(PROTECTED_CONSTITUTIONAL_INVARIANTS); }
  listProposals(limit=50): ConstitutionProposal[] { return clone(this.state.proposals.slice(-Math.max(1,Math.min(MAX_PROPOSALS,limit))).reverse()); }
  listAuditEvents(limit=100): ConstitutionAuditEvent[] { return clone(this.state.auditEvents.slice(-Math.max(1,Math.min(MAX_AUDIT_EVENTS,limit))).reverse()); }
  diagnostics() {
    return { activeVersion:this.state.active.version, activeDigest:this.state.active.digest, protectedInvariantDigest:this.state.protectedInvariantDigest,
      mutableRuleCount:this.state.active.rules.filter(r=>r.enabled).length,
      pendingProposalCount:this.state.proposals.filter(p=>['pending-review','awaiting-ratification','ratified'].includes(p.status)).length,
      revisionCount:this.state.revisions.length, auditEventCount:this.state.auditEvents.length,
      signedState:Boolean(this.signingKey), lastRestore:clone(this.restoreState) };
  }

  propose(input: ConstitutionProposalInput): ConstitutionProposal {
    this.requireSigningKey();
    const authorId = required(input.authorId,'authorId',160);
    if (input.baseVersion !== this.state.active.version) throw new Error('proposal base version is stale');
    if (!['add','amend','retire'].includes(input.change)) throw new Error('unsupported constitutional change');
    const motivation = required(input.motivation,'motivation');
    const scope = required(input.scope,'scope',600);
    const counterexample = required(input.counterexample,'counterexample');
    if (!input.riskAssessment || !['low','medium','high','critical'].includes(input.riskAssessment.level)) throw new Error('risk level is invalid');
    const riskAssessment = { level:input.riskAssessment.level, summary:required(input.riskAssessment.summary,'risk summary',1200),
      mitigations:Array.isArray(input.riskAssessment.mitigations) ? input.riskAssessment.mitigations.map(v=>required(v,'mitigation',500)) : [] };
    if (!riskAssessment.mitigations.length || riskAssessment.mitigations.length>12) throw new Error('at least one mitigation is required');
    if (!Array.isArray(input.testPlan) || input.testPlan.length<1 || input.testPlan.length>20) throw new Error('test plan must contain 1..20 tests');
    const testPlan = input.testPlan.map(v=>required(v,'test plan item',300));
    const targetRuleId = input.targetRuleId ? required(input.targetRuleId,'targetRuleId',96).toLowerCase() : null;
    const proposedRule = input.change==='retire' ? null : ruleInput(input.proposedRule as ConstitutionRuleInput);
    const existing = targetRuleId ? this.state.active.rules.find(r=>r.id===targetRuleId && r.enabled) : undefined;
    if (input.change==='add') {
      if (targetRuleId || this.state.revisions.some(v=>v.rules.some(r=>r.id===proposedRule!.id))) throw new Error('rule id already has lineage or add target is invalid');
    } else {
      if (!targetRuleId || !existing) throw new Error('amend/retire target must be active and mutable');
      if (input.change==='amend' && (proposedRule!.id!==targetRuleId || proposedRule!.domain!==existing.domain)) throw new Error('amend must preserve rule id and domain');
    }
    if (weakensCore([motivation,scope,counterexample,riskAssessment.summary,...riskAssessment.mitigations,...testPlan].join('\n'))) throw new Error('proposal appears to weaken a protected invariant');
    if (this.state.proposals.filter(p=>p.authorId===authorId && ['pending-review','awaiting-ratification','ratified'].includes(p.status)).length>=8) throw new Error('author proposal limit reached');
    if (this.state.proposals.length>=MAX_PROPOSALS) {
      const i=this.state.proposals.findIndex(p=>['applied','rejected','stale'].includes(p.status));
      if (i<0) throw new Error('proposal ledger full'); this.state.proposals.splice(i,1); this.invalidateSnapshot();
    }
    const core: ProposalCore = { authorId,baseVersion:input.baseVersion,change:input.change,targetRuleId,proposedRule,motivation,scope,counterexample,riskAssessment,testPlan };
    const proposalId=input.id ? required(input.id,'proposal id',120) : 'constitution-'+randomUUID();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(proposalId)) throw new Error('proposal id must be URL-safe and use only letters, digits, dot, underscore, colon, or hyphen');
    const p: ConstitutionProposal = { id:proposalId, ...core,
      submittedAt:Number.isFinite(input.submittedAt)?Number(input.submittedAt):Date.now(), candidateDigest:proposalDigest(core),
      status:'pending-review', reviews:[], approvalRequestId:null, approval:null, appliedVersion:null, rejectionReason:null };
    if (this.state.proposals.some(v=>v.id===p.id)) throw new Error('proposal id already exists');
    this.state.proposals.push(p);
    this.event('proposal.submitted',authorId,p.id,p.baseVersion,null,'constitutional change proposed',[],p.submittedAt);
    return clone(p);
  }

  review(id:string,artifact:unknown):ConstitutionProposal {
    this.requireSigningKey();
    const p=this.requireProposal(id);
    if (p.status!=='pending-review') throw new Error('proposal is not accepting reviews');
    const input=this.reviewVerifier(artifact,{
      proposalId:p.id,candidateDigest:p.candidateDigest,authorId:p.authorId,testPlanCount:p.testPlan.length,
    });
    if (!input) throw new Error('constitution review requires a fresh trusted Ed25519 signature bound to this proposal');
    const reviewerId=required(input.reviewerId,'reviewerId',160);
    if (p.reviews.some(r=>r.reviewerId===reviewerId)) throw new Error('reviewer already submitted an attestation');
    if (p.reviews.length >= MAX_REVIEWS_PER_PROPOSAL) throw new Error('proposal reviewer limit reached');
    const evidenceRefs=input.evidenceRefs.map(v=>required(v,'evidence ref',500));
    const rationale=required(input.rationale,'review rationale',1200);
    const at=input.at;
    if (input.decision==='reject') { p.status='rejected'; p.rejectionReason=rationale; }
    const review = { ...input,reviewerId,evidenceRefs,rationale,at };
    const signed = { ...review, attestationMac:this.mac(reviewCore(p.id,p.candidateDigest,review)) };
    p.reviews.push(signed);
    const approvals=p.reviews.filter(r=>r.decision==='approve').length;
    const quorum=['high','critical'].includes(p.riskAssessment.level)?2:1;
    if (input.decision==='approve' && approvals>=quorum) p.status='awaiting-ratification';
    this.event(input.decision==='reject'?'proposal.rejected':'proposal.reviewed',reviewerId,p.id,p.baseVersion,null,rationale,evidenceRefs,at);
    return clone(p);
  }

  async requestRatification(id:string,gateway:ApprovalTicketGateway):Promise<ConstitutionRatificationRequest> {
    this.requireSigningKey();
    const p=this.requireProposal(id);
    if (p.status!=='awaiting-ratification') throw new Error('independent review quorum has not completed');
    const decisionId=CONSTITUTION_APPROVAL_DECISION_PREFIX+p.id;
    const input={proposalId:p.id,candidateDigest:p.candidateDigest};
    const request=await gateway.requestToolApproval(CONSTITUTION_RATIFICATION_TOOL,input,'Ratify constitutional revision '+p.id,this.approvalOptions(decisionId),'direct');
    const ticket=request?.request;
    if (!ticket?.id || ticket.status!=='pending' || !Number.isFinite(ticket.expiresAt)) {
      const failureReason = request && 'failureReason' in request && typeof request.failureReason === 'string'
        ? request.failureReason : null;
      throw new Error('ActionGateway did not create a ratification ticket' +
        (failureReason ? ': ' + failureReason : ''));
    }
    p.approvalRequestId=ticket.id;
    this.event('proposal.ratification-requested',p.authorId,p.id,p.baseVersion,null,'one-shot ratification requested',[ticket.id],Date.now());
    return { proposalId:p.id,candidateDigest:p.candidateDigest,approvalRequestId:ticket.id,expiresAt:ticket.expiresAt,toolId:CONSTITUTION_RATIFICATION_TOOL };
  }

  async ratify(id:string,input:{approvalId:string},gateway:ApprovalTicketGateway):Promise<ConstitutionProposal> {
    this.requireSigningKey();
    const p=this.requireProposal(id);
    if (p.status!=='awaiting-ratification' || !p.approvalRequestId) throw new Error('proposal is not awaiting a ratification ticket');
    const approvalId=required(input?.approvalId,'approvalId',160);
    if (approvalId!==p.approvalRequestId) throw new Error('ratification ticket does not match the pending proposal');
    const decisionId=CONSTITUTION_APPROVAL_DECISION_PREFIX+p.id;
    const consumed=await gateway.consumeDirectActionApproval(CONSTITUTION_RATIFICATION_TOOL,
      {proposalId:p.id,candidateDigest:p.candidateDigest},approvalId,this.approvalOptions(decisionId),'direct');
    if (!consumed.ok || consumed.approvalId!==approvalId || !consumed.actor) throw new Error(consumed.reason??'ActionGateway ratification ticket was not consumed');
    const at=Number.isFinite(consumed.consumedAt)?Number(consumed.consumedAt):Date.now();
    const approvalCoreValue = { approverId:required(consumed.actor,'authenticated approval actor',160),approvalRef:approvalId,candidateDigest:p.candidateDigest,at };
    p.approval={...approvalCoreValue,signature:this.mac(approvalCore(p.id,approvalCoreValue))};
    p.approvalRequestId=null;
    p.status='ratified';
    this.event('proposal.ratified',approvalCoreValue.approverId,p.id,p.baseVersion,null,'constitution ratified by one-shot host approval',[approvalId],at);
    return clone(p);
  }

  activate(id:string,at=Date.now()):ConstitutionRevision {
    this.requireSigningKey();
    const p=this.requireProposal(id);
    if (p.status!=='ratified' || !p.approval) throw new Error('proposal must be reviewed and ratified before activation');
    if (p.baseVersion!==this.state.active.version) {
      p.status='stale'; p.rejectionReason='base version changed';
      this.event('proposal.stale','constitution-engine',p.id,p.baseVersion,null,'proposal base version changed before activation',[],Date.now());
      throw new Error('proposal is stale');
    }
    const rules=clone(this.state.active.rules);
    if (p.change==='add') rules.push({ ...p.proposedRule!,enabled:true,createdAt:at,updatedAt:at,retiredAt:null });
    else {
      const i=rules.findIndex(r=>r.id===p.targetRuleId && r.enabled);
      if (i<0) throw new Error('mutable rule no longer exists');
      rules[i]=p.change==='retire'?{ ...rules[i],enabled:false,updatedAt:at,retiredAt:at }:{ ...p.proposedRule!,enabled:true,createdAt:rules[i].createdAt,updatedAt:at,retiredAt:null };
    }
    if (rules.length>MAX_RULES) throw new Error('mutable rule capacity reached');
    const revision=this.makeRevision(rules,this.state.active.version,null,at);
    this.state.active=revision; this.state.revisions=[...this.state.revisions,revision].slice(-MAX_REVISIONS);
    p.status='applied'; p.appliedVersion=revision.version;
    this.event('constitution.activated',p.approval.approverId,p.id,p.baseVersion,revision.version,'activated '+revision.version,
      [...p.reviews.flatMap(r=>r.evidenceRefs),p.approval.approvalRef],at);
    return clone(revision);
  }

  async requestRollbackApproval(targetVersion:string,reason:string,gateway:ApprovalTicketGateway):Promise<ConstitutionRollbackRequest> {
    this.requireSigningKey();
    targetVersion=required(targetVersion,'targetVersion',40); reason=required(reason,'rollback reason',1200);
    if (targetVersion===this.state.active.version) throw new Error('target is already active');
    if (!this.state.revisions.some(r=>r.version===targetVersion)) throw new Error('rollback target is not retained');
    const fromVersion=this.state.active.version;
    const decisionId=CONSTITUTION_APPROVAL_DECISION_PREFIX+'rollback:'+fromVersion+':'+targetVersion;
    const payload={fromVersion,targetVersion,reason};
    const request=await gateway.requestToolApproval(CONSTITUTION_ROLLBACK_TOOL,payload,'Rollback constitutional revision '+fromVersion+' to '+targetVersion,this.approvalOptions(decisionId),'direct');
    const ticket=request?.request;
    if (!ticket?.id || ticket.status!=='pending' || !Number.isFinite(ticket.expiresAt)) throw new Error('ActionGateway did not create a rollback ticket');
    this.event('constitution.rollback-requested','host-requester',null,fromVersion,null,'one-shot rollback requested',[ticket.id],Date.now());
    return {fromVersion,targetVersion,reason,approvalRequestId:ticket.id,expiresAt:ticket.expiresAt,toolId:CONSTITUTION_ROLLBACK_TOOL};
  }

  async rollbackWithApproval(input:{targetVersion:string;reason:string;approvalId:string},gateway:ApprovalTicketGateway):Promise<ConstitutionRevision> {
    this.requireSigningKey();
    const targetVersion=required(input.targetVersion,'targetVersion',40),reason=required(input.reason,'rollback reason',1200);
    const approvalId=required(input.approvalId,'approvalId',160);
    if (targetVersion===this.state.active.version) throw new Error('target already active');
    const target=this.state.revisions.find(r=>r.version===targetVersion);
    if (!target) throw new Error('rollback target not retained');
    const from=this.state.active.version;
    const decisionId=CONSTITUTION_APPROVAL_DECISION_PREFIX+'rollback:'+from+':'+targetVersion;
    const payload={fromVersion:from,targetVersion,reason};
    const consumed=await gateway.consumeDirectActionApproval(CONSTITUTION_ROLLBACK_TOOL,payload,approvalId,this.approvalOptions(decisionId),'direct');
    if (!consumed.ok || consumed.approvalId!==approvalId || !consumed.actor) throw new Error(consumed.reason??'ActionGateway rollback ticket was not consumed');
    const at=Number.isFinite(consumed.consumedAt)?Number(consumed.consumedAt):Date.now();
    const revision=this.makeRevision(clone(target.rules),from,targetVersion,at);
    this.state.active=revision; this.state.revisions=[...this.state.revisions,revision].slice(-MAX_REVISIONS);
    this.event('constitution.rollback',required(consumed.actor,'authenticated rollback actor',160),null,from,revision.version,'rollback to '+targetVersion+': '+reason,[approvalId],at);
    return clone(revision);
  }

  restore(raw:unknown):boolean {
    const fail=(reason:string) => { this.state=defaults(); this.invalidateSnapshot(); this.restoreState={ok:false,reason,checkedAt:Date.now()}; return false; };
    try {
      if (raw===null || raw===undefined) { this.state=defaults(); this.invalidateSnapshot(); this.restoreState={ok:true,reason:'compiled-baseline-loaded',checkedAt:Date.now()}; return true; }
      if (!isRecord(raw) || raw.schemaVersion!==1 || raw.protectedInvariantDigest!==hash(PROTECTED_CONSTITUTIONAL_INVARIANTS)
        || typeof raw.auditAnchorDigest!=='string' || !/^[a-f0-9]{64}$/.test(raw.auditAnchorDigest)) return fail('schema or protected invariant digest mismatch');
      const { integrityMac:_integrityMac, ...body }=raw;
      if (!this.signingKey) {
        const baseline=defaults();
        if (raw.integrityMac!==null || raw.active?.digest!==baseline.active.digest || raw.revisions?.length!==1
          || raw.proposals?.length!==0 || raw.auditEvents?.length!==0 || raw.auditAnchorDigest!==ZERO_DIGEST) return fail('host signing key unavailable for non-baseline state');
      } else if (!verifyHexMac(raw.integrityMac,this.mac(body))) return fail('host HMAC snapshot authentication failed');
      if (!validRevision(raw.active) || !Array.isArray(raw.revisions) || raw.revisions.length<1 || raw.revisions.length>MAX_REVISIONS
        || !raw.revisions.every(validRevision)) return fail('revision integrity validation failed');
      const revisions=raw.revisions as ConstitutionRevision[];
      for (let index=1;index<revisions.length;index++) {
        const prior=revisions[index-1], current=revisions[index];
        if (current.parentVersion!==prior.version || current.revision!==prior.revision+1) return fail('revision parent lineage is inconsistent');
      }
      const lastRevision=revisions.at(-1);
      if (!lastRevision || lastRevision.version!==raw.active.version || lastRevision.digest!==raw.active.digest) return fail('active revision is not the history tip');
      if (!Array.isArray(raw.proposals) || raw.proposals.length>MAX_PROPOSALS || !Array.isArray(raw.auditEvents) || raw.auditEvents.length>MAX_AUDIT_EVENTS) return fail('snapshot bounds invalid');
      for (const p of raw.proposals as ConstitutionProposal[]) {
        if (!isRecord(p) || typeof p.id!=='string' || typeof p.authorId!=='string' || !Array.isArray(p.reviews)
          || p.reviews.length>MAX_REVIEWS_PER_PROPOSAL || !Array.isArray(p.testPlan) || p.testPlan.length<1 || p.testPlan.length>20
          || !p.riskAssessment || !Array.isArray(p.riskAssessment.mitigations) || p.riskAssessment.mitigations.length<1
          || p.riskAssessment.mitigations.length>12
          || !['pending-review','awaiting-ratification','ratified','applied','rejected','stale'].includes(p.status)
          || p.candidateDigest!==proposalDigest(proposalCore(p))) return fail('proposal integrity validation failed');
        if (['ratified','applied'].includes(p.status) && !p.approval) return fail('ratified proposal has no approval receipt');
        if (p.status==='applied' && (typeof p.appliedVersion!=='string' || !/^1\.\d+\.0$/.test(p.appliedVersion))) return fail('applied proposal version is invalid');
        for (const review of p.reviews) {
          if (!isRecord(review) || !Array.isArray(review.evidenceRefs) || review.evidenceRefs.length<1
            || review.evidenceRefs.length>MAX_EVIDENCE_REFS_PER_REVIEW
            || review.attestationMac!==this.mac(reviewCore(p.id,p.candidateDigest,review))) return fail('review attestation failed');
        }
        if (p.approval && (!isRecord(p.approval) || p.approval.signature!==this.mac(approvalCore(p.id,{
          approverId:p.approval.approverId,approvalRef:p.approval.approvalRef,candidateDigest:p.approval.candidateDigest,at:p.approval.at,
        })))) return fail('ratification attestation failed');
      }
      let previous=raw.auditAnchorDigest as string;
      for (const event of raw.auditEvents as ConstitutionAuditEvent[]) {
        if (!isRecord(event) || typeof event.id!=='string' || typeof event.actorId!=='string' || !Number.isFinite(event.at)
          || event.previousDigest!==previous || event.digest!==this.mac(auditCore(event))) return fail('append-only audit chain validation failed');
        previous=event.digest;
      }
      this.state={schemaVersion:1,protectedInvariantDigest:hash(PROTECTED_CONSTITUTIONAL_INVARIANTS),auditAnchorDigest:raw.auditAnchorDigest,
        active:clone(raw.active as ConstitutionRevision),revisions:clone(revisions),proposals:clone(raw.proposals as ConstitutionProposal[]),
        auditEvents:clone(raw.auditEvents as ConstitutionAuditEvent[])};
      this.invalidateSnapshot();
      this.restoreState={ok:true,reason:this.signingKey?'host-HMAC-and-audit-chain-verified':'compiled-baseline-verified',checkedAt:Date.now()};
      return true;
    } catch {
      return fail('snapshot validation raised an exception');
    }
  }

  private requireProposal(id:string):ConstitutionProposal {
    const p=this.state.proposals.find(item=>item.id===required(id,'proposalId',120));
    if (!p) throw new Error('proposal not found'); return p;
  }
  private makeRevision(rules:ConstitutionRule[],parentVersion:string,rollbackOf:string|null,at:number):ConstitutionRevision {
    const revision=this.state.active.revision+1;
    const value={version:'1.'+revision+'.0',revision,createdAt:at,parentVersion,rollbackOf,rules};
    return { ...value,digest:revisionDigest(value) };
  }
  private event(type:ConstitutionAuditEvent['type'],actorId:string,proposalId:string|null,fromVersion:string,toVersion:string|null,
    summary:string,evidenceRefs:string[],at:number):void {
    this.requireSigningKey();
    const previousDigest=this.state.auditEvents.at(-1)?.digest ?? this.state.auditAnchorDigest;
    const core={id:'constitution-event-'+randomUUID(),at,type,actorId:String(actorId).slice(0,160),proposalId,fromVersion,toVersion,
      summary:String(summary).slice(0,1200),evidenceRefs:evidenceRefs.slice(0,MAX_AUDIT_EVIDENCE_REFS).map(ref=>String(ref).slice(0,500)),previousDigest};
    const event={...core,digest:this.mac(core)};
    this.state.auditEvents=[...this.state.auditEvents,event];
    if(this.state.auditEvents.length>MAX_AUDIT_EVENTS) {
      const dropped=this.state.auditEvents.shift()!;
      this.state.auditAnchorDigest=dropped.digest;
    }
    this.invalidateSnapshot();
  }
}
