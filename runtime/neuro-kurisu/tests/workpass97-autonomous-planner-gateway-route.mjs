import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const intentRuntimeSource = await readFile(new URL('../src/organism/system/IntentExecutionRuntime.ts', import.meta.url), 'utf8');
const planAt = source.indexOf("planner: 'autonomous-resource-tool-life'");
assert.notEqual(planAt, -1, 'autonomous resource/tool/life planner must remain identifiable');
const autonomousBlock = source.slice(planAt, source.indexOf('const recorded =', planAt));
assert.match(autonomousBlock, /wasToolExecutorEntered\(toolResult\.outcomeClass\)/,
  'autonomous learning must share the gateway executor-entry classification instead of maintaining a divergent outcome list');
assert.doesNotMatch(autonomousBlock, /const executionActuallyAttempted = \[/,
  'autonomous learning must not duplicate ActionGateway outcome semantics');
const approvalAt = source.indexOf('approveFromTrustedPlanner(', planAt);
assert.notEqual(approvalAt, -1, 'autonomous planner must obtain a distinct trusted planner approval, not impersonate user confirmation');
const dispatchAt = source.indexOf('this.executeIntent(approvedAutonomousIntent', planAt);
assert.notEqual(dispatchAt, -1, 'autonomous planner must pass the approved contract through the Core intent gate');
assert.match(autonomousBlock, /intentExecutionRuntime\.getContract\(autonomousIntentDraft\.id\)/,
  'deterministic planner retries must reuse the same restored HMAC-attested intent contract');
assert.match(autonomousBlock, /cognitiveEventFabric\.append\(/,
  'internal approval must be anchored to the actual CEF plan event');
assert.match(source, /private verifyAutonomousPlannerIntent\(contract: IntentContract, evidence: TrustedAutonomousDecisionEvidence\)/,
  'the Core must independently validate the planner receipt before minting an internal approval');
assert.match(source, /cognitiveEventFabric\.snapshot\(\)\.recent/,
  'planner approval must check the decision event in the canonical CEF snapshot');
assert.match(source, /event\.payload\.intentHash !== expectedHash/,
  'planner receipt validation must compare the deterministic intent hash');
assert.match(source, /contract\.risk\.level === 'low' \|\| contract\.risk\.level === 'medium'/,
  'the internal planner verifier must not authorize high or critical intent');
assert.match(autonomousBlock, /refuseToolExecution\(/,
  'unverified or high-risk planner intents must create an audited refusal before executor entry');
const directCallAt = source.indexOf('this.cognitiveRuntime.actionGateway.executeTool(', planAt);
assert.ok(directCallAt === -1 || directCallAt > dispatchAt,
  'autonomous planner must not bypass the canonical Core execution wrapper before its planned action');
const wrapperAt = source.indexOf('async executeTool(id: string');
assert.notEqual(wrapperAt, -1, 'canonical core execution wrapper must exist');
const wrapperEnd = source.indexOf('\n    /**', wrapperAt);
const wrapper = source.slice(wrapperAt, wrapperEnd === -1 ? wrapperAt + 2500 : wrapperEnd);
assert.match(wrapper, /canonicalActionToolId\(id\)/, 'wrapper canonicalizes legacy aliases before dispatch');
assert.match(wrapper, /actionGateway\.executeTool\(canonicalId, input, reason, options\)/,
  'wrapper delegates to the canonical ActionGateway');
assert.match(wrapper, /finalizeToolOutcome\(canonicalId, input, reason, result, options(?:, finalizationContextKeys)?\)/,
  'unkeyed wrapper outcomes still pass through canonical finalization');
assert.match(wrapper, /options\.idempotencyKey \|\| result\.idempotentReplay/,
  'keyed execution and replay must not be finalized twice by the wrapper');


const projectStart = source.indexOf('const reconcileExistingOperation =');
assert.notEqual(projectStart, -1, 'project execution/reconciliation path must remain identifiable');
const projectEnd = source.indexOf('const unresolvedReceipt = [', projectStart);
assert.ok(projectEnd > projectStart, 'project execution path must have an explicit receipt outcome boundary');
const projectDispatch = source.slice(projectStart, projectEnd);
assert.match(projectDispatch, /this\.executeTrustedCoreIntent\(/,
  'fresh project tool execution must pass through the project-checkpoint-attested Intent Contract');
assert.match(projectDispatch, /intentApprovalId,/,
  'project Intent approval ID must remain separate from ActionGateway approval options');
assert.match(source, /projectInputHash = sha256Stable\(\{ input, expectedOutputKeys:/,
  'project intents must bind the exact project-step input digest');
assert.match(source, /evidence\.inputHash !== sha256Stable\(\{ input: action\.input/,
  'Core must re-check the exact action input against its planner evidence immediately before approval');
assert.match(source, /outcomeClass: 'idempotency-recovery-required'/,
  'an uncertain Intent dispatch must preserve the project/skill reconciliation state instead of becoming an ordinary refusal');
assert.match(intentRuntimeSource, /this\.inFlightExecutions\.add\(lock\)/,
  'Intent receipt reconciliation must serialize with execution and other lookups');
assert.match(intentRuntimeSource, /this\.inFlightExecutions\.delete\(lock\)/,
  'the shared execution/reconciliation lock must always be released');
assert.match(projectDispatch, /this\.reconcileIntentExecution\(approvedProjectIntent/,
  'a project operation with a persisted Intent Contract must reconcile through the intent runtime');
assert.match(projectDispatch, /else \{[\s\S]*this\.reconcileToolExecution\(/,
  'legacy checkpoints without an Intent record may use only the existing read-only receipt recovery path');
assert.doesNotMatch(projectDispatch, /actionGateway\.executeTool\(id, input, executionReason, executionOptions\)/,
  'project executor must not bypass the canonical core finalizer for fresh tool execution');
assert.match(projectDispatch, /this\.reconcileToolExecution\(id, input, `\$\{executionReason\};resume-reconcile`, executionOptions\)/,
  'project receipt recovery must use the core reconciliation wrapper so legacy tool aliases are canonicalized');
assert.doesNotMatch(projectDispatch, /cognitiveRuntime\.actionGateway\.reconcileToolExecution\(/,
  'project receipt recovery must not bypass canonical tool-ID normalization');


const skillStart = source.indexOf('const canonicalCandidateTool =');
assert.notEqual(skillStart, -1, 'compound skill execution path must remain identifiable');
const skillEnd = source.indexOf('stepError = result.result?.error', skillStart);
assert.ok(skillEnd > skillStart, 'compound skill execution must expose its outcome boundary');
const skillDispatch = source.slice(skillStart, skillEnd);
assert.match(skillDispatch, /this\.executeTrustedCoreIntent\(/,
  'compound skill steps must pass through a verified step-bound Intent Contract');
assert.match(skillDispatch, /intentApprovalId: pendingIntentApprovalId/,
  'compound skill Intent approvals must be distinct from ActionGateway tool approval IDs');
assert.match(skillDispatch, /finalizationContextKeys: Object\.keys\(runtimeInput\)/,
  'compound skill steps must preserve finalizer context through the Intent bridge');
assert.doesNotMatch(skillDispatch, /actionGateway\.executeTool\(/,
  'compound skill execution must not bypass canonical core finalization');
assert.doesNotMatch(skillDispatch, /this\.finalizeToolOutcome\(/,
  'compound skill execution must not duplicate the core wrapper finalizer');

console.log('NK1_AUTONOMOUS_PLANNER_GATEWAY_ROUTE=PASS plannerUsesIntent=true projectUsesIntent=true compoundSkillsUseIntent=true canonicalGateway=true finalizerOwnership=true');
