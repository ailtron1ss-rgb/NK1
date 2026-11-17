import { createHash } from 'node:crypto';
import { organismSystemContracts, type OrganismSystemContract } from '../core/OrganismSystemContract.ts';
import { invariantRuleManifest } from './InvariantEngine.ts';
import { RELEASE_CONTRACT } from './ReleaseContract.ts';

export type DevelopmentalGenomeModuleName = OrganismSystemContract['name'];
export type DevelopmentalGenomeTrait = 'estimatedCost01' | 'cadenceCycles';
export type DevelopmentalGenomeStatus = 'APPROVED' | 'BLOCKED' | 'NEEDS_REVIEW';

export interface DevelopmentalGenomeModule {
  name: DevelopmentalGenomeModuleName;
  contractVersion: number;
  purpose: string;
  phase: OrganismSystemContract['phase'];
  estimatedCost01: number;
  cadenceCycles: number;
  dependencies: DevelopmentalGenomeModuleName[];
  capabilityNames: string[];
}

export interface DevelopmentalGenomeChange {
  module: DevelopmentalGenomeModuleName;
  trait: DevelopmentalGenomeTrait;
  from: number;
  to: number;
}

export interface DevelopmentalGenomeRuntimeContract {
  application: string;
  organismCore: string;
  stateSchema: number;
  node: string;
  npm: string;
  phase: string;
  migrationOwner: 'migratePersistedOrganism';
  migrationPath: 'runtime/neuro-kurisu/src/organism/persistence/StateMigrations.ts';
}

export interface DevelopmentalGenome {
  schemaVersion: 1;
  genomeVersion: '1.0.0';
  modules: DevelopmentalGenomeModule[];
  dependencyOrder: DevelopmentalGenomeModuleName[];
  invariants: ReturnType<typeof invariantRuleManifest>;
  runtimeContract: DevelopmentalGenomeRuntimeContract;
  lineage: {
    generation: number;
    parentDigest: string | null;
    changes: DevelopmentalGenomeChange[];
  };
  activation: 'NOT_APPLIED';
  digest: string;
}

export interface GenomeGateIssue {
  code: string;
  path: string;
  message: string;
}

export interface GenomeGateReport {
  status: DevelopmentalGenomeStatus;
  activation: 'NOT_APPLIED';
  candidateDigest: string;
  parentDigest: string | null;
  violations: GenomeGateIssue[];
  warnings: GenomeGateIssue[];
}

export interface DevelopmentalGenomeTraitPatch {
  module: DevelopmentalGenomeModuleName;
  estimatedCost01?: number;
  cadenceCycles?: number;
}

const MIGRATION_PATH = 'runtime/neuro-kurisu/src/organism/persistence/StateMigrations.ts' as const;
const isDigest = (value: unknown): value is string => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
const stableValue = (value: any): any => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
};
const stableJson = (value: unknown): string => JSON.stringify(stableValue(value)) ?? 'undefined';

function currentRuntimeContract(): DevelopmentalGenomeRuntimeContract {
  return {
    application: RELEASE_CONTRACT.application,
    organismCore: RELEASE_CONTRACT.organismCore,
    stateSchema: RELEASE_CONTRACT.stateSchema,
    node: RELEASE_CONTRACT.node,
    npm: RELEASE_CONTRACT.npm,
    phase: RELEASE_CONTRACT.phase,
    migrationOwner: 'migratePersistedOrganism',
    migrationPath: MIGRATION_PATH,
  };
}

function moduleFromContract(contract: OrganismSystemContract): DevelopmentalGenomeModule {
  return {
    name: contract.name,
    contractVersion: contract.version,
    purpose: contract.purpose,
    phase: contract.phase,
    estimatedCost01: contract.estimatedCost01,
    cadenceCycles: contract.cadenceCycles,
    dependencies: [...contract.dependencies].sort(),
    capabilityNames: [...contract.capabilityNames].sort(),
  };
}

