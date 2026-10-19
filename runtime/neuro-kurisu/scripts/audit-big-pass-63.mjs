import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=process.cwd();
const required=[
  'src/organism/system/CausalAccountabilityGraph.ts',
  'src/organism/system/OutcomeCognitionFabric.ts',
  'tests/big-pass-63-causal-accountability.mjs',
  'tests/big-pass-63-outcome-cognition-fabric.mjs',
  'docs/BIG_PASS_63_AUDIT_REPORT_RU.md',
  'docs/BIG_PASS_63_PLAN_RU.md',
  'docs/BIG_PASS_63_PROGRESS_RU.md',
  'RELEASE_NOTES_34.34.0_RU.md',
];
for(const f of required) assert.ok(fs.existsSync(f),`missing ${f}`);
const core=fs.readFileSync('src/organism/core/OrganismCore.ts','utf8');
assert.match(core,/outcomeCognition\.project/,'Core does not use OutcomeCognitionFabric');
assert.doesNotMatch(core,/private readonly causalAccountability = new CausalAccountabilityGraph/,'duplicate causal graph owner remains in Core');
const action=fs.readFileSync('src/organism/system/ActionGateway.ts','utf8');
assert.match(action,/live-destructive-verifier-required/);
const release=JSON.parse(fs.readFileSync('VERSION.json','utf8'));
assert.ok(/^34\.(3[4-9]|[4-9]\d)\./.test(release.version));
assert.ok(release.stateSchema>=96);
assert.ok(String(release.phase).includes('causal-accountability') || String(release.phase).includes('external-observer-fabric'));
console.log('BIG_PASS_63_AUDIT=PASS required='+required.length+' coreSingleOutcomeFabric=true schema='+release.stateSchema);
