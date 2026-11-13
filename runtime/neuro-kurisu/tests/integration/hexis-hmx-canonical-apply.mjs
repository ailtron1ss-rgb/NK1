import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-hmx-canonical-'));
const port = 36400 + Math.floor(Math.random() * 700);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
const post = async (route, payload) => fetch(base + route, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const memoryIndex = async () => {
  const response = await fetch(base + '/api/organism/integration/hexis/memories?limit=128');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  return result.memoryIndex;
};
const makeDocument = (exportId, contentSuffix = '') => ({
  hmx_version: '1.7',
  export_id: exportId,
  export_intent: 'port',
  exported_at: '2026-11-13T12:00:00.000Z',
  source: {
    instance_id: 'donor-instance-001',
    schema_version: '1.7',
    embedding_model: 'donor-embedding-v1',
    embedding_dimension: 384,
    hexis_lineage_id: 'lineage-kurisu-port-001',
  },
  capabilities: {
    formats: ['json'],
    sections: ['memories', 'relationships', 'identity', 'goals'],
    hash_algorithms: ['sha256'],
    relationship_edge_types: ['supports'],
    optional_features: [],
  },
  privacy: {
    redaction_policy: 'strict',
    contains_sensitive_content: false,
    consent_scope: 'migration',
  },
  sections: {
    memories: [
      {
        ref: `${exportId}:memory-a`,
        type: 'semantic',
        status: 'active',
        content: `HMX canonical imported memory A ${contentSuffix}`,
        importance: 0.72,
        trust_level: 0.54,
        created_at: '2026-11-12T10:00:00.000Z',
        valid_from: '2026-11-12T10:00:00.000Z',
        metadata: { tags: ['donor', 'semantic'], entities: ['bounded-import-entity'] },
        provenance: {
          source_id: 'donor-source-a',
          source_type: 'observed-note',
          evidence_class: 'unverified',
        },
      },
      {
        ref: `${exportId}:memory-b`,
        type: 'procedural',
        status: 'active',
        content: `HMX canonical imported procedure B ${contentSuffix}`,
        importance: 0.64,
        trust_level: 0.51,
        created_at: '2026-11-12T11:00:00.000Z',
        metadata: { tags: ['donor', 'procedure'] },
        provenance: { source_id: 'donor-source-b', source_type: 'procedure' },
      },
    ],
    relationships: [
      { source_ref: `${exportId}:memory-a`, target_ref: `${exportId}:memory-b`, edge_type: 'supports', properties: { weight: 0.8 } },
      { source_ref: `${exportId}:memory-a`, target_ref: `${exportId}:goal-a`, edge_type: 'supports', properties: { weight: 0.7 } },
    ],
    identity: [{ key: 'core-name', content: 'MUST REMAIN DEFERRED: donor identity' }],
    goals: [{ ref: `${exportId}:goal-a`, title: 'MUST REMAIN DEFERRED: donor goal' }],
  },
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const response = await fetch(base + '/api/health');
      const health = await response.json();
      if (response.ok && health.ready === true) { ready = true; break; }
    } catch {}
  }
  assert.equal(ready, true, `server did not become ready: ${output.slice(-1200)}`);

  const exportId = 'exp_0123456789abcdef';
  const document = makeDocument(exportId);
  const stageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document, intent: 'port', strategy: 'additive',
  });
  assert.equal(stageResponse.status, 200);
  const staged = await stageResponse.json();
  assert.equal(staged.ok, true);
  assert.equal(staged.stage.status, 'staged');
  assert.deepEqual(staged.stage.conflicts, []);

  const before = await memoryIndex();
  const acceptResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'accept',
  });
  assert.equal(acceptResponse.status, 200);
  const accepted = await acceptResponse.json();
  assert.equal(accepted.stage.status, 'accepted');

  const afterAccept = await memoryIndex();
  assert.equal(afterAccept.some(row => row.summary.includes('HMX canonical imported memory A')), false,
    'accepting a stage must not write donor records to canonical MemoryOS2');
  assert.equal(afterAccept.length, before.length,
    'the accept transition is review-only; canonical memory changes require the separate apply transition');

  const applyResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'apply',
  });
  assert.equal(applyResponse.status, 200);
  const applied = await applyResponse.json();
  assert.equal(applied.ok, true);
  assert.equal(applied.stage.status, 'applied');
  assert.equal(applied.stage.application.importedCount, 2);
  assert.equal(applied.stage.application.projectedRelationships, 1);
  assert.equal(applied.stage.application.deferredRelationships, 1);
  assert.ok(applied.stage.application.deferredSections.identity >= 1);
  assert.ok(applied.stage.application.deferredSections.goals >= 1);

  const afterApply = await memoryIndex();
  const importedA = afterApply.find(row => row.summary.includes('HMX canonical imported memory A'));
  const importedB = afterApply.find(row => row.summary.includes('HMX canonical imported procedure B'));
  assert.ok(importedA && importedB, 'approved records are visible through the canonical memory index');
  assert.match(importedA.source, /^hexis:/);
  assert.match(importedB.source, /^hexis:/);
  assert.equal(importedA.epistemicStatus, 'belief',
    'external imports are never promoted to facts by the act of importing');
  assert.equal(afterApply.some(row => row.summary.includes('MUST REMAIN DEFERRED')), false,
    'structural identity and goal sections stay outside the canonical memory import');

  const countAfterApply = afterApply.length;
  const replayResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'apply',
  });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.stage.application.digest, applied.stage.application.digest);
  assert.equal((await memoryIndex()).length, countAfterApply,
    'replaying the same apply request cannot duplicate imported memory');

  const malformedDecision = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'apply-all',
  });
  assert.equal(malformedDecision.status, 400,
    'unknown decisions must fail closed rather than silently becoming reject');

  const analysisId = 'exp_fedcba9876543210';
  const analysisStageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: makeDocument(analysisId, 'analysis-only'),
    intent: 'analysis', strategy: 'analysis_only',
  });
  assert.equal(analysisStageResponse.status, 200);
  const analysisStage = await analysisStageResponse.json();
  assert.equal(analysisStage.stage.status, 'staged');
  const analysisAccept = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: analysisStage.stage.stagingId, decision: 'accept',
  });
  assert.equal(analysisAccept.status, 200);
  const analysisApply = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: analysisStage.stage.stagingId, decision: 'apply',
  });
  assert.equal(analysisApply.status, 409,
    'analysis-only imports remain review data and cannot mutate canonical memory');

  console.log('HEXIS_HMX_CANONICAL_APPLY=PASS');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 300));
  await rm(stateDir, { recursive: true, force: true });
}
