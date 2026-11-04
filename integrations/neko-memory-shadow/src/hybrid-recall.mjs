const DEFAULT_RRF_K = 60;
const MAX_CHANNELS = 8;
const MAX_ID_LENGTH = 256;
function isRecord(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}
function integer(v, name, min, max) {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new TypeError(name + ' out of bounds');
}
function id(v, name) {
  if (typeof v !== 'string' || !v.length || v.length > MAX_ID_LENGTH || v.trim() !== v) throw new TypeError(name + ' invalid');
}

/** Candidate-only shadow fusion. Never reads or persists memory text. */
export function combineRankedMemoryChannels(input) {
  if (!isRecord(input)) throw new TypeError('input must be a plain record');
  const { channels, subjectId = null, limit = 8, rrfK = DEFAULT_RRF_K, maxCandidatesPerChannel = 64 } = input;
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > MAX_CHANNELS) throw new TypeError('channels out of bounds');
  if (subjectId !== null) id(subjectId, 'subjectId');
  integer(limit, 'limit', 1, 64);
  integer(rrfK, 'rrfK', 1, 1000);
  integer(maxCandidatesPerChannel, 'maxCandidatesPerChannel', 1, 512);
  const names = new Set(), aggregate = new Map();
  const diagnostics = { channels: channels.length, candidatesSeen: 0, candidatesScopedOut: 0, duplicateRefs: 0, uniqueCandidates: 0 };
  for (const channel of channels) {
    if (!isRecord(channel)) throw new TypeError('channel must be a plain record');
    const { name, candidates, weight = 1 } = channel;
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/i.test(name)) throw new TypeError('invalid channel name');
    if (names.has(name)) throw new TypeError('duplicate channel name');
    names.add(name);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 4) throw new TypeError('channel weight out of bounds');
    if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
    const seen = new Set(), count = Math.min(candidates.length, maxCandidatesPerChannel);
    for (let i = 0; i < count; i++) {
      const candidate = candidates[i];
      diagnostics.candidatesSeen++;
      if (!isRecord(candidate)) throw new TypeError('candidate must be a plain record');
      id(candidate.id, 'candidate id');
      if (candidate.subjectId !== undefined) id(candidate.subjectId, 'candidate subjectId');
      // Apply ownership filtering before any rank can affect the score.
      if (subjectId !== null && candidate.subjectId !== subjectId) {
        diagnostics.candidatesScopedOut++;
        continue;
      }
      if (seen.has(candidate.id)) {
        diagnostics.duplicateRefs++;
        continue;
      }
      seen.add(candidate.id);
      const rank = i + 1;
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
    .map(row => ({ ...row, ranks: row.ranks.sort((a, b) => a.channel.localeCompare(b.channel)) }));
  diagnostics.uniqueCandidates = aggregate.size;
  return { items, diagnostics };
}

/** Privacy-reduced overlap comparator for offline ranking evaluation. */
export function compareRankedLists(left, right, k = 5) {
  if (!Array.isArray(left) || !Array.isArray(right)) throw new TypeError('ranked lists must be arrays');
  integer(k, 'k', 1, 1000);
  const a = new Set(left.slice(0, k).map(x => x?.id).filter(x => typeof x === 'string'));
  const b = new Set(right.slice(0, k).map(x => x?.id).filter(x => typeof x === 'string'));
  const overlap = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return { leftCount: a.size, rightCount: b.size, overlapAtK: overlap, jaccardAtK: union ? overlap / union : 1 };
}
