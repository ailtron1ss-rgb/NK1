import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const self = fileURLToPath(import.meta.url);
const TOOL = 'test.workpass62-kill-reconcile';
const INPUT = { device: 'simulated-relay', desired: 'on' };
const KEY = 'wp62:simulated-relay:physical-op-001';
const DECISION = 'decision:wp62:simulated-relay:physical-op-001';

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  const handle = await open(temp, 'w');
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
  const { rename } = await import('node:fs/promises');
  await rename(temp, path);
}
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function approval(core, operation) {
  const options = { idempotencyKey: KEY, decisionId: DECISION, autonomous: false };
  const req = await core.cognitiveRuntime.actionGateway.requestToolApproval(TOOL, INPUT, `wp62-${operation}`, options, operation);
  assert.equal(req.created, true, `approval ticket created for ${operation}`);
  const resolved = await core.cognitiveRuntime.actionGateway.resolveToolApproval(req.request.id, true, 'workpass62-test-owner');
  assert.equal(resolved.ok, true, `approval ticket resolved for ${operation}`);
  return { ...options, approvalId: req.request.id };
}
function register(core, dir, mode) {
  const providerPath = join(dir, 'simulated-provider-receipt.json');
  const unexpectedPath = join(dir, 'unexpected-re-execution.json');
  core.registerActionTool({
    id: TOOL,
    capability: 'device.set-state',
    destructive: false,
    projectAllowed: true,
    requiresIdempotencyKey: true,
    execute: async () => {
      if (mode === 'crash') {
        const previous = await readJson(providerPath).catch(() => ({ executeCount: 0 }));
        await atomicJson(providerPath, {
          executeCount: Number(previous.executeCount || 0) + 1,
          accepted: true,
          receiptId: 'provider-receipt-wp62-live-simulation-001',
          appliedState: 'on',
          idempotencyKey: KEY,
        });
        // Simulate a provider accepting the side effect and the host process dying
        // before the adapter can return an ACK or ActionGateway can finalize it.
        process.kill(process.pid, 'SIGKILL');
        throw new Error('unreachable-after-sigkill');
      }
      await atomicJson(unexpectedPath, { called: true, at: Date.now() });
      return { ok: true, appliedState: 'on', error: 'executor-must-not-run-during-recovery' };
    },
    reconcile: async (_input, context) => {
      assert.ok(context.executionId.startsWith('exec-'));
      assert.ok(context.idempotencyKey);
      const receipt = await readJson(providerPath).catch(() => null);
      if (!receipt?.accepted || receipt.idempotencyKey !== KEY) return { status: 'unknown', reason: 'simulated-provider-receipt-not-yet-visible' };
      return {
        status: 'found', authoritative: true,
        receiptId: receipt.receiptId,
        result: { ok: true, appliedState: receipt.appliedState, providerReceiptId: receipt.receiptId },
        checkedAt: Date.now(),
      };
    },
    verify: async ({ result }) => result?.appliedState === 'on'
      ? { verified: true, basis: 'external-postcondition', externalObservation: true, observationId: 'wp62-independent-readback-001', expectedPostcondition: 'relay=on', observedPostcondition: 'relay=on', confidence01: .97, notes: 'independent simulated provider read-after-write confirmed' }
      : { verified: false, basis: 'none', externalObservation: false, confidence01: 0, notes: 'postcondition not observed' },
  });
}

