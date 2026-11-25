import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ProactiveDeliveryCoordinator } from "../src/server/proactive-delivery-coordinator.mjs";

function fixture({ acknowledge = async () => true } = {}) {
  let clock = 10_000;
  let claims = 0;
  const runtime = {
    async autonomousDialogueReady() {
      claims += 1;
      return {
        id: "soc:coordinator:1",
        deliveryAttemptCount: claims,
        deliveryLeaseUntil: clock + 5_000,
        message: "A grounded proactive thought",
        status: "ready",
      };
    },
    async acknowledgeAutonomousDialogue(id) {
      return acknowledge(id);
    },
    async autonomousDialogueDeliveryPolicy() {
      return { consentGranted: true, mayDeliverUserVisible: true };
    },
    async setAutonomousDialogueConsent(value) {
      return { consentGranted: value, mayDeliverUserVisible: value };
    },
  };
  let tokens = 0;
  const coordinator = new ProactiveDeliveryCoordinator({
    runtime,
    now: () => clock,
    tokenFactory: () => `coordinator-token-${++tokens}-long-enough`,
  });
  return { coordinator, runtime, setTime(value) { clock = value; }, get claims() { return claims; } };
}

{
  const f = fixture();
  const claimed = await f.coordinator.claim();
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.initiative.id, "soc:coordinator:1");
  assert.equal(claimed.body.initiative.deliveryToken, "coordinator-token-1-long-enough");
  assert.equal(claimed.body.initiative.message, "A grounded proactive thought");
}

{
  const f = fixture();
  const claimed = await f.coordinator.claim();
  const { id, deliveryToken } = claimed.body.initiative;
  assert.equal((await f.coordinator.acknowledge(id, "wrong-token")).status, 409);
  assert.equal((await f.coordinator.acknowledge("soc:other", deliveryToken)).status, 409);
  const accepted = await f.coordinator.acknowledge(id, deliveryToken);
  assert.deepEqual(accepted, { status: 200, body: { ok: true, acknowledged: true, id } });
  assert.equal((await f.coordinator.acknowledge(id, deliveryToken)).status, 409,
    "a successful receipt token is one-use");
}

{
  const f = fixture();
  const first = await f.coordinator.claim();
  const token = first.body.initiative.deliveryToken;
  f.setTime(15_000);
  assert.equal((await f.coordinator.acknowledge("soc:coordinator:1", token)).status, 409,
    "a receipt must be rejected at the exact lease-expiry boundary");
}

{
  let finishAck;
  const f = fixture({
    acknowledge: () => new Promise((resolve) => { finishAck = resolve; }),
  });
  const claim = await f.coordinator.claim();
  const id = claim.body.initiative.id;
  const token = claim.body.initiative.deliveryToken;
  const first = f.coordinator.acknowledge(id, token);
  await Promise.resolve();
  const duplicate = await f.coordinator.acknowledge(id, token);
  assert.equal(duplicate.status, 409,
    "concurrent duplicate ACKs must not execute two runtime acknowledgements");
  finishAck(true);
  assert.equal((await first).status, 200);
}

{
  const f = fixture();
  const claim = await f.coordinator.claim();
  const token = claim.body.initiative.deliveryToken;
  await f.coordinator.setConsent(false);
  assert.equal((await f.coordinator.acknowledge("soc:coordinator:1", token)).status, 409,
    "revoking consent invalidates an outstanding delivery token");
}

{
  const f = fixture();
  const claim = await f.coordinator.claim();
  const { id, deliveryToken } = claim.body.initiative;
  const restarted = new ProactiveDeliveryCoordinator({
    runtime: f.runtime,
    now: () => 10_000,
    tokenFactory: () => "coordinator-token-after-restart",
  });
  assert.equal((await restarted.acknowledge(id, deliveryToken)).status, 409,
    "process restart must invalidate all in-memory receipt tokens");
}

{
  const f = fixture();
  const empty = {
    ...f.runtime,
    autonomousDialogueReady: async () => null,
  };
  const coordinator = new ProactiveDeliveryCoordinator({ runtime: empty });
  assert.deepEqual(await coordinator.claim(), { status: 200, body: { ok: true, initiative: null } });
}


{
  let attempts = 0;
  const f = fixture({ acknowledge: async () => ++attempts > 1 });
  const claim = await f.coordinator.claim();
  const { id, deliveryToken } = claim.body.initiative;
  assert.equal((await f.coordinator.acknowledge(id, deliveryToken)).status, 409,
    "a runtime-level rejected receipt must not consume the current attempt token");
  assert.equal((await f.coordinator.acknowledge(id, deliveryToken)).status, 200,
    "a transient runtime rejection can be retried while the same engine lease is live");
}

{
  let attempts = 0;
  const f = fixture({
    acknowledge: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary checkpoint failure");
      return true;
    },
  });
  const claim = await f.coordinator.claim();
  const { id, deliveryToken } = claim.body.initiative;
  assert.equal((await f.coordinator.acknowledge(id, deliveryToken)).status, 503,
    "transient checkpoint failure must be reported as retryable");
  assert.equal((await f.coordinator.acknowledge(id, deliveryToken)).status, 200,
    "a failed runtime ACK must leave a valid in-lease token for retry");
}

{
  const f = fixture();
  assert.equal((await f.coordinator.acknowledge(" bad-id ", "token")).status, 400);
}

{
  const runtimeSource = await readFile(new URL("../src/organism/core/OrganismRuntime.ts", import.meta.url), "utf8");
  const methodStart = runtimeSource.indexOf("async acknowledgeAutonomousDialogue");
  const coreCommit = runtimeSource.indexOf("await this.core.flush()", methodStart);
  const optionalProjection = runtimeSource.indexOf("persistOpenLoopMutation", methodStart);
  assert.ok(methodStart >= 0 && coreCommit > methodStart && optionalProjection > coreCommit,
    "the canonical Core delivery receipt must be persisted before the optional Open Loop projection");
}

console.log("PROACTIVE_DELIVERY_COORDINATOR=PASS");
