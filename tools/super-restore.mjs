#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreBackup } from './lib/state-backup.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const backupName = args.find(arg => !arg.startsWith('--')) ?? '';
const confirmed = args.includes('--confirm-overwrite');
const stateDir = path.resolve(process.env.STATE_DIR || path.join(projectRoot, '.super-state', 'organism'));
const backupRoot = path.join(projectRoot, 'backups');
const result = await restoreBackup({ stateDir, backupRoot, backupName, confirmed });
console.log(JSON.stringify({ ok: result.ok, restored: result.restored, stateDir: result.stateDir, files: result.files.length, preRestoreBackup: result.preRestoreBackup, createdAt: result.createdAt }, null, 2));
