import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureUiBuilt } from './super-ui-build.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nk1-super-ui-build-'));
  mkdirSync(path.join(root, 'app'), { recursive: true });
  writeFileSync(path.join(root, 'app', 'package.json'), JSON.stringify({ scripts: { 'build:web': 'vite build' } }));
  return root;
}

test('builds the UI before startup when the preview artifact is missing', () => {
  const root = fixture();
  try {
    let invocation;
    const result = ensureUiBuilt(root, {
      timeoutMs: 30_000,
      runBuild: args => {
        invocation = args;
        mkdirSync(path.join(root, 'app', 'dist'), { recursive: true });
        writeFileSync(path.join(root, 'app', 'dist', 'index.html'), '<!doctype html>');
        return { status: 0, signal: null, error: null };
      },
    });
    assert.equal(result.built, true);
    assert.equal(result.indexPath, path.join(root, 'app', 'dist', 'index.html'));
    assert.deepEqual(invocation.args, ['--prefix', 'app', 'run', 'build:web']);
    assert.equal(invocation.cwd, root);
    assert.equal(invocation.timeoutMs, 30_000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('does not rebuild a UI artifact that already exists', () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, 'app', 'dist'), { recursive: true });
    writeFileSync(path.join(root, 'app', 'dist', 'index.html'), '<!doctype html>');
    let called = false;
    const result = ensureUiBuilt(root, { runBuild: () => { called = true; return { status: 1 }; } });
    assert.equal(result.built, false);
    assert.equal(called, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails before launching preview when the build command fails', () => {
  const root = fixture();
  try {
    assert.throws(() => ensureUiBuilt(root, {
      runBuild: () => ({ status: 1, signal: null, error: null }),
    }), /UI build failed before startup \(status=1\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when the build exits successfully without creating index.html', () => {
  const root = fixture();
  try {
    assert.throws(() => ensureUiBuilt(root, {
      runBuild: () => ({ status: 0, signal: null, error: null }),
    }), /UI build completed without producing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects unsafe build timeout values', () => {
  const root = fixture();
  try {
    assert.throws(() => ensureUiBuilt(root, { timeoutMs: 999, runBuild: () => ({ status: 0 }) }), /timeout/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
