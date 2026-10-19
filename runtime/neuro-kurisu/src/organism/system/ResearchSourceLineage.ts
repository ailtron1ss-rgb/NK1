import { createHash } from 'node:crypto';

/**
 * Conservative cross-publisher syndication detection for research evidence.
 *
 * This is lexical near-duplicate detection, not semantic source genealogy. It only
 * merges pages when their normalized canonical URL, extracted content hash, or a
 * high-overlap sequence of long word shingles matches. Short excerpts are never
 * merged by topical similarity alone. Unknown lineage remains a first-class result.
 */
export type ResearchLineageRelation = 'same-document' | 'identical-content' | 'near-duplicate' | 'distinct' | 'insufficient-text';

export interface ResearchLineageCandidate {
  url?: string;
  documentKey?: string;
  contentHash?: string;
  title?: string;
  snippet?: string;
  sourceLineageKey?: string;
}

export interface ResearchLineageMatch {
  sourceLineageKey: string;
  relation: ResearchLineageRelation;
  similarity01: number;
  matchedPriorIndex: number | null;
}

const MAX_TEXT = 1200;
const MIN_TOKENS_FOR_NEAR_DUPLICATE = 48;
const MIN_SHINGLES_FOR_NEAR_DUPLICATE = 28;
const SHINGLE_SIZE = 5;
const JACCARD_THRESHOLD = 0.78;
const CONTAINMENT_THRESHOLD = 0.9;

function clean(value: unknown, max = MAX_TEXT): string {
  return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function canonicalResearchDocumentKey(rawUrl: string): string {
  try {
    const url = new URL(String(rawUrl ?? ''));
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    // Strip known measurement parameters but preserve meaningful query parameters.
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|gclid|dclid|fbclid|msclkid|mc_cid|mc_eid|ref|ref_src|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return `${url.protocol}//${url.host}${url.pathname}${url.search}`.slice(0, 1000);
  } catch {
    return '';
  }
}

function tokens(candidate: ResearchLineageCandidate): string[] {
  const text = `${clean(candidate.title, 240)} ${clean(candidate.snippet)}`.toLocaleLowerCase();
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function shinglesFor(input: ResearchLineageCandidate): Set<string> {
  const words = tokens(input);
  const result = new Set<string>();
  if (words.length < MIN_TOKENS_FOR_NEAR_DUPLICATE) return result;
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) result.add(words.slice(i, i + SHINGLE_SIZE).join(' '));
  return result;
}

function overlap(a: Set<string>, b: Set<string>): { jaccard: number; containment: number } {
  if (!a.size || !b.size) return { jaccard: 0, containment: 0 };
  let intersection = 0;
  for (const shingle of a) if (b.has(shingle)) intersection++;
  return { jaccard: intersection / (a.size + b.size - intersection), containment: intersection / Math.min(a.size, b.size) };
}

function digest(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function fallbackLineage(candidate: ResearchLineageCandidate): string {
  const document = canonicalResearchDocumentKey(candidate.url ?? candidate.documentKey ?? '');
  if (document) return digest('doc', document);
  const contentHash = clean(candidate.contentHash, 96).toLowerCase();
  if (/^[a-f0-9]{32,96}$/.test(contentHash)) return digest('content', contentHash);
  const normalized = tokens(candidate).join(' ');
  return normalized ? digest('text', normalized) : digest('unknown', 'no-source-identity');
}

/** Match a fetched page against the bounded research session's existing lineage clusters. */
export function resolveResearchSourceLineage(
  candidate: ResearchLineageCandidate,
  previous: ResearchLineageCandidate[],
): ResearchLineageMatch {
  const candidateDocument = canonicalResearchDocumentKey(candidate.url ?? candidate.documentKey ?? '');
  const candidateHash = clean(candidate.contentHash, 96).toLowerCase();
  const candidateShingles = shinglesFor(candidate);
  const candidates = (Array.isArray(previous) ? previous : []).slice(0, 24);

  // Exact document identity takes precedence over content identity: revised versions
  // of a page remain one document lineage, while the firewall detects changed hashes.
  for (let i = 0; i < candidates.length; i++) {
    const prior = candidates[i]!;
    const priorDocument = canonicalResearchDocumentKey(prior.url ?? prior.documentKey ?? '');
    if (candidateDocument && priorDocument && candidateDocument === priorDocument) {
      return { sourceLineageKey: prior.sourceLineageKey || fallbackLineage(prior), relation: 'same-document', similarity01: 1, matchedPriorIndex: i };
    }
  }

  // Identical extracted page hashes across different domains are the strongest
  // direct syndication signal available without examining publisher attribution.
  if (/^[a-f0-9]{32,96}$/.test(candidateHash)) {
    for (let i = 0; i < candidates.length; i++) {
      const prior = candidates[i]!;
      if (candidateHash === clean(prior.contentHash, 96).toLowerCase()) {
        return { sourceLineageKey: prior.sourceLineageKey || fallbackLineage(prior), relation: 'identical-content', similarity01: 1, matchedPriorIndex: i };
      }
    }
  }

  if (candidateShingles.size >= MIN_SHINGLES_FOR_NEAR_DUPLICATE) {
    let best: { index: number; jaccard: number; containment: number; key: string } | null = null;
    for (let i = 0; i < candidates.length; i++) {
      const prior = candidates[i]!;
      const priorShingles = shinglesFor(prior);
      if (priorShingles.size < MIN_SHINGLES_FOR_NEAR_DUPLICATE) continue;
      const score = overlap(candidateShingles, priorShingles);
      const matches = (score.jaccard >= JACCARD_THRESHOLD) || (score.jaccard >= 0.62 && score.containment >= CONTAINMENT_THRESHOLD);
      if (matches && (!best || score.jaccard > best.jaccard)) best = { index: i, jaccard: score.jaccard, containment: score.containment, key: prior.sourceLineageKey || fallbackLineage(prior) };
    }
    if (best) return { sourceLineageKey: best.key, relation: 'near-duplicate', similarity01: Number(best.jaccard.toFixed(4)), matchedPriorIndex: best.index };
  }

  const hasEnoughText = tokens(candidate).length >= MIN_TOKENS_FOR_NEAR_DUPLICATE;
  return {
    sourceLineageKey: fallbackLineage(candidate),
    relation: hasEnoughText ? 'distinct' : 'insufficient-text',
    similarity01: 0,
    matchedPriorIndex: null,
  };
}

/** A stable, low-disclosure lineage descriptor suitable for logs and persisted memory metadata. */
export function summarizeResearchLineage(candidate: ResearchLineageCandidate): { sourceLineageKey: string; canonicalDocumentKey: string } {
  return {
    sourceLineageKey: candidate.sourceLineageKey || fallbackLineage(candidate),
    canonicalDocumentKey: canonicalResearchDocumentKey(candidate.url ?? candidate.documentKey ?? ''),
  };
}
