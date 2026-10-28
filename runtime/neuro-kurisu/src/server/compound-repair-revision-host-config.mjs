import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

/**
 * Load the independently configured evaluation authorities from a distinct,
 * host-owned module. The repair provider can propose/generate candidates, but
 * cannot supply its own executor, verifier, scanner, task schedule, or holdout.
 */
export async function createIndependentEvaluationConfigFactory(input) {
  const setting = String(input?.moduleSetting ?? '').trim();
  const production = input?.production === true;
  if (!setting) {
    if (production) {
      throw new Error('production-compound-repair-revision-requires-independent-evaluation-config-module');
    }
    return undefined;
  }
  if (!isNonEmptyString(input.root) || !isNonEmptyString(input.stateDirectory) ||
      typeof input.createHostOwnedFactory !== 'function') {
    throw new Error('compound-repair-independent-evaluation-loader-config-invalid');
  }

  const configuredPath = path.isAbsolute(setting) ? path.resolve(setting) : path.resolve(input.root, setting);
  const evaluationPath = await realpath(configuredPath);
  const moduleMetadata = await stat(evaluationPath);
  if (!moduleMetadata.isFile()) {
    throw new Error('compound-repair-independent-evaluator-module-must-be-regular-file');
  }
  if (process.platform !== 'win32' && (moduleMetadata.mode & 0o022) !== 0) {
    throw new Error('compound-repair-independent-evaluator-module-must-not-be-group-or-world-writable');
  }
  // The authority config is executable policy: never load it from the mutable
  // organism state directory where learned data or runtime artifacts may be written.
  const statePath = path.resolve(input.stateDirectory);
  const stateRelative = path.relative(statePath, evaluationPath);
  if (stateRelative === '' || (!stateRelative.startsWith('..' + path.sep) &&
      stateRelative !== '..' && !path.isAbsolute(stateRelative))) {
    throw new Error('compound-repair-independent-evaluator-module-must-be-outside-state-directory');
  }
  if (input.providerModulePath) {
    const providerPath = await realpath(path.resolve(input.providerModulePath));
    if (evaluationPath === providerPath) {
      throw new Error('compound-repair-provider-and-independent-evaluator-modules-must-be-distinct');
    }
  }

  const loaded = await import(pathToFileURL(evaluationPath).href);
  const createHostConfig = loaded.createIndependentEvaluationHostConfig ?? loaded.default;
  if (typeof createHostConfig !== 'function') {
    throw new Error('independent-evaluation-config-module-must-export-createIndependentEvaluationHostConfig');
  }

  // Give this module no engine/store/registry capability; it owns only evaluator
  // process configuration, task plans and the fixed experiment authority.
  const hostOptions = await createHostConfig({ stateDirectory: input.stateDirectory });
  if (!isRecord(hostOptions) || !isRecord(hostOptions.commands) ||
      !isRecord(hostOptions.commands.executor) ||
      !isRecord(hostOptions.commands.verifier) ||
      !isRecord(hostOptions.commands.safetyScanner) ||
      typeof hostOptions.tasksForRepair !== 'function' ||
      typeof hostOptions.environmentFingerprintForRepair !== 'function') {
    throw new Error('independent-evaluation-host-config-incomplete');
  }
  if (production && typeof hostOptions.experimentAuthorityForRepair !== 'function') {
    throw new Error('production-independent-evaluation-requires-host-owned-experiment-authority');
  }
  const baselineMethod = hostOptions.baselineMethod;
  const sourceCandidateMethod = hostOptions.sourceCandidateMethod;
  if (production &&
      (typeof baselineMethod !== 'string' || !baselineMethod.trim() ||
       typeof sourceCandidateMethod !== 'string' || !sourceCandidateMethod.trim() ||
       baselineMethod === sourceCandidateMethod)) {
    throw new Error('production-independent-evaluation-baseline-and-source-methods-required');
  }

  const factory = await input.createHostOwnedFactory(hostOptions);
  if (typeof factory !== 'function') {
    throw new Error('host-owned-independent-evaluation-factory-invalid');
  }
  return repair => {
    const config = factory(repair);
    if (!config || typeof config !== 'object') {
      throw new Error('host-owned-independent-evaluation-config-invalid');
    }
    const revisionMethod = config.experimentAuthority?.method;
    const methods = [baselineMethod, sourceCandidateMethod, revisionMethod];
    if (production &&
        (methods.some(method => typeof method !== 'string' || !method.trim()) ||
         new Set(methods).size !== methods.length)) {
      throw new Error('production-independent-evaluation-methods-must-be-distinct');
    }
    if (production) {
      for (const plan of [config.experimentAuthority.validationPlan, config.experimentAuthority.holdoutPlan]) {
        const scheduled = new Set(plan.arms.map(arm => arm.method));
        if (methods.some(method => !scheduled.has(method))) {
          throw new Error('production-independent-evaluation-method-not-in-experiment-plan');
        }
      }
    }
    return {
      ...config,
      ...(typeof baselineMethod === 'string' ? { baselineMethod } : {}),
      ...(typeof sourceCandidateMethod === 'string' ? { sourceCandidateMethod } : {}),
    };
  };
}

/**
 * Parse an explicit opt-in schedule for background revision from verified repairs.
 * An absent value keeps background revision disabled; malformed values fail startup.
 */
export function parseCompoundRepairBackgroundRevisionConfig(raw) {
  const source = String(raw ?? '').trim();
  if (!source) return undefined;

  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('compound-repair-background-revision-json-invalid');
  }
  if (!isRecord(value) ||
      Object.keys(value).some(key => !['enabled', 'initialDelayMs', 'intervalMs'].includes(key)) ||
      typeof value.enabled !== 'boolean') {
    throw new Error('compound-repair-background-revision-config-invalid');
  }
  if (value.initialDelayMs !== undefined &&
      (!Number.isSafeInteger(value.initialDelayMs) || value.initialDelayMs < 0 || value.initialDelayMs > 86_400_000)) {
    throw new Error('compound-repair-background-revision-initial-delay-invalid');
  }
  if (value.intervalMs !== undefined &&
      (!Number.isSafeInteger(value.intervalMs) || value.intervalMs < 60_000 || value.intervalMs > 86_400_000)) {
    throw new Error('compound-repair-background-revision-interval-invalid');
  }
  return {
    enabled: value.enabled,
    ...(value.initialDelayMs === undefined ? {} : { initialDelayMs: value.initialDelayMs }),
    ...(value.intervalMs === undefined ? {} : { intervalMs: value.intervalMs }),
  };
}
