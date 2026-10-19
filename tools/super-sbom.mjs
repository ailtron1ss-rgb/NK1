#!/usr/bin/env node
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const digest = (data) => createHash('sha256').update(data).digest('hex');
const lock = JSON.parse(await readFile(path.join(root, 'app/package-lock.json'), 'utf8'));
const rootPkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const runtimePkg = JSON.parse(await readFile(path.join(root, 'runtime/neuro-kurisu/package.json'), 'utf8'));
const superVersion = JSON.parse(await readFile(path.join(root, 'SUPER_VERSION.json'), 'utf8'));
const workpassMatch = String(superVersion.build ?? '').match(/WORKPASS(\d+)/i);
if (!workpassMatch) throw new Error('SUPER_VERSION.build must contain a WORKPASS lineage tag before SBOM provenance can be published');
const currentWorkpass = Number(workpassMatch[1]);
const generatedAt = new Date().toISOString();
const components = [];
const licenseSummary = new Map();
const asCycloneLicense = (value) => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = value.trim();
  if (/\b(AND|OR|WITH)\b/.test(text)) return { expression: text };
  if (/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(text)) return { license: { id: text } };
  return { license: { name: text.slice(0, 180) } };
};
const addLicenseCount = (value) => {
  const key = typeof value === 'string' && value.trim() ? value.trim() : 'UNKNOWN';
  licenseSummary.set(key, (licenseSummary.get(key) ?? 0) + 1);
};

for (const [name, data] of Object.entries(lock.packages ?? {})) {
  if (!name || !data?.version) continue;
  const license = typeof data.license === 'string' ? data.license : data.license?.type;
  addLicenseCount(license);
  const normalizedName = name.replace(/^node_modules\//, '');
  // Package URLs preserve the namespace separator for scoped npm packages.
  const purlName = normalizedName.startsWith('@') ? `%40${normalizedName.slice(1)}` : normalizedName;
  const comp = {
    type: 'library', bomRef: `npm:${name}@${data.version}`, name: normalizedName,
    version: data.version, purl: `pkg:npm/${purlName}@${data.version}`,
    scope: data.dev ? 'optional' : 'required',
  };
  if (data.resolved) comp.externalReferences = [{ type: 'distribution', url: data.resolved }];
  if (typeof data.integrity === 'string' && data.integrity.startsWith('sha512-')) {
    comp.hashes = [{ alg: 'SHA-512', content: Buffer.from(data.integrity.slice('sha512-'.length), 'base64').toString('hex') }];
  }
  const cv = asCycloneLicense(license);
  if (cv) comp.licenses = [cv];
  else comp.properties = [{ name: 'neuro-kurisu:license-status', value: 'unknown-in-lockfile' }];
  components.push(comp);
}

components.push(
  { type: 'application', bomRef: 'neuro-kurisu-super', name: rootPkg.name, version: rootPkg.version, licenses: [{ license: { name: 'Project license not declared; see repository provenance inventory' } }] },
  { type: 'application', bomRef: 'neuro-kurisu-runtime', name: runtimePkg.name, version: runtimePkg.version, licenses: [{ license: { name: 'Project license not declared; see repository provenance inventory' } }] },
);

async function walk(dir, rel = '') {
  let rows = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.super-state', 'backups', 'dist', 'coverage'].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) rows.push(...await walk(abs, nextRel));
    else if (entry.isFile()) rows.push({ abs, rel: nextRel });
  }
  return rows;
}
const files = await walk(root);
const licenseFiles = [];
for (const file of files) {
  if (!/(?:^|\/)(?:LICENSE(?:\.[^/]*)?|COPYING(?:\.[^/]*)?|NOTICE(?:\.[^/]*)?|COPYRIGHT)$/i.test(file.rel)) continue;
  const meta = await lstat(file.abs);
  if (!meta.isFile() || meta.isSymbolicLink()) continue;
  const bytes = await readFile(file.abs);
  const text = bytes.toString('utf8');
  const spdx = /SPDX-License-Identifier:\s*([^\s*]+)/i.exec(text)?.[1];
  let declaredLicense;
  const siblingPackage = path.join(path.dirname(file.abs), 'package.json');
  try {
    const pkg = JSON.parse(await readFile(siblingPackage, 'utf8'));
    declaredLicense = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type;
  } catch { /* no adjacent package manifest */ }
  const foundLicense = spdx || declaredLicense || undefined;
  licenseFiles.push({ path: file.rel, sizeBytes: bytes.byteLength, sha256: digest(bytes), spdxIdentifier: spdx, adjacentPackageDeclaredLicense: declaredLicense, status: foundLicense ? 'identified' : 'license-text-present-id-needs-review' });
}

