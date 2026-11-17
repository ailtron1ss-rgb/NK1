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

const stable = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
};
const hash = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex');
const BASELINE_DIGEST = hash(PROTECTED_CONSTITUTIONAL_INVARIANTS);
const clone = <T>(v: T): T => structuredClone(v);
const required = (v: unknown, name: string, max = 1600): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(name + ' must be non-empty and <= ' + max);
  return v.trim();
};
const weakensCore = (s: string) => {
  const v = '(?:disable|bypass|remove|weaken|circumvent|override|ignore|suppress|evade)';
  const n = '(?:safety|security|privacy|consent|law|legal|provenance|audit|invariant|user authority|human approval|rollback)';
  return new RegExp(v + '.{0,80}' + n + '|' + n + '.{0,80}' + v, 'i').test(s);
};
const ruleInput = (v: ConstitutionRuleInput): ConstitutionRuleInput => {
  if (!v || !MUTABLE_CONSTITUTION_DOMAINS.includes(v.domain)) throw new Error('constitution domain is protected');
  const id = required(v.id, 'rule.id', 96).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{2,95}$/.test(id) || id.startsWith('core.')) throw new Error('rule id must be a stable non-core identifier');
  const r = { id, title: required(v.title, 'rule.title', 120), statement: required(v.statement, 'rule.statement', 1200), domain: v.domain, scope: required(v.scope, 'rule.scope', 400) };
  if (weakensCore(stable(r))) throw new Error('proposal appears to weaken a protected invariant');
  return r;
};
const revisionDigest = (r: Omit<ConstitutionRevision, 'digest'>) => hash({ version:r.version, revision:r.revision, createdAt:r.createdAt, parentVersion:r.parentVersion, rollbackOf:r.rollbackOf, rules:r.rules, protected:BASELINE_DIGEST });
type ProposalCore = Pick<ConstitutionProposal, 'authorId'|'baseVersion'|'change'|'targetRuleId'|'proposedRule'|'motivation'|'scope'|'counterexample'|'riskAssessment'|'testPlan'>;
const proposalDigest = (p: ProposalCore) => hash({ ...p, protected:BASELINE_DIGEST });
const baseRevision = (): ConstitutionRevision => {
  const r = { version:'1.0.0', revision:0, createdAt:0, parentVersion:null, rollbackOf:null, rules:[] as ConstitutionRule[] };
  return { ...r, digest:revisionDigest(r) };
};
const defaults = (): ConstitutionEvolutionSnapshot => {
  const active = baseRevision();
  return { schemaVersion:1, protectedInvariantDigest:BASELINE_DIGEST, active, revisions:[active], proposals:[], auditEvents:[] };
};
const isRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const validRevision = (v: unknown): v is ConstitutionRevision => {
  if (!isRecord(v) || !Array.isArray(v.rules) || !/^1\.\d+\.0$/.test(String(v.version)) || !Number.isInteger(v.revision) || !Number.isFinite(v.createdAt)) return false;
  try {
    if (v.rules.length > 256 || new Set(v.rules.map((r: ConstitutionRule) => r.id)).size !== v.rules.length) return false;
    for (const r of v.rules) {
      const normalized = ruleInput(r);
      if (normalized.id !== r.id || typeof r.enabled !== 'boolean' || !Number.isFinite(r.createdAt) || !Number.isFinite(r.updatedAt) || !(r.retiredAt === null || Number.isFinite(r.retiredAt))) return false;
    }
    const core = { version:v.version, revision:v.revision, createdAt:v.createdAt, parentVersion:v.parentVersion, rollbackOf:v.rollbackOf, rules:v.rules };
    return v.digest === revisionDigest(core);
  } catch { return false; }
};
const coreOf = (p: ConstitutionProposal): ProposalCore => ({
  authorId:p.authorId, baseVersion:p.baseVersion, change:p.change, targetRuleId:p.targetRuleId, proposedRule:p.proposedRule,
  motivation:p.motivation, scope:p.scope, counterexample:p.counterexample, riskAssessment:p.riskAssessment, testPlan:p.testPlan,
});

/** A versioned governance ledger. P69 remains the final, immutable runtime arbiter. */
export class ConstitutionEvolutionEngine {
  private state = defaults();
  private restoreState = { ok:true, reason:'compiled-baseline', checkedAt:0 };

  snapshot(): ConstitutionEvolutionSnapshot { return clone(this.state); }
  activeConstitution(): ConstitutionRevision { return clone(this.state.active); }
  protectedInvariants() { return clone(PROTECTED_CONSTITUTIONAL_INVARIANTS); }
  listProposals(limit=50): ConstitutionProposal[] { return clone(this.state.proposals.slice(-Math.max(1,Math.min(128,limit))).reverse()); }
  listAuditEvents(limit=100): ConstitutionAuditEvent[] { return clone(this.state.auditEvents.slice(-Math.max(1,Math.min(512,limit))).reverse()); }
  diagnostics() {
    return { activeVersion:this.state.active.version, activeDigest:this.state.active.digest, protectedInvariantDigest:BASELINE_DIGEST,
      mutableRuleCount:this.state.active.rules.filter(r=>r.enabled).length,
      pendingProposalCount:this.state.proposals.filter(p=>['pending-review','awaiting-ratification','ratified'].includes(p.status)).length,
      revisionCount:this.state.revisions.length, auditEventCount:this.state.auditEvents.length, lastRestore:clone(this.restoreState) };
  }