async function child(mode, dir) {
  const store = new FileStateStore(join(dir, 'organism-state.json'), {
    backupEverySaves: 1, directoryFsyncEverySaves: 1, strictDirectoryFsync: true,
  });
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  register(core, dir, mode);
  if (mode === 'crash') {
    await core.executeTool(TOOL, INPUT, 'wp62-crash-after-provider-acceptance', await approval(core, 'execute'));
    throw new Error('expected SIGKILL inside executor did not occur');
  }
  if (mode === 'inspect-pending') {
    const queue = core.actionRecoveryQueueSnapshot(8);
    assert.equal(queue.unresolvedCount, 1, 'restart exposes one unresolved durable action');
    assert.equal(queue.returnedCount, 1);
    assert.equal(queue.entries[0].toolId, TOOL);
    assert.equal(queue.entries[0].status, 'reconciliation-required');
    assert.equal(queue.entries[0].reconciliationSupported, true);
    assert.equal(queue.entries[0].nextAction, 'provider-read-only-reconciliation');
    const row = queue.entries[0];
    for (const secretField of ['keyHash','requestHash','idempotencyKey','requestFingerprint','input','providerReceiptId','result']) {
      assert.equal(Object.hasOwn(row, secretField), false, `recovery API omits ${secretField}`);
    }
    assert.equal(queue.redacted, true);
    assert.equal(queue.readOnly, true);
    await atomicJson(join(dir, 'recovery-queue.json'), queue);
    return;
  }
  if (mode === 'recover' || mode === 'recover-crash-finalizer') {
    const reconcileOptions = await approval(core, 'reconcile');
    if (mode === 'recover-crash-finalizer') {
      // Fault-inject at the second dangerous window: with an ambiguous first attempt,
      // authoritative provider receipt creates the first canonical outcome/receipt trio
      // in memory, but the completed ActionGateway receipt has not reached durable state.
      // This is a genuine child-process SIGKILL, not a handled exception.
      const baseSave = store.save.bind(store);
      store.save = async (value) => {
        const projections = value?.system?.outcomeVerification?.projectionIndex ?? [];
        const completed = (value?.system?.actionExecutionLedger?.records ?? []).find(row => row.toolId === TOOL && row.status === 'completed');
        if (completed && projections.some(row => row.executionId === completed.executionId)) {
          console.error('[WorkPass62/63] crash injection after first canonical finalization, before completed receipt commit');
          process.kill(process.pid, 'SIGKILL');
        }
        return baseSave(value);
      };
    }
    const result = await core.reconcileToolExecution(TOOL, INPUT, 'wp62-reconcile-after-process-restart', reconcileOptions);
    assert.equal(result.reconciled, true);
    assert.equal(result.providerReceiptId, 'provider-receipt-wp62-live-simulation-001');
    assert.equal(result.verified, true);
    assert.equal(result.outcomeClass, 'executed-verified');
    await core.checkpoint(true);
    const persisted = await store.load();
    await atomicJson(join(dir, 'recovery-result.json'), {
      ok: true,
      executionId: result.executionId,
      outcomeClass: result.outcomeClass,
      providerReceiptId: result.providerReceiptId,
      verified: result.verified,
      evidenceRevisionCount: persisted?.system?.outcomeVerification?.evidenceRevisions?.filter(row => row.executionId === result.executionId).length ?? 0,
      outcomeProjectionCount: persisted?.system?.outcomeVerification?.projectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
      receiptTraceCount: persisted?.system?.cognitiveEventFabric?.receiptProjectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
      receiptLedgerStatus: persisted?.system?.actionExecutionLedger?.records?.find(row => row.toolId === TOOL)?.status ?? null,
    });
    return;
  }
  if (mode === 'replay') {
    const result = await core.executeTool(TOOL, INPUT, 'wp62-replay-after-restart', { idempotencyKey: KEY, decisionId: DECISION, autonomous: false });
    assert.equal(result.idempotentReplay, true);
    assert.match(result.executionId, /^exec-/);
    await core.checkpoint(true);
    const persisted = await store.load();
    await atomicJson(join(dir, 'recovery-result.json'), {
      ok: true, executionId: result.executionId, outcomeClass: result.outcomeClass, verified: result.verified,
      providerReceiptId: result.providerReceiptId, idempotentReplay: result.idempotentReplay,
      evidenceRevisionCount: persisted?.system?.outcomeVerification?.evidenceRevisions?.filter(row => row.executionId === result.executionId).length ?? 0,
      outcomeProjectionCount: persisted?.system?.outcomeVerification?.projectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
      receiptTraceCount: persisted?.system?.cognitiveEventFabric?.receiptProjectionIndex?.filter(row => row.executionId === result.executionId).length ?? 0,
      receiptLedgerStatus: persisted?.system?.actionExecutionLedger?.records?.find(row => row.toolId === TOOL)?.status ?? null,
    });
    return;
  }
  throw new Error(`unknown child mode: ${mode}`);
}

