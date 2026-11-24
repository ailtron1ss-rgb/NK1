import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, open, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const self = fileURLToPath(import.meta.url);
const TOOL = 'filesystem.wp63.safe-write';
const INPUT = { resource: 'demo-relay', desired: 'on' };
const KEY = 'wp63:filesystem-target:demo-relay-on';
const DECISION = 'decision:wp63:filesystem-target:demo-relay-on';
const OPERATION_HASH = sha256Stable({ idempotencyKey: KEY });
const RECEIPT_ID = 'fs-provider-receipt-wp63-001';

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  const handle = await open(temp, 'w');
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, path);
  // Best-effort directory flush; the target file itself was fsynced before rename.
  try { const dir = await open(dirname(path), 'r'); try { await dir.sync(); } finally { await dir.close(); } } catch {}
}
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function readJsonOr(path, fallback) { try { return await readJson(path); } catch { return structuredClone(fallback); } }
async function approve(core, operation) {
  const options = { idempotencyKey: KEY, decisionId: DECISION, autonomous: false };
  const ticket = await core.requestActionToolApproval(TOOL, INPUT, `wp63-${operation}`, options, operation);
  assert.equal(ticket.created, true, `approval ticket created for ${operation}`);
  const approved = await core.resolveActionToolApproval(ticket.request.id, true);
  assert.equal(approved.ok, true, `approval ticket resolved for ${operation}`);
  return { ...options, approvalId: ticket.request.id };
}
function registerFilesystemAdapter(core, dir, mode) {
  const targetPath = join(dir, 'real-target-state.json');
  const receiptsDir = join(dir, 'provider-receipts');
  const receiptPath = join(receiptsDir, `${OPERATION_HASH}.json`);
  const invocationsPath = join(dir, 'adapter-invocations.json');
  core.registerActionTool({
    id: TOOL,
    capability: 'filesystem.write',
    permissionClass: 'filesystem',
    destructive: false,
    projectAllowed: true,
    requiresIdempotencyKey: true,
    observationSource: { sourceId: 'wp63-filesystem-target', sourceClass: 'os', channel: 'filesystem', independenceKey: 'wp63-real-target-state-file' },
    execute: async (input, context) => {
      // This is a real side effect against a temporary file-system target, not a
      // mock counter: the target state itself changes and is independently read later.
      const invocations = await readJsonOr(invocationsPath, { count: 0 });
      invocations.count++;
      await atomicJson(invocationsPath, invocations);
      const keyHash = String(context?.idempotencyKey ?? '');
      if (!/^[a-f0-9]{64}$/i.test(keyHash)) throw new Error('provider-idempotency-key-invalid');

      // Provider-native idempotency: the target mutation is applied once per operation
      // token. A separate receipt is durably written after the target has been fsynced.
      const target = await readJsonOr(targetPath, { version: 1, values: {}, appliedOperationKeys: [], sideEffectCount: 0, revision: 0 });
      if (!target.appliedOperationKeys.includes(keyHash)) {
        target.values[String(input.resource)] = String(input.desired);
        target.appliedOperationKeys.push(keyHash);
        target.sideEffectCount++;
        target.revision++;
        target.updatedAt = Date.now();
        await atomicJson(targetPath, target);
      }
      const receipt = {
        receiptId: RECEIPT_ID,
        operationKeyHash: keyHash,
        executionId: context.executionId,
        accepted: true,
        resource: String(input.resource),
        desired: String(input.desired),
        targetRevision: target.revision,
        acceptedAt: Date.now(),
      };
      await atomicJson(receiptPath, receipt);
      if (mode === 'attempt' || mode === 'lost-ack') {
        // Provider acceptance and its receipt are durable, but the adapter observes
        // only a generic transport timeout rather than returning the ACK to the gateway.
        throw new Error('transport-timeout-after-provider-acceptance-before-ack');
      }
      return { ok: true, desiredState: String(input.desired), providerReceiptId: RECEIPT_ID, executionId: context.executionId };
    },
    reconcile: async (_input, context) => {
      // Read-only lookup: it never calls execute and cannot create a receipt.
      const receipt = await readJsonOr(receiptPath, null);
      if (!receipt) return { status: 'unknown', reason: 'provider-receipt-not-visible-yet', checkedAt: Date.now() };
      if (receipt.operationKeyHash !== context.idempotencyKey || receipt.executionId !== context.executionId) {
        return { status: 'unknown', reason: 'provider-receipt-identity-mismatch', checkedAt: Date.now() };
      }
      return {
        status: 'found', authoritative: true, receiptId: receipt.receiptId, checkedAt: Date.now(),
        result: { ok: true, desiredState: receipt.desired, executionId: receipt.executionId, targetRevisionAtAcceptance: receipt.targetRevision },
      };
    },
    verify: async ({ input, result }) => {
      // Independent read-after-write: this reads the target state file, not the
      // receipt file used by reconcile(). A provider ACK alone is not the postcondition.
      const target = await readJsonOr(targetPath, null);
      const resource = String(input.resource ?? '');
      const desired = String(input.desired ?? '');
      const operationAppliedExactlyOnce = target?.appliedOperationKeys?.filter(key => key === OPERATION_HASH).length === 1;
      const match = target?.values?.[resource] === desired && operationAppliedExactlyOnce && target?.sideEffectCount === 1;
      const observed = target ? `${resource}=${String(target.values?.[resource] ?? 'missing')};operationCount=${target.appliedOperationKeys?.filter(key => key === OPERATION_HASH).length ?? 0};sideEffectCount=${target.sideEffectCount}` : `${resource}=missing`;
      return {
        verified: Boolean(match),
        basis: match ? 'external-postcondition' : 'none',
        externalObservation: Boolean(match),
        observationId: `filesystem-readback:${String(result.executionId ?? 'unknown')}`,
        expectedPostcondition: `${resource}=${desired};operationCount=1;sideEffectCount=1`,
        observedPostcondition: observed,
        confidence01: match ? .99 : .05,
        notes: match ? 'independent target-file read-after-write matches the requested state' : 'independent target-file read-back does not establish the requested state',
      };
    },
  });
}
async function runChild(mode, dir) {
  const store = new FileStateStore(join(dir, 'organism-state.json'), { backupEverySaves: 1, directoryFsyncEverySaves: 1, strictDirectoryFsync: true });
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  registerFilesystemAdapter(core, dir, mode);
  if (mode === 'attempt') {
    const options = await approve(core, 'execute');
    const result = await core.executeTool(TOOL, INPUT, 'wp63-real-filesystem-side-effect-lost-ack', options);
    assert.equal(result.outcomeClass, 'idempotency-recovery-required');
    await core.checkpoint(true);
    await atomicJson(join(dir, 'attempt-result.json'), { outcomeClass: result.outcomeClass, executionId: result.executionId, idempotencyStatus: result.idempotencyStatus });
    return;
  }
  if (mode === 'inspect') {
    const queue = core.actionRecoveryQueueSnapshot(8);
    assert.equal(queue.unresolvedCount, 1);
    assert.equal(queue.entries[0].toolId, TOOL);
    assert.equal(queue.entries[0].status, 'reconciliation-required');
    assert.equal(queue.entries[0].nextAction, 'provider-read-only-reconciliation');
    assert.equal(queue.redacted, true);
    assert.equal(queue.readOnly, true);
    for (const forbidden of ['keyHash','requestHash','idempotencyKey','input','result','providerReceiptId']) {
      assert.equal(Object.hasOwn(queue.entries[0], forbidden), false, `queue must omit ${forbidden}`);
    }
    await atomicJson(join(dir, 'queue.json'), queue);
    return;
  }
  if (mode === 'reconcile') {
    const options = await approve(core, 'reconcile');
    const result = await core.reconcileToolExecution(TOOL, INPUT, 'wp63-read-only-provider-reconcile', options);
    assert.equal(result.reconciled, true);
    assert.equal(result.providerReceiptId, RECEIPT_ID);
    assert.equal(result.outcomeClass, 'executed-verified');
    assert.equal(result.verified, true);
    assert.equal(result.verification.basis, 'external-postcondition');
    assert.match(result.verification.observedPostcondition, /demo-relay=on/);
    await core.checkpoint(true);
    const persisted = await store.load();
    await atomicJson(join(dir, 'reconciled-result.json'), {
      executionId: result.executionId,
      outcomeClass: result.outcomeClass,
      providerReceiptId: result.providerReceiptId,
      verified: result.verified,
      verification: result.verification,
      receiptStatus: persisted?.system?.actionExecutionLedger?.records?.find(row => row.toolId === TOOL)?.status ?? null,
      outcomeProjectionCount: persisted?.system?.outcomeVerification?.projectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
      evidenceRevisionCount: persisted?.system?.outcomeVerification?.evidenceRevisions?.filter(row => row.executionId === result.executionId).length ?? 0,
      receiptTraceCount: persisted?.system?.cognitiveEventFabric?.receiptProjectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
    });
    return;
  }
  if (mode === 'replay') {
    const result = await core.executeTool(TOOL, INPUT, 'wp63-repeat-replay', { idempotencyKey: KEY, decisionId: DECISION, autonomous: false });
    assert.equal(result.idempotentReplay, true);
    await core.checkpoint(true);
    await atomicJson(join(dir, 'replay-result.json'), { executionId: result.executionId, idempotentReplay: result.idempotentReplay });
    return;
  }
  throw new Error(`unknown child mode: ${mode}`);
}

