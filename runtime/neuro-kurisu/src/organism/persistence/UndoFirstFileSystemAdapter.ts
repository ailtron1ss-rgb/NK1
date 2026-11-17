import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, link, unlink, readFile, lstat, realpath, rename } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, join, win32 } from 'node:path';
import {
  ActionGateway,
  ToolExecutionNoEffectError,
  ToolExecutionUncertainError,
  type ActionUndoFirstPreparation,
  type ActionUndoFirstPreparationContext,
  type ToolExecutionContext,
  type ToolReceiptLookup,
} from '../system/ActionGateway.ts';
import type { ToolInputContract, ToolOutputContract } from '../system/ToolInputContract.ts';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';

const MAX_FILE_BYTES = 32 * 1024;
const RECOVERY_PREFIX = 'nk1-file-create:';
const RECOVERY_DIRECTORY = '.nk1-recovery';
const PREPARED_DIRECTORY = 'prepared';
const ARTIFACT_VERSION = 1 as const;

type FileState = {
  exists: boolean;
  stateHash: string;
  contentHash?: string;
  size: number;
};

type FileArtifactCore = {
  version: typeof ARTIFACT_VERSION;
  artifactId: string;
  executionId: string;
  relativePath: string;
  contentHash: string;
  byteLength: number;
  beforeStateHash: string;
  afterStateHash: string;
  createdAt: number;
  status: 'prepared' | 'committed';
};

type FileArtifact = FileArtifactCore & { digest: string };

const WRITE_INPUT_CONTRACT: ToolInputContract = Object.freeze({
  type: 'object',
  properties: {
    path: { type: 'string', minLength: 1, maxLength: 180 },
    content: { type: 'string', minLength: 1, maxLength: MAX_FILE_BYTES },
  },
  required: ['path', 'content'],
  additionalProperties: false,
  maxProperties: 2,
  maxSerializedBytes: 40_000,
});

const PATH_INPUT_CONTRACT: ToolInputContract = Object.freeze({
  type: 'object',
  properties: { path: { type: 'string', minLength: 1, maxLength: 180 } },
  required: ['path'],
  additionalProperties: false,
  maxProperties: 1,
  maxSerializedBytes: 1024,
});

const WRITE_OUTPUT_CONTRACT: ToolOutputContract = Object.freeze({
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    path: { type: 'string', minLength: 1, maxLength: 180 },
    contentHash: { type: 'string', minLength: 64, maxLength: 64 },
    stateHash: { type: 'string', minLength: 64, maxLength: 64 },
    size: { type: 'integer', minimum: 0, maximum: MAX_FILE_BYTES },
    providerReceiptId: { type: 'string', minLength: 1, maxLength: 180 },
  },
  required: ['ok', 'path', 'contentHash', 'stateHash', 'size', 'providerReceiptId'],
  additionalProperties: false,
  maxProperties: 6,
  maxSerializedBytes: 2048,
});

const STATE_OUTPUT_CONTRACT: ToolOutputContract = Object.freeze({
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    path: { type: 'string', minLength: 1, maxLength: 180 },
    exists: { type: 'boolean' },
    stateHash: { type: 'string', minLength: 64, maxLength: 64 },
    contentHash: { type: 'string', minLength: 64, maxLength: 64 },
    size: { type: 'integer', minimum: 0, maximum: MAX_FILE_BYTES },
  },
  required: ['ok', 'path', 'exists', 'stateHash', 'size'],
  additionalProperties: false,
  maxProperties: 6,
  maxSerializedBytes: 2048,
});

const MISSING_STATE_HASH = sha256Stable({ exists: false, size: 0 });

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT');
}

function rawContentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stateHashForContent(contentHash: string, size: number): string {
  return sha256Stable({ exists: true, contentHash, size });
}

function artifactDigest(core: FileArtifactCore): string {
  return sha256Stable(core);
}