function dependencyTopology(modules: DevelopmentalGenomeModule[]): {
  order: DevelopmentalGenomeModuleName[];
  issues: GenomeGateIssue[];
} {
  const issues: GenomeGateIssue[] = [];
  const names = modules.map(module => module.name);
  const known = new Set<string>();
  for (const name of names) {
    if (known.has(name)) issues.push({ code: 'duplicate-module', path: 'modules', message: 'Duplicate module name: ' + name });
    known.add(name);
  }

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const name of known) {
    indegree.set(name, 0);
    outgoing.set(name, []);
  }

  for (const module of modules) {
    if (!Array.isArray(module.dependencies)) {
      issues.push({ code: 'invalid-dependencies', path: 'modules.' + module.name + '.dependencies', message: 'Dependencies must be an array' });
      continue;
    }
    const local = new Set<string>();
    for (const dependency of module.dependencies) {
      if (local.has(dependency)) {
        issues.push({ code: 'duplicate-dependency', path: 'modules.' + module.name + '.dependencies', message: 'Duplicate dependency: ' + dependency });
        continue;
      }
      local.add(dependency);
      if (dependency === module.name) {
        issues.push({ code: 'self-dependency', path: 'modules.' + module.name + '.dependencies', message: 'A module cannot depend on itself' });
        continue;
      }
      if (!known.has(dependency)) {
        issues.push({ code: 'unknown-dependency', path: 'modules.' + module.name + '.dependencies', message: 'Unknown dependency: ' + dependency });
        continue;
      }
      outgoing.get(dependency)!.push(module.name);
      indegree.set(module.name, (indegree.get(module.name) ?? 0) + 1);
    }
  }

  const ready = [...known].filter(name => indegree.get(name) === 0).sort();
  const order: string[] = [];
  while (ready.length) {
    const name = ready.shift()!;
    order.push(name);
    for (const dependent of (outgoing.get(name) ?? []).sort()) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (order.length !== known.size) {
    issues.push({ code: 'dependency-cycle', path: 'modules.dependencies', message: 'Dependency graph contains a cycle' });
  }
  return { order: order as DevelopmentalGenomeModuleName[], issues };
}

export function computeDevelopmentalGenomeDigest(genome: Omit<DevelopmentalGenome, 'digest'> | DevelopmentalGenome): string {
  const payload: Record<string, unknown> = { ...(genome as any) };
  delete payload.digest;
  return 'sha256:' + createHash('sha256').update(stableJson(payload)).digest('hex');
}

function sealGenome(payload: Omit<DevelopmentalGenome, 'digest'>): DevelopmentalGenome {
  return { ...payload, digest: computeDevelopmentalGenomeDigest(payload) };
}

/** Build a reproducible manifest from the live physical-system contracts. */
export function buildDevelopmentalGenome(
  contracts: readonly OrganismSystemContract[] = organismSystemContracts(),
): DevelopmentalGenome {
  const expectedNames = organismSystemContracts().map(contract => contract.name).sort();
  const modules = contracts.map(moduleFromContract).sort((a, b) => a.name.localeCompare(b.name));
  const actualNames = modules.map(module => module.name).sort();
  if (stableJson(actualNames) !== stableJson(expectedNames)) {
    throw new Error('Developmental Genome requires the complete canonical system set');
  }
  const topology = dependencyTopology(modules);
  if (topology.issues.length) {
    throw new Error('Developmental Genome contract graph is invalid: ' + topology.issues.map(issue => issue.code).join(','));
  }
  return sealGenome({
    schemaVersion: 1,
    genomeVersion: '1.0.0',
    modules,
    dependencyOrder: topology.order,
    invariants: invariantRuleManifest(),
    runtimeContract: currentRuntimeContract(),
    lineage: { generation: 0, parentDigest: null, changes: [] },
    activation: 'NOT_APPLIED',
  });
}

