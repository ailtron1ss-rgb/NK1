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

// Runtime callers cannot inject unknown action names or unbounded provenance
// labels into the authoritative policy ledger.
assert.throws(() => l.add({source:'bad-action',action:'execute',bias01:.9,authority01:1,causal01:1,stage:'candidate'}), /invalid-policy-action/);
assert.throws(() => l.add({source:'',action:'verify',bias01:.9,authority01:1,causal01:1,stage:'candidate'}), /invalid-policy-source/);
assert.throws(() => l.add({source:'x'.repeat(121),action:'verify',bias01:.9,authority01:1,causal01:1,stage:'candidate'}), /invalid-policy-source/);
assert.throws(() => l.add({source:'bad\\u0000source',action:'verify',bias01:.9,authority01:1,causal01:1,stage:'candidate'}), /invalid-policy-source/);
assert.throws(() => l.add({source:'valid',action:'verify',bias01:.9,authority01:1,causal01:1,stage:''}), /invalid-policy-stage/);
l.beginCycle(Number.NaN);
assert.equal(l.snapshot().cycle,0,'non-finite cycle identifiers normalize to zero instead of contaminating diagnostics');
l.beginCycle(-12.4);
assert.equal(l.snapshot().cycle,0,'negative cycle identifiers normalize to zero');
l.add({source:'finite-fallback',action:'reflect',bias01:.03,authority01:Number.NaN,causal01:Number.POSITIVE_INFINITY,stage:'validation'});
const safeContribution=l.snapshot().contributions.at(-1);
assert.equal(safeContribution.authority01,0,'malformed authority defaults to no authority');
assert.equal(safeContribution.causal01,0,'malformed causal confidence defaults to no authority');
// Per-cycle storage has a hard bound so a runaway producer cannot grow the authority ledger indefinitely.
const bounded = new PolicyAuthorityLedger();
bounded.beginCycle(1);
for (let i = 0; i < 4096; i++) bounded.add({source:`source-${i}`,action:'wait',bias01:0,authority01:0,causal01:0,stage:'bounded'});
assert.throws(() => bounded.add({source:'overflow',action:'wait',bias01:0,authority01:0,causal01:0,stage:'bounded'}), /policy-contribution-limit-exceeded/);
console.log('POLICY_AUTHORITY_LEDGER=PASS runtimeInputValidation=true finiteCycle=true boundedContributions=4096');
