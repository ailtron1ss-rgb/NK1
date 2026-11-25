import assert from "node:assert/strict";
import { ProactiveDeliveryLeaseRegistry } from "../src/server/proactive-delivery-lease-registry.mjs";

{
  const leases = new ProactiveDeliveryLeaseRegistry();
  assert.equal(leases.issue("soc:1", 1, 10_000, "token-0000000000001", 1), "token-0000000000001");
  assert.equal(leases.matches("soc:1", "token-0000000000001", 9_999), true);
  assert.equal(leases.matches("soc:other", "token-0000000000001", 9_999), false);
  assert.equal(leases.matches("soc:1", "wrong-token-0000000000", 9_999), false);
  assert.equal(leases.matches("soc:1", "token-0000000000001", 10_000), false,
    "a token is invalid exactly at lease expiry");
}

{
  const leases = new ProactiveDeliveryLeaseRegistry();
  leases.issue("soc:2", 1, 20_000, "first-token-00000001", 1);
  leases.issue("soc:2", 2, 30_000, "second-token-0000002", 2);
  assert.equal(leases.matches("soc:2", "first-token-00000001", 3), false,
    "a newer retry attempt must fence the previous attempt token");
  assert.equal(leases.matches("soc:2", "second-token-0000002", 3), true);
  assert.equal(leases.consume("soc:2", "second-token-0000002", 4), true);
  assert.equal(leases.consume("soc:2", "second-token-0000002", 5), false,
    "delivery receipt tokens are one-use");
}

{
  const leases = new ProactiveDeliveryLeaseRegistry({ maxEntries: 2 });
  leases.issue("soc:a", 1, 50_000, "token-a-0000000001", 1);
  leases.issue("soc:b", 1, 50_000, "token-b-0000000001", 1);
  leases.issue("soc:c", 1, 50_000, "token-c-0000000001", 1);
  assert.equal(leases.size(), 2, "the ephemeral token registry must remain bounded");
  assert.equal(leases.matches("soc:a", "token-a-0000000001", 2), false,
    "capacity eviction must fail closed");
  leases.clear();
  assert.equal(leases.size(), 0);
}

{
  const leases = new ProactiveDeliveryLeaseRegistry();
  assert.equal(leases.issue(" ", 1, 5_000, "token-0000000000", 1), null);
  assert.equal(leases.issue("soc:x", 0, 5_000, "token-0000000000", 1), null);
  assert.equal(leases.issue("soc:x", 9, 5_000, "token-0000000000", 1), null);
  assert.equal(leases.issue("soc:x", 1, 1, "token-0000000000", 1), null);
  assert.equal(leases.issue("soc:x", 1, 5_000, "short", 1), null);
}

console.log("PROACTIVE_DELIVERY_LEASE_REGISTRY=PASS");
