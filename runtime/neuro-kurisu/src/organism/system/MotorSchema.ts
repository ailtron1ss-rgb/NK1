import type { ActionKind } from '../core/types.ts';

const ACTIONS = new Set<ActionKind>(['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']);
const ID = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const STEP_ID = /^[a-z][a-z0-9_-]{0,47}$/i;
const KEY = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;
const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : fallback));
const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

export interface MotorSchemaStep {
  id: string;
  action: ActionKind;
  toolId: string;
  input?: Record<string, unknown>;
  inputBindings?: Record<string, string>;
  expectedOutputKeys?: string[];
  requiredInputKeys?: string[];
  fallbackToolIds?: string[];
  maxAttempts?: number;
  resourceCost01?: number;
}
export interface MotorSchema {
  version: 1;
  id: string;
  projectId: string;
  name: string;
  origin: string;
  steps: MotorSchemaStep[];
  policy?: {
    requireVerified?: boolean;
    maxTotalAttempts?: number;
    maxTotalResourceCost01?: number;
  };
}
export interface MotorSchemaIssue { code: string; path: string; message: string; }
export interface MotorSchemaValidation {
  ok: boolean;
  issues: MotorSchemaIssue[];
  schema?: MotorSchema;
  totals?: { steps: number; maxAttempts: number; resourceCost01: number; };
}
export interface CompoundSkillCompileInput {
  projectId: string;
  name: string;
  origin: string;
  steps: Array<{
    id: string; action: string; toolId: string; input: Record<string, unknown>;
    inputBindings?: Record<string, string>; allowUnverified: false;
    expectedOutputKeys?: string[]; requiredInputKeys?: string[];
    fallbackToolIds?: string[]; maxAttempts: number; resourceCost01: number;
  }>;
}

/**
 * A MotorSchema is a versioned execution-plan contract, not a second executor.
 * Validation is performed here, then the plan is lowered into the existing
 * ProceduralSkillLibrary and executed through the canonical ActionGateway.
 */
