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
    async setAutonomousDialogueQuietHours(input) {
      return { consentGranted: true, quietHoursEnabled: input.enabled, quietStartHourUtc: input.startHourUtc, quietEndHourUtc: input.endHourUtc };
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
  let ackCalls = 0;
  const f = fixture({ acknowledge: async () => { ackCalls += 1; return true; } });
  const claimed = await f.coordinator.claim();
  const { id, deliveryToken } = claimed.body.initiative;
  assert.equal((await f.coordinator.acknowledge(id, "wrong-token")).status, 409);
  assert.equal((await f.coordinator.acknowledge("soc:other", deliveryToken)).status, 409);
  const accepted = await f.coordinator.acknowledge(id, deliveryToken);
  assert.deepEqual(accepted, { status: 200, body: { ok: true, acknowledged: true, id } });
  const replay = await f.coordinator.acknowledge(id, deliveryToken);
  assert.deepEqual(replay, { status: 200, body: { ok: true, acknowledged: true, id, idempotentReplay: true } });
  assert.equal(ackCalls, 1,
    "a lost HTTP response can be replayed without invoking the Core a second time");
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
  const serverSource = await readFile(new URL("../src/server/server.mjs", import.meta.url), "utf8");
  const coordinatorSource = await readFile(new URL("../src/server/proactive-delivery-coordinator.mjs", import.meta.url), "utf8");
  assert.ok(runtimeSource.includes("setAutonomousDialogueQuietHours(input)"),
    "Runtime must serialize quiet-hours policy changes");
  assert.ok(coreSource.includes("setAutonomousInitiativeQuietHours(input)"),
    "Core must remain the owner of persisted quiet-hours configuration");
  assert.ok(serverSource.includes("/api/organism/proactive-quiet-hours"),
    "the server must expose the quiet-hours configuration endpoint");
  assert.ok(coordinatorSource.includes("invalid-proactive-quiet-hours"),
    "the coordinator must validate quiet-hours payloads before entering Runtime");
  assert.ok(runtimeSource.includes("acknowledgeAutonomousSocialInitiativeWithState(id, Date.now(), expectedAttemptCount)"),
    "Runtime must forward the attempt fence into the Core command");
  assert.ok(coreSource.includes("acknowledgeWithState(id, at, expectedAttemptCount)"),
    "Core must forward the expected attempt to the canonical initiative owner");
  const coreClaimStart = coreSource.indexOf("claimAutonomousSocialInitiativeDelivery()");
  const coreClaimSnapshot = coreSource.indexOf("this.persisted.system.autonomousSocialInitiative", coreClaimStart);
  const coreClaimDirty = coreSource.indexOf("this.markPersistenceDirty()", coreClaimSnapshot);
  const coreAckStart = coreSource.indexOf("acknowledgeAutonomousSocialInitiativeWithState");
  const coreAckSnapshot = coreSource.indexOf("this.persisted.system.autonomousSocialInitiative", coreAckStart);
  const coreAckDirty = coreSource.indexOf("this.markPersistenceDirty()", coreAckSnapshot);
  assert.ok(coreClaimStart >= 0 && coreClaimSnapshot > coreClaimStart && coreClaimDirty > coreClaimSnapshot,
    "a successful or terminalizing claim must mark the canonical Core snapshot dirty");
  assert.ok(coreAckStart >= 0 && coreAckSnapshot > coreAckStart && coreAckDirty > coreAckSnapshot,
    "a successful or terminalizing ACK must mark the canonical Core snapshot dirty");
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


{
  const f = fixture();
  const policy = await f.coordinator.setQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
  assert.equal(policy.quietHoursEnabled, true);
  assert.equal(policy.quietStartHourUtc, 22);
  assert.equal(policy.quietEndHourUtc, 8);
  for (const invalid of [
    null,
    [],
    { enabled: 1, startHourUtc: 22, endHourUtc: 8 },
    { enabled: true, startHourUtc: -1, endHourUtc: 8 },
    { enabled: true, startHourUtc: 22, endHourUtc: 24 },
    { enabled: true, startHourUtc: 22.5, endHourUtc: 8 },
  ]) {
    await assert.rejects(() => f.coordinator.setQuietHours(invalid), /invalid-proactive-quiet-hours/);
  }
}


{
  let finishAck;
  const f = fixture({
    acknowledge: () => new Promise((resolve) => { finishAck = resolve; }),
  });
  const claim = await f.coordinator.claim();
  const { id, deliveryToken } = claim.body.initiative;
  const first = f.coordinator.acknowledge(id, deliveryToken);
  await Promise.resolve();
  f.setTime(15_001);
  const duplicateWhilePending = await f.coordinator.acknowledge(id, deliveryToken);
  assert.equal(duplicateWhilePending.status, 409,
    "a duplicate ACK while the same request is in flight must not prune its token at lease expiry");
  finishAck(true);
  assert.equal((await first).status, 200);
  const replayAfterCommit = await f.coordinator.acknowledge(id, deliveryToken);
  assert.deepEqual(replayAfterCommit, {
    status: 200,
    body: { ok: true, acknowledged: true, id, idempotentReplay: true },
  }, "a committed receipt can be replayed even when its HTTP response arrives after lease expiry");
}

console.log("PROACTIVE_DELIVERY_COORDINATOR=PASS");
