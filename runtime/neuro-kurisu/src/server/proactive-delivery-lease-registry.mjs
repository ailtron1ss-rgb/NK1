const DEFAULT_MAX_ENTRIES = 64;
const MAX_TOKEN_LENGTH = 256;
const MAX_ATTEMPTS = 8;

/**
 * Ephemeral fencing registry for proactive-delivery attempts.
 * Tokens are deliberately process-local: a server restart invalidates old
 * receipts, while the durable engine lease/backoff controls when a new
 * attempt can be claimed.
 */
export class ProactiveDeliveryLeaseRegistry {
  constructor(options = {}) {
    const requested = Number(options.maxEntries);
    this.maxEntries = Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, DEFAULT_MAX_ENTRIES)
      : DEFAULT_MAX_ENTRIES;
    this.entries = new Map();
  }

  prune(now = Date.now()) {
    if (!Number.isFinite(now) || now < 0) return;
    for (const [id, entry] of this.entries) {
      if (!Number.isFinite(entry.leaseUntil) || entry.leaseUntil <= now) {
        this.entries.delete(id);
      }
    }
  }

  issue(id, attemptCount, leaseUntil, token, now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(leaseUntil) || leaseUntil <= now) return null;
    this.prune(now);
    if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 160) return null;
    if (!Number.isSafeInteger(attemptCount) || attemptCount < 1 || attemptCount > MAX_ATTEMPTS) return null;
    if (typeof token !== "string" || token.length < 16 || token.length > MAX_TOKEN_LENGTH) return null;
    const current = this.entries.get(id);
    if (current && current.leaseUntil > now && attemptCount <= current.attemptCount) {
      // Never rotate or replay a token inside the same active engine attempt.
      return null;
    }

    if (!current && this.entries.size >= this.maxEntries) {
      const oldestId = this.entries.keys().next().value;
      if (typeof oldestId === "string") this.entries.delete(oldestId);
    }
    this.entries.set(id, { attemptCount, leaseUntil, token });
    return token;
  }

  matches(id, token, now = Date.now()) {
    return this.attemptCountFor(id, token, now) !== null;
  }

  /** Return the persisted engine attempt bound to this live receipt token. */
  attemptCountFor(id, token, now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return null;
    this.prune(now);
    if (typeof id !== "string" || typeof token !== "string") return null;
    const current = this.entries.get(id);
    return current && current.token === token && current.leaseUntil > now
      ? current.attemptCount
      : null;
  }

  consume(id, token, now = Date.now()) {
    if (!this.matches(id, token, now)) return false;
    return this.entries.delete(id);
  }

  clear() {
    this.entries.clear();
  }

  size(now = Date.now()) {
    this.prune(now);
    return this.entries.size;
  }
}