const archiveRows = [];
for (const file of files.filter(f => /\.(?:zip|tar\.gz|tgz)$/i.test(f.rel))) {
  const bytes = await readFile(file.abs);
  const ext = /\.(?:tar\.gz|tgz)$/i.test(file.rel) ? 'tar.gz' : 'zip';
  let members = [];
  let listingError;
  try {
    const result = ext === 'zip'
      ? execFileSync('unzip', ['-Z1', file.abs], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000 })
      : execFileSync('tar', ['-tzf', file.abs], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
    members = result.split(/\r?\n/).filter(Boolean);
  } catch (error) { listingError = String(error?.message ?? error).slice(0, 240); }
  const licenseCandidates = members
    .filter(name => /(?:^|\/)(?:LICENSE(?:\.[^/]*)?|COPYING(?:\.[^/]*)?|NOTICE(?:\.[^/]*)?)$/i.test(name) && name.split('/').filter(Boolean).length <= 3)
    .sort((a, b) => a.length - b.length).slice(0, 12);
  const embeddedLicenses = [];
  for (const member of licenseCandidates) {
    try {
      const content = ext === 'zip'
        ? execFileSync('unzip', ['-p', file.abs, member], { encoding: 'buffer', maxBuffer: 1024 * 1024, timeout: 10000 })
        : execFileSync('tar', ['-xOzf', file.abs, member], { encoding: 'buffer', maxBuffer: 1024 * 1024, timeout: 10000 });
      const text = content.toString('utf8');
      embeddedLicenses.push({ member, sizeBytes: content.byteLength, sha256: digest(content), spdxIdentifier: /SPDX-License-Identifier:\s*([^\s*]+)/i.exec(text)?.[1] });
    } catch (error) {
      embeddedLicenses.push({ member, readError: String(error?.message ?? error).slice(0, 160) });
    }
  }
  const archiveId = `file:${file.rel}`;
  components.push({
    type: 'file', bomRef: archiveId, name: path.basename(file.rel), version: 'archived-source-snapshot',
    hashes: [{ alg: 'SHA-256', content: digest(bytes) }],
    properties: [
      { name: 'neuro-kurisu:relative-path', value: file.rel },
      { name: 'neuro-kurisu:archive-format', value: ext },
      { name: 'neuro-kurisu:archive-members', value: String(members.length) },
      { name: 'neuro-kurisu:license-review', value: embeddedLicenses.length ? 'embedded-license-files-found; full provenance review required' : 'no-top-level-license-file-detected; do-not-assume-permissive' },
    ],
  });
  archiveRows.push({ path: file.rel, format: ext, sizeBytes: bytes.byteLength, sha256: digest(bytes), memberCount: members.length, listingError, embeddedLicenses, licenseReview: embeddedLicenses.length ? 'license-evidence-found-not-a-legal-conclusion' : 'license-not-detected-in-top-level-members' });
}

const sbom = {
  bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
  metadata: { timestamp: generatedAt, component: { type: 'application', name: rootPkg.name, version: rootPkg.version }, properties: [{ name: 'neuro-kurisu:scope', value: 'locked npm dependencies plus embedded source/archive snapshots' }] },
  components,
};
const provenance = {
  format: 'neuro-kurisu-source-provenance/v1', generatedAt,
  note: 'Inventory evidence only; a detected identifier or license file is not legal advice or proof that every file in a source tree uses that license. Unknown or ambiguous licenses require manual review before redistribution.',
  dependencySummary: { lockedNpmComponents: components.filter(c => c.bomRef?.startsWith('npm:')).length, licenses: Object.fromEntries([...licenseSummary.entries()].sort((a,b) => a[0].localeCompare(b[0]))), missingLicenseFields: licenseSummary.get('UNKNOWN') ?? 0 },
  sourceArchiveSummary: { archives: archiveRows.length, archivesWithLicenseEvidence: archiveRows.filter(a => a.embeddedLicenses.length).length, archivesWithoutDetectedLicense: archiveRows.filter(a => !a.embeddedLicenses.length).map(a => a.path) },
  sourceArchives: archiveRows,
  repositoryLicenseFiles: licenseFiles,
  unknownOrManualReview: [
    'Repository-wide source license policy is not declared by the root package.',
    'Raw snapshots may contain nested projects with multiple licenses; inspect notices and file-level headers before redistribution.',
    'License text may not carry an SPDX identifier. A present license file is recorded as evidence, not automatically classified.',
  ],
};

const bomPath = path.join(root, 'contracts', 'SBOM.final.json');
const provenancePath = path.join(root, 'contracts', `SOURCE_PROVENANCE_LICENSES_WORKPASS${currentWorkpass}.json`);
await writeFile(bomPath, `${JSON.stringify(sbom, null, 2)}\n`);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, bomPath, provenancePath, npmComponents: provenance.dependencySummary.lockedNpmComponents, licenseFiles: licenseFiles.length, sourceArchives: archiveRows.length, sourceArchivesWithLicenseEvidence: provenance.sourceArchiveSummary.archivesWithLicenseEvidence, missingNpmLicenseFields: provenance.dependencySummary.missingLicenseFields }, null, 2));
