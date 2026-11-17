export type OmeStroResearchRole =
  | 'discoverer' | 'theorist' | 'experimentalist' | 'replicator'
  | 'skeptic' | 'auditor' | 'safety';
export type ReviewPosition = 'accept' | 'reject' | 'challenge';

const safeText = (value: unknown, max = 240): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const unique = (values: unknown, max = 64): string[] => {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values.slice(0, max)) {
    const normalized = safeText(value, 240);
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
};
const finite01 = (value: unknown): number =>
  Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

export interface GenomeModule {
  id: string;
  dependsOn: string[];
  contractRef: string;
}
export interface DevelopmentalGenome {
  version: number;
  modules: GenomeModule[];
  invariants: string[];
}
export interface GenomeCandidate {
  candidateId: string;
  branchRef: string;
  baseVersion: number;
  targetVersion: number;
  modules: GenomeModule[];
  invariants: string[];
  migrationRef: string;
  testRefs: string[];
  rollbackRef: string;
}
export interface GenomeValidation {
  eligible: boolean;
  blockers: string[];
  topologicalOrder: string[];
  addedModules: string[];
  removedModules: string[];
}
export function validateDevelopmentalGenome(
  base: DevelopmentalGenome,
  candidate: GenomeCandidate,
): GenomeValidation {
  const blockers: string[] = [];
  const baseModules = Array.isArray(base?.modules) ? base.modules : [];
  const modules = Array.isArray(candidate?.modules) ? candidate.modules.slice(0, 256) : [];
  const ids = new Set<string>();
  const byId = new Map<string, GenomeModule>();
  if (!safeText(candidate?.candidateId, 160)) blockers.push('candidate-id-required');
  if (!/^((aspect|candidate)\/)[a-z0-9._/-]+$/i.test(safeText(candidate?.branchRef, 180))) blockers.push('isolated-candidate-branch-required');
  if (!Number.isSafeInteger(candidate?.baseVersion) || candidate.baseVersion !== base?.version) blockers.push('base-version-mismatch');
  if (!Number.isSafeInteger(candidate?.targetVersion) || candidate.targetVersion <= candidate.baseVersion) blockers.push('target-version-must-advance');
  if (!safeText(candidate?.migrationRef, 240)) blockers.push('migration-required');
  if (!safeText(candidate?.rollbackRef, 240)) blockers.push('rollback-required');
  if (!unique(candidate?.testRefs).length) blockers.push('verification-tests-required');
  for (const module of modules) {
    const id = safeText(module?.id, 160);
    if (!id || ids.has(id)) blockers.push('duplicate-or-invalid-module:' + id);
    if (!safeText(module?.contractRef, 240)) blockers.push('module-contract-missing:' + id);
    ids.add(id);
    if (id) byId.set(id, module);
  }
  for (const module of modules) {
    for (const dependency of unique(module.dependsOn, 256)) {
      if (!ids.has(dependency)) blockers.push('missing-dependency:' + module.id + ':' + dependency);
    }
  }
  const baseInvariantSet = new Set(unique(base?.invariants, 256));
  const candidateInvariantSet = new Set(unique(candidate?.invariants, 256));
  for (const invariant of baseInvariantSet) {
    if (!candidateInvariantSet.has(invariant)) blockers.push('immutable-invariant-removed:' + invariant);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) { blockers.push('dependency-cycle:' + id); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const module = byId.get(id);
    for (const dependency of unique(module?.dependsOn, 256)) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const id of [...ids].sort()) visit(id);
  const baseIds = new Set(baseModules.map(module => module.id));
  const candidateIds = new Set(modules.map(module => module.id));
  return {
    eligible: blockers.length === 0,
    blockers: [...new Set(blockers)],
    topologicalOrder: order,
    addedModules: [...candidateIds].filter(id => !baseIds.has(id)).sort(),
    removedModules: [...baseIds].filter(id => !candidateIds.has(id)).sort(),
  };
}

