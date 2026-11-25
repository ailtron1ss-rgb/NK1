const DEFAULT_MAX_ENTRIES = 64;
const MAX_TOKEN_LENGTH = 256;
const MAX_ATTEMPTS = 8;
const COMPLETED_RECEIPT_TTL_MS = 10 * 60_000;

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
    this.completed = new Map();
  }

  prune(now = Date.now()) {
    if (!Number.isFinite(now) || now < 0) return;
    for (const [id, entry] of this.entries) {
      if (!Number.isFinite(entry.leaseUntil) || entry.leaseUntil <= now) {
        this.entries.delete(id);
      }
    }
    for (const [id, receipt] of this.completed) {
      if (!Number.isSafeInteger(receipt.expiresAt) || receipt.expiresAt <= now) {
        this.completed.delete(id);
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

    if (!current) this.completed.delete(id);
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

  completedAttemptCountFor(id, token, now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return null;
    this.prune(now);
    if (typeof id !== "string" || typeof token !== "string") return null;
    const receipt = this.completed.get(id);
    return receipt && receipt.token === token && receipt.expiresAt > now
      ? receipt.attemptCount
      : null;
  }

  /** Move a live token into a short-lived idempotency receipt ledger. */
  complete(id, token, now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0 || typeof id !== "string" || typeof token !== "string") return false;
    // The coordinator calls complete only after the serialized engine accepted
    // this exact attempt. Allow the HTTP reply to finish just after lease expiry,
    // but never complete a token already replaced by a newer attempt.
    const current = this.entries.get(id);
    if (!current || current.token !== token) return false;
    const expiresAt = now + COMPLETED_RECEIPT_TTL_MS;
    if (!Number.isSafeInteger(expiresAt)) return false;
    this.entries.delete(id);
    this.prune(now);
    this.completed.delete(id);
    this.completed.set(id, {
      attemptCount: current.attemptCount,
      token: current.token,
      acknowledgedAt: now,
      expiresAt,
    });
    while (this.completed.size > this.maxEntries) {
      const oldestId = this.completed.keys().next().value;
      if (typeof oldestId !== "string") break;
      this.completed.delete(oldestId);
    }
    return true;
  }

  /** Compatibility operation for callers that want to discard a token without a receipt. */
  consume(id, token, now = Date.now()) {
    if (!this.matches(id, token, now)) return false;
    return this.entries.delete(id);
  }

  clear() {
    this.entries.clear();
    this.completed.clear();
  }

  size(now = Date.now()) {
    this.prune(now);
    return this.entries.size;
  }
}
