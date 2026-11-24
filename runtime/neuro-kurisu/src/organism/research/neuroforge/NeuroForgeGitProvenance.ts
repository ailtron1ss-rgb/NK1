import { lstat, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface NeuroForgeGitProvenance {
  repositoryUrl: string | null;
  revision: string | null;
  ref: string | null;
  status: 'pinned' | 'unavailable' | 'invalid' | 'external-worktree';
}

const MAX_GIT_METADATA_BYTES = 16 * 1024;
const HASH_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

async function readRegularText(path: string): Promise<string | null> {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_GIT_METADATA_BYTES) return null;
    const text = await readFile(path, 'utf8');
    return Buffer.byteLength(text, 'utf8') <= MAX_GIT_METADATA_BYTES ? text : null;
  } catch {
    return null;
  }
}

function sanitizeRepositoryUrl(raw: string): string | null {
  let value = raw.trim().replace(/^["']|["']$/g, '');
  if (!value) return null;
  if (!value.includes('://')) {
    const scp = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
    if (scp) value = 'ssh://' + scp[1] + '/' + scp[2];
  }
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return null;
  }
}

function originUrl(config: string | null): string | null {
  if (!config) return null;
  let inOrigin = false;
  for (const line of config.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      inOrigin = /^remote\s+"origin"$/i.test(section[1]!.trim());
      continue;
    }
    if (!inOrigin) continue;
    const match = line.match(/^\s*url\s*=\s*(.*?)\s*$/i);
    if (match) return sanitizeRepositoryUrl(match[1]!);
  }
  return null;
}

async function resolveGitDirectory(gitDirectory: string): Promise<NeuroForgeGitProvenance> {
  const head = (await readRegularText(join(gitDirectory, 'HEAD')))?.trim();
  if (!head) return { repositoryUrl: null, revision: null, ref: null, status: 'invalid' };
  let revision: string | null = null;
  let ref: string | null = null;

  if (HASH_PATTERN.test(head)) {
    revision = head.toLowerCase();
  } else if (head.startsWith('ref: ')) {
    ref = head.slice(5).trim();
    const safeRef = /^refs\/[A-Za-z0-9._/-]+$/.test(ref) &&
      !ref.split('/').some(part => part === '.' || part === '..') &&
      !ref.includes('\\');
    if (!safeRef) return { repositoryUrl: null, revision: null, ref: null, status: 'invalid' };

    const direct = (await readRegularText(join(gitDirectory, ...ref.split('/'))))?.trim();
    if (direct && HASH_PATTERN.test(direct)) {
      revision = direct.toLowerCase();
    } else {
      const packed = await readRegularText(join(gitDirectory, 'packed-refs'));
      if (packed) {
        for (const line of packed.split(/\r?\n/)) {
          if (!line || line.startsWith('#') || line.startsWith('^')) continue;
          const match = line.match(/^([0-9a-f]{40}(?:[0-9a-f]{24})?)\s+(.+)$/i);
          if (match && match[2] === ref) {
            revision = match[1]!.toLowerCase();
            break;
          }
        }
      }
    }
  } else {
    return { repositoryUrl: null, revision: null, ref: null, status: 'invalid' };
  }

  if (!revision) return { repositoryUrl: null, revision: null, ref, status: 'invalid' };
  const repositoryUrl = originUrl(await readRegularText(join(gitDirectory, 'config')));
  return { repositoryUrl, revision, ref, status: 'pinned' };
}

export async function readNeuroForgeGitProvenance(sourceRoot: string): Promise<NeuroForgeGitProvenance> {
  let directory = resolve(sourceRoot);
  for (let depth = 0; depth < 12; depth += 1) {
    const gitPath = join(directory, '.git');
    let metadata: Awaited<ReturnType<typeof lstat>> | null = null;
    try { metadata = await lstat(gitPath); } catch { /* this ancestor is not a Git root */ }

    if (metadata) {
      if (metadata.isSymbolicLink()) return { repositoryUrl: null, revision: null, ref: null, status: 'invalid' };
      if (metadata.isFile()) return { repositoryUrl: null, revision: null, ref: null, status: 'external-worktree' };
      if (!metadata.isDirectory()) return { repositoryUrl: null, revision: null, ref: null, status: 'invalid' };
      return resolveGitDirectory(gitPath);
    }

    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return { repositoryUrl: null, revision: null, ref: null, status: 'unavailable' };
}