export interface WorldForgeTask {
  taskId: string;
  taskFingerprint: string;
  split: 'train' | 'validation' | 'holdout';
  seed: number;
  environmentFingerprint: string;
  perturbationId: string;
}
export interface WorldForgeManifest {
  version: 1;
  tasks: WorldForgeTask[];
  splitFingerprints: Record<'train' | 'validation' | 'holdout', string[]>;
  holdoutLocked: true;
}
export function buildWorldForgeManifest(tasks: WorldForgeTask[]): {
  accepted: boolean; manifest: WorldForgeManifest | null; blockers: string[];
} {
  const blockers: string[] = [];
  const input = Array.isArray(tasks) ? tasks.slice(0, 10_000) : [];
  if (!input.length) blockers.push('tasks-required');
  const taskIds = new Set<string>();
  const fingerprintToSplit = new Map<string, string>();
  const fingerprints = { train: new Set<string>(), validation: new Set<string>(), holdout: new Set<string>() };
  for (const task of input) {
    if (!safeText(task?.taskId, 160) || !safeText(task?.taskFingerprint, 160) ||
        !safeText(task?.environmentFingerprint, 160) || !safeText(task?.perturbationId, 120) ||
        !Number.isSafeInteger(task?.seed) || task.seed < 0 ||
        !['train', 'validation', 'holdout'].includes(task?.split)) {
      blockers.push('invalid-task:' + safeText(task?.taskId, 160));
      continue;
    }
    if (taskIds.has(task.taskId)) blockers.push('duplicate-task-id:' + task.taskId);
    taskIds.add(task.taskId);
    const previousSplit = fingerprintToSplit.get(task.taskFingerprint);
    if (previousSplit && previousSplit !== task.split) blockers.push('cross-split-fingerprint-leakage:' + task.taskFingerprint);
    fingerprintToSplit.set(task.taskFingerprint, task.split);
    fingerprints[task.split].add(task.taskFingerprint);
  }
  for (const split of ['train', 'validation', 'holdout'] as const) {
    if (!fingerprints[split].size) blockers.push('missing-split:' + split);
  }
  const manifest = blockers.length ? null : {
    version: 1 as const,
    tasks: structuredClone(input),
    splitFingerprints: {
      train: [...fingerprints.train].sort(),
      validation: [...fingerprints.validation].sort(),
      holdout: [...fingerprints.holdout].sort(),
    },
    holdoutLocked: true as const,
  };
  return { accepted: blockers.length === 0, manifest, blockers: [...new Set(blockers)] };
}

export interface ParliamentReview {
  role: OmeStroResearchRole;
  actorId: string;
  position: ReviewPosition;
  evidenceRefs: string[];
  independentOf?: string | null;
}
export function adjudicateCognitiveParliament(input: {
  candidateAuthorId: string;
  reviews: ParliamentReview[];
  holdoutPassed: boolean;
  replicationPassed: boolean;
  safetyPassed: boolean;
  auditPassed: boolean;
}): {
  status: 'promotable' | 'rejected' | 'needs-evidence';
  blockers: string[];
  roleCoverage: OmeStroResearchRole[];
} {
  const required: OmeStroResearchRole[] = ['discoverer', 'theorist', 'experimentalist', 'replicator', 'skeptic', 'auditor', 'safety'];
  const reviews = Array.isArray(input?.reviews) ? input.reviews : [];
  const blockers: string[] = [];
  const byRole = new Map<OmeStroResearchRole, ParliamentReview>();
  for (const review of reviews) {
    if (!required.includes(review.role) || byRole.has(review.role)) blockers.push('duplicate-or-unknown-role:' + review.role);
    if (!safeText(review.actorId, 120) || !['accept', 'reject', 'challenge'].includes(review.position) ||
        !unique(review.evidenceRefs).length) blockers.push('review-evidence-invalid:' + review.role);
    byRole.set(review.role, review);
  }
  for (const role of required) if (!byRole.has(role)) blockers.push('missing-role:' + role);
  const reviewerIds = required.map(role => byRole.get(role)?.actorId).filter((value): value is string => !!value);
  if (new Set(reviewerIds).size !== reviewerIds.length || reviewerIds.includes(input.candidateAuthorId)) {
    blockers.push('research-roles-must-use-distinct-independent-actors');
  }
  const experimentalist = byRole.get('experimentalist');
  const replicator = byRole.get('replicator');
  const auditor = byRole.get('auditor');
  const safety = byRole.get('safety');
  if (replicator?.actorId === experimentalist?.actorId ||
      replicator?.actorId === input.candidateAuthorId ||
      replicator?.independentOf !== input.candidateAuthorId) blockers.push('replicator-not-independent');
  if (auditor?.actorId === input.candidateAuthorId) blockers.push('auditor-not-independent');
  if (input.holdoutPassed !== true) blockers.push('holdout-not-passed');
  if (input.replicationPassed !== true) blockers.push('independent-replication-not-passed');
  if (input.safetyPassed !== true || safety?.position !== 'accept') blockers.push('safety-gate-not-passed');
  if (input.auditPassed !== true || auditor?.position !== 'accept') blockers.push('audit-gate-not-passed');
  if (reviews.some(review => review.position === 'reject' && (review.role === 'safety' || review.role === 'auditor'))) {
    return { status: 'rejected', blockers: [...new Set(blockers)], roleCoverage: [...byRole.keys()] };
  }
  if (reviews.some(review => review.position === 'challenge')) blockers.push('unresolved-skeptical-challenge');
  const status = blockers.length === 0 ? 'promotable' : 'needs-evidence';
  return { status, blockers: [...new Set(blockers)], roleCoverage: required.filter(role => byRole.has(role)) };
}

