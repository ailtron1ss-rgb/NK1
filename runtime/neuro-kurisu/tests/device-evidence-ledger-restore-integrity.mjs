import assert from 'node:assert/strict';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';

const record = {
  id: 'device-evidence-1700000000000-1',
  at: 1700000000000,
  status: 'REAL_DEVICE_VERIFIED',
  capabilityDigest: 'battery:1|sensors:1|tts:1|stt:1|camera:1|wifi:1',
  telemetryFresh: true,
  commandSuccessRate01: 0.9,
  source: 'android-termux',
};

// A legitimate version-1 snapshot keeps its bounded counters and evidence rows.
{
  const ledger = new DeviceEvidenceLedger();
  ledger.restore({
    version: 1,
    probes: 8,
    verifiedProbes: 2,
    hostProbes: 3,
    unavailableProbes: 3,
    lastStatus: 'REAL_DEVICE_VERIFIED',
    records: [record],
  });
  assert.deepEqual(ledger.snapshot(), {
    version: 1,
    probes: 8,
    verifiedProbes: 2,
    hostProbes: 3,
    unavailableProbes: 3,
    lastStatus: 'REAL_DEVICE_VERIFIED',
    records: [record],
  });
}

// A forged counter, unsupported status, or malformed record cannot certify a device.
{
  const ledger = new DeviceEvidenceLedger();
  ledger.restore({
    version: 1,
    probes: Number.MAX_SAFE_INTEGER + 1,
    verifiedProbes: '99',
    hostProbes: -1,
    unavailableProbes: 3,
    lastStatus: 'REAL_DEVICE_VERIFIED;VERIFIED',
    records: [{
      ...record,
      status: 'REAL_DEVICE_VERIFIED',
      telemetryFresh: true,
      commandSuccessRate01: 1,
      source: 'android-termux',
    }],
  });
  assert.deepEqual(ledger.snapshot(), defaultDeviceEvidence());
  assert.equal(ledger.certification().status, 'unavailable');
  assert.equal(ledger.certification().criteria.verifiedProbes, false);
}

// Invalid rows are discarded; valid bounded evidence remains available.
{
  const ledger = new DeviceEvidenceLedger();
  ledger.restore({
    version: 1,
    probes: 4,
    verifiedProbes: 1,
    hostProbes: 2,
    unavailableProbes: 1,
    lastStatus: 'HOST_PROBE',
    records: [
      record,
      { ...record, id: 'bad-rate', commandSuccessRate01: 2 },
      { ...record, id: 'bad-time', at: Number.NaN },
    ],
  });
  assert.deepEqual(ledger.snapshot().records, [record]);
}

// Accessor-backed input is rejected without invoking user code.
{
  let getterCalls = 0;
  const hostile = {
    version: 1,
    probes: 1,
    hostProbes: 1,
    unavailableProbes: 0,
    lastStatus: 'HOST_PROBE',
    records: [],
  };
  Object.defineProperty(hostile, 'verifiedProbes', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('persisted getter must never execute');
    },
  });

  const ledger = new DeviceEvidenceLedger();
  ledger.restore(hostile);
  assert.equal(getterCalls, 0);
  assert.deepEqual(ledger.snapshot(), defaultDeviceEvidence());
}

// A revoked or hostile reflection proxy is contained and resets to safe defaults.
{
  const ledger = new DeviceEvidenceLedger();
  const revoked = Proxy.revocable({ version: 1 }, {});
  revoked.revoke();
  ledger.restore(revoked.proxy);
  assert.deepEqual(ledger.snapshot(), defaultDeviceEvidence());

  const descriptorTrap = new Proxy({ version: 1 }, {
    getOwnPropertyDescriptor() {
      throw new Error('hostile descriptor trap');
    },
  });
  ledger.restore(descriptorTrap);
  assert.deepEqual(ledger.snapshot(), defaultDeviceEvidence());
}

console.log('DEVICE_EVIDENCE_LEDGER_RESTORE_INTEGRITY=PASS');
