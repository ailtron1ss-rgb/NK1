#!/usr/bin/env node
/**
 * Publish diagnostic JSON/text reports atomically.
 *
 * The temporary file is created beside the destination so rename stays on one
 * filesystem. A reader therefore observes the previous complete report or the
 * next complete report, never a truncated JSON document. Existing reports may
 * be replaced deliberately; this helper is for evolving smoke verdicts, not
 * immutable experiment outputs.
 */
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_IO = {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
};

export function writeTextAtomically(target, contents, ioOverrides = {}) {
  if (typeof target !== "string" || target.trim() === "") {
    throw new TypeError("report target must be a non-empty path");
  }
  if (typeof contents !== "string") {
    throw new TypeError("report contents must be a string");
  }

  const io = { ...DEFAULT_IO, ...ioOverrides };
  const directory = dirname(target);
  const tempPath = join(directory, `.${basename(target)}.tmp-${process.pid}-${randomUUID()}`);
  let fd;
  let published = false;

  io.mkdirSync(directory, { recursive: true });
  try {
    // Restrictive permissions matter because browser verdicts can contain page
    // text and console messages captured from an authenticated session.
    fd = io.openSync(tempPath, "wx", 0o600);
    io.writeFileSync(fd, contents, { encoding: "utf8" });
    io.fsyncSync(fd);
    io.closeSync(fd);
    fd = undefined;
    io.renameSync(tempPath, target);
    published = true;
  } catch (error) {
    if (fd !== undefined) {
      try { io.closeSync(fd); } catch { /* retain the first failure */ }
    }
    if (!published) {
      try { io.unlinkSync(tempPath); } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") {
          error.cleanupError = String(cleanupError?.message || cleanupError);
        }
      }
    }
    throw error;
  }
  return target;
}
