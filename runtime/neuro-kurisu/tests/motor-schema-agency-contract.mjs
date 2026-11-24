import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { validateMotorSchema, motorSchemaToCompoundSkillInput } from '../src/organism/system/MotorSchema.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const baseSchema = {
  version: 1,
  id: 'safe-investigation-v1',
  projectId: 'pass5-agency',
  name: 'safe-investigation',
  origin: 'integration-test',
  policy: { requireVerified: true, maxTotalAttempts: 4, maxTotalResourceCost01: .5 },
  steps: [
    { id: 'inspect', action: 'explore', toolId: 'tool.motor.inspect', input: { query: 'safe' }, expectedOutputKeys: ['value'], maxAttempts: 1, resourceCost01: .1 },
    { id: 'verify', action: 'verify', toolId: 'tool.motor.verify', inputBindings: { value: '$step:inspect.value' }, requiredInputKeys: ['value'], expectedOutputKeys: ['accepted'], maxAttempts: 1, resourceCost01: .12 },
  ],
};

const valid = validateMotorSchema(baseSchema);
assert.equal(valid.ok, true, JSON.stringify(valid.issues));
assert.deepEqual(valid.totals, { steps: 2, maxAttempts: 2, resourceCost01: .22 });
const compiledInput = motorSchemaToCompoundSkillInput(valid.schema);
assert.equal(compiledInput.steps[1].inputBindings.value, '$step:inspect.value');
assert.equal(compiledInput.steps[1].allowUnverified, false);

assert.equal(validateMotorSchema({ ...baseSchema, policy: { requireVerified: false } }).ok, false,
  'schema cannot bypass verified execution');
assert.equal(validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], maxAttempts: 90 }, baseSchema.steps[1]] }).ok, false,
  'unsafe retry counts must be rejected rather than silently clamped');
assert.equal(validateMotorSchema({ ...baseSchema, steps: [baseSchema.steps[0], { ...baseSchema.steps[1], id: 'inspect' }] }).ok, false,
  'duplicate step IDs must be rejected');
assert.equal(validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], inputBindings: { x: '$step:verify.value' } }, baseSchema.steps[1]] }).ok, false,
  'forward references must be rejected');
assert.equal(validateMotorSchema({ ...baseSchema, policy: { requireVerified: true, maxTotalAttempts: 2, maxTotalResourceCost01: .1 } }).ok, false,
  'resource over-budget plans must be rejected');
assert.equal(validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], input: { payload: '😀'.repeat(2200) } }, baseSchema.steps[1]] }).ok, false,
  'serialized input must be bounded by actual UTF-8 bytes, not JavaScript character count');
const cyclicInput = {}; cyclicInput.self = cyclicInput;
assert.doesNotThrow(() => validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], input: cyclicInput }, baseSchema.steps[1]] }),
  'cyclic input must fail closed as a validation result rather than crash the validator');
assert.equal(validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], input: cyclicInput }, baseSchema.steps[1]] }).ok, false);
assert.equal(validateMotorSchema({ ...baseSchema, steps: [{ ...baseSchema.steps[0], input: new Date() }, baseSchema.steps[1]] }).ok, false,
  'non-plain input objects must not silently normalize into empty objects');

const noCall = { count: 0 };
const gateway = new ActionGateway({ live: false });
gateway.registerTool({ id: 'tool.unavailable', capability: 'safe.test', destructive: false,
  availability: () => ({ available: false, reason: 'missing-device' }),
  execute: async () => { noCall.count++; return { ok: true }; } });
const unavailable = await gateway.executeTool('tool.unavailable');
assert.equal(unavailable.outcomeClass, 'unavailable');
assert.equal(unavailable.audit.outcomeClass, 'unavailable');
assert.equal(noCall.count, 0, 'unavailable tool must not execute');

gateway.registerTool({ id: 'tool.gate-error', capability: 'safe.test', destructive: false,
  competence: () => { throw new Error('gate unavailable'); },
  execute: async () => { noCall.count++; return { ok: true }; } });
const gateError = await gateway.executeTool('tool.gate-error');
assert.equal(gateError.outcomeClass, 'gate-check-failed', 'a failed competence check is not evidence of incompetence');
assert.equal(noCall.count, 0);

gateway.registerTool({ id: 'tool.incompetent', capability: 'safe.test', destructive: false,
  competence: () => ({ competent: false, confidence01: .2, reason: 'missing-verified-skill' }),
  execute: async () => { noCall.count++; return { ok: true }; } });