function artifactPathFor(directory: string, artifactId: string): string {
  if (!/^[a-f0-9]{40}$/.test(artifactId)) throw new Error('filesystem-recovery-artifact-id-invalid');
  return join(directory, `${artifactId}.json`);
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

/**
 * Sandboxed, create-only filesystem integration for NK1's canonical ActionGateway.
 *
 * This first adapter deliberately does not overwrite or delete existing files.
 * Undo-First prepares a durable, hash-bound recovery record and returns a manual
 * recovery plan. Automatic deletion is intentionally not advertised: Node's
 * portable filesystem API has no atomic "unlink only if bytes still hash to X"
 * primitive. The plan therefore refuses to silently remove a file that a user
 * or another process may have changed after creation.
 */
export class UndoFirstFileSystemAdapter {
  private readonly requestedRoot: string;
  private resolvedRoot?: string;

  constructor(workspaceRoot: string) {
    if (typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) throw new Error('filesystem-workspace-root-required');
    this.requestedRoot = resolve(workspaceRoot);
  }

  register(gateway: ActionGateway): void {
    gateway.registerTool({
      id: 'organism.files.state',
      capability: 'filesystem.read',
      destructive: false,
      projectAllowed: false,
      inputContract: PATH_INPUT_CONTRACT,
      outputContract: STATE_OUTPUT_CONTRACT,
      execute: async (input) => {
        const relativePath = this.normalizeRelativePath(input.path);
        const state = await this.readState(relativePath);
        return {
          ok: true,
          path: relativePath,
          exists: state.exists,
          stateHash: state.stateHash,
          ...(state.contentHash ? { contentHash: state.contentHash } : {}),
          size: state.size,
        };
      },
      verify: async ({ result }) => ({
        verified: typeof result.stateHash === 'string' && /^[a-f0-9]{64}$/.test(result.stateHash),
        basis: 'tool-contract',
        confidence01: 1,
        externalObservation: false,
        notes: 'filesystem state read completed with a canonical state fingerprint',
      }),
    });

    gateway.registerTool({
      id: 'organism.files.write',
      capability: 'filesystem.create',
      destructive: false,
      projectAllowed: false,
      permissionClass: 'filesystem',
      requiresIdempotencyKey: true,
      requiresUndoFirst: true,
      inputContract: WRITE_INPUT_CONTRACT,
      outputContract: WRITE_OUTPUT_CONTRACT,
      observationSource: {
        sourceId: 'nk1.private-workspace',
        sourceClass: 'os',
        channel: 'filesystem',
        independenceKey: `nk1-filesystem-workspace:${sha256Stable(this.requestedRoot).slice(0, 24)}`,
      },
      undoFirst: {
        prepare: async (input, context) => this.prepare(input, context),
        discardPrepared: async (reference, context) => this.discardPrepared(reference, context),
      },
      execute: async (input, context) => this.executeCreate(input, context),
      verify: async ({ input, result }) => {
        const relativePath = this.normalizeRelativePath(input.path);
        const observed = await this.readState(relativePath);
        const expectedStateHash = typeof result.stateHash === 'string' ? result.stateHash : '';
        const matches = observed.exists && observed.stateHash === expectedStateHash
          && observed.contentHash === result.contentHash;
        return {
          verified: matches,
          basis: 'external-postcondition',
          confidence01: 1,
          externalObservation: true,
          observationId: `filesystem-readback:${observed.stateHash.slice(0, 24)}`,
          expectedPostcondition: expectedStateHash,
          observedPostcondition: observed.stateHash,
          notes: matches
            ? 'independent filesystem readback matches the exact created-file content hash'
            : 'filesystem readback does not match the prepared create-only postcondition',
        };
      },
      reconcile: async (input, context) => this.reconcileCreate(input, context),
    });
  }

  private async ensureWorkspace(): Promise<string> {
    if (this.resolvedRoot) return this.resolvedRoot;
    await mkdir(this.requestedRoot, { recursive: true, mode: 0o700 });
    const root = await realpath(this.requestedRoot);
    const rootStat = await lstat(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('filesystem-workspace-root-not-a-directory');
    this.resolvedRoot = root;
    return root;
  }

  private normalizeRelativePath(value: unknown): string {
    if (typeof value !== 'string') throw new Error('filesystem-relative-path-required');
    const raw = value.normalize('NFKC');
    if (!raw || raw.length > 180 || /[\u0000-\u001f\u007f\\]/.test(raw) || isAbsolute(raw) || win32.isAbsolute(raw)) {
      throw new Error('filesystem-relative-path-invalid');
    }
    const segments = raw.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.toLowerCase() === RECOVERY_DIRECTORY)) {
      throw new Error('filesystem-path-traversal-or-reserved-path');
    }
    if (segments.some(segment => !/^[a-zA-Z0-9._-]{1,80}$/.test(segment))) {
      throw new Error('filesystem-path-segment-invalid');
    }
    return segments.join('/');
  }

  private async resolveTarget(relativePath: string): Promise<{ root: string; target: string }> {
    const root = await this.ensureWorkspace();
    const target = resolve(root, ...relativePath.split('/'));
    const rel = relative(root, target);
    if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
      throw new Error('filesystem-path-escapes-workspace');
    }
    const segments = relativePath.split('/');
    let parent = root;
    for (const segment of segments.slice(0, -1)) {
      parent = join(parent, segment);
      const parentStat = await lstat(parent);
      if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error('filesystem-parent-is-not-a-real-directory');
    }
    return { root, target };
  }

  private async readState(relativePath: string): Promise<FileState> {
    const { target } = await this.resolveTarget(relativePath);
    let info;
    try { info = await lstat(target); }
    catch (error) {
      if (isNotFound(error)) return { exists: false, stateHash: MISSING_STATE_HASH, size: 0 };
      throw error;
    }
    if (info.isSymbolicLink() || !info.isFile()) throw new Error('filesystem-target-is-not-a-regular-file');
    const bytes = await readFile(target);
    const contentHash = rawContentHash(bytes);
    return {
      exists: true,
      stateHash: stateHashForContent(contentHash, bytes.byteLength),
      contentHash,
      size: bytes.byteLength,
    };
  }

  private async recoveryDirectory(): Promise<{ prepared: string }> {
    const root = await this.ensureWorkspace();
    const recovery = join(root, RECOVERY_DIRECTORY);
    await mkdir(recovery, { recursive: true, mode: 0o700 });
    const recoveryStat = await lstat(recovery);
    if (recoveryStat.isSymbolicLink() || !recoveryStat.isDirectory()) throw new Error('filesystem-recovery-directory-invalid');
    const prepared = join(recovery, PREPARED_DIRECTORY);
    await mkdir(prepared, { recursive: true, mode: 0o700 });
    const preparedStat = await lstat(prepared);
    if (preparedStat.isSymbolicLink() || !preparedStat.isDirectory()) throw new Error('filesystem-prepared-directory-invalid');
    return { prepared };
  }

  private artifactId(executionId: string, relativePath: string, contentHash: string): string {
    return sha256Stable({ executionId, relativePath, contentHash }).slice(0, 40);
  }

  private reference(artifactId: string): string {
    return `${RECOVERY_PREFIX}${artifactId}`;
  }

  private parseReference(reference: string): string {
    if (typeof reference !== 'string' || !reference.startsWith(RECOVERY_PREFIX)) throw new Error('filesystem-recovery-reference-invalid');
    const artifactId = reference.slice(RECOVERY_PREFIX.length);
    if (!/^[a-f0-9]{40}$/.test(artifactId)) throw new Error('filesystem-recovery-reference-invalid');
    return artifactId;
  }

  private async loadArtifact(artifactId: string): Promise<FileArtifact> {
    const { prepared } = await this.recoveryDirectory();
    const path = artifactPathFor(prepared, artifactId);
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 4096) throw new Error('filesystem-recovery-artifact-invalid');
    const parsed = JSON.parse(await readFile(path, 'utf8')) as FileArtifact;
    const { digest, ...core } = parsed;
    if (parsed.version !== ARTIFACT_VERSION || parsed.artifactId !== artifactId
      || !/^exec-[a-z0-9-]{8,80}$/i.test(parsed.executionId)
      || typeof parsed.relativePath !== 'string'
      || !/^[a-f0-9]{64}$/.test(parsed.contentHash)
      || !/^[a-f0-9]{64}$/.test(parsed.beforeStateHash)
      || !/^[a-f0-9]{64}$/.test(parsed.afterStateHash)
      || !Number.isSafeInteger(parsed.byteLength) || parsed.byteLength < 1 || parsed.byteLength > MAX_FILE_BYTES
      || !Number.isFinite(parsed.createdAt) || !['prepared', 'committed'].includes(parsed.status)
      || digest !== artifactDigest(core)) throw new Error('filesystem-recovery-artifact-integrity-failed');
    return parsed;
  }

  private async persistArtifact(core: FileArtifactCore): Promise<void> {
    const { prepared } = await this.recoveryDirectory();
    const destination = artifactPathFor(prepared, core.artifactId);
    const record: FileArtifact = { ...core, digest: artifactDigest(core) };
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(stableJson(record), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
      await syncDirectory(prepared);
    } finally {
      await unlink(temporary).catch(error => { if (!isNotFound(error)) throw error; });
    }
  }

  private async prepare(input: Record<string, unknown>, context: ActionUndoFirstPreparationContext): Promise<ActionUndoFirstPreparation> {
    const relativePath = this.normalizeRelativePath(input.path);
    const content = typeof input.content === 'string' ? input.content : '';
    const bytes = new TextEncoder().encode(content);
    if (!content || bytes.byteLength < 1 || bytes.byteLength > MAX_FILE_BYTES) throw new Error('filesystem-content-size-invalid');
    const contentHash = rawContentHash(bytes);
    const before = await this.readState(relativePath);
    if (before.exists) throw new Error('filesystem-create-only-target-already-exists');
    const afterStateHash = stateHashForContent(contentHash, bytes.byteLength);
    const artifactId = this.artifactId(context.executionId, relativePath, contentHash);
    const { prepared } = await this.recoveryDirectory();
    const artifactPath = artifactPathFor(prepared, artifactId);

    try {
      const existing = await this.loadArtifact(artifactId);
      if (existing.executionId !== context.executionId || existing.relativePath !== relativePath
        || existing.contentHash !== contentHash || existing.afterStateHash !== afterStateHash) {
        throw new Error('filesystem-recovery-artifact-key-conflict');
      }
      if (existing.status === 'committed') throw new ToolExecutionUncertainError('filesystem-create-already-committed-without-replayable-action-receipt');
    } catch (error) {
      if (!isNotFound(error) && !(error instanceof Error && error.message === 'ENOENT')) throw error;
    }

    const artifact: FileArtifactCore = {
      version: ARTIFACT_VERSION,
      artifactId,
      executionId: context.executionId,
      relativePath,
      contentHash,
      byteLength: bytes.byteLength,
      beforeStateHash: before.stateHash,
      afterStateHash,
      createdAt: Date.now(),
      status: 'prepared',
    };
    try {
      await this.persistArtifact(artifact);
    } catch (error) {
      // The artifact is auxiliary and no primary target was touched. The caller's
      // discardPrepared hook is idempotent and will release it if the gateway rejects.
      throw error;
    }

    const recoveryArtifactRef = this.reference(artifactId);
    return {
      strategy: 'manual',
      summary: `Create-only file ${relativePath} is recorded with a durable content fingerprint; automatic deletion is withheld because portable filesystem APIs cannot atomically unlink only an unchanged hash.`,
      beforeStateHash: before.stateHash,
      recoveryArtifactRef,
      manualSteps: [
        `Inspect ${relativePath} in the NK1 private workspace.`,
        `The file content SHA-256 must still equal ${contentHash} before any removal is considered.`,
        'Do not remove or replace the file if its hash differs; preserve it and resolve the state divergence manually.',
        `Recovery record: ${recoveryArtifactRef}`,
      ],
    };
  }

  private async discardPrepared(reference: string, context: ActionUndoFirstPreparationContext): Promise<void> {
    const artifactId = this.parseReference(reference);
    let artifact: FileArtifact;
    try { artifact = await this.loadArtifact(artifactId); }
    catch (error) { if (isNotFound(error)) return; throw error; }
    if (artifact.executionId !== context.executionId || artifact.status !== 'prepared') return;
    const { prepared } = await this.recoveryDirectory();
    await unlink(artifactPathFor(prepared, artifactId)).catch(error => { if (!isNotFound(error)) throw error; });
    await syncDirectory(prepared);
  }

  private async executeCreate(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<Record<string, unknown>> {
    if (!context?.executionId) throw new ToolExecutionUncertainError('filesystem-create-execution-identity-required');
    const relativePath = this.normalizeRelativePath(input.path);
    const content = typeof input.content === 'string' ? input.content : '';
    const bytes = new TextEncoder().encode(content);
    if (!content || bytes.byteLength < 1 || bytes.byteLength > MAX_FILE_BYTES) throw new ToolExecutionNoEffectError('filesystem-content-size-invalid');
    const contentHash = rawContentHash(bytes);
    const artifactId = this.artifactId(context.executionId, relativePath, contentHash);
    const artifact = await this.loadArtifact(artifactId);
    if (artifact.executionId !== context.executionId || artifact.relativePath !== relativePath
      || artifact.contentHash !== contentHash || artifact.status !== 'prepared') {
      throw new ToolExecutionUncertainError('filesystem-create-preparation-receipt-mismatch');
    }

    const { target } = await this.resolveTarget(relativePath);
    const existingState = await this.readState(relativePath);
    if (existingState.exists) throw new ToolExecutionNoEffectError('filesystem-create-target-already-exists');
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    let linked = false;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      // Same-directory hard-link creation is atomic and fails with EEXIST rather
      // than overwriting a resource created by a concurrent writer.
      await link(temporary, target);
      linked = true;
      await unlink(temporary);
      await syncDirectory(dirname(target));
      await this.persistArtifact({ ...artifact, status: 'committed' });
    } catch (error) {
      await unlink(temporary).catch(cleanupError => { if (!isNotFound(cleanupError)) throw cleanupError; });
      if (!linked) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
          await this.discardPrepared(this.reference(artifactId), {
            ...context,
            requestHash: artifact.digest,
          } as ActionUndoFirstPreparationContext);
          throw new ToolExecutionNoEffectError('filesystem-create-target-appeared-before-atomic-create');
        }
        throw new ToolExecutionNoEffectError(`filesystem-create-not-applied:${String((error as Error)?.message ?? error).slice(0, 160)}`);
      }
      throw new ToolExecutionUncertainError(`filesystem-create-committed-but-receipt-finalization-uncertain:${String((error as Error)?.message ?? error).slice(0, 160)}`);
    }

    return {
      ok: true,
      path: relativePath,
      contentHash,
      stateHash: artifact.afterStateHash,
      size: bytes.byteLength,
      providerReceiptId: `nk1-file:${artifactId}`,
    };
  }

  private async reconcileCreate(input: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolReceiptLookup> {
    try {
      const relativePath = this.normalizeRelativePath(input.path);
      const content = typeof input.content === 'string' ? input.content : '';
      const bytes = new TextEncoder().encode(content);
      if (!content || bytes.byteLength < 1 || bytes.byteLength > MAX_FILE_BYTES) return { status: 'unknown', reason: 'filesystem-reconcile-input-invalid' };
      const contentHash = rawContentHash(bytes);
      const artifactId = this.artifactId(context.executionId, relativePath, contentHash);
      const artifact = await this.loadArtifact(artifactId);
      if (artifact.executionId !== context.executionId || artifact.relativePath !== relativePath
        || artifact.contentHash !== contentHash || artifact.status === 'prepared') {
        // A prepared artifact plus matching target can result from a lost metadata
        // acknowledgement after the hard-link commit; readback below decides.
      }
      const state = await this.readState(relativePath);
      if (!state.exists || state.stateHash !== artifact.afterStateHash || state.contentHash !== contentHash) {
        return { status: 'unknown', reason: 'filesystem-create-state-does-not-prove-the-requested-postcondition', checkedAt: Date.now() };
      }
      return {
        status: 'found',
        authoritative: true,
        receiptId: `nk1-file:${artifactId}`,
        result: {
          ok: true,
          path: relativePath,
          contentHash,
          stateHash: state.stateHash,
          size: state.size,
          providerReceiptId: `nk1-file:${artifactId}`,
        },
        checkedAt: Date.now(),
      };
    } catch (error) {
      return { status: 'unknown', reason: String((error as Error)?.message ?? 'filesystem-reconcile-unknown').slice(0, 180), checkedAt: Date.now() };
    }
  }
}
