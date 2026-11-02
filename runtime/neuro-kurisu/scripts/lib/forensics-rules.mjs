import crypto from 'node:crypto';
import path from 'node:path';
import { maskNonCode } from './source-mask.mjs';

export const MAX_LINE = 800;

const CODE_LIKE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|json)$/i;
const LEGAL_FILE = /^(license|licence|notice|copying|authors|patents)(\.[a-z]+)?$/i;

// A line is a readability defect when it carries too much *code*. In code/JSON a long
// string, template literal, URL or regex is data, not logic, so it is ignored — this
// mirrors ESLint max-len defaults (ignoreStrings/ignoreUrls/ignoreTemplateLiterals/
// ignoreRegExpLiterals/ignoreComments). Prose files are still measured raw.
export function longLineMeasure(rel, line) {
  return CODE_LIKE.test(rel) ? maskNonCode(line).replace(/\s/g, '').length : line.length;
}

export function isLongLine(rel, line) {
  return longLineMeasure(rel, line) > MAX_LINE;
}

// Identical basenames are not always duplication: vendored upstream intake keeps each
// project's own files byte-for-byte, legal files legitimately share a name, and a
// runnable harness (scripts/ or src/) intentionally shares its basename with its
// assertion test (tests/). Only byte-identical harness/test pairs are real copy-paste.
export function isDuplicateNameGroup(group, readFile = null) {
  if (group.length < 2) return false;
  if (group.every(p => path.basename(p).toLowerCase() === 'index.ts')) return false;
  if (group.every(p => LEGAL_FILE.test(path.basename(p)))) return false;
  if (group.every(p => p.startsWith('research/vendor/'))) return false;
  const isHarness = p => p.startsWith('scripts/') || p.startsWith('src/');
  const isTest = p => p.startsWith('tests/');
  if (group.length === 2 && group.some(isHarness) && group.some(isTest)) {
    if (!readFile) return true;
    const bodies = group.map(p => {
      try { return crypto.createHash('sha256').update(readFile(p)).digest('hex'); } catch { return p; }
    });
    if (new Set(bodies).size > 1) return false;
  }
  return true;
}
