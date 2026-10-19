import assert from 'node:assert/strict';
import { PredictionLedger } from '../src/organism/system/PredictionLedger.ts';

const l = new PredictionLedger(64);
const id = l.record({ at: Date.now(), tick: 7, kind:'reward', action:'explore', predicted01:.8, confidence01:.9, context:{source:'test'} });
assert.equal(l.pendingCount(), 1);
const resolved = l.resolve(id, .2);
assert.equal(resolved?.actual01, .2);
assert.ok(Math.abs((resolved?.error01 ?? 0) - .6) < 1e-12);
assert.equal(l.pendingCount(), 0);
assert.equal(l.snapshot().samples, 1);
assert.ok(l.snapshot().calibrationGap01 > 0);
console.log('P46 prediction ledger PASS');
