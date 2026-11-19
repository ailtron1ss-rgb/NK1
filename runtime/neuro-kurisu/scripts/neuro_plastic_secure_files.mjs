import { constants as fsConstants } from 'node:fs';
import { lstat, open, unlink } from 'node:fs/promises';
import path from 'node:path';

const NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

function sameFile(left, right) {
  return left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino;
}

function sameVersion(left, right) {
  return sameFile(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs;
}

export async function assertNoSymlinkPathComponents(filePath, { allowMissingLeaf = false } = {}) {
  const absolute = path.resolve(filePath);
  const { root } = path.parse(absolute);
  const segments = absolute.slice(root.length).split(path.sep).filter(Boolean);
  if (!root || segments.length === 0) throw new Error('neuro-plastic-secure-path-must-name-a-file');

  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissingLeaf && index === segments.length - 1) {
        return absolute;
      }
      throw new Error('neuro-plastic-secure-path-component-unavailable');
    }
    if (info.isSymbolicLink()) throw new Error('neuro-plastic-secure-path-symlink-rejected');
    const leaf = index === segments.length - 1;
    if (!leaf && !info.isDirectory()) {
      throw new Error('neuro-plastic-secure-path-parent-not-directory');
    }
    if (leaf && allowMissingLeaf) {
      throw new Error('neuro-plastic-secure-output-already-exists');
    }
    if (leaf && !info.isFile()) {
      throw new Error('neuro-plastic-secure-path-leaf-not-regular-file');
    }
  }
  return absolute;
}

export async function readSecureRegularFile(filePath, label, maxBytes, requirePrivatePermissions = false) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('neuro-plastic-secure-invalid-size-limit');
  }
  const absolute = await assertNoSymlinkPathComponents(filePath);
  const beforeOpen = await lstat(absolute);
  const handle = await open(absolute, fsConstants.O_RDONLY | NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size < 1 || opened.size > maxBytes || !sameFile(opened, beforeOpen)) {
      throw new Error(label + '-must-be-a-bounded-regular-file');
    }
    if (requirePrivatePermissions && process.platform !== 'win32') {
      if ((opened.mode & 0o077) !== 0) {
        throw new Error('private-key-file-permissions-must-be-owner-only');
      }
      if (typeof process.getuid === 'function' && opened.uid !== process.getuid()) {
        throw new Error('private-key-file-owner-mismatch');
      }
    }

    const bytes = await handle.readFile();
    if (bytes.byteLength < 1 || bytes.byteLength > maxBytes || bytes.byteLength !== opened.size) {
      throw new Error(label + '-exceeds-size-limit-or-changed-during-read');
    }
    await assertNoSymlinkPathComponents(absolute);
    const afterRead = await lstat(absolute);
    if (!sameVersion(afterRead, opened) || afterRead.nlink !== 1) {
      throw new Error('neuro-plastic-secure-input-changed-during-read');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function writeSecureNewFile(filePath, contents, mode = 0o600) {
  const absolute = await assertNoSymlinkPathComponents(filePath, { allowMissingLeaf: true });
  const handle = await open(
    absolute,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | NOFOLLOW,
    mode,
  );
  let created;
  try {
    created = await handle.stat();
    if (!created.isFile() || created.nlink !== 1) {
      throw new Error('neuro-plastic-secure-output-not-a-private-regular-file');
    }
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await assertNoSymlinkPathComponents(absolute);
    const afterWrite = await lstat(absolute);
    if (!sameFile(afterWrite, created) || afterWrite.nlink !== 1) {
      throw new Error('neuro-plastic-secure-output-path-changed');
    }
  } catch (error) {
    await handle.close().catch(() => {});
    if (created) {
      const current = await lstat(absolute).catch(() => null);
      if (current && sameFile(current, created)) await unlink(absolute).catch(() => {});
    }
    throw error;
  }
  await handle.close();
  return absolute;
}
