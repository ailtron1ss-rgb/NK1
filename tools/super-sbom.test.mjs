import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const superVersion = JSON.parse(await readFile(path.join(root, 'SUPER_VERSION.json'), 'utf8'));
const currentWorkpass = Number(String(superVersion.build ?? '').match(/WORKPASS(\d+)/i)?.[1] ?? 0);
const fileHash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('SBOM and source provenance include locked licenses and immutable archive hashes', async () => {
  execFileSync(process.execPath, [path.join(root, 'tools/super-sbom.mjs')], { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 2 * 1024 * 1024 });
  const sbom = JSON.parse(await readFile(path.join(root, 'contracts/SBOM.final.json'), 'utf8'));
  const provenance = JSON.parse(await readFile(path.join(root, `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS${currentWorkpass}.json`), 'utf8'));
  assert.ok(currentWorkpass > 0, 'current SBOM must use the canonical release lineage');
  const npmComponents = sbom.components.filter((component) => component.bomRef?.startsWith('npm:'));
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.specVersion, '1.5');
  assert.ok(npmComponents.length >= 400, 'SBOM must include the locked application dependency tree');
  assert.ok(npmComponents.every((component) => Array.isArray(component.licenses) && component.licenses.length > 0), 'each locked npm dependency must expose its declared license or an explicit unknown status');
  assert.ok(npmComponents.every((component) => /^pkg:npm\//.test(component.purl)), 'all npm dependencies must have package URLs');
  assert.ok(npmComponents.every((component) => !component.name.startsWith('@') || component.purl.includes('/')), 'scoped package URLs must retain their scope separator');
  assert.ok(provenance.repositoryLicenseFiles.length >= 5);
  assert.ok(provenance.sourceArchives.length >= 8);
  assert.ok(provenance.sourceArchives.every((archive) => /^[a-f0-9]{64}$/.test(archive.sha256) && Number.isSafeInteger(archive.sizeBytes)));
  assert.ok(provenance.sourceArchives.every((archive) => archive.memberCount > 0 || archive.listingError), 'archive inspection failures must be explicit, never silently treated as empty');
  assert.ok(provenance.sourceArchives.some((archive) => archive.embeddedLicenses.length > 0));
  assert.ok(provenance.unknownOrManualReview.length > 0, 'ambiguous source licensing must stay explicit');
  const currentArchive = provenance.sourceArchives.find((archive) => archive.path === 'legacy/input-archives/raw-source-archives/lumina-main.zip');
  assert.ok(currentArchive, 'canonical Lumina archive must remain represented after duplicate alias removal');
  assert.equal(currentArchive.sha256, fileHash(await readFile(path.join(root, currentArchive.path))));
  assert.equal(provenance.sourceArchives.some((archive) => archive.path === 'legacy/input-archives/lumina-main-2026-10-08.zip'), false, 'omitted duplicate alias must not reappear in provenance');
  console.log(JSON.stringify({status:'PASS', npmComponents:npmComponents.length, repoLicenseFiles:provenance.repositoryLicenseFiles.length, sourceArchives:provenance.sourceArchives.length, licenseEvidence:provenance.sourceArchiveSummary.archivesWithLicenseEvidence}));
});
