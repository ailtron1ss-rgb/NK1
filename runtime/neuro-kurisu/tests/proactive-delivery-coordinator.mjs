import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ProactiveDeliveryCoordinator } from "../src/server/proactive-delivery-coordinator.mjs";

function fixture({ acknowledge = async () => true } = {}) {
  let clock = 10_000;
  let claims = 0;
  let activeAttempt = 0;
  const runtime = {
    async autonomousDialogueReady() {
      claims += 1;
      activeAttempt = claims;
      return {
        id: "soc:coordinator:1",
        deliveryAttemptCount: activeAttempt,
        deliveryLeaseUntil: clock + 5_000,
        message: "A grounded proactive thought",
        status: "ready",
      };
    },
    async acknowledgeAutonomousDialogue(id, expectedAttemptCount) {
      return acknowledge(id, expectedAttemptCount, () => expectedAttemptCount === activeAttempt);
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
  const coreSource = await readFile(new URL("../src/organism/core/OrganismCore.ts", import.meta.url), "utf8");
  const engineSource = await readFile(new URL("../src/organism/system/AutonomousSocialInitiativeEngine.ts", import.meta.url), "utf8");
  assert.ok(runtimeSource.includes("acknowledgeAutonomousSocialInitiativeWithState(id, Date.now(), expectedAttemptCount)"),
    "Runtime must forward the attempt fence into the Core command");
  assert.ok(coreSource.includes("acknowledgeWithState(id, at, expectedAttemptCount)"),
    "Core must forward the expected attempt to the canonical initiative owner");
  assert.ok(engineSource.includes("expectedAttemptCount !== item.deliveryAttemptCount"),
    "the engine must validate the attempt count at command execution time");
  const methodStart = runtimeSource.indexOf("async acknowledgeAutonomousDialogue");
  const coreCommit = runtimeSource.indexOf("await this.core.flush()", methodStart);
  const optionalProjection = runtimeSource.indexOf("persistOpenLoopMutation", methodStart);
  assert.ok(methodStart >= 0 && coreCommit > methodStart && optionalProjection > coreCommit,
    "the canonical Core delivery receipt must be persisted before the optional Open Loop projection");
  assert.ok(runtimeSource.includes("acknowledgeAutonomousSocialInitiativeWithState"),
    "Runtime must consume the Core ACK state-change receipt");
  const readyStart = runtimeSource.indexOf("async autonomousDialogueReady()");
  const readyClaim = runtimeSource.indexOf("claimAutonomousSocialInitiativeDelivery()", readyStart);
  const readyCheckpoint = runtimeSource.indexOf("if (claim.stateChanged) await this.core.flush()", readyStart);
  assert.ok(readyStart >= 0 && readyClaim > readyStart && readyCheckpoint > readyClaim,
    "a null delivery poll must checkpoint only when claim processing changed durable state");
}


{
  const delayed = [];
  const f = fixture({
    acknowledge: (id, expectedAttemptCount, isCurrentAttempt) => new Promise((resolve) => {
      delayed.push(() => resolve(isCurrentAttempt()));
    }),
  });
  const firstClaim = await f.coordinator.claim();
  const firstToken = firstClaim.body.initiative.deliveryToken;
  const firstAck = f.coordinator.acknowledge("soc:coordinator:1", firstToken);
  await Promise.resolve();

  // The durable engine lease has expired; the second claim replaces its token.
  f.setTime(15_000);
  const secondClaim = await f.coordinator.claim();
  const secondToken = secondClaim.body.initiative.deliveryToken;
  assert.notEqual(secondToken, firstToken);
  const secondAck = f.coordinator.acknowledge("soc:coordinator:1", secondToken);
  await Promise.resolve();
  assert.equal(delayed.length, 2,
    "a new engine attempt may progress while an older attempt ACK is still queued");

  delayed[0]();
  assert.equal((await firstAck).status, 409,
    "an old ACK queued before retry must fail its engine attempt-count fence");
  delayed[1]();
  assert.equal((await secondAck).status, 200,
    "the current attempt's ACK remains eligible after stale ACK rejection");
}

console.log("PROACTIVE_DELIVERY_COORDINATOR=PASS");
