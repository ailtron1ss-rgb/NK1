import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const key = 'workpass96:finalizer-boundary:v1';
const options = { idempotencyKey: key, decisionId: 'decision:workpass96:finalizer-boundary' };

function makeGateway() {
  const gateway = new ActionGateway();
  gateway.setExecutionLedgerPersister(async () => {});
  let executions = 0;
  gateway.registerTool({
    id: 'organism.inspect', capability: 'core.read', destructive: false,
    execute: async () => { executions += 1; return { ok: true, state: 'ready' }; },
  });
  return { gateway, getExecutions: () => executions };
}

const success = makeGateway();
let finalizations = 0;
success.gateway.setExecutionFinalizer(async ({ toolId, result, options: received }) => {
  finalizations += 1;
  assert.equal(toolId, 'organism.inspect');
  assert.equal(result.ok, true);
  assert.equal(received.idempotencyKey, key);
});
const first = await success.gateway.executeTool('organism.inspect', {}, 'finalizer-success', options);
assert.equal(first.ok, true);
assert.equal(first.idempotencyStatus, 'recorded');
assert.equal(finalizations, 1, 'fresh keyed execution is finalized before its completed receipt is returned');
const replay = await success.gateway.executeTool('organism.inspect', {}, 'finalizer-replay', options);
assert.equal(replay.idempotentReplay, true);
assert.equal(replay.ok, true);
assert.equal(finalizations, 1, 'receipt replay must not repeat finalization or learning projections');
assert.equal(success.getExecutions(), 1, 'receipt replay must not repeat the executor');

const failing = makeGateway();
let failedFinalizations = 0;
failing.gateway.setExecutionFinalizer(async () => {
  failedFinalizations += 1;
  throw new Error('projection-store-unavailable');
});
const uncertain = await failing.gateway.executeTool('organism.inspect', {}, 'finalizer-failure', options);
assert.equal(uncertain.outcomeClass, 'idempotency-recovery-required',
  'a post-effect finalization failure must not be reported as a committed success');
assert.equal(uncertain.result.error, 'post-execution-finalization-failed');
assert.equal(failing.getExecutions(), 1);
assert.equal(failedFinalizations, 1);
const retry = await failing.gateway.executeTool('organism.inspect', {}, 'finalizer-failure-retry', options);
assert.equal(retry.outcomeClass, 'idempotency-recovery-required',
  'an unresolved receipt must block automatic re-execution after finalization failure');
assert.equal(failing.getExecutions(), 1, 'retry must not repeat a possibly completed side effect');
assert.equal(failedFinalizations, 1, 'retry must not rerun finalization without reconciliation');

console.log('NK1_ACTION_FINALIZER_BOUNDARY=PASS successFinalizedOnce=true replayNoFinalize=true failureBlocksRetry=true');