  propose(input: ConstitutionProposalInput): ConstitutionProposal {
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
    if (this.state.proposals.length>=128) {
      const i=this.state.proposals.findIndex(p=>['applied','rejected','stale'].includes(p.status));
      if (i<0) throw new Error('proposal ledger full'); this.state.proposals.splice(i,1);
    }
    const core: ProposalCore = { authorId,baseVersion:input.baseVersion,change:input.change,targetRuleId,proposedRule,motivation,scope,counterexample,riskAssessment,testPlan };
    const p: ConstitutionProposal = { id:input.id ? required(input.id,'proposal id',120) : 'constitution-'+randomUUID(), ...core,
      submittedAt:Number.isFinite(input.submittedAt)?Number(input.submittedAt):Date.now(), candidateDigest:proposalDigest(core),
      status:'pending-review', reviews:[], approval:null, appliedVersion:null, rejectionReason:null };
    if (this.state.proposals.some(v=>v.id===p.id)) throw new Error('proposal id already exists');
    this.state.proposals.push(p); this.event('proposal.submitted',authorId,p.id,p.baseVersion,null,'constitutional change proposed',[],p.submittedAt);
    return clone(p);
  }

  review(id:string,input:ConstitutionReviewInput):ConstitutionProposal {
    const p=this.requireProposal(id);
    if (!['approve','reject'].includes(input.decision)) throw new Error('unsupported review decision');
    if (p.status!=='pending-review') throw new Error('proposal is not accepting reviews');
    const reviewerId=required(input.reviewerId,'reviewerId',160);
    if (reviewerId===p.authorId) throw new Error('proposal author cannot review their own change');
    if (p.reviews.some(r=>r.reviewerId===reviewerId)) throw new Error('reviewer already submitted an attestation');
    if (input.candidateDigest!==p.candidateDigest) throw new Error('review digest mismatch');
    const e=input.tests;
    if (!e || ![e.planned,e.executed,e.passed,e.failed,e.holdoutCases].every(n=>Number.isInteger(n)&&n>=0)
      || e.planned!==p.testPlan.length || e.executed>e.planned || e.passed>e.executed || e.failed>e.executed || e.passed+e.failed>e.executed) throw new Error('test evidence is inconsistent');
    const evidenceRefs=Array.isArray(input.evidenceRefs)?input.evidenceRefs.map(v=>required(v,'evidence ref',500)):[];
    if (!evidenceRefs.length || evidenceRefs.length>20) throw new Error('validation evidence refs are required');
    const rationale=required(input.rationale,'review rationale',1200);
    if (input.decision==='approve' && (input.invariantsPassed!==true || e.executed!==e.planned || e.passed!==e.planned || e.failed!==0 || e.holdoutCases<1 || e.holdoutPassed!==true)) throw new Error('tests, holdout and invariant checks must pass');
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    if (input.decision==='reject') { p.status='rejected'; p.rejectionReason=rationale; }
    p.reviews.push({ ...input,reviewerId,evidenceRefs,rationale,at });
    const approvals=p.reviews.filter(r=>r.decision==='approve').length;
    const quorum=['high','critical'].includes(p.riskAssessment.level)?2:1;
    if (input.decision==='approve' && approvals>=quorum) p.status='awaiting-ratification';
    this.event(input.decision==='reject'?'proposal.rejected':'proposal.reviewed',reviewerId,p.id,p.baseVersion,null,rationale,evidenceRefs,at);
    return clone(p);
  }

  ratify(id:string,input:ConstitutionApprovalInput):ConstitutionProposal {
    const p=this.requireProposal(id);
    if (p.status!=='awaiting-ratification') throw new Error('independent review quorum has not completed');
    const approverId=required(input.approverId,'approverId',160);
    if (approverId===p.authorId || p.reviews.some(r=>r.reviewerId===approverId)) throw new Error('approver must be separate from author and reviewers');
    if (input.explicitHumanApproval!==true || input.candidateDigest!==p.candidateDigest) throw new Error('explicit digest-bound human approval is required');
    p.approval={ ...input,approverId,approvalRef:required(input.approvalRef,'approvalRef',500),rationale:required(input.rationale,'approval rationale',1200),at:Number.isFinite(input.at)?Number(input.at):Date.now() };
    p.status='ratified';
    this.event('proposal.ratified',approverId,p.id,p.baseVersion,null,p.approval.rationale,[p.approval.approvalRef],p.approval.at!);
    return clone(p);
  }