export function validateMotorSchema(raw: unknown): MotorSchemaValidation {
  const issues: MotorSchemaIssue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: [{ code: 'schema-not-object', path: '$', message: 'MotorSchema must be an object.' }] };
  }
  const src = raw as Record<string, any>;
  if (src.version !== 1) issue('unsupported-version', 'version', 'Only MotorSchema version 1 is supported.');
  if (typeof src.id !== 'string' || !ID.test(src.id)) issue('invalid-id', 'id', 'id must be a 2–64 character safe identifier.');
  if (typeof src.projectId !== 'string' || !src.projectId.trim() || src.projectId.length > 96) issue('invalid-project', 'projectId', 'projectId is required and limited to 96 characters.');
  if (typeof src.name !== 'string' || !src.name.trim() || src.name.length > 96) issue('invalid-name', 'name', 'name is required and limited to 96 characters.');
  if (typeof src.origin !== 'string' || !src.origin.trim() || src.origin.length > 48) issue('invalid-origin', 'origin', 'origin is required and limited to 48 characters.');
  if (!Array.isArray(src.steps) || src.steps.length < 2 || src.steps.length > 8) {
    issue('step-count', 'steps', 'A MotorSchema must contain 2–8 steps.');
    return { ok: false, issues };
  }
  const seen = new Set<string>();
  const priorOutputKeys = new Map<string, Set<string> | null>();
  const normalizedSteps: MotorSchemaStep[] = [];
  let maxAttempts = 0;
  let resourceCost01 = 0;
  for (let i = 0; i < src.steps.length; i++) {
    const step = src.steps[i];
    const base = `steps[${i}]`;
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      issue('invalid-step', base, 'Step must be an object.');
      continue;
    }
    const id = String(step.id ?? '');
    const action = String(step.action ?? '') as ActionKind;
    const toolId = String(step.toolId ?? '');
    if (!STEP_ID.test(id)) issue('invalid-step-id', `${base}.id`, 'Step id must be a safe identifier.');
    if (seen.has(id)) issue('duplicate-step-id', `${base}.id`, `Duplicate step id: ${id}.`);
    if (id) seen.add(id);
    if (!ACTIONS.has(action)) issue('invalid-action', `${base}.action`, 'Action is not a canonical ActionKind.');
    if (!ID.test(toolId)) issue('invalid-tool-id', `${base}.toolId`, 'toolId must be a safe identifier.');
    const input = step.input === undefined ? {} : step.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      issue('invalid-input', `${base}.input`, 'input must be a plain object.');
    }
    let serializedInput: string | undefined;
    try {
      serializedInput = JSON.stringify(input);
      if (typeof serializedInput !== 'string') {
        issue('input-not-json', `${base}.input`, 'input must serialize to a JSON object.');
      } else if (utf8ByteLength(serializedInput) > 8192) {
        issue('input-too-large', `${base}.input`, 'Serialized step input must be at most 8192 UTF-8 bytes.');
      }
    } catch {
      issue('input-not-json', `${base}.input`, 'input must be JSON serializable and contain no cycles.');
    }
    // Rebuild from canonical JSON rather than structuredClone: invalid cyclic/proxy-like
    // inputs must yield validation errors, not throw out of the validator.
    let isPlainInput = false;
    try {
      isPlainInput = Boolean(input && typeof input === 'object' && !Array.isArray(input) &&
        (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null));
    } catch {
      issue('input-not-plain-object', `${base}.input`, 'input must be a plain object without a throwing prototype trap.');
    }
    if (input && typeof input === 'object' && !Array.isArray(input) && !isPlainInput) {
      issue('invalid-input', `${base}.input`, 'input must be a plain object.');
    }
    let normalizedInput: Record<string, unknown> = {};
    if (isPlainInput && typeof serializedInput === 'string') {
      try { normalizedInput = JSON.parse(serializedInput) as Record<string, unknown>; }
      catch { issue('input-not-json', `${base}.input`, 'input must be valid JSON.'); }
    }
    const inputBindings: Record<string, string> = {};
    if (step.inputBindings !== undefined && (!step.inputBindings || typeof step.inputBindings !== 'object' || Array.isArray(step.inputBindings))) {
      issue('invalid-bindings', `${base}.inputBindings`, 'inputBindings must be an object.');
    } else {
      const bindingEntries = Object.entries(step.inputBindings ?? {});
      if (bindingEntries.length > 16) issue('too-many-bindings', `${base}.inputBindings`, 'At most 16 input bindings are allowed.');
      for (const [key, exprValue] of bindingEntries.slice(0, 16)) {
        const expr = String(exprValue);
        if (!KEY.test(key)) issue('invalid-binding-key', `${base}.inputBindings.${key}`, 'Binding target key is invalid.');
        const m = /^\$step:([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_-]+))?$/.exec(expr);
        if (!m) {
          issue('invalid-binding-expression', `${base}.inputBindings.${key}`, 'Only prior-step bindings ($step:id or $step:id.outputKey) are allowed.');
        } else if (!seen.has(m[1]) || m[1] === id || !priorOutputKeys.has(m[1])) {
          issue('forward-binding', `${base}.inputBindings.${key}`, 'Binding must reference an earlier step in this same schema.');
        } else if (m[2] && priorOutputKeys.get(m[1]) && !priorOutputKeys.get(m[1])!.has(m[2])) {
          issue('undeclared-output-binding', `${base}.inputBindings.${key}`, `Earlier step does not declare output key "${m[2]}".`);
        } else {
          inputBindings[key] = expr;
        }
      }
    }
    const expectedOutputKeys = normalizeKeys(step.expectedOutputKeys, `${base}.expectedOutputKeys`, 'invalid-output-key', issue);
    const requiredInputKeys = normalizeKeys(step.requiredInputKeys, `${base}.requiredInputKeys`, 'invalid-required-key', issue);
    if (step.fallbackToolIds !== undefined && !Array.isArray(step.fallbackToolIds)) {
      issue('invalid-fallback-tools', `${base}.fallbackToolIds`, 'fallbackToolIds must be an array.');
    }
    if (Array.isArray(step.fallbackToolIds) && step.fallbackToolIds.length > 4) {
      issue('too-many-fallback-tools', `${base}.fallbackToolIds`, 'At most four fallback tools are allowed per step.');
    }
    const fallbackToolIds = Array.isArray(step.fallbackToolIds)
      ? step.fallbackToolIds.slice(0, 4).map((x: unknown) => String(x))
      : [];
    for (let j = 0; j < fallbackToolIds.length; j++) {
      if (!ID.test(fallbackToolIds[j])) issue('invalid-fallback-tool', `${base}.fallbackToolIds[${j}]`, 'Fallback tool id is invalid.');
    }
    const attemptsRaw = step.maxAttempts === undefined ? 1 : Number(step.maxAttempts);
    const attempts = Number.isInteger(attemptsRaw) && attemptsRaw >= 1 && attemptsRaw <= 4 ? attemptsRaw : 1;
    if (step.maxAttempts !== undefined && attempts !== attemptsRaw) issue('invalid-max-attempts', `${base}.maxAttempts`, 'maxAttempts must be an integer between 1 and 4.');
    const costRaw = step.resourceCost01 === undefined ? .1 : Number(step.resourceCost01);
    const cost = Number.isFinite(costRaw) && costRaw >= 0 && costRaw <= .5 ? costRaw : .1;
    if (step.resourceCost01 !== undefined && cost !== costRaw) issue('invalid-resource-cost', `${base}.resourceCost01`, 'resourceCost01 must be finite and between 0 and 0.5.');
    maxAttempts += attempts;
    resourceCost01 += cost;
    normalizedSteps.push({
      id, action, toolId, input: normalizedInput,
      ...(Object.keys(inputBindings).length ? { inputBindings } : {}),
      ...(expectedOutputKeys.length ? { expectedOutputKeys } : {}),
      ...(requiredInputKeys.length ? { requiredInputKeys } : {}),
      ...(fallbackToolIds.length ? { fallbackToolIds } : {}),
      maxAttempts, // overwritten below with per-step value
      resourceCost01: cost,
    });
    normalizedSteps[normalizedSteps.length - 1].maxAttempts = attempts;
    priorOutputKeys.set(id, expectedOutputKeys.length ? new Set(expectedOutputKeys) : null);
  }
  if (src.policy !== undefined && (!src.policy || typeof src.policy !== 'object' || Array.isArray(src.policy))) {
    issue('invalid-policy', 'policy', 'policy must be an object.');
  }
  const policy = (src.policy && typeof src.policy === 'object' && !Array.isArray(src.policy)) ? src.policy : {};
  if (policy.requireVerified === false) issue('unverified-plan-forbidden', 'policy.requireVerified', 'MotorSchema cannot disable verified execution.');
  const maxTotalAttemptsRaw = policy.maxTotalAttempts === undefined ? 16 : Number(policy.maxTotalAttempts);
  const maxTotalAttempts = Number.isInteger(maxTotalAttemptsRaw) && maxTotalAttemptsRaw >= 2 && maxTotalAttemptsRaw <= 32 ? maxTotalAttemptsRaw : 16;
  if (policy.maxTotalAttempts !== undefined && maxTotalAttempts !== maxTotalAttemptsRaw) issue('invalid-attempt-budget', 'policy.maxTotalAttempts', 'maxTotalAttempts must be an integer between 2 and 32.');
  const maxTotalResourceCostRaw = policy.maxTotalResourceCost01 === undefined ? .8 : Number(policy.maxTotalResourceCost01);
  const maxTotalResourceCost01 = Number.isFinite(maxTotalResourceCostRaw) && maxTotalResourceCostRaw >= 0 && maxTotalResourceCostRaw <= 1 ? maxTotalResourceCostRaw : .8;
  if (policy.maxTotalResourceCost01 !== undefined && maxTotalResourceCost01 !== maxTotalResourceCostRaw) issue('invalid-resource-budget', 'policy.maxTotalResourceCost01', 'maxTotalResourceCost01 must be finite and between 0 and 1.');
  if (maxAttempts > maxTotalAttempts) issue('attempt-budget-exceeded', 'policy.maxTotalAttempts', `Plan requires ${maxAttempts} attempts but budget is ${maxTotalAttempts}.`);
  if (resourceCost01 > maxTotalResourceCost01 + 1e-9) issue('resource-budget-exceeded', 'policy.maxTotalResourceCost01', `Plan resource cost ${resourceCost01.toFixed(3)} exceeds budget ${maxTotalResourceCost01.toFixed(3)}.`);
  if (issues.length) return { ok: false, issues, totals: { steps: normalizedSteps.length, maxAttempts, resourceCost01 } };
  const schema: MotorSchema = {
    version: 1, id: src.id, projectId: src.projectId.trim(), name: src.name.trim(), origin: src.origin.trim(),
    steps: normalizedSteps,
    policy: { requireVerified: true, maxTotalAttempts, maxTotalResourceCost01 },
  };
  return { ok: true, issues: [], schema, totals: { steps: schema.steps.length, maxAttempts, resourceCost01 } };
}

