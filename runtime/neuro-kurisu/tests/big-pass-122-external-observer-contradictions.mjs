import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const observer = new ExternalObserverFabric();
observer.registerSource({ id: 'device-left', sourceClass: 'device', channel: 'sensor', independenceKey: 'controller-left', reliability01: .96 });
observer.registerSource({ id: 'device-right', sourceClass: 'device', channel: 'sensor', independenceKey: 'controller-right', reliability01: .96 });
const left = observer.observeAndAssess({ sourceId: 'device-left', sourceClass: 'device', channel: 'sensor', independenceKey: 'controller-left', claimKey: 'relay-8', observedPostcondition: 'status=blocked', confidence01: .98, observedAt: Date.now(), expectedPostcondition: 'status=ready' });
const right = observer.observeAndAssess({ sourceId: 'device-right', sourceClass: 'device', channel: 'sensor', independenceKey: 'controller-right', claimKey: 'relay-8', observedPostcondition: 'status=blocked', confidence01: .98, observedAt: Date.now(), expectedPostcondition: 'status=ready' });
assert.equal(left.assessment.assessment, 'mismatch');
assert.equal(right.assessment.assessment, 'mismatch');
assert.equal(right.reconciliation.status, 'disputed');
assert.equal(right.reconciliation.independentContradictionSources, 2);
assert.ok(right.reconciliation.contradiction01 >= .68, `contradiction strength should remain high: ${right.reconciliation.contradiction01}`);
assert.equal(observer.summary().contradictedCount >= 2, true);
console.log('BIG_PASS_122_EXTERNAL_CONTRADICTIONS=PASS', JSON.stringify({ status: right.reconciliation.status, independentContradictions: right.reconciliation.independentContradictionSources, contradiction01: right.reconciliation.contradiction01 }));
