import { types as nodeTypes } from 'node:util';

const DEFAULT_RRF_K = 60;
const MAX_CHANNELS = 8;
const MAX_ID_LENGTH = 256;

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || nodeTypes.isProxy(value) || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readOwnData(record, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor) return { valid: true, value: undefined };
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { valid: false, value: undefined };
    return { valid: true, value: descriptor.value };
  } catch {
    return { valid: false, value: undefined };
  }
}

function readFields(record, keys) {
  if (!isPlainRecord(record)) return null;
  const result = Object.create(null);
  for (const key of keys) {
    const field = readOwnData(record, key);
    if (!field.valid) return null;
    result[key] = field.value;
  }
  return result;
}

function readDensePrefix(value, maximum) {
  try {
    if (nodeTypes.isProxy(value) || !Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor && Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      ? lengthDescriptor.value : Number.NaN;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return null;
    const count = Math.min(length, maximum);
    const items = [];
    for (let index = 0; index < count; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      items.push(descriptor.value);
    }
    return { items, length };
  } catch {
    return null;
  }
}

function requireInteger(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(name + ' out of bounds');
  }
}

function validateId(value, name) {
  if (typeof value !== 'string' || !value.length || value.length > MAX_ID_LENGTH || value.trim() !== value) {
    throw new TypeError(name + ' invalid');
  }
}

/** Candidate-only shadow fusion. Never reads or persists memory text. */
export function combineRankedMemoryChannels(input) {
  const fields = readFields(input, ['channels', 'subjectId', 'limit', 'rrfK', 'maxCandidatesPerChannel']);
  if (!fields) throw new TypeError('input must be a plain record with own data properties');
  const channelRows = readDensePrefix(fields.channels, MAX_CHANNELS);
  if (!channelRows || channelRows.length < 1 || channelRows.length > MAX_CHANNELS || channelRows.items.length !== channelRows.length) {
    throw new TypeError('channels out of bounds or malformed');
  }
  const subjectId = fields.subjectId ?? null;
  const limit = fields.limit ?? 8;
  const rrfK = fields.rrfK ?? DEFAULT_RRF_K;
  const maxCandidatesPerChannel = fields.maxCandidatesPerChannel ?? 64;
  if (subjectId !== null) validateId(subjectId, 'subjectId');
  requireInteger(limit, 'limit', 1, 64);
  requireInteger(rrfK, 'rrfK', 1, 1000);
  requireInteger(maxCandidatesPerChannel, 'maxCandidatesPerChannel', 1, 512);

  const names = new Set();
  const aggregate = new Map();
  const diagnostics = {
    channels: channelRows.length,
    candidatesSeen: 0,
    candidatesScopedOut: 0,
    duplicateRefs: 0,
    uniqueCandidates: 0,
  };

  for (const channelValue of channelRows.items) {
    const channel = readFields(channelValue, ['name', 'candidates', 'weight']);
    if (!channel) throw new TypeError('channel must be a plain data record');
    const { name, candidates } = channel;
    const weight = channel.weight ?? 1;
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/i.test(name)) throw new TypeError('invalid channel name');
    if (names.has(name)) throw new TypeError('duplicate channel name');
    names.add(name);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 4) throw new TypeError('channel weight out of bounds');

    const candidateRows = readDensePrefix(candidates, maxCandidatesPerChannel);
    if (!candidateRows) throw new TypeError('candidates must be a dense data array');
    const seen = new Set();
    for (let index = 0; index < candidateRows.items.length; index += 1) {
      const candidate = readFields(candidateRows.items[index], ['id', 'subjectId']);
      diagnostics.candidatesSeen += 1;
      if (!candidate) throw new TypeError('candidate must be a plain data record');
      validateId(candidate.id, 'candidate id');
      if (candidate.subjectId !== undefined) validateId(candidate.subjectId, 'candidate subjectId');
      if (subjectId !== null && candidate.subjectId !== subjectId) {
        diagnostics.candidatesScopedOut += 1;
        continue;
      }
      if (seen.has(candidate.id)) {
        diagnostics.duplicateRefs += 1;
        continue;
      }
      seen.add(candidate.id);
      const rank = index + 1;
      let row = aggregate.get(candidate.id);
      if (!row) {
        row = { id: candidate.id, score: 0, bestRank: rank, ranks: [] };
        aggregate.set(candidate.id, row);
      }
      row.score += weight / (rrfK + rank);
      row.bestRank = Math.min(row.bestRank, rank);
      row.ranks.push({ channel: name, rank });
    }
  }

  const items = [...aggregate.values()]
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(row => ({
      id: row.id,
      score: row.score,
      bestRank: row.bestRank,
      ranks: row.ranks.sort((a, b) => a.channel.localeCompare(b.channel)),
    }));
  diagnostics.uniqueCandidates = aggregate.size;
  return { items, diagnostics };
}

/** Privacy-reduced overlap comparator for offline ranking evaluation. */
export function compareRankedLists(left, right, k = 5) {
  requireInteger(k, 'k', 1, 1000);
  const leftRows = readDensePrefix(left, k);
  const rightRows = readDensePrefix(right, k);
  if (!leftRows || !rightRows) throw new TypeError('ranked lists must be dense arrays');
  const collectIds = rows => rows.items.map(row => {
    const fields = readFields(row, ['id']);
    if (!fields) throw new TypeError('ranked item must be a plain data record');
    return fields.id;
  }).filter(value => typeof value === 'string');
  const a = new Set(collectIds(leftRows));
  const b = new Set(collectIds(rightRows));
  const overlap = [...a].filter(value => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return {
    leftCount: a.size,
    rightCount: b.size,
    overlapAtK: overlap,
    jaccardAtK: union ? overlap / union : 1,
  };
}