  activate(id:string,at=Date.now()):ConstitutionRevision {
    const p=this.requireProposal(id);
    if (p.status!=='ratified' || !p.approval) throw new Error('proposal must be reviewed and ratified before activation');
    if (p.baseVersion!==this.state.active.version) { p.status='stale'; p.rejectionReason='base version changed'; throw new Error('proposal is stale'); }
    const rules=clone(this.state.active.rules);
    if (p.change==='add') rules.push({ ...p.proposedRule!,enabled:true,createdAt:at,updatedAt:at,retiredAt:null });
    else {
      const i=rules.findIndex(r=>r.id===p.targetRuleId && r.enabled);
      if (i<0) throw new Error('mutable rule no longer exists');
      rules[i]=p.change==='retire'?{ ...rules[i],enabled:false,updatedAt:at,retiredAt:at }:{ ...p.proposedRule!,enabled:true,createdAt:rules[i].createdAt,updatedAt:at,retiredAt:null };
    }
    if (rules.length>256) throw new Error('mutable rule capacity reached');
    const revision=this.makeRevision(rules,this.state.active.version,null,at);
    this.state.active=revision; this.state.revisions=[...this.state.revisions,revision].slice(-64);
    p.status='applied'; p.appliedVersion=revision.version;
    this.event('constitution.activated',p.approval.approverId,p.id,p.baseVersion,revision.version,'activated '+revision.version,
      [...p.reviews.flatMap(r=>r.evidenceRefs),p.approval.approvalRef],at);
    return clone(revision);
  }

  rollbackApprovalDigest(targetVersion:string,reason:string):string {
    return hash({ operation:'constitution.rollback',fromVersion:this.state.active.version,targetVersion,reason:required(reason,'rollback reason',1200),protected:BASELINE_DIGEST });
  }
  rollback(input:ConstitutionRollbackInput):ConstitutionRevision {
    const targetVersion=required(input.targetVersion,'targetVersion',40), reason=required(input.reason,'rollback reason',1200);
    const approverId=required(input.approverId,'approverId',160), approvalRef=required(input.approvalRef,'approvalRef',500);
    if (input.explicitHumanApproval!==true || input.approvalDigest!==this.rollbackApprovalDigest(targetVersion,reason)) throw new Error('explicit digest-bound approval required');
    if (targetVersion===this.state.active.version) throw new Error('target already active');
    const target=this.state.revisions.find(r=>r.version===targetVersion);
    if (!target) throw new Error('rollback target not retained');
    const from=this.state.active.version, at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const revision=this.makeRevision(clone(target.rules),from,targetVersion,at);
    this.state.active=revision; this.state.revisions=[...this.state.revisions,revision].slice(-64);
    this.event('constitution.rollback',approverId,null,from,revision.version,'rollback to '+targetVersion+': '+reason,[approvalRef],at);
    return clone(revision);
  }

  restore(raw:unknown):boolean {
    const fail=(reason:string)=>{ this.state=defaults(); this.restoreState={ok:false,reason,checkedAt:Date.now()}; return false; };
    if (raw===null || raw===undefined) { this.state=defaults(); this.restoreState={ok:true,reason:'compiled-baseline-loaded',checkedAt:Date.now()}; return true; }
    if (!isRecord(raw) || raw.schemaVersion!==1 || raw.protectedInvariantDigest!==BASELINE_DIGEST) return fail('schema or protected invariant digest mismatch');
    if (!validRevision(raw.active) || !Array.isArray(raw.revisions) || raw.revisions.length<1 || raw.revisions.length>64 || !raw.revisions.every(validRevision)) return fail('revision integrity validation failed');
    if (!(raw.revisions as ConstitutionRevision[]).some(r=>r.version===raw.active.version && r.digest===raw.active.digest)) return fail('active revision is not anchored in history');
    if (!Array.isArray(raw.proposals) || raw.proposals.length>128 || !Array.isArray(raw.auditEvents) || raw.auditEvents.length>512) return fail('snapshot bounds invalid');
    for (const p of raw.proposals as ConstitutionProposal[]) {
      if (!isRecord(p) || typeof p.id!=='string' || typeof p.authorId!=='string' || !Array.isArray(p.reviews)
        || !['pending-review','awaiting-ratification','ratified','applied','rejected','stale'].includes(p.status)
        || p.candidateDigest!==proposalDigest(coreOf(p))) return fail('proposal integrity validation failed');
    }
    for (const e of raw.auditEvents as ConstitutionAuditEvent[]) if (!isRecord(e) || typeof e.id!=='string' || typeof e.actorId!=='string' || !Number.isFinite(e.at)) return fail('audit ledger invalid');
    this.state={schemaVersion:1,protectedInvariantDigest:BASELINE_DIGEST,active:clone(raw.active),revisions:clone(raw.revisions),
      proposals:clone(raw.proposals),auditEvents:clone(raw.auditEvents)};
    this.restoreState={ok:true,reason:'snapshot-and-protected-baseline-verified',checkedAt:Date.now()};
    return true;
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
  private event(type:ConstitutionAuditEvent['type'],actorId:string,proposalId:string|null,fromVersion:string,toVersion:string|null,summary:string,evidenceRefs:string[],at:number):void {
    this.state.auditEvents=[...this.state.auditEvents,{id:'constitution-event-'+randomUUID(),at,type,actorId,proposalId,fromVersion,toVersion,summary,evidenceRefs}].slice(-512);
  }
}
