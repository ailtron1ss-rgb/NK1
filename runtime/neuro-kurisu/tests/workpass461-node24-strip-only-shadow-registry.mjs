import assert from 'node:assert/strict';
import { AtomicFileTrustedSkillShadowRunRegistry } from '../src/organism/learning/TrustedSkillShadowRunRegistry.ts';

// Node 24's --experimental-strip-types removes erasable TypeScript syntax only.
// Importing the real runtime module catches unsupported parameter properties at parse time.
assert.equal(typeof AtomicFileTrustedSkillShadowRunRegistry, 'function');
assert.throws(
  () => new AtomicFileTrustedSkillShadowRunRegistry(''),
  error => error instanceof Error && error.message === 'trusted run registry path is required',
  'the constructor must load under strip-only TypeScript and preserve its validation contract',
);

console.log(JSON.stringify({ ok: true, test: 'workpass461-node24-strip-only-shadow-registry' }));
