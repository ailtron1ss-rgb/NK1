import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const version = readJson('VERSION.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const checks = [
  ['VERSION.application', version.application, pkg.version],
  ['VERSION.versionAlias', version.version, pkg.version],
  ['VERSION.organismCore', version.organismCore, readJson('RELEASE_MANIFEST.json').organismCore],
  ['VERSION.stateSchema', version.stateSchema, readJson('RELEASE_MANIFEST.json').stateSchema],
  ['VERSION.phase', version.phase, readJson('RELEASE_MANIFEST.json').phase],
  ['lock.root.version', lock.packages?.['']?.version, pkg.version],
  ['lock.root.name', lock.packages?.['']?.name, pkg.name],
];
const failures = checks.filter(([, a, b]) => a !== b);
if (failures.length) {
  console.error(JSON.stringify({ ok:false, failures }, null, 2));
  process.exit(1);
}
console.log(`RELEASE_SOURCE=PASS application=${version.application} core=${version.organismCore} schema=${version.stateSchema}`);
