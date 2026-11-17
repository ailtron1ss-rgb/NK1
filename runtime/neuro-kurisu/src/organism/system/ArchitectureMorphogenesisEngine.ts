import { createHash } from 'node:crypto';
import { buildCognitiveArchitectureSnapshot } from '../core/CognitiveArchitectureMap.ts';
import { buildDevelopmentalGenome } from './DevelopmentalGenome.ts';

export type ArchitectureEdgeKind = 'import' | 'contract' | 'data-flow';
export type ArchitectureAuthority = 'single-owner' | 'shared';

export interface ArchitectureMorphogenesisModule {
  id: string;
  path: string;
  owner: string;
  revisionSha256: string;
}

export interface ArchitectureMorphogenesisContract {
  id: string;
  ownerModuleId: string;
  consumerModuleIds: string[];
  authority: ArchitectureAuthority;
}

export interface ArchitectureMorphogenesisEdge {
  from: string;
  to: string;
  kind: ArchitectureEdgeKind;
}

export interface ArchitectureMorphogenesisGraph {
  schemaVersion: 1;
  canonicalGenomeDigest: string;
  modules: ArchitectureMorphogenesisModule[];
  contracts: ArchitectureMorphogenesisContract[];
  edges: ArchitectureMorphogenesisEdge[];
}

export type ArchitectureMorphogenesisOperation =
  | { kind: 'merge'; sourceModuleIds: string[]; targetModuleId: string; rationale: string }
  | { kind: 'split'; sourceModuleId: string; targetModuleIds: string[]; rationale: string }
  | { kind: 'move'; moduleId: string; fromPath: string; toPath: string; rationale: string }
  | { kind: 'replace'; moduleId: string; rationale: string };

export interface ArchitectureMigrationStep {
  id: string;
  description: string;
  verify: string;
}

export interface ArchitectureMigrationPlan {
  checkpoint: {
    id: string;
    baselineCommit: string;
    reference: string;
    description: string;
  };
  steps: ArchitectureMigrationStep[];
  rollbackSteps: ArchitectureMigrationStep[];
  affectedContractIds: string[];
}

export interface ArchitectureMorphogenesisIssue {
  code: string;
  path: string;
  message: string;
}

export interface ArchitectureMorphogenesisPlan {
  schemaVersion: 1;
  status: 'BLOCKED' | 'READY_FOR_REVIEW';
  activation: 'NOT_APPLIED';
  baselineCommit: string;
  candidateBranch: string;
  baselineGraph: ArchitectureMorphogenesisGraph;
  candidateGraph: ArchitectureMorphogenesisGraph;
  operations: ArchitectureMorphogenesisOperation[];
  migrationPlan: ArchitectureMigrationPlan;
  diff: {
    addedModuleIds: string[];
    removedModuleIds: string[];
    movedModuleIds: string[];
    replacedModuleIds: string[];
    changedContractIds: string[];
  };
  issues: ArchitectureMorphogenesisIssue[];
  planDigest: string;
}

export interface ArchitectureMorphogenesisEvidence {
  candidateCommit: string;
  baselineCommit: string;
  testsPassed: boolean;
  typecheckPassed: boolean;
  architectureAuditPassed: boolean;
  contractChecksPassed: boolean;
  rollbackVerified: boolean;
  reviewApproved: boolean;
}

export interface ArchitectureMorphogenesisGateReport {
  status: 'BLOCKED' | 'NEEDS_REVIEW' | 'ELIGIBLE_FOR_MANUAL_INTEGRATION';
  activation: 'NOT_APPLIED';
  mergeAllowed: false;
  planDigest: string;
  issues: ArchitectureMorphogenesisIssue[];
}

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const MODULE_ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
const CONTRACT_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MAX_MODULES = 512;
const MAX_CONTRACTS = 512;
const MAX_EDGES = 12000;
const MAX_STEPS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reject accessors, prototypes, cycles and non-JSON values before inspecting candidate data. */
function isPlainData(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 32 || seen.has(value)) return false;
  seen.add(value);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) return false;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
        if (!isPlainData(descriptor.value, seen, depth + 1)) return false;
      }
      for (const key of Reflect.ownKeys(descriptors)) {
        if (key === 'length' || (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key))) continue;
        return false;
      }
      return true;
    }
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') return false;
      const descriptor = descriptors[key];
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
      if (!isPlainData(descriptor.value, seen, depth + 1)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    seen.delete(value);
  }
}

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: string): string {
  return 'sha256:' + createHash('sha256').update(value).digest('hex');
}

