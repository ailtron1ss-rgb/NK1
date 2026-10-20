import assert from 'node:assert/strict';
const { PolicyAuthorityLedger } = await import('../src/organism/learning/PolicyAuthorityLedger.ts');
const l = new PolicyAuthorityLedger();
l.beginCycle(1);
l.add({source:'canonical-policy',action:'explore',bias01:.08,authority01:.8,causal01:.8,stage:'candidate'});
l.add({source:'causal-policy-b264',action:'explore',bias01:.03,authority01:.7,causal01:.8,stage:'causal'});
const out=l.finalize();
assert.equal(out.explore,.11);
assert.equal(l.diagnostics().duplicateSourcePairs,0);
l.add({source:'canonical-policy',action:'explore',bias01:.02,authority01:.8,causal01:.8,stage:'late'});
assert.equal(l.diagnostics().duplicateSourcePairs,1);

// Invalid output bounds must fail closed to a safe finite default; negative
// bounds clamp influence to zero rather than inverting the policy interval.
const fallbackBound = l.finalize(Number.NaN);
assert.ok(Object.values(fallbackBound).every(value => Number.isFinite(value)));
assert.ok(Math.abs(fallbackBound.explore) <= .24);
const zeroBound = l.finalize(-5);
assert.equal(zeroBound.explore, 0);
const oversizedBound = l.finalize(50);
assert.equal(oversizedBound.explore, 0.13);
console.log('POLICY_AUTHORITY_LEDGER=PASS');