if (['attempt','inspect','reconcile','replay'].includes(process.argv[2])) {
  await runChild(process.argv[2], process.argv[3]);
} else {
  const dir = await mkdtemp(join(tmpdir(), 'neuro-kurisu-wp63-fs-'));
  try {
    const run = mode => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', self, mode, dir], {
        stdio: ['ignore','pipe','pipe'], detached: process.platform !== 'win32',
      });
      let stdout = ''; let stderr = ''; let timedOut = false; let settled = false; let timer;
      const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
      // A descendant may inherit a stdio pipe and keep the 'close' event open after
      // the direct child exits. Bound the whole process group and close both pipes.
      timer = setTimeout(() => {
        timedOut = true;
        try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { child.kill('SIGKILL'); }
        child.stdout.destroy(); child.stderr.destroy();
        stderr += `\nchild-process deadline exceeded for mode=${mode}`;
        finish({ code: null, signal: 'SIGKILL', stdout, stderr, timedOut });
      }, 15_000);
      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', error => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
      child.on('close', (code, signal) => finish({ code, signal, stdout, stderr, timedOut }));
    });
    const attempt = await run('attempt');
    assert.equal(attempt.timedOut, false, `lost-ACK child exceeded its deadline; stderr=${attempt.stderr}`);
    assert.equal(attempt.code, 0, `lost-ACK attempt should be conservatively recorded; stderr=${attempt.stderr}`);
    assert.equal((await readJson(join(dir, 'attempt-result.json'))).outcomeClass, 'idempotency-recovery-required');
    const receipt = await readJson(join(dir, 'provider-receipts', `${OPERATION_HASH}.json`));
    assert.equal(receipt.accepted, true, 'provider-side receipt survived the lost ACK');
    assert.equal(receipt.operationKeyHash, OPERATION_HASH);
    const target = await readJson(join(dir, 'real-target-state.json'));
    assert.equal(target.values['demo-relay'], 'on', 'the real filesystem target changed before ACK was lost');
    assert.equal(target.sideEffectCount, 1, 'the externally visible target change happened exactly once');
    assert.deepEqual(target.appliedOperationKeys, [OPERATION_HASH]);
    assert.equal((await readJson(join(dir, 'adapter-invocations.json'))).count, 1);

    const inspect = await run('inspect');
    assert.equal(inspect.timedOut, false, `inspect child exceeded its deadline; stderr=${inspect.stderr}`);
    assert.equal(inspect.code, 0, `pending action should be visible after restart; stderr=${inspect.stderr}`);
    const queue = await readJson(join(dir, 'queue.json'));
    assert.equal(queue.entries[0].executionId, receipt.executionId);
    assert.equal(queue.unresolvedCount, 1);

    const reconcile = await run('reconcile');
    assert.equal(reconcile.timedOut, false, `reconcile child exceeded its deadline; stderr=${reconcile.stderr}`);
    assert.equal(reconcile.code, 0, `read-only provider reconciliation should succeed; stderr=${reconcile.stderr}`);
    const settled = await readJson(join(dir, 'reconciled-result.json'));
    assert.equal(settled.executionId, receipt.executionId, 'reconciliation preserves the original execution identity');
    assert.equal(settled.providerReceiptId, RECEIPT_ID);
    assert.equal(settled.outcomeClass, 'executed-verified');
    assert.equal(settled.verified, true, 'independent target-state read-after-write establishes the postcondition');
    assert.equal(settled.receiptStatus, 'completed');
    assert.equal(settled.outcomeProjectionCount, 1, 'pending-first result creates exactly one canonical outcome projection');
    assert.equal(settled.evidenceRevisionCount, 0, 'no evidence revision is created when there was no prior terminal outcome');
    assert.equal(settled.receiptTraceCount, 1, 'pending-first reconciliation creates exactly one canonical receipt trace');
    assert.equal((await readJson(join(dir, 'real-target-state.json'))).sideEffectCount, 1, 'reconciliation does not repeat the real target mutation');
    assert.equal((await readJson(join(dir, 'adapter-invocations.json'))).count, 1, 'reconciliation is read-only and did not call execute again');

    const replay = await run('replay');
    assert.equal(replay.timedOut, false, `replay child exceeded its deadline; stderr=${replay.stderr}`);
    assert.equal(replay.code, 0, `completed receipt should replay safely; stderr=${replay.stderr}`);
    const replayResult = await readJson(join(dir, 'replay-result.json'));
    assert.equal(replayResult.executionId, receipt.executionId);
    assert.equal(replayResult.idempotentReplay, true);
    assert.equal((await readJson(join(dir, 'real-target-state.json'))).sideEffectCount, 1);
    assert.equal((await readJson(join(dir, 'adapter-invocations.json'))).count, 1);
    console.log('WORKPASS63_FILESYSTEM_SIDE_EFFECT_RECOVERY=PASS real-temp-filesystem-target provider-receipt lost-ACK-after-acceptance durable-restore redacted-queue read-only-reconcile independent-read-after-write single-effect original-execution-id idempotent-replay');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
