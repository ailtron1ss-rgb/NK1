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
  const fields = readFields(preview, ['itemIds', 'rankedChannels', 'currentRrfK', 'currentRrfWeights', 'diagnostics']);
  if (!fields) throw new TypeError('memoryOS2 preview must be a plain data record');
  const settings = readFields(options, ['limit', 'rrfK', 'maxCandidatesPerChannel', 'channelWeights']);
  if (!settings) throw new TypeError('shadow evaluation options must be a plain data record');
  const limit = settings.limit ?? 8;
  const rrfK = settings.rrfK ?? fields.currentRrfK ?? 60;
  const maxCandidatesPerChannel = settings.maxCandidatesPerChannel ?? 64;
  const baselineIds = readDenseStrings(fields.itemIds, 64, 'itemIds');
  const rankedChannels = fields.rankedChannels;
  if (!isPlainRecord(rankedChannels)) throw new TypeError('rankedChannels must be a plain data record');
  const channelNames = Object.keys(rankedChannels);
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
    currentRrfWeights: fields.currentRrfWeights ?? null,
    diagnostics: {
      ...fused.diagnostics,
      answerabilityGate: diagnosticFields.answerabilityGate ?? null,
      rankedBeforeGate: diagnosticFields.rankedBeforeGate ?? 0,
      groundedAfterGate: diagnosticFields.groundedAfterGate ?? 0,
      abstained: diagnosticFields.abstained,
    },
  };
}
