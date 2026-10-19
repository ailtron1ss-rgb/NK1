import { RELEASE_CONTRACT } from './ReleaseContract.ts';
import type { PersistedOrganism } from '../core/OrganismCore.ts';

export interface IntegrityViolation { code: string; path: string; message: string; severity: 'error' | 'warning'; }
export interface IntegritySnapshot { ok: boolean; violations: IntegrityViolation[]; warnings: IntegrityViolation[]; checkedAt: number; }

const finite01 = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

export function validatePersistedOrganism(value: PersistedOrganism): IntegritySnapshot {
  const violations: IntegrityViolation[] = [];
  const warnings: IntegrityViolation[] = [];
  const add = (code: string, path: string, message: string, severity: 'error' | 'warning' = 'error') => (severity === 'error' ? violations : warnings).push({ code, path, message, severity });

  if (value.schemaVersion !== RELEASE_CONTRACT.stateSchema) add('schema-mismatch', 'schemaVersion', `Expected ${RELEASE_CONTRACT.stateSchema}, got ${value.schemaVersion}`);
  if (value.state.version !== RELEASE_CONTRACT.stateSchema) add('state-version-mismatch', 'state.version', `Expected ${RELEASE_CONTRACT.stateSchema}, got ${value.state.version}`);
  if (!Number.isInteger(value.state.tick) || value.state.tick < 0) add('tick-invalid', 'state.tick', 'Tick must be a non-negative integer');
  for (const [k, v] of Object.entries(value.state.needs)) if (!finite01(v)) add('need-out-of-range', `state.needs.${k}`, 'Need must be finite and within [0,1]');
  const goalIds = new Set<string>();
  for (const g of value.goals) { if (goalIds.has(g.id)) add('duplicate-goal-id', `goals.${g.id}`, 'Goal ID is duplicated'); goalIds.add(g.id); }
  const projectIds = new Set<string>();
  for (const p of value.facets.evolution.selfProjects.projects) { if (projectIds.has(p.id)) add('duplicate-project-id', `facets.evolution.selfProjects.${p.id}`, 'Project ID is duplicated'); projectIds.add(p.id); }
  if (value.traces.length > 500) add('trace-retention', 'traces', 'Trace retention exceeded 500 entries');
  if (value.memories.length > 500) add('memory-retention', 'memories', 'Memory retention exceeded 500 entries');
  if (value.facets.memory.eventLog.length > 5000) add('event-retention', 'facets.memory.eventLog', 'Event retention exceeded 5000 entries');
  for (const [k, v] of Object.entries(value.facets.evolution.valueEvolution.protectedFloor)) if (!finite01(v)) add('value-floor-invalid', `facets.evolution.valueEvolution.protectedFloor.${k}`, 'Protected value floor must be within [0,1]');
  if (value.facets.evolution.selfProjects.projects.length > 4) add('project-load', 'facets.evolution.selfProjects.projects', 'Active/proposed project load exceeds design limit', 'warning');
  if (!value.system?.lastStateHash) add('state-hash-missing', 'system.lastStateHash', 'State has no provenance hash yet', 'warning');
  return { ok: violations.length === 0, violations, warnings, checkedAt: Date.now() };
}