function normalizeKeys(raw: unknown, path: string, code: string, issue: (code: string, path: string, message: string) => void): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) { issue(code, path, 'Value must be an array of safe keys.'); return []; }
  if (raw.length > 16) issue('too-many-keys', path, 'At most 16 keys are allowed.');
  const values = raw.slice(0, 16).map(x => String(x));
  for (const [i, key] of values.entries()) if (!KEY.test(key)) issue(code, `${path}[${i}]`, 'Key is invalid.');
  return [...new Set(values.filter(x => KEY.test(x)))];
}

export function motorSchemaToCompoundSkillInput(schema: MotorSchema): CompoundSkillCompileInput {
  return {
    projectId: schema.projectId,
    name: schema.name,
    origin: `motor-schema-v1:${schema.origin}`,
    steps: schema.steps.map(step => ({
      id: step.id, action: step.action, toolId: step.toolId,
      input: structuredClone(step.input ?? {}),
      ...(step.inputBindings ? { inputBindings: { ...step.inputBindings } } : {}),
      allowUnverified: false,
      ...(step.expectedOutputKeys ? { expectedOutputKeys: [...step.expectedOutputKeys] } : {}),
      ...(step.requiredInputKeys ? { requiredInputKeys: [...step.requiredInputKeys] } : {}),
      ...(step.fallbackToolIds ? { fallbackToolIds: [...step.fallbackToolIds] } : {}),
      maxAttempts: step.maxAttempts ?? 1,
      resourceCost01: step.resourceCost01 ?? .1,
    })),
  };
}
