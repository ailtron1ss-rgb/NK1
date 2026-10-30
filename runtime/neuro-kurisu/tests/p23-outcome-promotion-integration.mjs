import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { evaluateOutcomePromotion } from '../src/organism/learning/VerifiedOutcomePromotionGate.ts';

const families = ['memory', 'transfer', 'tool-use'];
const makeLedger = (regressedFamily = null) => {
  const manifest = families.map((family) => ({
    taskId: `task-${family}`,
    family,
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`Independent holdout task for ${family}`),
    verifierId: 'external-verifier-v1',
    version: '1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  for (const family of families) {
    for (let seed = 0; seed < 30; seed++) {
      const baselinePassed = seed % 3 === 0;
      const candidatePassed = family === regressedFamily ? false : true;
      for (const [method, passed] of [['baseline', baselinePassed], ['candidate', candidatePassed]]) {
        const result = ledger.record({
          taskId: `task-${family}`, taskVersion: '1', method, seed, attempt: 1,
          passed, authority: 'independent-verifier', verifierId: 'external-verifier-v1',
          evidenceRef: `artifact://${family}/${method}/${seed}`,
          observedAt: 1_800_000_000_000 + seed,
        });
        assert.equal(result.accepted, true);
      }
    }
  }
  return ledger;
};

const goodLedger = makeLedger();
const goodAggregate = goodLedger.comparePairedBySeed('baseline', 'candidate');
const goodFamilies = goodLedger.comparePairedByFamilyAndSeed('baseline', 'candidate');
const eligible = evaluateOutcomePromotion(goodAggregate, goodFamilies);
assert.equal(goodAggregate.pairedN, 30, 'seed, not task cell, is the independent unit');
assert.ok(goodAggregate.signTestPValue < 0.05);
assert.ok(goodFamilies.every(family => family.statisticalUnit === 'seed' && family.pairedN === 30));
assert.equal(eligible.eligible, true, JSON.stringify(eligible));

const badLedger = makeLedger('transfer');
const badAggregate = badLedger.comparePairedBySeed('baseline', 'candidate');
const badFamilies = badLedger.comparePairedByFamilyAndSeed('baseline', 'candidate');
const blocked = evaluateOutcomePromotion(badAggregate, badFamilies);
assert.equal(blocked.eligible, false);
assert.ok(blocked.reasons.includes('family-regression:transfer'));
assert.ok(blocked.worstFamilyGain < -0.05);

console.log('P23_OUTCOME_PROMOTION_INTEGRATION=PASS');
console.log(JSON.stringify({
  pairedN: goodAggregate.pairedN,
  gain: goodAggregate.absoluteGain,
  familyGains: goodFamilies.map(({ family, pairedN, absoluteGain }) => ({ family, pairedN, absoluteGain })),
  regressionBlocked: blocked.reasons.includes('family-regression:transfer'),
}));
