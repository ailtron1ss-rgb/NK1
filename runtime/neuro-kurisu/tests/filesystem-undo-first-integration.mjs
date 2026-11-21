import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const tempRoot = await mkdtemp(join(tmpdir(), 'nk1-undo-first-files-'));
const statePath = join(tempRoot, 'organism-core.json');
const store = new FileStateStore(statePath, { backupEverySaves: 20 });
// Simulate an older or manually created workspace with permissive mode bits.
await mkdir(store.siblingPath('workspace'), { recursive: true, mode: 0o755 });
const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });

function undoArtifactIdFromReference(undoResult) {
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

  // The tool must not accept anonymous or unapproved filesystem writes.
  const missingKey = await core.executeTool('organism.files.write', input, 'anonymous-filesystem-write');
  assert.equal(missingKey.outcomeClass, 'idempotency-key-required');
  const unapprovedKey = 'filesystem-undo-first:unapproved';
  const missingApproval = await core.executeTool('organism.files.write', input, 'unapproved-filesystem-write', {
    idempotencyKey: unapprovedKey,
    decisionId: 'filesystem-integration:unapproved',
    autonomous: false,
  });
  assert.equal(missingApproval.outcomeClass, 'approval-required');
  await assert.rejects(readFile(join(store.siblingPath('workspace'), input.path), 'utf8'), { code: 'ENOENT' });

  const idempotencyKey = 'filesystem-undo-first:integration-create-01';
  const options = await approveWrite(core, input, idempotencyKey);
  const result = await core.executeTool(
    'organism.files.write', input, 'filesystem-undo-first-integration', options,
  );
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.outcomeClass, 'executed-verified');

  const workspace = store.siblingPath('workspace');
  assert.equal((await stat(workspace)).mode & 0o777, 0o700, 'the pre-existing workspace is tightened to owner-only before file creation');
  const writtenPath = join(workspace, 'undo-first-integration.txt');
  assert.equal(await readFile(writtenPath, 'utf8'), input.content);
  const expectedContentHash = createHash('sha256').update(input.content, 'utf8').digest('hex');
  assert.equal(result.result.contentHash, expectedContentHash);
  assert.equal(result.result.path, input.path);

  const undo = await core.executeUndoForKey(idempotencyKey, 'inspect filesystem recovery plan');
  assert.equal(undo.status, 'manual-intervention-required');
  assert.ok(undo.planHash);
  assert.ok(undo.recoveryArtifactRef?.startsWith('nk1-file-create:'));
  assert.ok(undo.manualSteps?.some(step => step.includes(expectedContentHash)));
  assert.equal(await readFile(writtenPath, 'utf8'), input.content, 'presenting a manual plan must not silently delete user data');

  const recoveryArtifactId = undoArtifactIdFromReference(undo);
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

  // A final-component symlink is rejected rather than followed outside the workspace.
  await symlink(tempRoot, join(workspace, 'external-link.txt'));
  const symlinkInput = { path: 'external-link.txt', content: 'must not follow symlinks' };
  const symlinkOptions = await approveWrite(core, symlinkInput, 'filesystem-undo-first:symlink-denied');
  const symlinkResult = await core.executeTool('organism.files.write', symlinkInput, 'must-not-follow-symlink', symlinkOptions);
  assert.equal(symlinkResult.outcomeClass, 'undo-preparation-failed');
  await assert.rejects(readFile(join(tempRoot, 'external-link.txt'), 'utf8'), { code: 'ENOENT' });

  // Automatic compensation is deliberately not advertised for a regular mutable
  // filesystem path: the current adapter creates new files only and exposes a
  // hash-bound manual recovery procedure instead of claiming a false CAS delete.

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

  // An attacker-controlled recovery-directory symlink must be rejected before
  // the adapter creates any child directory outside the private workspace.
  const symlinkStoreRoot = join(tempRoot, 'symlink-store');
  const symlinkStore = new FileStateStore(join(symlinkStoreRoot, 'organism-core.json'), { backupEverySaves: 20 });
  const symlinkWorkspace = symlinkStore.siblingPath('workspace');
  const externalRecoveryTarget = join(tempRoot, 'external-recovery-target');
  await mkdir(symlinkWorkspace, { recursive: true });
  await mkdir(externalRecoveryTarget, { recursive: true });
  await symlink(externalRecoveryTarget, join(symlinkWorkspace, '.nk1-recovery'));
  const symlinkCore = new OrganismCore(symlinkStore, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await symlinkCore.init();
  const symlinkStoreInput = { path: 'must-not-write.txt', content: 'must remain inside workspace' };
  const symlinkStoreOptions = await approveWrite(symlinkCore, symlinkStoreInput, 'filesystem-undo-first:recovery-symlink');
  const symlinkStoreResult = await symlinkCore.executeTool('organism.files.write', symlinkStoreInput, 'must-not-follow-recovery-symlink', symlinkStoreOptions);
  assert.equal(symlinkStoreResult.outcomeClass, 'undo-preparation-failed');
  await assert.rejects(stat(join(externalRecoveryTarget, 'prepared')), { code: 'ENOENT' });

  // Memory-only cores have no durable filesystem workspace and must not expose
  // the mutation tool at all.
  const memoryCore = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await memoryCore.init();
  assert.equal(memoryCore.actionToolsSnapshot().some(row => row.id === 'organism.files.write'), false);

  console.log(JSON.stringify({
    ok: true,
    pass: 'filesystem-undo-first-integration',
    checks: ['one-shot-approval','required-idempotency','create-only-no-overwrite','path-traversal-denial','target-symlink-denial','recovery-directory-symlink-denial','readback-hash','durable-artifact','restart-replay','memory-store-isolation'],
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
