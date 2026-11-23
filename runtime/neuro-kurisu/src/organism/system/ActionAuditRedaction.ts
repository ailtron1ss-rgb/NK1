/**
 * Bounded, data-only redaction for ActionGateway audit previews.
 * Audit logs are diagnostics, never a second copy of tool payloads or credentials.
 */
const SECRET_KEY = /(?:authorization|auth[-_]?header|access[-_]?token|refresh[-_]?token|id[-_]?token|api[-_]?key|client[-_]?secret|password|passwd|cookie|set[-_]?cookie|session|credential|private[-_]?key|secret|bearer)/i;
const SECRET_TEXT = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:sk|rk|pk|ghp|gho|ghu|ghs|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];
const SECRET_QUERY = /([?&](?:access_token|refresh_token|token|api_key|apikey|secret|password|authorization)=)[^&#\s]+/gi;
const REDACTED = '[REDACTED]';

export function sanitizeActionAuditValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  let budget = 96;
  const visit = (input: unknown, depth: number, key?: string): unknown => {
    if (key && SECRET_KEY.test(key)) return REDACTED;
    if (typeof input === 'string') {
      let output = input.slice(0, 1200);
      for (const pattern of SECRET_TEXT) output = output.replace(pattern, REDACTED);
      output = output.replace(SECRET_QUERY, (_match, prefix: string) => prefix + REDACTED);
      return output;
    }
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (typeof input !== 'object') return typeof input === 'undefined' ? '[undefined]' : '[non-data]';
    if (depth >= 5 || budget <= 0) return '[truncated]';
    if (seen.has(input)) return '[circular]';
    seen.add(input);
    budget--;
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (Array.isArray(input)) return Array.from({ length: Math.min(input.length, 16) }, (_, index) => {
        const descriptor = descriptors[String(index)];
        return descriptor && 'value' in descriptor ? visit(descriptor.value, depth + 1) : '[accessor-omitted]';
      });
      const output: Record<string, unknown> = Object.create(null);
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
