import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(64);
const snapshot = () => fabric.snapshot();
const assertNoMutation = (before, label) => assert.deepEqual(snapshot(), before, label);

const malformedPayloads = [
  null,
  [],
  'not-an-object',
  17,
  true,
  new Date(0),
  new (class PayloadEnvelope { value = 1; })(),
];

for (let index = 0; index < malformedPayloads.length; index += 1) {
  const before = snapshot();
  assert.throws(
    () => fabric.recordOperationalCycle({
      tick: index + 1,
      observation: { payload: { valid: true } },
      plan: { payload: { accepted: true } },
      learning: { payload: malformedPayloads[index] },
    }),
    /invalid-cognitive-event-payload/,
    'explicit malformed phase payload roots must not be sanitized into an empty object',
  );
  assertNoMutation(before, 'malformed late phase payload must reject before the first event append');
}

// A present but falsy phase is not equivalent to an omitted phase. Silently skipping
// null/false/zero/empty-string phases can disguise a malformed partial cognitive cycle.
for (const phase of [null, false, 0, '']) {
  const before = snapshot();
  assert.throws(
    () => fabric.recordOperationalCycle({ tick: 20, observation: phase }),
    /invalid-cognitive-cycle-phase:observation/,
  );
  assertNoMutation(before, 'malformed phase envelopes must not mutate the event ledger');
}

// Known root fields are copied through own data descriptors; accessor properties
// must not run while preparing a multi-stage cycle.
let rootGetterCalls = 0;
const accessorRoot = {
  tick: 30,
  observation: { payload: { accepted: true } },
};
Object.defineProperty(accessorRoot, 'learning', {
  enumerable: true,
  configurable: true,
  get() {
    rootGetterCalls += 1;
    return { payload: { trusted: false } };
  },
});
{
  const before = snapshot();
  assert.throws(
    () => fabric.recordOperationalCycle(accessorRoot),
    /invalid-cognitive-cycle-input/,
  );
  assert.equal(rootGetterCalls, 0, 'cycle root getter must never run');
  assertNoMutation(before, 'accessor-backed cycle root must be rejected before writes');
}

// Phase fields receive the same descriptor-only treatment.
let phaseGetterCalls = 0;
const accessorPhase = { tick: 31, observation: {} };
Object.defineProperty(accessorPhase.observation, 'payload', {
  enumerable: true,
  configurable: true,
  get() {
    phaseGetterCalls += 1;
    return { not: 'accepted' };
  },
});
{
  const before = snapshot();
  assert.throws(
    () => fabric.recordOperationalCycle(accessorPhase),
    /invalid-cognitive-cycle-phase:observation/,
  );
  assert.equal(phaseGetterCalls, 0, 'phase payload getter must never run');
  assertNoMutation(before, 'accessor-backed phase must be rejected before writes');
}

// Validation that used to be deferred until append is now explicit and atomic.
for (const phase of [
  { observation: { source: ' padded-source ', payload: { valid: true } } },
  { observation: { confidence01: 1.01, payload: { valid: true } } },
]) {
  const before = snapshot();
  assert.throws(() => fabric.recordOperationalCycle({ tick: 32, ...phase }));
  assertNoMutation(before, 'invalid source/confidence is rejected during preflight');
}

// A normal record payload and omitted payload remain compatible.
const valid = fabric.recordOperationalCycle({
  tick: 40,
  observation: { payload: { accepted: true } },
  outcome: { payload: { ok: true } },
});
assert.ok(valid.ids?.observation, 'valid operational observation should be recorded');
assert.ok(valid.ids?.outcome, 'valid operational outcome should be recorded');
assert.ok(snapshot().total >= 2, 'valid cycle should append its stages');
console.log('Cognitive operational cycle envelope: PASS');
