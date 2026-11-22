import { snapshotPlainData } from '../../core/PlainDataSnapshot.ts';
export const HMX_IMPORT_REDACTED_PATTERN_IDS = Object.freeze([
  'private-key',
  'credential-url',
  'bearer-token',
  'github-token',
  'provider-token',
  'aws-access-key',
  'jwt',
  'secret-assignment',
  'email-address',
  'phone-number',
]);

const PATTERNS: Array<[string, RegExp]> = [
  ['private-key', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi],
  ['credential-url', /https?:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi],
  ['github-token', /\b(?:github_pat_[A-Za-z0-9_]{16,}|gh[pousr]_[A-Za-z0-9]{16,})\b/gi],
  ['provider-token', /\b(?:sk|rk|pk|api|token)[_-][A-Za-z0-9_-]{16,}\b/gi],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['secret-assignment', /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi],
  ['email-address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  // A non-word lookbehind is required because a leading '+' is itself non-word.
  ['phone-number', /(?<!\w)\+?\d[\d .()\/-]{8,}\d(?!\w)/g],
];

/**
 * Bounded pattern-based scrubbing for untrusted HMX text before canonical import.
 * This is a risk-reduction screen, not a universal secret or PII detector.
 */
export function redactHmxImportedText(value: string, maxLength = 16_000): string {
  const bounded = Number.isSafeInteger(maxLength) ? Math.max(0, Math.min(48_000, maxLength)) : 16_000;
  let text = value.normalize('NFKC');
  for (const [name, pattern] of PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (_match: string, prefix?: string) =>
      typeof prefix === 'string' ? prefix + '[redacted:' + name + ']' : '[redacted:' + name + ']');
  }
  return text.slice(0, bounded);
}

/**
 * Creates an accessor-safe bounded data-only HMX export and scrubs every nested
 * string before it leaves the organism. The pattern set is risk reduction,
 * not proof that arbitrary free text is free of personal or secret data.
 */
export function redactHmxExportValue<T = unknown>(value: T, maxStringLength = 12_000): T {
  const boundedStringLength = Number.isSafeInteger(maxStringLength)
    ? Math.max(0, Math.min(48_000, maxStringLength))
    : 12_000;
  const snapshot = snapshotPlainData<unknown>(value, {
    maxDepth: 32,
    maxNodes: 20_000,
    maxStringUnits: 1_000_000,
  });
  let visited = 0;
  const visit = (input: unknown, depth: number): unknown => {
    visited += 1;
    if (visited > 20_000 || depth > 32) throw new Error('hmx-export-size-limit');
    if (typeof input === 'string') return redactHmxImportedText(input, boundedStringLength);
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (Array.isArray(input)) return input.map(value => visit(value, depth + 1));
    if (input && typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (Object.keys(result).length >= 2_000) throw new Error('hmx-export-object-size-limit');
        Object.defineProperty(result, key, {
          value: visit(value, depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
    throw new Error('hmx-export-unsupported-value');
  };
  return visit(snapshot, 0) as T;
}
