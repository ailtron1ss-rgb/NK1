import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

// Regression: the gateway currently ignores the proof-required marker. The
// production defect is executor entry without an authenticated competence proof.
const gateway = new ActionGateway();
let executorCalls = 0;
gateway.registerTool({
  id: 'skill.proof.read',
  capability: 'skill-competence-proof-test',
  destructive: false,
  requiresSkillCompetenceProof: true,
  execute: async () => {
    executorCalls += 1;
    return { ok: true, value: 'executed-without-proof' };
  },
});

const result = await gateway.executeTool('skill.proof.read', {}, 'proof-required-regression');
assert.equal(result.outcomeClass, 'competence-insufficient',
  'a proof-required tool without an attested skill certificate must be refused');
assert.equal(executorCalls, 0,
  'missing competence proof must be rejected before the tool executor is entered');

console.log('P23_SKILL_COMPETENCE_PROOF=PASS');
