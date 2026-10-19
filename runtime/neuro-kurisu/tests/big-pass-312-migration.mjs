import assert from 'node:assert/strict';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const raw={schemaVersion:127,system:{b312ExecutiveDecisionHandoff:{version:1,evaluations:17,promotions:3,confirmations:8,blocked:6,lastPolicyAction:'explore',lastPromotedAction:'explore',lastReason:'verified-policy-promoted',lastPolicyCredit01:.88,lastPolicyMargin01:.041,history:[{tick:17,policyAction:'explore',promotedAction:'explore',reason:'verified-policy-promoted',credit01:.88,margin01:.041}]}}};
const migrated=migratePersistedOrganism(raw);
const state=migrated.system.b312ExecutiveDecisionHandoff;
assert.equal(state?.evaluations,17);
assert.equal(state?.promotions,3);
assert.equal(state?.confirmations,8);
assert.equal(state?.lastPolicyAction,'explore');
console.log(JSON.stringify({pass:true,schema:ORGANISM_STATE_SCHEMA,restored:state},null,2));
process.exit(0);