export function computeArchitectureGraphDigest(graph: ArchitectureMorphogenesisGraph): string {
  if (!isPlainData(graph)) throw new TypeError('Architecture graph digest requires bounded plain data');
  return sha256(stableJson(graph));
}

function isCanonicalSourcePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 240 || !value.startsWith('src/organism/')) return false;
  if (value.includes('\\') || value.startsWith('/') || value.includes('//')) return false;
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return false;
  if (segments.some(segment => ['legacy', 'legacy-original', 'research', 'state'].includes(segment))) return false;
  return /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(value);
}

function structuralCycles(edges: ArchitectureMorphogenesisEdge[], known: Set<string>): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const id of known) adjacency.set(id, []);
  for (const edge of edges) {
    if (edge.kind === 'data-flow') continue;
    adjacency.get(edge.from)?.push(edge.to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const stack: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push(stack.slice(start).concat(id));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of known) visit(id);
  return cycles;
}

export function validateArchitectureMorphogenesisGraph(input: unknown): {
  ok: boolean;
  moduleCount: number;
  contractCount: number;
  edgeCount: number;
  issues: ArchitectureMorphogenesisIssue[];
} {
  const issues: ArchitectureMorphogenesisIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!isPlainData(input) || !isRecord(input)) {
    add('graph-untrusted-data', 'graph', 'Graph must contain bounded plain JSON data without getters, prototypes or cycles');
    return { ok: false, moduleCount: 0, contractCount: 0, edgeCount: 0, issues };
  }

  const graph = input as unknown as ArchitectureMorphogenesisGraph;
  if (graph.schemaVersion !== 1) add('schema-unsupported', 'schemaVersion', 'Only graph schema version 1 is supported');
  if (typeof graph.canonicalGenomeDigest !== 'string' || !SHA256.test(graph.canonicalGenomeDigest)) {
    add('genome-digest-invalid', 'canonicalGenomeDigest', 'A valid Developmental Genome SHA-256 digest is required');
  }
  if (!Array.isArray(graph.modules) || graph.modules.length === 0 || graph.modules.length > MAX_MODULES) {
    add('modules-invalid', 'modules', 'Modules must be a non-empty bounded array');
  }
  if (!Array.isArray(graph.contracts) || graph.contracts.length > MAX_CONTRACTS) {
    add('contracts-invalid', 'contracts', 'Contracts must be a bounded array');
  }
  if (!Array.isArray(graph.edges) || graph.edges.length > MAX_EDGES) {
    add('edges-invalid', 'edges', 'Edges must be a bounded array');
  }
  if (issues.length) return {
    ok: false,
    moduleCount: Array.isArray(graph.modules) ? graph.modules.length : 0,
    contractCount: Array.isArray(graph.contracts) ? graph.contracts.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
    issues,
  };

  const modules = graph.modules as ArchitectureMorphogenesisModule[];
  const contracts = graph.contracts as ArchitectureMorphogenesisContract[];
  const edges = graph.edges as ArchitectureMorphogenesisEdge[];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const [index, module] of modules.entries()) {
    const path = 'modules[' + index + ']';
    if (!isRecord(module) || typeof module.id !== 'string' || !MODULE_ID.test(module.id)) {
      add('module-id-invalid', path + '.id', 'Module id must be a bounded lowercase identifier');
      continue;
    }
    if (ids.has(module.id)) add('module-id-duplicate', path + '.id', 'Module ids must be unique');
    ids.add(module.id);
    if (!isCanonicalSourcePath(module.path)) add('module-path-forbidden', path + '.path', 'Module path must remain inside canonical src/organism and outside legacy, research and state');
    if (typeof module.path === 'string') {
      if (paths.has(module.path)) add('module-path-duplicate', path + '.path', 'Each module must have one unique canonical source path');
      paths.add(module.path);
    }
    if (typeof module.owner !== 'string' || !module.owner.trim() || module.owner.length > 256) {
      add('module-owner-invalid', path + '.owner', 'Every module needs one explicit bounded owner');
    }
    if (typeof module.revisionSha256 !== 'string' || !SHA256.test(module.revisionSha256)) {
      add('module-revision-invalid', path + '.revisionSha256', 'Module revision must be a SHA-256 digest');
    }
  }

  const contractIds = new Set<string>();
  for (const [index, contract] of contracts.entries()) {
    const path = 'contracts[' + index + ']';
    if (!isRecord(contract) || typeof contract.id !== 'string' || !CONTRACT_ID.test(contract.id)) {
      add('contract-id-invalid', path + '.id', 'Contract id must be a bounded identifier');
      continue;
    }
    if (contractIds.has(contract.id)) add('contract-id-duplicate', path + '.id', 'Contract ids must be unique');
    contractIds.add(contract.id);
    if (!ids.has(contract.ownerModuleId)) add('contract-owner-missing', path + '.ownerModuleId', 'Contract owner must reference a known module');
    if (contract.authority !== 'single-owner' && contract.authority !== 'shared') {
      add('contract-authority-invalid', path + '.authority', 'Contract authority must be single-owner or shared');
    }
    if (!Array.isArray(contract.consumerModuleIds)) {
      add('contract-consumers-invalid', path + '.consumerModuleIds', 'Contract consumers must be an array');
      continue;
    }
    const consumers = new Set<string>();
    for (const consumer of contract.consumerModuleIds) {
      if (typeof consumer !== 'string' || !ids.has(consumer)) add('contract-consumer-missing', path + '.consumerModuleIds', 'Every contract consumer must reference a known module');
      if (consumers.has(consumer)) add('contract-consumer-duplicate', path + '.consumerModuleIds', 'Contract consumers must be unique');
      consumers.add(consumer);
      if (consumer === contract.ownerModuleId) add('contract-self-consumption', path + '.consumerModuleIds', 'A contract owner cannot consume its own authority contract');
    }
  }

  const edgeKeys = new Set<string>();
  for (const [index, edge] of edges.entries()) {
    const path = 'edges[' + index + ']';
    if (!isRecord(edge) || !ids.has(edge.from) || !ids.has(edge.to)) {
      add('edge-endpoint-missing', path, 'Every edge endpoint must reference a known module');
      continue;
    }
    if (!['import', 'contract', 'data-flow'].includes(edge.kind)) {
      add('edge-kind-invalid', path + '.kind', 'Edge kind must be import, contract or data-flow');
      continue;
    }
    const key = edge.from + '|' + edge.to + '|' + edge.kind;
    if (edgeKeys.has(key)) add('edge-duplicate', path, 'Duplicate graph edges are not accepted');
    edgeKeys.add(key);
  }

  const contractEdges = new Set(edges.filter(edge => edge.kind === 'contract').map(edge => edge.from + '|' + edge.to));
  for (const contract of contracts) {
    for (const consumer of contract.consumerModuleIds ?? []) {
      if (!contractEdges.has(contract.ownerModuleId + '|' + consumer)) {
        add('contract-edge-missing', 'contracts.' + contract.id, 'Every declared contract consumer needs a matching owner-to-consumer edge');
      }
    }
  }
  for (const edge of edges) {
    if (edge.kind === 'contract' && !contracts.some(contract => contract.ownerModuleId === edge.from && contract.consumerModuleIds.includes(edge.to))) {
      add('contract-edge-unowned', 'edges', 'Every contract edge must be declared by an owner contract');
    }
  }

  const cycles = structuralCycles(edges, ids);
  for (const cycle of cycles) {
    add('structural-cycle', 'edges', 'Import/contract cycle: ' + cycle.join(' -> '));
  }
  return {
    ok: issues.length === 0,
    moduleCount: modules.length,
    contractCount: contracts.length,
    edgeCount: edges.length,
    issues,
  };
}