function immutableModuleShape(module: DevelopmentalGenomeModule): unknown {
  return {
    name: module.name,
    contractVersion: module.contractVersion,
    purpose: module.purpose,
    phase: module.phase,
    dependencies: module.dependencies,
    capabilityNames: module.capabilityNames,
  };
}

function addIssue(list: GenomeGateIssue[], code: string, path: string, message: string): void {
  list.push({ code, path, message });
}

/** Fail-closed structural and parent-child compatibility gate. */
export function evaluateDevelopmentalGenome(
  candidate: DevelopmentalGenome,
  parent?: DevelopmentalGenome,
): GenomeGateReport {
  const violations: GenomeGateIssue[] = [];
  const warnings: GenomeGateIssue[] = [];
  const value = candidate as any;

  if (!value || typeof value !== 'object') {
    addIssue(violations, 'candidate-invalid', 'candidate', 'Candidate must be an object');
    return { status: 'BLOCKED', activation: 'NOT_APPLIED', candidateDigest: '', parentDigest: null, violations, warnings };
  }
  if (value.schemaVersion !== 1 || value.genomeVersion !== '1.0.0') {
    addIssue(violations, 'unsupported-genome-schema', 'schemaVersion', 'Only Developmental Genome schema 1 / version 1.0.0 is supported');
  }
  if (value.activation !== 'NOT_APPLIED') {
    addIssue(violations, 'activation-forbidden', 'activation', 'Genome candidates cannot activate or mutate the running organism');
  }
  if (!Array.isArray(value.modules)) {
    addIssue(violations, 'modules-invalid', 'modules', 'Genome modules must be an array');
  }
  if (!Array.isArray(value.dependencyOrder)) {
    addIssue(violations, 'dependency-order-invalid', 'dependencyOrder', 'Dependency order must be an array');
  }
  if (!value.lineage || !Number.isInteger(value.lineage.generation) || value.lineage.generation < 0 || !Array.isArray(value.lineage.changes)) {
    addIssue(violations, 'lineage-invalid', 'lineage', 'Lineage generation and change list are invalid');
  }
  if (!isDigest(value.digest) || value.digest !== computeDevelopmentalGenomeDigest(value)) {
    addIssue(violations, 'digest-mismatch', 'digest', 'SHA-256 digest does not match the canonical genome payload');
  }

  const contracts = organismSystemContracts();
  const contractByName = new Map(contracts.map(contract => [contract.name, contract]));
  const moduleNames = Array.isArray(value.modules) ? value.modules.map((module: any) => module?.name) : [];
  const uniqueNames = new Set(moduleNames);
  if (uniqueNames.size !== moduleNames.length) {
    addIssue(violations, 'duplicate-module', 'modules', 'Module names must be unique');
  }
  const expectedNames = [...contractByName.keys()].sort();
  if (stableJson([...moduleNames].sort()) !== stableJson(expectedNames)) {
    addIssue(violations, 'module-set-mismatch', 'modules', 'Genome must contain exactly the current canonical system set');
  }

  if (Array.isArray(value.modules)) {
    for (const module of value.modules) {
      const contract = contractByName.get(module?.name);
      if (!contract) {
        addIssue(violations, 'unknown-module', 'modules', 'Unknown module: ' + String(module?.name));
        continue;
      }
      if (stableJson(immutableModuleShape(module)) !== stableJson(immutableModuleShape(moduleFromContract(contract)))) {
        addIssue(violations, 'immutable-module-change', 'modules.' + module.name, 'Canonical module identity, purpose, phase, dependencies and capabilities are immutable');
      }
      if (typeof module.estimatedCost01 !== 'number' || !Number.isFinite(module.estimatedCost01) || module.estimatedCost01 < 0 || module.estimatedCost01 > 1) {
        addIssue(violations, 'trait-out-of-range', 'modules.' + module.name + '.estimatedCost01', 'estimatedCost01 must be finite and within [0,1]');
      }
      if (!Number.isInteger(module.cadenceCycles) || module.cadenceCycles < 1 || module.cadenceCycles > 64) {
        addIssue(violations, 'trait-out-of-range', 'modules.' + module.name + '.cadenceCycles', 'cadenceCycles must be an integer within [1,64]');
      }
    }

    const topology = dependencyTopology(value.modules);
    violations.push(...topology.issues);
    if (Array.isArray(value.dependencyOrder) && stableJson(value.dependencyOrder) !== stableJson(topology.order)) {
      addIssue(violations, 'dependency-order-mismatch', 'dependencyOrder', 'Stored order does not match deterministic topological sorting');
    }
  }

  if (stableJson(value.invariants) !== stableJson(invariantRuleManifest())) {
    addIssue(violations, 'invariant-contract-mismatch', 'invariants', 'Invariant rules and their owner are immutable');
  }
  if (stableJson(value.runtimeContract) !== stableJson(currentRuntimeContract())) {
    addIssue(violations, 'runtime-contract-mismatch', 'runtimeContract', 'Release, state-schema and migration contracts are immutable');
  }

  const generation = value.lineage?.generation;
  if (generation === 0) {
    if (value.lineage?.parentDigest !== null || (value.lineage?.changes?.length ?? -1) !== 0) {
      addIssue(violations, 'baseline-lineage-invalid', 'lineage', 'Baseline genome must have no parent and no inherited changes');
    }
    for (const module of value.modules ?? []) {
      const contract = contractByName.get(module?.name);
      if (contract && (module.estimatedCost01 !== contract.estimatedCost01 || module.cadenceCycles !== contract.cadenceCycles)) {
        addIssue(violations, 'baseline-trait-drift', 'modules.' + module.name, 'Baseline traits must match the live canonical contract');
      }
    }
  } else if (Number.isInteger(generation) && generation > 0) {
    if (!isDigest(value.lineage?.parentDigest)) {
      addIssue(violations, 'lineage-parent-mismatch', 'lineage.parentDigest', 'Inherited genomes require a SHA-256 parent digest');
    }
    if (!parent) {
      addIssue(warnings, 'parent-proof-missing', 'lineage.parentDigest', 'The direct parent genome is required for approval');
    } else {
      if (!isDigest(parent.digest) || parent.digest !== computeDevelopmentalGenomeDigest(parent)) {
        addIssue(violations, 'parent-digest-mismatch', 'parent.digest', 'Parent digest does not match its payload');
      }
      if (value.lineage.parentDigest !== parent.digest || generation !== parent.lineage.generation + 1) {
        addIssue(violations, 'lineage-parent-mismatch', 'lineage', 'Generation and parent digest do not match the supplied parent');
      }
      const parentByName = new Map(parent.modules.map(module => [module.name, module]));
      const actualChanges: DevelopmentalGenomeChange[] = [];
      for (const module of value.modules ?? []) {
        const previous = parentByName.get(module.name);
        if (!previous) {
          addIssue(violations, 'module-parent-missing', 'modules.' + module.name, 'Parent does not contain this module');
          continue;
        }
        if (stableJson(immutableModuleShape(module)) !== stableJson(immutableModuleShape(previous))) {
          addIssue(violations, 'immutable-module-change', 'modules.' + module.name, 'Inherited genome changed an immutable module field');
        }
        if (module.estimatedCost01 !== previous.estimatedCost01) {
          actualChanges.push({ module: module.name, trait: 'estimatedCost01', from: previous.estimatedCost01, to: module.estimatedCost01 });
        }
        if (module.cadenceCycles !== previous.cadenceCycles) {
          actualChanges.push({ module: module.name, trait: 'cadenceCycles', from: previous.cadenceCycles, to: module.cadenceCycles });
        }
      }
      actualChanges.sort((a, b) => a.module.localeCompare(b.module) || a.trait.localeCompare(b.trait));
      const claimedChanges = Array.isArray(value.lineage.changes) ? [...value.lineage.changes].sort((a: any, b: any) => String(a.module).localeCompare(String(b.module)) || String(a.trait).localeCompare(String(b.trait))) : [];
      if (stableJson(actualChanges) !== stableJson(claimedChanges)) {
        addIssue(violations, 'lineage-changes-mismatch', 'lineage.changes', 'Lineage receipt must exactly describe every inherited trait change');
      }
    }
  }

  const status: DevelopmentalGenomeStatus = violations.length ? 'BLOCKED' : (warnings.length ? 'NEEDS_REVIEW' : 'APPROVED');
  return {
    status,
    activation: 'NOT_APPLIED',
    candidateDigest: isDigest(value.digest) ? value.digest : '',
    parentDigest: isDigest(value.lineage?.parentDigest) ? value.lineage.parentDigest : null,
    violations,
    warnings,
  };
}

