import { isPlainDataArray, isPlainDataRecord, ownDataValue } from './RestoreSanitizers.ts';
import type { P41SemanticInput } from '../cognition/P41SemanticPerception.ts';

interface CloneBudget { remaining: number; }

function clonePlainData(value: unknown, depth: number, budget: CloneBudget): unknown {
  if (budget.remaining <= 0 || depth > 8) return undefined;
  budget.remaining -= 1;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 4096);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isPlainDataArray(value, 64)) {
    const result: unknown[] = [];
    for (let index = 0; index < value.length && budget.remaining > 0; index += 1) {
      const child = clonePlainData(ownDataValue(value, String(index)), depth + 1, budget);
      if (child !== undefined) result.push(child);
    }
    return result;
  }
  if (!isPlainDataRecord(value)) return undefined;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(value).slice(0, 128)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || budget.remaining <= 0) continue;
    const child = clonePlainData(ownDataValue(value, key), depth + 1, budget);
    if (child !== undefined) result[key] = child;
  }
  return result;
}

function keepRecordRows(container: Record<string, unknown>, key: string, max: number): void {
  const rows = container[key];
  if (!Array.isArray(rows)) {
    delete container[key];
    return;
  }
  container[key] = rows.filter(isPlainDataRecord).slice(0, max);
}

/**
 * Public P41 input is model/derived evidence, never a source of physical truth.
 * Real sensor/device captures must first pass OrganismCore.admitObservation().
 * This boundary also strips proxies, accessors, class instances and oversized graphs.
 */
export function sanitizePublicP41Ingress(raw: unknown): P41SemanticInput | null {
  const cloned = clonePlainData(raw, 0, { remaining: 4096 });
  if (!isPlainDataRecord(cloned)) return null;
  const safe = cloned as Record<string, unknown>;

  delete safe.sensor;
  if (typeof safe.at !== 'number' || !Number.isFinite(safe.at) || safe.at < 0) delete safe.at;
  if (typeof safe.text !== 'string') delete safe.text;

  if (!isPlainDataRecord(safe.vision)) delete safe.vision;
  else {
    keepRecordRows(safe.vision, 'objects', 32);
    keepRecordRows(safe.vision, 'relations', 16);
    keepRecordRows(safe.vision, 'events', 16);
  }

  if (!isPlainDataRecord(safe.audio)) delete safe.audio;
  else {
    keepRecordRows(safe.audio, 'events', 16);
    keepRecordRows(safe.audio, 'relations', 16);
  }

  if (!isPlainDataRecord(safe.world)) delete safe.world;
  else {
    const world = safe.world;
    world.evidenceKind = 'model-output';
    keepRecordRows(world, 'objects', 24);
    if (Array.isArray(world.objects)) {
      world.objects = world.objects.map((object) => ({ ...object, evidenceKind: 'model-output' }));
    }
    if (Array.isArray(world.events)) world.events = world.events.filter((event) => typeof event === 'string').slice(0, 16);
    else delete world.events;
  }

  return safe as P41SemanticInput;
}
