import fs from 'node:fs';
import assert from 'node:assert/strict';
const required=[
  'src/organism/system/ExternalObserverFabric.ts',
  'src/organism/system/OutcomeCognitionFabric.ts',
  'src/organism/system/CausalAccountabilityGraph.ts',
  'src/organism/system/ActionGateway.ts',
  'src/organism/core/EvidenceResearchSubsystemRuntime.ts',
  'src/organism/core/PersistenceProjectionCoordinator.ts',
  'src/organism/core/OrganismCore.ts',
  'src/organism/cognition/CognitivePressureField.ts',
  'src/server/server.mjs',
  'tests/big-pass-64-external-observer.mjs',
  'tests/big-pass-64-external-observer-adapters.mjs',
  'docs/BIG_PASS_64_AUDIT_REPORT_RU.md',
  'docs/BIG_PASS_64_PLAN_RU.md',
  'docs/BIG_PASS_64_PROGRESS_RU.md',
  'RELEASE_NOTES_34.35.0_RU.md',
];
for(const f of required) assert.ok(fs.existsSync(f),`missing ${f}`);
const core=fs.readFileSync('src/organism/core/OrganismCore.ts','utf8');
assert.match(core,/ingestExternalObservation/);
assert.match(core,/externalObserverForPressure/);
assert.match(core,/outcomeCognition\.project/);
const action=fs.readFileSync('src/organism/system/ActionGateway.ts','utf8');
assert.match(action,/executionId/);
const fabric=fs.readFileSync('src/organism/system/ExternalObserverFabric.ts','utf8');
assert.match(fabric,/observeFilesystem/);
assert.match(fabric,/observeHttp/);
assert.match(fabric,/observeProcess/);
const project=fs.readFileSync('src/organism/core/PersistenceProjectionCoordinator.ts','utf8');
assert.match(project,/system\.externalObserver/);
const server=fs.readFileSync('src/server/server.mjs','utf8');
assert.match(server,/\/api\/organism\/external-observer/);
const release=JSON.parse(fs.readFileSync('VERSION.json','utf8'));
assert.ok(release.version === '34.35.0' || release.version === '34.36.0' || /^34\.(?:3[5-9]|[4-9]\d)\./.test(release.version));
assert.ok(release.stateSchema>=97);
assert.ok(String(release.phase).includes('external-observer-fabric'));
console.log('BIG_PASS_64_AUDIT=PASS required='+required.length+' schema='+release.stateSchema+' phase='+release.phase);
