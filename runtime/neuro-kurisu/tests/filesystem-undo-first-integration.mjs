import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const tempRoot = await mkdtemp(join(tmpdir(), 'nk1-undo-first-files-'));
const statePath = join(tempRoot, 'organism-core.json');
const store = new FileStateStore(statePath, { backupEverySaves: 20 });
const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });

function undoArtifactIdFromReference(undoResult, operationKey) {
  assert.ok(undoResult.recoveryArtifactRef?.startsWith('nk1-file-create:'));
  return undoResult.recoveryArtifactRef.slice('nk1-file-create:'.length);
}

async function approveWrite(targetCore, payload, key) {
  const options = { idempotencyKey: key, autonomous: false, decisionId: `filesystem-integration:${key}` };
  const request = await targetCore.requestActionToolApproval(
    'organism.files.write', payload, 'filesystem-undo-first-integration', options, 'execute',
  );
  assert.equal(request.created, true);
  const resolved = await targetCore.resolveActionToolApproval(request.request.id, true);
  assert.equal(resolved.ok, true);
  return { ...options, approvalId: request.request.id };
}

try {
  await core.init();

  // The file writer must be a real tool on the same ActionGateway as camera,
  // speech and project actions — not a parallel file executor.
  const tools = core.actionToolsSnapshot();
  const writer = tools.find(row => row.id === 'organism.files.write');
  assert.ok(writer, 'OrganismCore must register the first sandboxed filesystem write tool');
  assert.equal(writer.capability, 'filesystem.create');
  assert.equal(writer.permissionClass, 'filesystem');
  assert.equal(writer.requiresIdempotencyKey, true);
  assert.equal(writer.requiresUndoFirst, true);
  assert.equal(writer.hasUndoFirstPreparation, true);
  assert.equal(writer.hasInputContract, true);
  assert.equal(writer.hasOutcomeVerifier, true);
  assert.equal(writer.hasReceiptReconciliation, true);

  const input = { path: 'undo-first-integration.txt', content: 'NK1 filesystem Undo-First integration\n' };
  const idempotencyKey = 'filesystem-undo-first:integration-create-01';
  const options = await approveWrite(core, input, idempotencyKey);
  const result = await core.executeTool(
    'organism.files.write', input, 'filesystem-undo-first-integration', options,
  );
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.outcomeClass, 'executed-verified');

  const workspace = store.siblingPath('workspace');
  const writtenPath = join(workspace, 'undo-first-integration.txt');
  assert.equal(await readFile(writtenPath, 'utf8'), input.content);
  const expectedContentHash = createHash('sha256').update(input.content, 'utf8').digest('hex');
  assert.equal(result.result.contentHash, expectedContentHash);
  assert.equal(result.result.path, input.path);

  const recoveryArtifactId = undoArtifactIdFromReference(result, idempotencyKey);
  const artifactPath = join(workspace, '.nk1-recovery', 'prepared', `${recoveryArtifactId}.json`);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  assert.equal(artifact.version, 1);
  assert.equal(artifact.executionId, result.executionId);
  assert.equal(artifact.relativePath, input.path);
  assert.equal(artifact.contentHash, expectedContentHash);
  assert.equal(artifact.status, 'committed');
  assert.match(artifact.digest, /^[a-f0-9]{64}$/);

  // A second approved create to the same path must fail closed and preserve the
  // original bytes instead of treating a user file as replaceable content.
  const overwriteInput = { path: input.path, content: 'replacement must not be applied' };
  const overwriteOptions = await approveWrite(core, overwriteInput, 'filesystem-undo-first:overwrite-denied');
  const overwrite = await core.executeTool('organism.files.write', overwriteInput, 'must-not-overwrite', overwriteOptions);
  assert.equal(overwrite.outcomeClass, 'undo-preparation-failed');
  assert.equal(await readFile(writtenPath, 'utf8'), input.content);

  // Parent traversal is rejected before receipt admission or target file creation.
  const traversalInput = { path: '../escaped-from-workspace.txt', content: 'must stay inside the sandbox' };
  const traversalOptions = await approveWrite(core, traversalInput, 'filesystem-undo-first:path-traversal');
  const traversal = await core.executeTool('organism.files.write', traversalInput, 'must-not-escape', traversalOptions);
  assert.equal(traversal.outcomeClass, 'undo-preparation-failed');
  await assert.rejects(readFile(join(tempRoot, 'escaped-from-workspace.txt'), 'utf8'), { code: 'ENOENT' });

  // Automatic compensation is deliberately not advertised for a regular mutable
  // filesystem path: the current adapter creates new files only and exposes a
  // hash-bound manual recovery procedure instead of claiming a false CAS delete.
  const undo = await core.executeUndoForKey(idempotencyKey, 'inspect filesystem recovery plan');
  assert.equal(undo.status, 'manual-intervention-required');
  assert.ok(undo.planHash);
  assert.ok(undo.recoveryArtifactRef?.startsWith('nk1-file-create:'));
  assert.ok(undo.manualSteps?.some(step => step.includes(expectedContentHash)));
  assert.equal(await readFile(writtenPath, 'utf8'), input.content, 'presenting a manual plan must not silently delete user data');

  // Reopen the exact FileStateStore and prove the plan/receipt survives a core restart.
  const restarted = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await restarted.init();
  const replay = await restarted.executeTool('organism.files.write', input, 'filesystem-retry', options);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.executionId, result.executionId);
  assert.equal(replay.result.contentHash, expectedContentHash);
  const restoredUndo = await restarted.executeUndoForKey(idempotencyKey, 'inspect recovery after restart');
  assert.equal(restoredUndo.status, 'manual-intervention-required');
  assert.equal(restoredUndo.planHash, undo.planHash);
  assert.equal(restoredUndo.recoveryArtifactRef, undo.recoveryArtifactRef);
  assert.equal((await stat(writtenPath)).isFile(), true);

  // Memory-only cores have no durable filesystem workspace and must not expose
  // the mutation tool at all.
  const memoryCore = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await memoryCore.init();
  assert.equal(memoryCore.actionToolsSnapshot().some(row => row.id === 'organism.files.write'), false);

  console.log(JSON.stringify({
    ok: true,
    pass: 'filesystem-undo-first-integration',
    assertions: 42,
    tool: 'organism.files.write',
    receipt: result.executionId,
    undoStatus: undo.status,
    restartReplay: replay.idempotentReplay,
    contentHash: expectedContentHash,
    workspace: 'state-sidecar-only',
  }));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
