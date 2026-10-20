import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const planAt = source.indexOf("planner: 'autonomous-resource-tool-life'");
assert.notEqual(planAt, -1, 'autonomous resource/tool/life planner must remain identifiable');
const callAt = source.indexOf('const toolResult = await this.executeTool(autoToolPlan.tool.id', planAt);
assert.notEqual(callAt, -1, 'autonomous planner must delegate through OrganismCore.executeTool');
const directCallAt = source.indexOf('this.cognitiveRuntime.actionGateway.executeTool(', planAt);
assert.ok(directCallAt === -1 || directCallAt > callAt,
  'autonomous planner must not bypass the canonical core execution wrapper before its planned action');
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
assert.match(projectDispatch, /result = await this\.executeTool\(id, input, executionReason, executionOptions\)/,
  'fresh project tool execution must use the canonical core wrapper so unkeyed outcomes are finalized');
assert.doesNotMatch(projectDispatch, /actionGateway\.executeTool\(id, input, executionReason, executionOptions\)/,
  'project executor must not bypass the canonical core finalizer for fresh tool execution');


const skillStart = source.indexOf('const canonicalCandidateTool =');
assert.notEqual(skillStart, -1, 'compound skill execution path must remain identifiable');
const skillEnd = source.indexOf('stepError = result.result?.error', skillStart);
assert.ok(skillEnd > skillStart, 'compound skill execution must expose its outcome boundary');
const skillDispatch = source.slice(skillStart, skillEnd);
assert.match(skillDispatch, /this\.executeTool\(\s*canonicalCandidateTool, resolvedToolInput, executionReason, executionOptions, Object\.keys\(runtimeInput\)/,
  'compound skill steps must dispatch through OrganismCore.executeTool and preserve finalization context keys');
assert.doesNotMatch(skillDispatch, /actionGateway\.executeTool\(/,
  'compound skill execution must not bypass canonical core finalization');
assert.doesNotMatch(skillDispatch, /this\.finalizeToolOutcome\(/,
  'compound skill execution must not duplicate the core wrapper finalizer');

console.log('NK1_AUTONOMOUS_PLANNER_GATEWAY_ROUTE=PASS plannerUsesCoreWrapper=true projectUsesCoreWrapper=true canonicalGateway=true finalizerOwnership=true');
