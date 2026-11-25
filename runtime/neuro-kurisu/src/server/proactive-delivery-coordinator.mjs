import { randomUUID } from "node:crypto";
import { ProactiveDeliveryLeaseRegistry } from "./proactive-delivery-lease-registry.mjs";

/**
 * HTTP-facing orchestration only. Durable initiative state remains owned by
 * AutonomousSocialInitiativeEngine through the serialized OrganismRuntime.
 * This coordinator owns ephemeral per-attempt receipt fencing and prevents
 * concurrent duplicate ACK work from crossing that runtime boundary.
 */
export class ProactiveDeliveryCoordinator {
  constructor({
    runtime,
    leases = new ProactiveDeliveryLeaseRegistry({ maxEntries: 64 }),
    tokenFactory = randomUUID,
    now = Date.now,
  } = {}) {
    if (!runtime
      || typeof runtime.autonomousDialogueReady !== "function"
      || typeof runtime.acknowledgeAutonomousDialogue !== "function"
      || typeof runtime.autonomousDialogueDeliveryPolicy !== "function"
      || typeof runtime.setAutonomousDialogueConsent !== "function") {
      throw new TypeError("proactive-delivery-runtime-contract-invalid");
    }
    if (!leases || typeof leases.issue !== "function" || typeof leases.matches !== "function"
      || typeof leases.consume !== "function" || typeof leases.attemptCountFor !== "function"
      || typeof leases.completedAttemptCountFor !== "function" || typeof leases.complete !== "function"
      || typeof leases.clear !== "function") {
      throw new TypeError("proactive-delivery-lease-registry-contract-invalid");
    }
    if (typeof tokenFactory !== "function" || typeof now !== "function") {
      throw new TypeError("proactive-delivery-clock-or-token-factory-invalid");
    }
    this.runtime = runtime;
    this.leases = leases;
    this.tokenFactory = tokenFactory;
    this.now = now;
    this.acknowledgementsInFlight = new Set();
  }

  async policy() {
    return this.runtime.autonomousDialogueDeliveryPolicy();
  }

  async setConsent(consentGranted) {
    if (typeof consentGranted !== "boolean") {
      throw new TypeError("consent-granted-must-be-boolean");
    }
    const policy = await this.runtime.setAutonomousDialogueConsent(consentGranted);
    if (!consentGranted) this.leases.clear();
    return policy;
  }

  async claim() {
    const initiative = await this.runtime.autonomousDialogueReady();
    if (!initiative) return { status: 200, body: { ok: true, initiative: null } };

    const token = this.leases.issue(
      initiative.id,
      initiative.deliveryAttemptCount,
      initiative.deliveryLeaseUntil,
      this.tokenFactory(),
      this.now(),
    );
    if (!token) {
      return {
        status: 503,
        body: { ok: false, error: "proactive-delivery-lease-token-unavailable", initiative: null },
      };
    }
    return {
      status: 200,
      body: { ok: true, initiative: { ...initiative, deliveryToken: token } },
    };
  }

  async acknowledge(id, token) {
    if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 160) {
      return { status: 400, body: { ok: false, acknowledged: false, error: "invalid-initiative-id" } };
    }
    const now = this.now();
    const completedAttemptCount = typeof token === "string"
      ? this.leases.completedAttemptCountFor(id, token, now)
      : null;
    if (completedAttemptCount !== null) {
      // A response may have been lost after Core committed. Replay the durable
      // receipt without invoking the Runtime or mutating the initiative again.
      return { status: 200, body: { ok: true, acknowledged: true, id, idempotentReplay: true } };
    }
    const attemptCount = typeof token === "string"
      ? this.leases.attemptCountFor(id, token, now)
      : null;
    if (attemptCount === null) {
      return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-lease-token-invalid" } };
    }
    const inFlightKey = JSON.stringify([id, token]);
    if (this.acknowledgementsInFlight.has(inFlightKey)) {
      return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-ack-in-flight" } };
    }

    this.acknowledgementsInFlight.add(inFlightKey);
    try {
      const acknowledged = await this.runtime.acknowledgeAutonomousDialogue(id, attemptCount);
      if (!acknowledged) {
        return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-ack-rejected" } };
      }
      this.leases.complete(id, token, this.now());
      return { status: 200, body: { ok: true, acknowledged: true, id } };
    } catch {
      // Keep the receipt token live while its lease remains valid. The caller
      // may retry after a transient checkpoint/store failure without a new claim.
      return { status: 503, body: { ok: false, acknowledged: false, error: "proactive-delivery-ack-unavailable" } };
    } finally {
      this.acknowledgementsInFlight.delete(inFlightKey);
    }
  }
}
