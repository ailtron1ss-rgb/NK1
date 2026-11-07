import { types as nodeTypes } from 'node:util';
import { combineRankedMemoryChannels, compareRankedLists } from './hybrid-recall.mjs';

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || nodeTypes.isProxy(value) || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readFields(record, keys) {
  if (!isPlainRecord(record)) return null;
  const result = Object.create(null);
  for (const key of keys) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (descriptor && !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      result[key] = descriptor?.value;
    } catch {
      return null;
    }
  }
  return result;
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function copyWeightRecord(value) {
  if (value === null || value === undefined) return null;
  if (!isPlainRecord(value)) throw new TypeError('currentRrfWeights must be a plain data record');
  const result = Object.create(null);
  for (const name of Object.keys(value).sort(compareCodeUnits)) {
    const fields = readFields(value, [name]);
    const weight = fields?.[name];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 4) {
      throw new TypeError(`currentRrfWeights.${name} is invalid`);
    }
    result[name] = weight;
  }
  return result;
}

function readDenseStrings(value, maximum, fieldName) {
  try {
    if (nodeTypes.isProxy(value) || !Array.isArray(value)) throw new TypeError(`${fieldName} must be a dense string array`);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maximum) throw new TypeError(`${fieldName} exceeds its bound`);
    const result = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'string') {
        throw new TypeError(`${fieldName} must contain only own data strings`);
      }
      result.push(descriptor.value);
    }
    return result;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError(`${fieldName} must be a dense string array`);
  }
}

/** Evaluate an isolated MemoryOS2 ranked-channel preview with alternate RRF weights. */
export function evaluateMemoryOS2ShadowPreview(preview, options = {}) {
  const fields = readFields(preview, ['itemIds', 'rankedChannels', 'currentRrfK', 'currentRrfWeights', 'diagnostics', 'maxPerChannel']);
  if (!fields) throw new TypeError('memoryOS2 preview must be a plain data record');
  const settings = readFields(options, ['limit', 'rrfK', 'maxCandidatesPerChannel', 'channelWeights']);
  if (!settings) throw new TypeError('shadow evaluation options must be a plain data record');
  const limit = settings.limit ?? 8;
  const rrfK = settings.rrfK ?? fields.currentRrfK ?? 60;
  const maxCandidatesPerChannel = settings.maxCandidatesPerChannel ?? fields.maxPerChannel ?? 64;
  const baselineIds = readDenseStrings(fields.itemIds, 64, 'itemIds');
  const rankedChannels = fields.rankedChannels;
  if (!isPlainRecord(rankedChannels)) throw new TypeError('rankedChannels must be a plain data record');
  const channelNames = Object.keys(rankedChannels).sort(compareCodeUnits);
  if (channelNames.length < 1 || channelNames.length > 8) throw new TypeError('ranked channel count out of bounds');
  const weights = settings.channelWeights;
  if (weights !== undefined && !isPlainRecord(weights)) throw new TypeError('channelWeights must be a plain data record');
  const channels = channelNames.map(name => {
    const idsField = readFields(rankedChannels, [name]);
    if (!idsField) throw new TypeError(`ranked channel ${name} is not own data`);
    const ids = readDenseStrings(idsField[name], maxCandidatesPerChannel, `rankedChannels.${name}`);
    let weight = 1;
    if (weights !== undefined) {
      const weightField = readFields(weights, [name]);
      if (!weightField) throw new TypeError(`channel weight ${name} is not own data`);
      if (weightField[name] !== undefined) weight = weightField[name];
    }
    return { name, weight, candidates: ids.map(id => ({ id })) };
  });
  if (weights !== undefined && Object.keys(weights).some(name => !channelNames.includes(name))) {
    throw new TypeError('channelWeights contains an unknown channel');
  }
  const diagnosticFields = readFields(fields.diagnostics, ['abstained', 'answerabilityGate', 'rankedBeforeGate', 'groundedAfterGate']);
  if (!diagnosticFields || typeof diagnosticFields.abstained !== 'boolean') {
    throw new TypeError('MemoryOS2 answerability diagnostics are required');
  }
  if (diagnosticFields.abstained && (baselineIds.length > 0 || channels.some(channel => channel.candidates.length > 0))) {
    throw new TypeError('abstained preview cannot contain ranked candidates');
  }
  const fused = combineRankedMemoryChannels({ channels, limit, rrfK, maxCandidatesPerChannel });
  const comparison = compareRankedLists(baselineIds.map(id => ({ id })), fused.items, limit);
  return {
    baselineIds,
    shadowIds: fused.items.map(item => item.id),
    shadowItems: fused.items,
    channelNames,
    overlapAtK: comparison.overlapAtK,
    jaccardAtK: comparison.jaccardAtK,
    currentRrfK: fields.currentRrfK ?? null,
    currentRrfWeights: copyWeightRecord(fields.currentRrfWeights),
    diagnostics: {
      ...fused.diagnostics,
      answerabilityGate: diagnosticFields.answerabilityGate ?? null,
      rankedBeforeGate: diagnosticFields.rankedBeforeGate ?? 0,
      groundedAfterGate: diagnosticFields.groundedAfterGate ?? 0,
      abstained: diagnosticFields.abstained,
    },
  };
}

