import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { speakViaTermuxWithOutcome } from '../src/organism/body/AndroidEmbodimentBridge.ts';

const originalPath = process.env.PATH;
const originalMode = process.env.NK_TTS_MODE;
const originalLog = process.env.NK_TTS_LOG;
const temp = await mkdtemp(path.join(os.tmpdir(), 'nk-workpass68-tts-'));
const shim = path.join(temp, 'termux-tts-speak');
const emptyPath = path.join(temp, 'empty-path');
await mkdir(emptyPath);
const log = path.join(temp, 'calls.log');

try {
  await writeFile(shim, `#!/bin/sh\nprintf 'started\\n' >> "$NK_TTS_LOG"\ncase "$NK_TTS_MODE" in\n  success) exit 0 ;;\n  partial) exit 23 ;;\n  timeout) exec sleep 20 ;;\n  *) exit 1 ;;\nesac\n`, 'utf8');
  await chmod(shim, 0o755);
  process.env.PATH = `${temp}:/usr/bin:/bin`;
  process.env.NK_TTS_LOG = log;

  process.env.NK_TTS_MODE = 'success';
  const success = await speakViaTermuxWithOutcome('hello Kurisu', {}, 1000, 'speech-success');
  assert.deepEqual(success, { status: 'completed', command: 'termux-tts-speak', operationId: 'speech-success' });

  process.env.NK_TTS_MODE = 'partial';
  const partial = await speakViaTermuxWithOutcome('this may have started', {}, 1000, 'speech-partial');
  assert.equal(partial.status, 'unknown', 'non-zero process exit after spawn does not prove no playback');
  assert.match(partial.reason, /uncertain-playback/);

  process.env.NK_TTS_MODE = 'timeout';
  const timed = await speakViaTermuxWithOutcome('timeout after acceptance', {}, 120, 'speech-timeout');
  assert.equal(timed.status, 'unknown', 'timeout after process start must retain ambiguous outcome');
  assert.match(timed.reason, /timeout-after-process-start/);

  await new Promise(resolve => setTimeout(resolve, 80));
  const empty = await speakViaTermuxWithOutcome(' \n ', {}, 1000);
  assert.equal(empty.status, 'not-started');
  assert.equal(empty.reason, 'empty-text');

  process.env.PATH = emptyPath; // no command exists on this PATH
  const missing = await speakViaTermuxWithOutcome('cannot start', {}, 1000, 'speech-missing');
  assert.equal(missing.status, 'not-started', 'spawn ENOENT is a proven non-start');
  assert.equal(missing.reason, 'termux-tts-unavailable');

  process.env.PATH = `${temp}:/usr/bin:/bin`;
  const started = (await readFile(log, 'utf8')).trim().split(/\r?\n/);
  assert.equal(started.length, 3, 'only the three successfully spawned command attempts are logged');
  console.log('WORKPASS68_TTS=PASS success=completed partial=unknown timeout=unknown missing=not-started');
} finally {
  process.env.PATH = originalPath;
  if (originalMode === undefined) delete process.env.NK_TTS_MODE; else process.env.NK_TTS_MODE = originalMode;
  if (originalLog === undefined) delete process.env.NK_TTS_LOG; else process.env.NK_TTS_LOG = originalLog;
  await rm(temp, { recursive: true, force: true });
}
