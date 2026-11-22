/**
 * Bounded, data-only redaction for ActionGateway audit previews.
 * Audit logs are diagnostics, never a second copy of tool payloads or credentials.
 */
const SECRET_KEY = /(?:authorization|auth[-_]?header|access[-_]?token|refresh[-_]?token|id[-_]?token|api[-_]?key|client[-_]?secret|password|passwd|cookie|set[-_]?cookie|session|credential|private[-_]?key|secret|bearer)/i;
const SECRET_TEXT = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:sk|rk|pk|ghp|gho|ghu|ghs|github_pat|xox[baprs])-([A-Za-z0-9_-]{12,})\b/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /([?&](?:access_token|refresh_token|token|api_key|apikey|secret|password|authorization)=)[^&#\s]+/gi,
];
const REDACTED = '[REDACTED]';

/** Return a JSON-safe preview without invoking accessors or retaining unbounded payloads. */
export function sanitizeActionAuditValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  let budget = 96;
  const visit = (input: unknown, depth: number, key?: string): unknown => {
    if (key && SECRET_KEY.test(key)) return REDACTED;
    if (typeof input === 'string') {
      let output = input.slice(0, 1200);
      for (const pattern of SECRET_TEXT) output = output.replace(pattern, (match, prefix) => typeof prefix === 'string' ? prefix + REDACTED : REDACTED);
      return output;
    }
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (typeof input !== 'object') return typeof input === 'undefined' ? '[undefined]' : '[non-data]';
    if (depth >= 5 || budget <= 0) return '[truncated]';
    if (seen.has(input)) return '[circular]';
    seen.add(input);
    budget--;
    try {
      if (Array.isArray(input)) return input.slice(0, 16).map(item => visit(item, depth + 1));
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const output: Record<string, unknown> = {};
      for (const name of Object.keys(descriptors).slice(0, 32)) {
        const descriptor = descriptors[name];
        if (!descriptor || !('value' in descriptor)) {
          output[name] = '[accessor-omitted]';
          continue;
        }
        output[name] = visit(descriptor.value, depth + 1, name);
      }
      return output;
    } catch {
      return '[uninspectable]';
    }
  };
  return visit(value, 0);
}
