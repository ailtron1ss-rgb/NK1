#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup } from './lib/state-backup.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.resolve(process.env.STATE_DIR || path.join(projectRoot, '.super-state', 'organism'));
const backupRoot = path.join(projectRoot, 'backups');
const result = await createBackup({ stateDir, backupRoot, label: 'snapshot' });
console.log(JSON.stringify({ ok: result.ok, destination: path.relative(projectRoot, result.path), files: result.files.length, manifestFiles: result.files }, null, 2));
