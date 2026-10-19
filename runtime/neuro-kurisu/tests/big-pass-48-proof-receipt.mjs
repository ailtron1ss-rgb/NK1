import assert from 'node:assert/strict';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';

const fw = new EvidenceFirewallEngine();
const now = Date.now();
const observe = (sourceKey, contentHash, trust=.9, contradiction=0) => fw.observe({
  claimKey:'proof-receipt', sourceClass:'external-api', sourceKey, contentHash,
  confidence01:trust, trust01:trust, contradiction01:contradiction, at:now,
});

observe('alpha.example','hash-a');
let claim = observe('beta.example','hash-b');
assert.equal(claim.status,'promoted');
assert.ok(claim.promotionReceipt,'promotion must carry a receipt');
assert.equal(claim.promotionReceipt.policyVersion,'firewall-v1');
assert.deepEqual(claim.promotionReceipt.independentSources,['alpha.example','beta.example']);
assert.deepEqual(claim.promotionReceipt.contentHashes,['hash-a','hash-b']);
assert.equal(claim.promotionReceipt.promotedAt,claim.promotedAt);

const after = observe('gamma.example','hash-c',.9,.9);
assert.equal(after.status,'contested');
assert.ok(after.promotionReceipt,'original proof receipt remains auditable after contradiction');
assert.ok(after.promotionReceipt.contentHashes.includes('hash-a'));
assert.ok(after.promotionReceipt.contentHashes.includes('hash-b'));

console.log('BIG_PASS_48_PROOF_RECEIPT=PASS', JSON.stringify({status:after.status, independentSources:after.independentSources, hashes:after.promotionReceipt.contentHashes.length}));
