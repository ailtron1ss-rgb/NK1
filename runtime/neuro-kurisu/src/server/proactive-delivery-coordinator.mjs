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
      || typeof runtime.setAutonomousDialogueConsent !== "function"
      || typeof runtime.setAutonomousDialogueQuietHours !== "function") {
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

  async setQuietHours(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)
      || typeof input.enabled !== "boolean"
      || !Number.isSafeInteger(input.startHourUtc) || input.startHourUtc < 0 || input.startHourUtc > 23
      || !Number.isSafeInteger(input.endHourUtc) || input.endHourUtc < 0 || input.endHourUtc > 23) {
      throw new TypeError("invalid-proactive-quiet-hours");
    }
    return this.runtime.setAutonomousDialogueQuietHours({
      enabled: input.enabled,
      startHourUtc: input.startHourUtc,
      endHourUtc: input.endHourUtc,
    });
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
    if (typeof token !== "string") {
      return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-lease-token-invalid" } };
    }
    const inFlightKey = JSON.stringify([id, token]);
    // Do not prune an expired token while its own Runtime ACK is still in
    // flight: Core may have committed just before expiry while the checkpoint
    // response is still pending. The successful completion moves it into the
    // idempotent receipt ledger for safe replay.
    if (this.acknowledgementsInFlight.has(inFlightKey)) {
      return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-ack-in-flight" } };
    }
    const now = this.now();
    const completedAttemptCount = this.leases.completedAttemptCountFor(id, token, now);
    if (completedAttemptCount !== null) {
      return { status: 200, body: { ok: true, acknowledged: true, id, idempotentReplay: true } };
    }
    const attemptCount = this.leases.attemptCountFor(id, token, now);
    if (attemptCount === null) {
      return { status: 409, body: { ok: false, acknowledged: false, error: "proactive-delivery-lease-token-invalid" } };
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