export type InventionStage =
  | 'idea' | 'hypothesis' | 'prototype' | 'preregistered'
  | 'validation' | 'holdout' | 'replicated' | 'accepted' | 'rejected';
export interface InventionEvidence {
  stage: InventionStage;
  authorId: string;
  hypothesisRef?: string;
  prototypeRef?: string;
  protocolRef?: string;
  holdoutFingerprint?: string;
  validationPassed?: boolean;
  holdoutPassed?: boolean;
  replicationPassed?: boolean;
  safetyPassed?: boolean;
  replicatorId?: string;
  baselineScore01?: number;
  candidateScore01?: number;
  effectThreshold01?: number;
}
export function advanceInventionLoop(evidence: InventionEvidence): {
  accepted: boolean; nextStage: InventionStage; blockers: string[];
} {
  const blockers: string[] = [];
  const stage = evidence?.stage;
  const requireRef = (value: unknown, name: string) => { if (!safeText(value, 240)) blockers.push(name + '-required'); };
  if (!safeText(evidence?.authorId, 120)) blockers.push('author-required');
  if (stage === 'idea') requireRef(evidence.hypothesisRef, 'hypothesis');
  if (stage === 'hypothesis') requireRef(evidence.prototypeRef, 'prototype');
  if (stage === 'prototype') {
    requireRef(evidence.protocolRef, 'preregistered-protocol');
    requireRef(evidence.holdoutFingerprint, 'locked-holdout-fingerprint');
  }
  if (stage === 'preregistered' && evidence.validationPassed !== true) blockers.push('validation-not-passed');
  if (stage === 'validation' && evidence.holdoutPassed !== true) blockers.push('holdout-not-passed');
  if (stage === 'holdout') {
    requireRef(evidence.replicatorId, 'independent-replicator');
    if (evidence.replicatorId === evidence.authorId) blockers.push('replicator-must-differ-from-author');
    if (evidence.replicationPassed !== true) blockers.push('replication-not-passed');
  }
  if (stage === 'replicated') {
    if (evidence.safetyPassed !== true) blockers.push('safety-not-passed');
    const baseline = Number(evidence.baselineScore01);
    const candidate = Number(evidence.candidateScore01);
    const threshold = finite01(evidence.effectThreshold01);
    if (!Number.isFinite(baseline) || !Number.isFinite(candidate) || candidate - baseline < threshold) blockers.push('measured-benefit-below-preregistered-threshold');
  }
  const transitions: Record<InventionStage, InventionStage> = {
    idea: 'hypothesis', hypothesis: 'prototype', prototype: 'preregistered',
    preregistered: 'validation', validation: 'holdout', holdout: 'replicated',
    replicated: 'accepted', accepted: 'accepted', rejected: 'rejected',
  };
  const nextStage = blockers.length ? stage : transitions[stage];
  return { accepted: blockers.length === 0, nextStage, blockers };
}

