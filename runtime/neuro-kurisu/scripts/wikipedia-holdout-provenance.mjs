import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Capture the exact public source revision and content digest used by the
 * mechanically-labelled bilingual holdout. Raw extracts stay in the dataset
 * snapshot; this manifest stores only provenance and hashes.
 */
export function createWikipediaSourcePageRecord({
  topicId,
  language,
  requestedTitle,
  summary,
  memoryId,
  usedAsMemory = false,
}) {
  if (typeof topicId !== 'string' || !/^topic-\d+$/.test(topicId)) {
    throw new Error('wikipedia-source-topic-id-invalid');
  }
  if (language !== 'en' && language !== 'ru') {
    throw new Error('wikipedia-source-language-invalid');
  }
  const requested = nonEmpty(requestedTitle);
  const title = nonEmpty(summary?.title) ?? requested;
  const extract = nonEmpty(summary?.extract);
  if (!requested || !title || !extract || extract.length < 40) {
    throw new Error('wikipedia-source-page-content-invalid');
  }
  const revisionValue = summary?.revision;
  const revision = typeof revisionValue === 'string' || typeof revisionValue === 'number'
    ? String(revisionValue).trim() || null
    : null;
  const pageId = Number.isSafeInteger(summary?.pageId) && summary.pageId > 0
    ? summary.pageId
    : null;
  const timestamp = nonEmpty(summary?.timestamp);
  const candidateUrl = nonEmpty(summary?.canonicalUrl);
  const canonicalUrl = candidateUrl && candidateUrl.startsWith(`https://${language}.wikipedia.org/wiki/`)
    ? candidateUrl
    : null;
  const selectedMemoryId = usedAsMemory ? nonEmpty(memoryId) : null;
  if (usedAsMemory && !selectedMemoryId) throw new Error('wikipedia-source-memory-id-required');

  return {
    topicId,
    language,
    requestedTitle: requested,
    title,
    pageId,
    revision,
    timestamp,
    canonicalUrl,
    contentSha256: sha256(extract),
    usedAsMemory: Boolean(usedAsMemory),
    memoryId: selectedMemoryId,
  };
}

/**
 * Build a deterministic, content-addressed manifest. Every topic must have one
 * English and one Russian source page, and exactly one of those pages must be
 * the single-language memory admitted for that topic.
 */
export function buildWikipediaSourceManifest(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('wikipedia-source-manifest-empty');
  }
  const sorted = pages.map((page) => ({ ...page })).sort((a, b) => {
    const left = `${a.topicId}\u0000${a.language}\u0000${a.requestedTitle}`;
    const right = `${b.topicId}\u0000${b.language}\u0000${b.requestedTitle}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const seen = new Set();
  const topics = new Map();
  for (const page of sorted) {
    const key = `${page.topicId}:${page.language}`;
    if (seen.has(key)) throw new Error('wikipedia-source-manifest-duplicate-page');
    seen.add(key);
    const group = topics.get(page.topicId) ?? [];
    group.push(page);
    topics.set(page.topicId, group);
  }
  for (const group of topics.values()) {
    if (group.length !== 2 || new Set(group.map((page) => page.language)).size !== 2) {
      throw new Error('wikipedia-source-manifest-language-pair-invalid');
    }
    if (group.filter((page) => page.usedAsMemory && typeof page.memoryId === 'string').length !== 1) {
      throw new Error('wikipedia-source-manifest-memory-selection-invalid');
    }
    if (group.some((page) => !page.usedAsMemory && page.memoryId !== null)) {
      throw new Error('wikipedia-source-manifest-unselected-memory-id');
    }
  }
  const sourceManifestSha256 = sha256(JSON.stringify(sorted));
  return {
    sourcePages: sorted,
    sourceManifestSha256,
    manifestAlgorithm: 'sha256-json-v1',
    datasetVersion: `wikipedia-rest-v1-${sourceManifestSha256.slice(0, 16)}`,
  };
}