/**
 * Optional N.E.K.O.-style lexical + cosine preview over the existing MemoryOS2 owner.
 * The semantic provider is called only when explicitly enabled. Vector-only candidates
 * for a canonically abstained query remain exploratory IDs and never enter shadow fusion.
 */
export async function previewNekoHybridMemoryRanking(memory, query, options = {}) {
  if (!memory || typeof memory.previewRetrieveWithRankedChannels !== 'function' ||
      typeof memory.previewRetrieveWithEmbeddings !== 'function') {
    throw new TypeError('memoryOS2 preview methods are required');
  }
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('query must be a non-empty string');
  const settings = readFields(options, [
    'limit', 'maxPerChannel', 'goalRelevance', 'identityRelevance', 'temporalOptions',
    'includeSemanticEmbeddingChannel', 'semanticWeight', 'semanticProviderTimeoutMs', 'rrfK', 'channelWeights', 'useCanonicalWeights',
  ]);
  if (!settings) throw new TypeError('hybrid preview options must be a plain data record');
  const limit = settings.limit ?? 8;
  const maxPerChannel = settings.maxPerChannel ?? 64;
  const goalRelevance = settings.goalRelevance ?? 0;
  const identityRelevance = settings.identityRelevance ?? 0;
  const temporalOptions = settings.temporalOptions ?? {};
  const baseline = memory.previewRetrieveWithRankedChannels(query, limit, goalRelevance, identityRelevance, temporalOptions, maxPerChannel);
  let rankedChannels = baseline.rankedChannels;
  let semantic = { enabled: false, provider: 'none', model: '', fallbackReason: settings.includeSemanticEmbeddingChannel === true ? 'not-requested-or-unavailable' : 'not-requested', coverage01: 0, indexedItems: 0, corpusItems: 0 };
  let exploratorySemanticIds = [];
  if (settings.useCanonicalWeights !== undefined && typeof settings.useCanonicalWeights !== 'boolean') throw new TypeError('useCanonicalWeights must be boolean');
  let channelWeights = settings.channelWeights ?? (settings.useCanonicalWeights === true ? baseline.currentRrfWeights : undefined);

  if (settings.includeSemanticEmbeddingChannel === true) {
    const semanticLimit = Math.max(1, Math.min(32, Math.floor(maxPerChannel)));
    const semanticPreview = await memory.previewRetrieveWithEmbeddings(query, semanticLimit, goalRelevance, identityRelevance, temporalOptions, {
      maxLexicalPool: Math.max(8, Math.min(96, semanticLimit * 2)),
      maxIndexItems: Math.max(1, Math.min(96, semanticLimit * 2)),
      ...(Number.isFinite(settings.semanticProviderTimeoutMs) ? { providerTimeoutMs: settings.semanticProviderTimeoutMs } : {}),
    });
    semantic = {
      enabled: semanticPreview.semantic.enabled,
      provider: semanticPreview.semantic.provider,
      model: semanticPreview.semantic.model,
      fallbackReason: semanticPreview.semantic.fallbackReason,
      coverage01: semanticPreview.semantic.coverage01,
      indexedItems: semanticPreview.semantic.indexedItems,
      corpusItems: semanticPreview.semantic.corpusItems,
    };
    if (semanticPreview.semantic.enabled) {
      const semanticIds = semanticPreview.items.map(item => item.id);
      if (baseline.diagnostics?.abstained === true) {
        exploratorySemanticIds = semanticIds;
      } else {
        rankedChannels = { ...baseline.rankedChannels, vector: semanticIds };
      }
      if (baseline.diagnostics?.abstained !== true && channelWeights === undefined && settings.semanticWeight !== undefined) {
        channelWeights = { vector: settings.semanticWeight };
      } else if (baseline.diagnostics?.abstained !== true && channelWeights !== undefined && settings.semanticWeight !== undefined) {
        if (!isPlainRecord(channelWeights)) throw new TypeError('channelWeights must be a plain data record');
        const copiedWeights = Object.create(null);
        for (const name of Object.keys(channelWeights)) {
          const existing = readFields(channelWeights, [name]);
          if (!existing) throw new TypeError(`channel weight ${name} must be own data`);
          copiedWeights[name] = existing[name];
        }
        copiedWeights.vector = copiedWeights.vector ?? settings.semanticWeight;
        channelWeights = copiedWeights;
      }
    }
  }

  const result = evaluateMemoryOS2ShadowPreview({ ...baseline, rankedChannels }, {
    limit,
    rrfK: settings.rrfK,
    maxCandidatesPerChannel: maxPerChannel,
    channelWeights,
  });
  return {
    ...result,
    semantic,
    exploratorySemanticIds,
    semanticIncludedInShadowFusion: semantic.enabled && baseline.diagnostics?.abstained !== true,
    semanticExploratoryOnly: semantic.enabled && baseline.diagnostics?.abstained === true,
    userFacingEligible: false,
    rrfProfile: settings.channelWeights !== undefined || settings.semanticWeight !== undefined ? 'custom' : (settings.useCanonicalWeights === true ? 'memoryos2' : 'equal'),
  };
}