/** Create an immutable child manifest; this does not apply the traits to runtime systems. */
export function inheritDevelopmentalGenome(
  parent: DevelopmentalGenome,
  changes: DevelopmentalGenomeTraitPatch[],
): DevelopmentalGenome {
  if (!parent || !Array.isArray(changes) || changes.length === 0) {
    throw new Error('Inheritance requires a parent genome and at least one trait patch');
  }
  const parentReport = evaluateDevelopmentalGenome(parent);
  if (parentReport.status === 'BLOCKED') {
    throw new Error('Cannot inherit from a blocked genome: ' + parentReport.violations.map(issue => issue.code).join(','));
  }
  const modules = parent.modules.map(module => ({ ...module, dependencies: [...module.dependencies], capabilityNames: [...module.capabilityNames] }));
  const byName = new Map(modules.map(module => [module.name, module]));
  const seen = new Set<string>();
  const receipt: DevelopmentalGenomeChange[] = [];

  for (const patch of changes) {
    if (seen.has(patch.module)) throw new Error('Only one patch per module is accepted');
    seen.add(patch.module);
    const module = byName.get(patch.module);
    if (!module) throw new Error('Unknown genome module: ' + patch.module);
    const fields = Object.keys(patch).filter(key => key !== 'module');
    if (!fields.length || fields.some(field => field !== 'estimatedCost01' && field !== 'cadenceCycles')) {
      throw new Error('Only estimatedCost01 and cadenceCycles may be inherited');
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'estimatedCost01')) {
      const next = patch.estimatedCost01;
      if (typeof next !== 'number' || !Number.isFinite(next) || next < 0 || next > 1) {
        throw new Error('estimatedCost01 must be finite and within [0,1]');
      }
      if (next === module.estimatedCost01) throw new Error('No-op trait patches are not accepted');
      receipt.push({ module: module.name, trait: 'estimatedCost01', from: module.estimatedCost01, to: next });
      module.estimatedCost01 = next;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'cadenceCycles')) {
      const next = patch.cadenceCycles;
      if (!Number.isInteger(next) || next < 1 || next > 64) {
        throw new Error('cadenceCycles must be an integer within [1,64]');
      }
      if (next === module.cadenceCycles) throw new Error('No-op trait patches are not accepted');
      receipt.push({ module: module.name, trait: 'cadenceCycles', from: module.cadenceCycles, to: next });
      module.cadenceCycles = next;
    }
  }

  receipt.sort((a, b) => a.module.localeCompare(b.module) || a.trait.localeCompare(b.trait));
  const child = sealGenome({
    schemaVersion: 1,
    genomeVersion: '1.0.0',
    modules,
    dependencyOrder: [...parent.dependencyOrder],
    invariants: structuredClone(parent.invariants),
    runtimeContract: { ...parent.runtimeContract },
    lineage: { generation: parent.lineage.generation + 1, parentDigest: parent.digest, changes: receipt },
    activation: 'NOT_APPLIED',
  });
  const report = evaluateDevelopmentalGenome(child, parent);
  if (report.status !== 'APPROVED') {
    throw new Error('Inherited genome failed Evolution Gate: ' + report.violations.map(issue => issue.code).join(','));
  }
  return child;
}