if (['crash', 'inspect-pending', 'recover', 'recover-crash-finalizer', 'replay'].includes(process.argv[2])) {
  await child(process.argv[2], process.argv[3]);
} else {
  const dir = await mkdtemp(join(tmpdir(), 'neuro-kurisu-wp62-'));
  try {
    const run = (mode) => new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, ['--experimental-strip-types', self, mode, dir], {
        stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
      });
      let stdout = ''; let stderr = ''; let timedOut = false; let settled = false; let timer;
      const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
      // Intentional SIGKILL modes close normally. If a descendant keeps a pipe open,
      // kill the entire test process group and fail the scenario at a bounded deadline.
      timer = setTimeout(() => {
        timedOut = true;
        try { if (process.platform !== 'win32') process.kill(-proc.pid, 'SIGKILL'); else proc.kill('SIGKILL'); } catch { proc.kill('SIGKILL'); }
        proc.stdout.destroy(); proc.stderr.destroy();
        stderr += `\nchild-process deadline exceeded for mode=${mode}`;
        finish({ code: null, signal: 'SIGKILL', stdout, stderr, timedOut });
      }, 15_000);
      proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('error', error => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
      proc.on('close', (code, signal) => finish({ code, signal, stdout, stderr, timedOut }));
    });
    const crashed = await run('crash');
    assert.equal(crashed.timedOut, false, `provider-acceptance child exceeded its deadline; stderr=${crashed.stderr}`);
    assert.equal(crashed.signal, 'SIGKILL', `child must be forcibly terminated after accepted side effect; stderr=${crashed.stderr}`);
    const providerReceipt = await readJson(join(dir, 'simulated-provider-receipt.json'));
    assert.equal(providerReceipt.executeCount, 1, 'provider committed exactly one side effect before process death');
    assert.equal(providerReceipt.accepted, true);

    const inspected = await run('inspect-pending');
    assert.equal(inspected.timedOut, false, `inspect-pending child exceeded its deadline; stderr=${inspected.stderr}`);
    assert.equal(inspected.code, 0, `recovery queue is exposed after startup restore; stderr=${inspected.stderr}`);
    const queue = await readJson(join(dir, 'recovery-queue.json'));
    assert.equal(queue.entries[0].executionId, (await new FileStateStore(join(dir, 'organism-state.json')).load()).system.actionExecutionLedger.records.find(row => row.toolId === TOOL).executionId);
    assert.equal(queue.unresolvedCount, 1);

    const finalizedCrash = await run('recover-crash-finalizer');
    assert.equal(finalizedCrash.timedOut, false, `finalizer-crash child exceeded its deadline; stderr=${finalizedCrash.stderr}`);
    assert.equal(finalizedCrash.signal, 'SIGKILL', `second child must die after finalization and before receipt commit; stderr=${finalizedCrash.stderr}`);
    const interruptedState = await new FileStateStore(join(dir, 'organism-state.json')).load();
    const interruptedEntry = interruptedState?.system?.actionExecutionLedger?.records?.find(row => row.toolId === TOOL);
    assert.equal(interruptedEntry?.status, 'pending', 'crash before state commit leaves a durable pending receipt');
    assert.equal((interruptedState?.system?.outcomeVerification?.projectionIndex ?? []).filter(row => row.executionId === interruptedEntry?.executionId).length, 0, 'uncommitted first canonical projection is not mistaken for durable state');
    assert.equal((await readJson(join(dir, 'simulated-provider-receipt.json'))).executeCount, 1, 'second crash does not replay the side effect');

    const recovered = await run('recover');
    assert.equal(recovered.timedOut, false, `recovery child exceeded its deadline; stderr=${recovered.stderr}`);
    assert.equal(recovered.code, 0, `restart and reconciliation must complete; stderr=${recovered.stderr}`);
    const result = await readJson(join(dir, 'recovery-result.json'));
    assert.equal(result.ok, true);
    assert.equal(result.outcomeClass, 'executed-verified');
    assert.equal(result.verified, true);
    assert.equal(result.providerReceiptId, providerReceipt.receiptId);
    assert.equal(result.outcomeProjectionCount, 1, 'process restart should persist exactly one canonical outcome after reconciliation');
    assert.equal(result.receiptTraceCount, 1, 'canonical receipt trio is committed after the finalization crash');
    assert.equal(result.evidenceRevisionCount, 0, 'pending-first reconciliation must not fabricate a revision of an absent terminal outcome');
    assert.equal(result.receiptLedgerStatus, 'completed', 'reconciled receipt must be committed durably after restore');
    assert.equal(providerReceipt.executeCount, 1, 'reconciliation must not execute the external action twice');
    const unexpected = await readJson(join(dir, 'unexpected-re-execution.json')).catch(() => null);
    assert.equal(unexpected, null, 'executor must not run during recovery');

    // A third fresh runtime verifies that the completed result remains idempotently replayable.
    const replayed = await run('replay');
    assert.equal(replayed.timedOut, false, `replay child exceeded its deadline; stderr=${replayed.stderr}`);
    assert.equal(replayed.code, 0, `repeat execution must safely replay the durable result; stderr=${replayed.stderr}`);
    const replayResult = await readJson(join(dir, 'recovery-result.json'));
    assert.equal(replayResult.executionId, result.executionId);
    assert.equal(replayResult.idempotentReplay, true);
    assert.equal(replayResult.evidenceRevisionCount, 0);
    assert.equal(replayResult.outcomeProjectionCount, 1);
    assert.equal(replayResult.receiptTraceCount, 1);
    assert.equal(providerReceipt.executeCount, 1);
    console.log('WORKPASS62_PROCESS_KILL_RECONCILIATION=PASS redacted-startup-recovery-queue two-real-child-SIGKILL-windows after-provider-acceptance and after-first-finalizer-before-complete-commit durable-file-store restore read-only-reconcile independent-postcondition no-duplicate-side-effect idempotent-replay');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
