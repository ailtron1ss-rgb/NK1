/**
 * Adaptive experience consolidator.
 *
 * Retention is utility/novelty/uncertainty weighted. The buffer is bounded so
 * consolidation cost stays predictable on mobile devices.
 *
 * This class is an ingestion boundary: callers may supply restored or
 * provider-derived data, so records are copied from own data properties only.
 */
export interface ExperienceRecord {
  id: string;
  timestamp: number;
  novelty: number;
  utility: number;
  uncertainty: number;
  tags: string[];
}

export interface ConsolidatedExperience extends ExperienceRecord {
  retentionScore: number;
  abstractionLevel: number;
  consolidated: boolean;
}

const MAX_BUFFER_LIMIT = 10_000;
const MAX_ID_LENGTH = 160;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 24;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

/** Rejects accessors, sparse arrays and malformed values without executing getters. */
function normalizeExperience(value: unknown): ExperienceRecord | null {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) return null;
  const allowed = new Set(['id', 'timestamp', 'novelty', 'utility', 'uncertainty', 'tags']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;

  const idValue = ownDataValue(value, 'id');
  const timestamp = ownDataValue(value, 'timestamp');
  const novelty = ownDataValue(value, 'novelty');
  const utility = ownDataValue(value, 'utility');
  const uncertainty = ownDataValue(value, 'uncertainty');
  const tagsValue = ownDataValue(value, 'tags');

  if (typeof idValue !== 'string' || !idValue.trim() || idValue.trim().length > MAX_ID_LENGTH) return null;
  if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0) return null;
  for (const metric of [novelty, utility, uncertainty]) {
    if (typeof metric !== 'number' || !Number.isFinite(metric)) return null;
  }
  if (!Array.isArray(tagsValue) || tagsValue.length > MAX_TAGS) return null;
  const tags: string[] = [];
  for (let index = 0; index < tagsValue.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(tagsValue, index)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(tagsValue, String(index));
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') return null;
    const tag = descriptor.value.trim();
    if (!tag || tag.length > MAX_TAG_LENGTH) return null;
    tags.push(tag);
  }
  if (Object.getOwnPropertySymbols(tagsValue).length > 0) return null;

  return {
    id: idValue.trim(),
    timestamp,
    novelty: clamp01(novelty as number),
    utility: clamp01(utility as number),
    uncertainty: clamp01(uncertainty as number),
    tags,
  };
}

export class AdaptiveExperienceConsolidator {
  private readonly maxBuffer: number;
  private buffer: ExperienceRecord[] = [];

  constructor(maxBuffer = 256) {
    const requested = Number.isFinite(maxBuffer) ? Math.floor(maxBuffer) : 256;
    this.maxBuffer = Math.max(16, Math.min(MAX_BUFFER_LIMIT, requested));
  }

  /** Returns false for malformed input; accepted records are detached from caller data. */
  ingest(exp: ExperienceRecord): boolean {
    const normalized = normalizeExperience(exp);
    if (!normalized) return false;
    this.buffer.push(normalized);
    if (this.buffer.length > this.maxBuffer) this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    return true;
  }

  consolidate(limit = this.buffer.length): ConsolidatedExperience[] {
    if (!Number.isFinite(limit) || limit <= 0) return [];
    const boundedLimit = Math.min(this.buffer.length, Math.floor(limit));
    if (boundedLimit <= 0) return [];

    return this.buffer
      .map((experience) => ({
        ...experience,
        tags: [...experience.tags],
        retentionScore: this.score(experience),
        abstractionLevel: clamp01((experience.utility + experience.novelty + (1 - experience.uncertainty)) / 3),
        consolidated: true,
      }))
      .sort((a, b) => b.retentionScore - a.retentionScore
        || b.timestamp - a.timestamp
        || a.id.localeCompare(b.id))
      .slice(0, boundedLimit);
  }

  size(): number {
    return this.buffer.length;
  }

  snapshot(): ExperienceRecord[] {
    return this.buffer.map((experience) => ({ ...experience, tags: [...experience.tags] }));
  }

  /** Restore is a bounded, validating import; malformed rows are skipped, never trusted. */
  restore(records?: ExperienceRecord[] | null): void {
    if (!Array.isArray(records)) {
      this.buffer = [];
      return;
    }
    const restored: ExperienceRecord[] = [];
    const seen = new Set<string>();
    const start = Math.max(0, records.length - this.maxBuffer);
    for (let index = start; index < records.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(records, index)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
      if (!descriptor || !('value' in descriptor)) continue;
      const normalized = normalizeExperience(descriptor.value);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      restored.push(normalized);
    }
    this.buffer = restored;
  }

  private score(experience: ExperienceRecord): number {
    return clamp01(experience.utility * 0.45
      + experience.novelty * 0.3
      + (1 - experience.uncertainty) * 0.25);
  }
}
