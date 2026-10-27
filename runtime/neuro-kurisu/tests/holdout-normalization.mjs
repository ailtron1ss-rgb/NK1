import { createHash } from 'node:crypto';

export function normalizeHoldoutQuery(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function canonicalizeHoldoutRows(rows) {
  return [...rows]
    .map((row) => ({
      id: row.id,
      query: normalizeHoldoutQuery(row.query),
      ...(row.language === undefined ? {} : { language: row.language }),
      relevantIds: [...new Set(row.relevantIds)].sort(),
      split: row.split,
      answerable: row.answerable !== false,
    }))
    .sort((a, b) =>
      a.id.localeCompare(b.id) ||
      a.split.localeCompare(b.split) ||
      a.query.localeCompare(b.query) ||
      a.relevantIds.join('\0').localeCompare(b.relevantIds.join('\0')),
    );
}

export function hashHoldoutRows(rows) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeHoldoutRows(rows)))
    .digest('hex');
}