export function assessNeuroForgeIntake(input: {
  sourceId: string;
  sourceFingerprint: string;
  license: string;
  sbomFingerprint: string;
  architectureMapRef: string;
  sandboxEvidenceRef: string;
  testsPassed: boolean;
  legalReviewApproved?: boolean;
}): { eligible: boolean; blockers: string[]; licenseClass: 'permissive' | 'review-required' | 'unknown' } {
  const license = safeText(input?.license, 80);
  const permissive = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);
  const reviewRequired = new Set(['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'Proprietary']);
  const licenseClass = permissive.has(license) ? 'permissive' : reviewRequired.has(license) ? 'review-required' : 'unknown';
  const blockers: string[] = [];
  for (const [key, value] of Object.entries({
    sourceId: input?.sourceId, sourceFingerprint: input?.sourceFingerprint,
    sbomFingerprint: input?.sbomFingerprint, architectureMapRef: input?.architectureMapRef,
    sandboxEvidenceRef: input?.sandboxEvidenceRef,
  })) if (!safeText(value, 240)) blockers.push(key + '-required');
  if (licenseClass === 'unknown') blockers.push('license-not-cleared');
  if (licenseClass === 'review-required' && input.legalReviewApproved !== true) blockers.push('legal-review-required');
  if (input.testsPassed !== true) blockers.push('sandbox-tests-not-passed');
  return { eligible: blockers.length === 0, blockers, licenseClass };
}

export function rankMechanismAnalogies(source: {
  mechanisms: string[]; flows: string[]; constraints: string[];
}, candidates: Array<{
  id: string; domain: string; mechanisms: string[]; flows: string[]; constraints: string[];
}>): Array<{ id: string; domain: string; similarity01: number; sharedMechanisms: string[]; hypothesisOnly: true }> {
  const overlap = (left: string[], right: string[]) => {
    const a = new Set(unique(left, 128).map(value => value.toLowerCase()));
    const b = new Set(unique(right, 128).map(value => value.toLowerCase()));
    const shared = [...a].filter(value => b.has(value));
    const denominator = new Set([...a, ...b]).size || 1;
    return { score: shared.length / denominator, shared };
  };
  return (Array.isArray(candidates) ? candidates : []).map(candidate => {
    const mechanisms = overlap(source.mechanisms, candidate.mechanisms);
    const flows = overlap(source.flows, candidate.flows);
    const constraints = overlap(source.constraints, candidate.constraints);
    return {
      id: safeText(candidate.id, 160), domain: safeText(candidate.domain, 120),
      similarity01: finite01(mechanisms.score * 0.5 + flows.score * 0.3 + constraints.score * 0.2),
      sharedMechanisms: mechanisms.shared, hypothesisOnly: true as const,
    };
  }).filter(item => item.id).sort((a, b) => b.similarity01 - a.similarity01 || a.id.localeCompare(b.id));
}

export function createSharedFuture(input: {
  id: string;
  assumptions: string[];
  scenarios: Array<{ id: string; probability01: number; dependencyIds: string[]; pointOfNoReturn?: boolean }>;
  revisitTriggers: string[];
}): { valid: boolean; blockers: string[]; pointOfNoReturnIds: string[]; scenarioOrder: string[] } {
  const blockers: string[] = [];
  if (!safeText(input?.id, 160)) blockers.push('future-id-required');
  if (!unique(input?.assumptions).length) blockers.push('assumptions-required');
  if (!unique(input?.revisitTriggers).length) blockers.push('revisit-trigger-required');
  const scenarios = Array.isArray(input?.scenarios) ? input.scenarios.slice(0, 128) : [];
  const ids = new Set<string>();
  const byId = new Map<string, { id: string; probability01: number; dependencyIds: string[]; pointOfNoReturn?: boolean }>();
  if (!scenarios.length) blockers.push('scenarios-required');
  for (const scenario of scenarios) {
    const id = safeText(scenario?.id, 160);
    if (!id || ids.has(id) || !Number.isFinite(scenario?.probability01) ||
        scenario.probability01 < 0 || scenario.probability01 > 1) blockers.push('invalid-or-duplicate-scenario:' + id);
    if (id) {
      ids.add(id);
      byId.set(id, scenario);
    }
  }
  for (const scenario of scenarios) {
    for (const dependency of unique(scenario.dependencyIds)) {
      if (!ids.has(dependency)) blockers.push('unknown-scenario-dependency:' + dependency);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const scenarioOrder: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) { blockers.push('scenario-dependency-cycle:' + id); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const scenario = byId.get(id);
    for (const dependency of unique(scenario?.dependencyIds)) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    scenarioOrder.push(id);
  };
  for (const id of [...ids].sort()) visit(id);
  return {
    valid: blockers.length === 0, blockers: [...new Set(blockers)],
    pointOfNoReturnIds: scenarios.filter(scenario => scenario.pointOfNoReturn === true).map(scenario => scenario.id),
    scenarioOrder,
  };
}

export function createDyadicTaskLink(input: {
  taskId: string;
  humanPrincipal: string;
  organismPrincipal: string;
  scopes: string[];
  userConsent: boolean;
  sharePrivateEpisodes?: boolean;
}): { accepted: boolean; blockers: string[]; link: null | {
  taskId: string; humanPrincipal: string; organismPrincipal: string;
  scopes: string[]; sharedMemoryPolicy: 'task-context-only';
} } {
  const blockers: string[] = [];
  if (!safeText(input?.taskId, 160)) blockers.push('task-id-required');
  if (!safeText(input?.humanPrincipal, 120) || !safeText(input?.organismPrincipal, 120) ||
      input.humanPrincipal === input.organismPrincipal) blockers.push('separate-principals-required');
  if (input.userConsent !== true) blockers.push('explicit-user-consent-required');
  const scopes = unique(input?.scopes);
  if (!scopes.length) blockers.push('explicit-scope-required');
  if (input.sharePrivateEpisodes === true) blockers.push('private-episode-sharing-disabled-by-default');
  if (blockers.length) return { accepted: false, blockers, link: null };
  return {
    accepted: true, blockers: [],
    link: {
      taskId: input.taskId, humanPrincipal: input.humanPrincipal, organismPrincipal: input.organismPrincipal,
      scopes, sharedMemoryPolicy: 'task-context-only',
    },
  };
}

export function validateSynapticCommonsArtifact(input: {
  artifactId: string;
  artifactFingerprint: string;
  artifactType: 'skill-contract' | 'tool-schema' | 'adapter-manifest' | 'test-suite';
  licenseRef: string;
  contractRef: string;
  testRef: string;
  sandboxPassed: boolean;
  containsPersonalEpisodes: boolean;
  containsCredentials: boolean;
}): { shareable: boolean; blockers: string[] } {
  const blockers: string[] = [];
  for (const [key, value] of Object.entries({
    artifactId: input?.artifactId, artifactFingerprint: input?.artifactFingerprint,
    licenseRef: input?.licenseRef, contractRef: input?.contractRef, testRef: input?.testRef,
  })) if (!safeText(value, 240)) blockers.push(key + '-required');
  if (!['skill-contract', 'tool-schema', 'adapter-manifest', 'test-suite'].includes(input?.artifactType)) blockers.push('artifact-type-not-allowlisted');
  if (input.sandboxPassed !== true) blockers.push('sandbox-verification-required');
  if (input.containsPersonalEpisodes !== false) blockers.push('personal-episodes-excluded');
  if (input.containsCredentials !== false) blockers.push('credentials-excluded');
  return { shareable: blockers.length === 0, blockers };
}

export function compareDevelopmentalForks(input: {
  baselineEnvironmentFingerprint: string;
  forks: Array<{
    candidateId: string; branchRef: string; environmentFingerprint: string;
    independentEvaluation: boolean; safetyPassed: boolean; rollbackRef: string;
    quality01: number; cost01: number; reliability01: number;
  }>;
}): { eligibleCandidates: string[]; rejected: Array<{ candidateId: string; blockers: string[] }> } {
  const eligibleCandidates: string[] = [];
  const rejected: Array<{ candidateId: string; blockers: string[] }> = [];
  for (const fork of Array.isArray(input?.forks) ? input.forks : []) {
    const blockers: string[] = [];
    if (!safeText(fork.candidateId, 160)) blockers.push('candidate-id-required');
    if (!/^((aspect|candidate)\/)[a-z0-9._/-]+$/i.test(safeText(fork.branchRef, 180))) blockers.push('isolated-branch-required');
    if (fork.environmentFingerprint !== input.baselineEnvironmentFingerprint) blockers.push('environment-mismatch');
    if (fork.independentEvaluation !== true) blockers.push('independent-evaluation-required');
    if (fork.safetyPassed !== true) blockers.push('safety-not-passed');
    if (!safeText(fork.rollbackRef, 240)) blockers.push('rollback-required');
    for (const metric of [fork.quality01, fork.cost01, fork.reliability01]) if (!Number.isFinite(metric) || metric < 0 || metric > 1) blockers.push('invalid-comparison-metric');
    if (blockers.length) rejected.push({ candidateId: fork.candidateId, blockers: [...new Set(blockers)] });
    else eligibleCandidates.push(fork.candidateId);
  }
  return { eligibleCandidates, rejected };
}