/** Build a read-only graph from the current cognitive architecture and genome contracts. */
export function buildLiveArchitectureMorphogenesisGraph(): ArchitectureMorphogenesisGraph {
  const architecture = buildCognitiveArchitectureSnapshot();
  const genome = buildDevelopmentalGenome();
  const usedPaths = new Set<string>();
  const modules = architecture.subsystems.map(subsystem => {
    const candidatePaths = subsystem.components
      .map(component => component.replace(/^runtime\/neuro-kurisu\//, ''))
      .filter(path => isCanonicalSourcePath(path));
    const selectedPath = candidatePaths.find(path => !usedPaths.has(path));
    if (!selectedPath) throw new Error('No unique canonical source component found for architecture subsystem: ' + subsystem.id);
    usedPaths.add(selectedPath);
    const revision = {
      id: subsystem.id,
      owner: subsystem.owner,
      layer: subsystem.layer,
      cadence: subsystem.cadence,
      components: subsystem.components,
      inputs: subsystem.inputs,
      outputs: subsystem.outputs,
      dependsOn: subsystem.dependsOn,
      purpose: subsystem.purpose,
    };
    return {
      id: subsystem.id,
      path: selectedPath,
      owner: subsystem.owner,
      revisionSha256: sha256(stableJson(revision)),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const ownerByAuthority: Record<string, string> = {
    'writable-organism-state': 'lifecycle',
    'writable-canonical-memory': 'memory',
    'final-action-decision': 'executive',
    'side-effect-execution': 'executive',
    'external-evidence': 'outcome-learning',
    'research-promotion': 'research',
  };
  const subsystemById = new Map(architecture.subsystems.map(subsystem => [subsystem.id, subsystem]));
  const contracts: ArchitectureMorphogenesisContract[] = architecture.authorities.map(authority => {
    const ownerModuleId = ownerByAuthority[authority.role];
    if (!ownerModuleId || !subsystemById.has(ownerModuleId)) {
      throw new Error('Unmapped canonical authority owner: ' + authority.role);
    }
    const consumerModuleIds = architecture.subsystems
      .filter(subsystem => subsystem.id !== ownerModuleId && subsystem.dependsOn.includes(ownerModuleId))
      .map(subsystem => subsystem.id)
      .sort();
    return { id: authority.role, ownerModuleId, consumerModuleIds, authority: 'single-owner' };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const edges: ArchitectureMorphogenesisEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (from: string, to: string, kind: ArchitectureEdgeKind) => {
    const key = from + '|' + to + '|' + kind;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, kind });
  };
  for (const subsystem of architecture.subsystems) {
    for (const dependency of subsystem.dependsOn) addEdge(dependency, subsystem.id, 'data-flow');
  }
  for (const flow of architecture.flows) addEdge(flow.from, flow.to, 'data-flow');
  for (const contract of contracts) {
    for (const consumer of contract.consumerModuleIds) addEdge(contract.ownerModuleId, consumer, 'contract');
  }
  edges.sort((a, b) => a.kind.localeCompare(b.kind) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return {
    schemaVersion: 1,
    canonicalGenomeDigest: genome.digest,
    modules,
    contracts,
    edges,
  };
}

function issue(code: string, path: string, message: string): ArchitectureMorphogenesisIssue {
  return { code, path, message };
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function operationModuleIds(operation: any): string[] {
  if (!isRecord(operation)) return [];
  if (operation.kind === 'merge') {
    return [...(Array.isArray(operation.sourceModuleIds) ? operation.sourceModuleIds : []), ...(typeof operation.targetModuleId === 'string' ? [operation.targetModuleId] : [])]
      .filter((id): id is string => typeof id === 'string');
  }
  if (operation.kind === 'split') {
    return [...(typeof operation.sourceModuleId === 'string' ? [operation.sourceModuleId] : []), ...(Array.isArray(operation.targetModuleIds) ? operation.targetModuleIds : [])]
      .filter((id): id is string => typeof id === 'string');
  }
  return typeof operation.moduleId === 'string' ? [operation.moduleId] : [];
}

function validStepList(value: unknown, path: string, issues: ArchitectureMorphogenesisIssue[]): value is ArchitectureMigrationStep[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STEPS) {
    issues.push(issue('migration-steps-invalid', path, 'At least one bounded migration/rollback step is required'));
    return false;
  }
  const ids = new Set<string>();
  for (const [index, step] of value.entries()) {
    if (!isRecord(step) || typeof step.id !== 'string' || !MODULE_ID.test(step.id)
      || typeof step.description !== 'string' || !step.description.trim() || step.description.length > 500
      || typeof step.verify !== 'string' || !step.verify.trim() || step.verify.length > 500) {
      issues.push(issue('migration-step-invalid', path + '[' + index + ']', 'Every step needs a bounded id, description and verification action'));
      continue;
    }
    if (ids.has(step.id)) issues.push(issue('migration-step-duplicate', path + '[' + index + '].id', 'Step ids must be unique within the list'));
    ids.add(step.id);
  }
  return true;
}

function planDigestPayload(plan: Omit<ArchitectureMorphogenesisPlan, 'planDigest'> | ArchitectureMorphogenesisPlan): unknown {
  const payload: Record<string, unknown> = { ...(plan as any) };
  delete payload.planDigest;
  return payload;
}

export function createArchitectureMorphogenesisPlan(input: {
  baselineCommit: string;
  candidateBranch: string;
  baselineGraph: ArchitectureMorphogenesisGraph;
  candidateGraph: ArchitectureMorphogenesisGraph;
  operations: ArchitectureMorphogenesisOperation[];
  migrationPlan: ArchitectureMigrationPlan;
}): ArchitectureMorphogenesisPlan {
  const issues: ArchitectureMorphogenesisIssue[] = [];
  const emptyGraph: ArchitectureMorphogenesisGraph = {
    schemaVersion: 1, canonicalGenomeDigest: '', modules: [], contracts: [], edges: [],
  };
  const blocked = (): ArchitectureMorphogenesisPlan => {
    const payload: Omit<ArchitectureMorphogenesisPlan, 'planDigest'> = {
      schemaVersion: 1,
      status: 'BLOCKED',
      activation: 'NOT_APPLIED',
      baselineCommit: '',
      candidateBranch: '',
      baselineGraph: emptyGraph,
      candidateGraph: emptyGraph,
      operations: [],
      migrationPlan: {
        checkpoint: { id: '', baselineCommit: '', reference: '', description: '' },
        steps: [], rollbackSteps: [], affectedContractIds: [],
      },
      diff: { addedModuleIds: [], removedModuleIds: [], movedModuleIds: [], replacedModuleIds: [], changedContractIds: [] },
      issues,
    };
    return { ...payload, planDigest: sha256(stableJson(payload)) };
  };

  if (!isPlainData(input) || !isRecord(input)) {
    issues.push(issue('proposal-untrusted-data', 'proposal', 'Proposal must be bounded plain JSON data without getters, prototypes or cycles'));
    return blocked();
  }
  if (!COMMIT_SHA.test(input.baselineCommit)) issues.push(issue('baseline-commit-invalid', 'baselineCommit', 'Baseline must be a full 40-character commit SHA'));
  if (typeof input.candidateBranch !== 'string' || !/^(aspect|feature)\/[a-z0-9][a-z0-9-]{2,100}$/.test(input.candidateBranch)) {
    issues.push(issue('candidate-branch-forbidden', 'candidateBranch', 'Candidate must use a dedicated aspect/ or feature/ branch'));
  }
  if (!Array.isArray(input.operations) || input.operations.length === 0 || input.operations.length > 64) {
    issues.push(issue('operations-invalid', 'operations', 'At least one bounded structural operation is required'));
  }
  const baselineReport = validateArchitectureMorphogenesisGraph(input.baselineGraph);
  const candidateReport = validateArchitectureMorphogenesisGraph(input.candidateGraph);
  for (const item of baselineReport.issues) issues.push(issue('baseline-' + item.code, item.path, item.message));
  for (const item of candidateReport.issues) issues.push(issue('candidate-' + item.code, item.path, item.message));

  if (baselineReport.ok && candidateReport.ok) {
    const baseline = input.baselineGraph;
    const candidate = input.candidateGraph;
    if (baseline.canonicalGenomeDigest !== candidate.canonicalGenomeDigest) {
      issues.push(issue('canonical-genome-changed', 'candidateGraph.canonicalGenomeDigest', 'A source morphogenesis proposal cannot rewrite the immutable Developmental Genome contract'));
    }

    const baseById = new Map(baseline.modules.map(module => [module.id, module]));
    const nextById = new Map(candidate.modules.map(module => [module.id, module]));
    const added = sortedUnique(candidate.modules.filter(module => !baseById.has(module.id)).map(module => module.id));
    const removed = sortedUnique(baseline.modules.filter(module => !nextById.has(module.id)).map(module => module.id));
    const moved = sortedUnique(baseline.modules.filter(module => {
      const next = nextById.get(module.id);
      return Boolean(next && next.path !== module.path);
    }).map(module => module.id));
    const replaced = sortedUnique(baseline.modules.filter(module => {
      const next = nextById.get(module.id);
      return Boolean(next && (next.revisionSha256 !== module.revisionSha256 || next.owner !== module.owner));
    }).map(module => module.id));

    const removedCoverage = new Set<string>();
    const addedCoverage = new Set<string>();
    const movedCoverage = new Set<string>();
    const replacedCoverage = new Set<string>();
    const operationKeys = new Set<string>();

    if (Array.isArray(input.operations)) for (const [index, operation] of input.operations.entries()) {
      const path = 'operations[' + index + ']';
      if (!isRecord(operation) || typeof operation.kind !== 'string' || typeof operation.rationale !== 'string' || !operation.rationale.trim() || operation.rationale.length > 500) {
        issues.push(issue('operation-invalid', path, 'Every operation requires a supported kind and a concrete bounded rationale'));
        continue;
      }
      const touched = operationModuleIds(operation as ArchitectureMorphogenesisOperation);
      for (const id of touched) {
        if (operationKeys.has(operation.kind + ':' + id)) issues.push(issue('operation-duplicate', path, 'The same module cannot be repeated in an operation of the same kind'));
        operationKeys.add(operation.kind + ':' + id);
      }
      if (operation.kind === 'merge') {
        const op = operation as Extract<ArchitectureMorphogenesisOperation, { kind: 'merge' }>;
        if (!Array.isArray(op.sourceModuleIds) || op.sourceModuleIds.length < 2 || new Set(op.sourceModuleIds).size !== op.sourceModuleIds.length
          || typeof op.targetModuleId !== 'string' || !nextById.has(op.targetModuleId) || op.sourceModuleIds.includes(op.targetModuleId)) {
          issues.push(issue('merge-shape-invalid', path, 'Merge requires at least two distinct baseline modules and one candidate target'));
          continue;
        }
        for (const source of op.sourceModuleIds) {
          if (!baseById.has(source) || nextById.has(source)) issues.push(issue('merge-source-mismatch', path, 'Every merge source must exist only in the baseline'));
          removedCoverage.add(source);
        }
        if (!baseById.has(op.targetModuleId)) addedCoverage.add(op.targetModuleId);
      } else if (operation.kind === 'split') {
        const op = operation as Extract<ArchitectureMorphogenesisOperation, { kind: 'split' }>;
        if (typeof op.sourceModuleId !== 'string' || !baseById.has(op.sourceModuleId) || nextById.has(op.sourceModuleId)
          || !Array.isArray(op.targetModuleIds) || op.targetModuleIds.length < 2 || new Set(op.targetModuleIds).size !== op.targetModuleIds.length) {
          issues.push(issue('split-shape-invalid', path, 'Split requires one removed baseline source and at least two distinct new candidate targets'));
          continue;
        }
        removedCoverage.add(op.sourceModuleId);
        for (const target of op.targetModuleIds) {
          if (!nextById.has(target) || baseById.has(target)) issues.push(issue('split-target-mismatch', path, 'Every split target must be a new candidate module'));
          addedCoverage.add(target);
        }
      } else if (operation.kind === 'move') {
        const op = operation as Extract<ArchitectureMorphogenesisOperation, { kind: 'move' }>;
        const before = baseById.get(op.moduleId);
        const after = nextById.get(op.moduleId);
        if (!before || !after || before.path !== op.fromPath || after.path !== op.toPath || before.path === after.path) {
          issues.push(issue('move-mismatch', path, 'Move must preserve module identity and match the exact old/new canonical paths'));
          continue;
        }
        movedCoverage.add(op.moduleId);
      } else if (operation.kind === 'replace') {
        const op = operation as Extract<ArchitectureMorphogenesisOperation, { kind: 'replace' }>;
        const before = baseById.get(op.moduleId);
        const after = nextById.get(op.moduleId);
        if (!before || !after || before.path !== after.path || (before.revisionSha256 === after.revisionSha256 && before.owner === after.owner)) {
          issues.push(issue('replace-mismatch', path, 'Replace must preserve module identity/path and change its content revision or owner'));
          continue;
        }
        replacedCoverage.add(op.moduleId);
      } else {
        issues.push(issue('operation-kind-unsupported', path + '.kind', 'Only merge, split, move and replace operations are supported'));
      }
    }

    for (const id of removed) if (!removedCoverage.has(id)) issues.push(issue('removed-module-unaccounted', 'diff.removedModuleIds', 'Removed module lacks a merge/split operation: ' + id));
    for (const id of added) if (!addedCoverage.has(id)) issues.push(issue('added-module-unaccounted', 'diff.addedModuleIds', 'Added module lacks a merge/split operation: ' + id));
    for (const id of moved) if (!movedCoverage.has(id)) issues.push(issue('moved-module-unaccounted', 'diff.movedModuleIds', 'Moved module lacks an explicit move operation: ' + id));
    for (const id of replaced) if (!replacedCoverage.has(id)) issues.push(issue('replaced-module-unaccounted', 'diff.replacedModuleIds', 'Changed module lacks an explicit replace operation: ' + id));

    const baseContracts = new Map(baseline.contracts.map(contract => [contract.id, contract]));
    const nextContracts = new Map(candidate.contracts.map(contract => [contract.id, contract]));
    const allContractIds = sortedUnique([...baseContracts.keys(), ...nextContracts.keys()]);
    const changedContractIds = allContractIds.filter(id => {
      const before = baseContracts.get(id);
      const after = nextContracts.get(id);
      return !before || !after || stableJson(before) !== stableJson(after);
    });

    const migration = input.migrationPlan as ArchitectureMigrationPlan;
    if (!isRecord(migration) || !isRecord(migration.checkpoint)) {
      issues.push(issue('checkpoint-missing', 'migrationPlan.checkpoint', 'A baseline checkpoint is mandatory'));
    } else {
      if (typeof migration.checkpoint.id !== 'string' || !migration.checkpoint.id.trim()
        || migration.checkpoint.baselineCommit !== input.baselineCommit
        || typeof migration.checkpoint.reference !== 'string' || !migration.checkpoint.reference.trim()
        || typeof migration.checkpoint.description !== 'string' || !migration.checkpoint.description.trim()) {
        issues.push(issue('checkpoint-invalid', 'migrationPlan.checkpoint', 'Checkpoint must identify the exact baseline commit and a restorable reference'));
      }
    }
    validStepList(migration?.steps, 'migrationPlan.steps', issues);
    validStepList(migration?.rollbackSteps, 'migrationPlan.rollbackSteps', issues);
    if (!Array.isArray(migration?.affectedContractIds)) {
      issues.push(issue('affected-contracts-invalid', 'migrationPlan.affectedContractIds', 'Affected contract IDs must be explicit'));
    } else if (stableJson(sortedUnique(migration.affectedContractIds)) !== stableJson(changedContractIds)) {
      issues.push(issue('affected-contracts-mismatch', 'migrationPlan.affectedContractIds', 'Migration plan must name every and only changed contract'));
    }

    const payload: Omit<ArchitectureMorphogenesisPlan, 'planDigest'> = {
      schemaVersion: 1,
      status: issues.length ? 'BLOCKED' : 'READY_FOR_REVIEW',
      activation: 'NOT_APPLIED',
      baselineCommit: input.baselineCommit,
      candidateBranch: input.candidateBranch,
      baselineGraph: JSON.parse(stableJson(baseline)),
      candidateGraph: JSON.parse(stableJson(candidate)),
      operations: JSON.parse(stableJson(input.operations)),
      migrationPlan: JSON.parse(stableJson(migration)),
      diff: {
        addedModuleIds: added,
        removedModuleIds: removed,
        movedModuleIds: moved,
        replacedModuleIds: replaced,
        changedContractIds,
      },
      issues,
    };
    return { ...payload, planDigest: sha256(stableJson(payload)) };
  }

  const payload: Omit<ArchitectureMorphogenesisPlan, 'planDigest'> = {
    schemaVersion: 1,
    status: 'BLOCKED',
    activation: 'NOT_APPLIED',
    baselineCommit: typeof input.baselineCommit === 'string' ? input.baselineCommit : '',
    candidateBranch: typeof input.candidateBranch === 'string' ? input.candidateBranch : '',
    baselineGraph: emptyGraph,
    candidateGraph: emptyGraph,
    operations: [],
    migrationPlan: { checkpoint: { id: '', baselineCommit: '', reference: '', description: '' }, steps: [], rollbackSteps: [], affectedContractIds: [] },
    diff: { addedModuleIds: [], removedModuleIds: [], movedModuleIds: [], replacedModuleIds: [], changedContractIds: [] },
    issues,
  };
  return { ...payload, planDigest: sha256(stableJson(payload)) };
}

export function evaluateArchitectureMorphogenesisPlan(
  plan: ArchitectureMorphogenesisPlan,
  evidence: Partial<ArchitectureMorphogenesisEvidence> | null | undefined,
): ArchitectureMorphogenesisGateReport {
  const issues: ArchitectureMorphogenesisIssue[] = [];
  const fail = (code: string, path: string, message: string) => issues.push(issue(code, path, message));
  if (!isPlainData(plan) || !isRecord(plan)) {
    fail('plan-untrusted-data', 'plan', 'Plan must be bounded plain data');
    return { status: 'BLOCKED', activation: 'NOT_APPLIED', mergeAllowed: false, planDigest: '', issues };
  }
  if (plan.schemaVersion !== 1 || plan.activation !== 'NOT_APPLIED') {
    fail('plan-schema-invalid', 'plan', 'Unsupported plan schema or forbidden activation state');
  }
  const planPayload = planDigestPayload(plan);
  if (typeof plan.planDigest !== 'string' || plan.planDigest !== sha256(stableJson(planPayload))) {
    fail('plan-digest-mismatch', 'planDigest', 'Plan content no longer matches its sealed digest');
  }
  if (plan.status !== 'READY_FOR_REVIEW') {
    fail('plan-not-ready', 'status', 'A blocked or unvalidated plan cannot enter the evidence gate');
  }
  const baselineValidation = validateArchitectureMorphogenesisGraph(plan.baselineGraph);
  const candidateValidation = validateArchitectureMorphogenesisGraph(plan.candidateGraph);
  if (!baselineValidation.ok || !candidateValidation.ok) {
    fail('plan-graph-invalid', 'graphs', 'Baseline and candidate graph contracts must both remain valid');
  }
  if (!isPlainData(evidence) || !isRecord(evidence)) {
    return {
      status: issues.length ? 'BLOCKED' : 'NEEDS_REVIEW',
      activation: 'NOT_APPLIED',
      mergeAllowed: false,
      planDigest: plan.planDigest,
      issues,
    };
  }
  if (evidence.baselineCommit === undefined || evidence.candidateCommit === undefined) {
    fail('evidence-commit-missing', 'evidence', 'Evidence must bind the exact baseline and a full candidate commit SHA');
  } else if (evidence.baselineCommit !== plan.baselineCommit || typeof evidence.candidateCommit !== 'string' || !COMMIT_SHA.test(evidence.candidateCommit)) {
    fail('evidence-commit-mismatch', 'evidence', 'Evidence must bind the exact baseline and a full candidate commit SHA');
  }
  const required: Array<keyof ArchitectureMorphogenesisEvidence> = [
    'testsPassed', 'typecheckPassed', 'architectureAuditPassed', 'contractChecksPassed', 'rollbackVerified',
  ];
  for (const key of required) {
    if (evidence[key] === false) fail('evidence-gate-failed', 'evidence.' + key, 'A required verification gate failed');
    else if (evidence[key] === undefined) fail('evidence-gate-missing', 'evidence.' + key, 'A required verification result is missing');
    else if (evidence[key] !== true) fail('evidence-gate-invalid', 'evidence.' + key, 'A required verification result must be a boolean');
  }
  if (evidence.reviewApproved !== true) fail('human-review-missing', 'evidence.reviewApproved', 'Explicit human review approval is required');
  const blocked = issues.some(item => !['evidence-gate-missing', 'evidence-commit-missing', 'human-review-missing'].includes(item.code));
  if (blocked) return { status: 'BLOCKED', activation: 'NOT_APPLIED', mergeAllowed: false, planDigest: plan.planDigest, issues };
  if (issues.length) return { status: 'NEEDS_REVIEW', activation: 'NOT_APPLIED', mergeAllowed: false, planDigest: plan.planDigest, issues };
  return {
    status: 'ELIGIBLE_FOR_MANUAL_INTEGRATION',
    activation: 'NOT_APPLIED',
    mergeAllowed: false,
    planDigest: plan.planDigest,
    issues: [],
  };
}
