import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain.
 * Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied.
 */
export interface RelationshipSelfModel {
  person: string;
  role: string;
  trust: number;
  guardedness: number;
  warmth: number;
  predictability: number;
  sharedProjects: string[];
  openCommitments: string[];
  updatedAt: number;
}
export interface RelationshipSelfState { models: RelationshipSelfModel[]; version: number; }
export const defaultRelationshipSelf = (): RelationshipSelfState => ({ models: [], version: 1 });

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasControls = (value: string): boolean => Array.from(value).some(character => {
  const code = character.codePointAt(0) ?? 0;
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
});
const validText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && value.normalize('NFKC') === value && !hasControls(value);
const validStringList = (value: unknown, maxItems: number, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxItems &&
  value.every(item => validText(item, maxLength));

function normalizeRelationshipModel(value: unknown): RelationshipSelfModel | null {
  let row: unknown;
  try {
    row = snapshotPlainData<Record<string, unknown>>(value, {
      maxDepth: 4, maxNodes: 512, maxStringUnits: 16 * 1024,
    });
  } catch {
    return null;
  }
  if (!isRecord(row) || !validText(row.person, 180) || !validText(row.role, 120) ||
      !validStringList(row.sharedProjects, 32, 180) || !validStringList(row.openCommitments, 32, 180) ||
      typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || row.updatedAt < 0) return null;
  const metrics = [row.trust, row.guardedness, row.warmth, row.predictability];
  if (!metrics.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  return {
    person: row.person,
    role: row.role,
    trust: row.trust as number,
    guardedness: row.guardedness as number,
    warmth: row.warmth as number,
    predictability: row.predictability as number,
    sharedProjects: [...row.sharedProjects],
    openCommitments: [...row.openCommitments],
    updatedAt: row.updatedAt,
  };
}

export class RelationshipSelf {
  private state = defaultRelationshipSelf();

  restore(input?: RelationshipSelfState | null): void {
    const empty = defaultRelationshipSelf();
    if (!isRecord(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) {
      this.state = empty;
      return;
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable)) {
      this.state = empty;
      return;
    }
    const version = 1;
    const modelsDescriptor = descriptors.models;
    const rawModels = modelsDescriptor && 'value' in modelsDescriptor ? modelsDescriptor.value : undefined;
    const restored: RelationshipSelfModel[] = [];
    if (Array.isArray(rawModels) && Object.getPrototypeOf(rawModels) === Array.prototype) {
      const arrayDescriptors = Object.getOwnPropertyDescriptors(rawModels);
      const length = arrayDescriptors.length?.value;
      if (Number.isSafeInteger(length) && length >= 0 && length <= 512 &&
          Object.keys(arrayDescriptors).length === length + 1) {
        for (let index = 0; index < length && restored.length < 64; index++) {
          const descriptor = arrayDescriptors[String(index)];
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) continue;
          const model = normalizeRelationshipModel(descriptor.value);
          if (model && !restored.some(existing => existing.person === model.person)) restored.push(model);
        }
      }
    }
    this.state = { version, models: restored };
  }

  observe(person: string, success: number, socialSignal: number) {
    if (typeof person !== 'string' || person.length < 1 || person.length > 180 ||
        person.trim() !== person || person.normalize('NFKC') !== person || hasControls(person) ||
        !Number.isFinite(success) || success < 0 || success > 1 ||
        !Number.isFinite(socialSignal) || socialSignal < 0 || socialSignal > 1) {
      throw new TypeError('relationship-observation-invalid');
    }
    let model = this.state.models.find(item => item.person === person);
    if (!model) {
      model = {
        person, role: 'known-contact', trust: .5, guardedness: .35, warmth: .5, predictability: .5,
        sharedProjects: [], openCommitments: [], updatedAt: Date.now(),
      };
      this.state.models.unshift(model);
    }
    model.trust = clamp(model.trust * .9 + success * .1);
    model.predictability = clamp(model.predictability * .92 + (1 - Math.abs(socialSignal - .5) * 2) * .08);
    model.warmth = clamp(model.warmth * .94 + success * .06);
    model.guardedness = clamp(1 - model.trust * .7);
    model.updatedAt = Date.now();
    return structuredClone(model);
  }

  snapshot(): RelationshipSelfState { return structuredClone(this.state); }
}
