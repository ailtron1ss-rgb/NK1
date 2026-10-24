import assert from 'node:assert/strict';
import { realityEvidenceEventId } from '../src/organism/system/RealityEvidenceLedger.ts';

const base = realityEvidenceEventId('decision:17', 'observation', 'sensor:charge');
assert.match(base, /^nk1-reality:observation:[a-f0-9]{48}$/);
assert.equal(realityEvidenceEventId('decision:17', 'observation', 'sensor:charge'), base,
  'the same source/role/discriminator must produce a stable ID');
assert.notEqual(realityEvidenceEventId('decision:17', 'observation', 'sensor:temperature'), base,
  'a different projection discriminator must produce another ID');
assert.notEqual(realityEvidenceEventId('decision:17', 'outcome', 'sensor:charge'), base,
  'a different projection role must produce another ID');
assert.throws(() => realityEvidenceEventId('', 'observation', 'sensor:charge'),
  /reality-evidence-event-identity-invalid/);
assert.throws(() => realityEvidenceEventId('decision:17', 'not an allowed role', 'sensor:charge'),
  /reality-evidence-event-identity-invalid/);
assert.throws(() => realityEvidenceEventId('decision:17\u0000forged', 'observation', 'sensor:charge'),
  /reality-evidence-event-identity-invalid/);

console.log('WorkPass488 shared reality-evidence event identity: PASS');
