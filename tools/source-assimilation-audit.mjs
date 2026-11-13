#!/usr/bin/env node
/** Evidence-first external-source intake registry. No external dependencies. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = path.join(ROOT, 'engineering-os', 'source-assimilation.v1.json.gz');
const STAGE_OVERRIDES = path.join(ROOT, 'engineering-os', 'source-assimilation-stage-overrides.v1.json');
const HASH = /^[a-f0-9]{64}$/i;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.trim().length > 0;
const BOOLEAN_STAGE_KEYS = new Set(['codeCopied', 'adapted', 'runtimeWired', 'testsPassed', 'releaseVerified']);
const EVIDENCE_STAGE_KEYS = new Set(['runtimeEvidence', 'testEvidence', 'releaseEvidence']);

export function applySourceStageOverrides(doc, overlay) {
  if (!object(overlay) || overlay.schemaVersion !== 1 || !object(overlay.sources)) {
    throw new Error('invalid source stage override schema');
  }
  const merged = structuredClone(doc);
  const byId = new Map((merged.sources ?? []).map(source => [source.id, source]));
  for (const [sourceId, patch] of Object.entries(overlay.sources)) {
    const source = byId.get(sourceId);
    if (!source) throw new Error(`stage override references unknown source: ${sourceId}`);
    if (!object(patch)) throw new Error(`stage override must be an object: ${sourceId}`);
    for (const [key, value] of Object.entries(patch)) {
      if (BOOLEAN_STAGE_KEYS.has(key)) {
        if (typeof value !== 'boolean') throw new Error(`stage override ${sourceId}.${key} must be boolean`);
        source.implementation[key] = value;
      } else if (EVIDENCE_STAGE_KEYS.has(key)) {
        if (!Array.isArray(value) || !value.length || value.some(item => !text(item))) {
          throw new Error(`stage override ${sourceId}.${key} must contain non-empty evidence strings`);
        }
        source.implementation[key] = [...new Set([...(source.implementation[key] ?? []), ...value])];
      } else {
        throw new Error(`unsupported source stage override field: ${sourceId}.${key}`);
      }
    }
  }
  const validation = validateSourceRegistry(merged);
  if (!validation.ok) throw new Error(`invalid source stage override: ${validation.errors.join('; ')}`);
  return merged;
}

export async function loadSourceRegistry() {
  const bytes = await readFile(REGISTRY);
  const doc = JSON.parse(gunzipSync(bytes).toString('utf8'));
  try {
    const overlay = JSON.parse(await readFile(STAGE_OVERRIDES, 'utf8'));
    return applySourceStageOverrides(doc, overlay);
  } catch (error) {
    if (error?.code === 'ENOENT') return doc;
    throw error;
  }
}

export function validateSourceRegistry(doc) {
  const errors = [];
  if (!object(doc) || doc.schemaVersion !== 1) return { ok: false, errors: ['invalid schemaVersion'] };
  if (!Array.isArray(doc.containers) || !Array.isArray(doc.sources)) return { ok: false, errors: ['containers and sources must be arrays'] };
  const containers = new Map();
  for (const c of doc.containers) {
    if (!object(c) || !text(c.name) || containers.has(c.name) || !HASH.test(c.sha256 ?? '') ||
        !Number.isSafeInteger(c.bytes) || c.bytes <= 0 || !Number.isSafeInteger(c.embeddedZipCount)) errors.push('invalid/duplicate archive container');
    else containers.set(c.name, c);
  }
  const ids = new Set(), digestOwners = new Map();
  let artifacts = 0, adapters = 0, metadata = 0, licenseScreened = 0, diffs = 0, adapted = 0, wired = 0, tested = 0, released = 0, cleared = 0;
  for (const s of doc.sources) {
    if (!object(s) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id ?? '') || ids.has(s.id)) { errors.push('invalid/duplicate source ID'); continue; }
    ids.add(s.id);
    if (!text(s.name) || !/^https:\/\//.test(s.upstream ?? '') || !text(s.nextAction) || !text(s.potentialBenefit)) errors.push(`${s.id}: missing identity/upstream/nextAction/potentialBenefit`);
    if (!Array.isArray(s.artifacts) || !s.artifacts.length) errors.push(`${s.id}: artifacts must be non-empty`);
    for (const a of s.artifacts ?? []) {
      artifacts++;
      if (!object(a) || !containers.has(a.container) || !text(a.name) || !HASH.test(a.sha256 ?? '') ||
          !Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !Number.isSafeInteger(a.members) || a.members <= 0) errors.push(`${s.id}: invalid archive artifact`);
      else {
        if (!digestOwners.has(a.sha256)) digestOwners.set(a.sha256, new Set());
        digestOwners.get(a.sha256).add(s.id);
      }
    }
    const lic = s.license;
    if (!object(lic) || !text(lic.declared) || !text(lic.scopeNote) ||
        !['screened-not-cleared','mixed-scope','split-scope','nested-license','docs-only'].includes(lic.screen)) errors.push(`${s.id}: license scope not screened`);
    else {
      licenseScreened++;
      if (lic.legalClearance === 'approved') cleared++;
    }
    if (s.review?.metadata === 'screened') metadata++;
    if (s.review?.detailedDiff === true) diffs++;
    if ((s.nk1?.existingAdapterPaths ?? []).length) adapters++;
    if (!Array.isArray(s.nk1?.targetPaths) || !s.nk1.targetPaths.length) errors.push(`${s.id}: missing NK1 target mapping`);
    for (const p of [...(s.nk1?.existingAdapterPaths ?? []), ...(s.nk1?.targetPaths ?? [])]) {
      if (!text(p) || p.startsWith('/') || p.split('/').includes('..')) errors.push(`${s.id}: unsafe repository path`);
    }
    const stage = s.implementation;
    if (!object(stage)) { errors.push(`${s.id}: implementation stages missing`); continue; }
    for (const k of ['codeCopied','adapted','runtimeWired','testsPassed','releaseVerified']) {
      if (typeof stage[k] !== 'boolean') errors.push(`${s.id}: ${k} must be boolean`);
    }
    if (stage.codeCopied && lic?.legalClearance !== 'approved') errors.push(`${s.id}: codeCopied requires approved legal clearance`);
    if (stage.runtimeWired && (!stage.adapted || !Array.isArray(stage.runtimeEvidence) || !stage.runtimeEvidence.length)) errors.push(`${s.id}: runtime wiring requires adaptation and runtime evidence`);
    if (stage.testsPassed && (!stage.runtimeWired || !Array.isArray(stage.testEvidence) || !stage.testEvidence.length)) errors.push(`${s.id}: tests require runtime wiring and test evidence`);
    if (stage.releaseVerified && (!stage.testsPassed || !Array.isArray(stage.releaseEvidence) || !stage.releaseEvidence.length)) errors.push(`${s.id}: release requires test pass and release evidence`);
    if (stage.adapted) adapted++;
    if (stage.runtimeWired) wired++;
    if (stage.testsPassed) tested++;
    if (stage.releaseVerified) released++;
  }
  for (const [sha, owners] of digestOwners) if (owners.size > 1) errors.push(`archive digest reused by distinct source IDs: ${sha}`);
  const declared = [...containers.values()].reduce((n, c) => n + c.embeddedZipCount, 0);
  if (containers.size !== 4) errors.push(`expected 4 containers, found ${containers.size}`);
  if (artifacts !== doc.expectedArchiveArtifacts || artifacts !== declared) errors.push(`archive artifact/container count mismatch: artifacts=${artifacts}, container count=${declared}`);
  if (ids.size !== doc.expectedUniqueSources) errors.push(`expected ${doc.expectedUniqueSources} unique sources, found ${ids.size}`);
  return { ok: errors.length === 0, errors, metrics: { containers: containers.size, artifacts, sources: ids.size, metadata, licenseScreened, cleared, diffs, adapters, adapted, wired, tested, released } };
}

export function summarizeSourceRegistry(doc) {
  const v = validateSourceRegistry(doc);
  if (!v.ok) return { ok: false, errors: v.errors };
  const m = v.metrics, pct = n => (100 * n / m.sources).toFixed(1) + '%';
  return {
    ok: true, ...m,
    progress: {
      metadataScreened: pct(m.metadata),
      licenseScopeScreened: pct(m.licenseScreened),
      legalClearance: m.cleared + '/' + m.sources,
      fileLevelDiffs: pct(m.diffs),
      existingAdapterPresence: pct(m.adapters),
      adapted: pct(m.adapted), runtimeWired: pct(m.wired),
      testsVerified: pct(m.tested), releaseVerified: pct(m.released)
    },
    next: doc.sources.filter(s => !s.implementation.releaseVerified)
      .sort((a,b) => a.priority - b.priority || a.name.localeCompare(b.name))
      .slice(0, 8).map(s => ({ id:s.id, name:s.name, priority:s.priority, action:s.nextAction }))
  };
}

export function renderSourceReport(doc) {
  const s = summarizeSourceRegistry(doc);
  if (!s.ok) return 'INVALID SOURCE REGISTRY\n' + s.errors.map(e => '- ' + e).join('\n');
  const row = (label, done, total) => label.padEnd(30) + done + '/' + total + ' (' + (100*done/total).toFixed(1) + '%)';
  return [
    'NK1 SOURCE ASSIMILATION — ' + doc.generatedAt,
    'Canonical branch: ' + doc.baseBranch + ' @ ' + doc.observedSourceHead,
    'Archives: ' + s.containers + ' containers | ' + s.artifacts + ' ZIPs | ' + s.sources + ' unique projects',
    '',
    'PROGRESS — separate gates; not an overall readiness score',
    row('Metadata screened',s.metadata,s.sources),
    row('License scope screened',s.licenseScreened,s.sources),
    'Human legal clearance'.padEnd(30) + s.cleared + '/' + s.sources,
    row('Detailed code diffs',s.diffs,s.sources),
    row('Existing adapter presence',s.adapters,s.sources),
    row('New adaptations',s.adapted,s.sources),
    row('Runtime wiring',s.wired,s.sources),
    row('Tests verified',s.tested,s.sources),
    row('Release verified',s.released,s.sources),
    '',
    'NEXT PRIORITIES',
    ...s.next.map((x,i) => `${i+1}. [P${x.priority}] ${x.name} — ${x.action}`),
    '',
    'Adapter presence is discovery evidence only; it does not prove wiring, tests, release inclusion or feature parity.'
  ].join('\n');
}

async function main() {
  let doc;
  try { doc = await loadSourceRegistry(); }
  catch (e) { console.error('Cannot load source registry:', e.message); process.exitCode = 2; return; }
  const v = validateSourceRegistry(doc);
  if (!v.ok) { console.error(v.errors.join('\n')); process.exitCode = 1; return; }
  const command = process.argv[2] ?? 'report';
  if (command === 'validate') console.log(JSON.stringify({ ok:true, ...v.metrics },null,2));
  else if (command === 'report') console.log(process.argv.includes('--json') ? JSON.stringify(summarizeSourceRegistry(doc),null,2) : renderSourceReport(doc));
  else { console.error('Usage: source-assimilation-audit.mjs [validate|report [--json]]'); process.exitCode = 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
