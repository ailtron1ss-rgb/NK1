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
  ['private-key', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi],
  ['credential-url', /https?:\\/\\/[^\\s/:@]+:[^\\s/@]+@[^\\s]+/gi],
  ['bearer-token', /\\bBearer\\s+[A-Za-z0-9._~+\\/-]+=*/gi],
  ['github-token', /\\b(?:github_pat_[A-Za-z0-9_]{16,}|gh[pousr]_[A-Za-z0-9]{16,})\\b/gi],
  ['provider-token', /\\b(?:sk|rk|pk|api|token)[_-][A-Za-z0-9_-]{16,}\\b/gi],
  ['aws-access-key', /\\bAKIA[0-9A-Z]{16}\\b/g],
  ['jwt', /\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b/g],
  ['secret-assignment', /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s,;]+)/gi],
  ['email-address', /\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/gi],
  // A non-word lookbehind is required because a leading '+' is itself non-word.
  ['phone-number', /(?<!\\w)\\+?\\d[\\d .()\\/-]{8,}\\d(?!\\w)/g],
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