const incompetent = await gateway.executeTool('tool.incompetent');
assert.equal(incompetent.outcomeClass, 'competence-insufficient');
assert.equal(incompetent.competenceConfidence01, .2);
assert.equal(noCall.count, 0);

gateway.registerTool({ id: 'tool.policy', capability: 'safe.test', destructive: true,
  execute: async () => { noCall.count++; return { ok: true }; } });
const refused = await gateway.executeTool('tool.policy');
assert.equal(refused.outcomeClass, 'policy-refused');
assert.equal(noCall.count, 0, 'policy refusal must not execute or masquerade as incompetence');

gateway.registerTool({ id: 'tool.broken', capability: 'safe.test', destructive: false,
  execute: async () => { throw new Error('boom'); } });
const failed = await gateway.executeTool('tool.broken');
assert.equal(failed.outcomeClass, 'execution-failed');

gateway.registerTool({ id: 'tool.verified', capability: 'safe.test', destructive: false,
  execute: async () => ({ ok: true, value: 'ok' }),
  verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .95, externalObservation: false, notes: 'verified fixture' }) });
const succeeded = await gateway.executeTool('tool.verified');
assert.equal(succeeded.outcomeClass, 'executed-verified');
assert.equal(succeeded.audit.outcomeClass, 'executed-verified');

gateway.registerTool({ id: 'tool.unverified', capability: 'safe.test', destructive: false,
  execute: async () => ({ ok: true, value: 'unverified' }) });
const weak = await gateway.executeTool('tool.unverified');
assert.equal(weak.ok, true);
assert.equal(weak.verified, false);
assert.equal(weak.outcomeClass, 'executed-unverified');

const observedBinding = { value: '' };
const core = new OrganismCore(new MemoryStateStore(), {
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 2,
  cycleResultMode: 'operational',
});
await core.init();
core.registerActionTool({
  id: 'tool.motor.inspect', capability: 'safe.test', destructive: false, projectAllowed: false,
  execute: async () => ({ ok: true, value: 'artifact-pass5' }),
  verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .96, externalObservation: false, notes: 'inspection fixture verified' }),
});
core.registerActionTool({
  id: 'tool.motor.verify', capability: 'safe.test', destructive: false, projectAllowed: false,
  execute: async (input) => { observedBinding.value = String(input.value ?? ''); return { ok: input.value === 'artifact-pass5', accepted: input.value === 'artifact-pass5' }; },
  verify: async ({ result }) => ({ verified: Boolean(result?.accepted), basis: 'tool-contract', confidence01: .97, externalObservation: false, notes: 'bound artifact verified' }),
});
const compiled = core.compileMotorSchema(baseSchema);
assert.equal(compiled.ok, true, JSON.stringify(compiled));
assert.equal(compiled.skill.stepCount, 2);
assert.equal(compiled.skill.status, 'candidate');
for (let i = 0; i < 5; i++) {
  core.recordCompoundSkillExecution(compiled.skill.id, {
    success01: 1, verified: true, independent: true, context: `motor schema validated context ${i}`,
  });
}
const reusable = core.reusableCompoundSkill('motor schema validated context 4');
assert.ok(reusable && reusable.status === 'reusable', 'promotion must remain controlled by canonical ProceduralSkillLibrary');
const executed = await core.executeReusableSkill(reusable.id, {
  contextKey: 'motor schema validated context 5', independentEvidence: true,
}, 'motor-schema-pass5-test');
assert.equal(executed.ok, true);
assert.equal(executed.verified, true);
assert.equal(executed.results.length, 2);
assert.equal(observedBinding.value, 'artifact-pass5', 'prior step output must be bound into the next canonical tool call');
assert.equal(executed.results[1].verified, true);
assert.equal(executed.results[0].outcomeClass, 'executed-verified');
assert.equal(executed.results[1].outcomeClass, 'executed-verified');
const outcomeRecords = core.outcomeVerificationSnapshot().records;
assert.ok(outcomeRecords.some((r) => r.outcomeClass === 'executed-verified'),
  'outcome class must survive projection into the canonical persistent verification ledger');
assert.ok(outcomeRecords.length >= 2,
  'each motor step must pass through canonical action/outcome verification');
await core.flush();

console.log('MOTOR_SCHEMA_AGENCY_PASS=PASS', JSON.stringify({
  validation: valid.ok, totals: valid.totals,
  outcomeClasses: [unavailable.outcomeClass, gateError.outcomeClass, incompetent.outcomeClass, refused.outcomeClass, failed.outcomeClass, succeeded.outcomeClass, weak.outcomeClass],
  canonicalSkillExecuted: executed.ok && executed.verified && executed.results.length === 2,
}));
