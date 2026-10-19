import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.resolve(here, '../../src/organism/core/OrganismCore.ts'), 'utf8');
const willRank = source.indexOf('this.willIntegration.rankCandidates(governedCandidates');
const p69Arbitrate = source.indexOf('const p69Decision = this.governanceSubsystem.p69ConstitutionalArbiter.arbitrate');
const selectedFromP69 = source.indexOf('const constitutionalSelected = p69Decision.chosen');
assert.ok(willRank >= 0 && p69Arbitrate >= 0 && selectedFromP69 >= 0, 'WILL ranking and P69 arbitration anchors must exist');
assert.ok(willRank < p69Arbitrate, 'WILL bounded candidate signal must be applied before constitutional arbitration');
assert.ok(p69Arbitrate < selectedFromP69, 'P69 must remain the final constitutional selection authority');
assert.match(source.slice(p69Arbitrate, selectedFromP69), /candidates:\s*governedCandidates/);
console.log('WILL_ARBITRATION_ORDER=PASS; WILL score influences candidates before P69; P69 retains final selection authority');
