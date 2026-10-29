import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCognitiveArchitectureSnapshot, validateCognitiveArchitecture } from '../src/organism/core/CognitiveArchitectureMap.ts';

// Regression contract: micro-cycle inputs do not contain canonical verifier evidence,
// so claimed reward/success must not become fresh verified learning credit.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const microCycleSource = readFileSync(resolve(packageRoot, 'src/organism/core/OperationalMicroCycleRuntime.ts'), 'utf8');
assert.match(microCycleSource, /const microReward = 0\.5;/, 'unverified micro-cycle reward must stay neutral');
assert.match(microCycleSource, /const microVerified = false;/, 'micro-cycle must not self-certify a claimed outcome');
assert.doesNotMatch(microCycleSource, /const microVerified = Boolean\(observation\.(worldEvent|success|reward)/, 'caller claims must not certify outcomes');

const report = buildCognitiveArchitectureSnapshot();
const validation = validateCognitiveArchitecture();
const root = packageRoot;

assert.equal(validation.ok, true, 'cognitive architecture map must have unique IDs, valid references, and explicit owners');
assert.equal(report.mainSystem.id, 'kurisu-organism');
assert.equal(report.authorities.filter(x => x.role === 'writable-canonical-memory').length, 1, 'one canonical writable memory authority');
assert.equal(report.authorities.filter(x => x.role === 'final-action-decision').length, 1, 'one final action decision authority');
assert.equal(report.authorities.filter(x => x.role === 'side-effect-execution').length, 1, 'one side-effect execution authority');

const ids = new Set(report.subsystems.map(x => x.id));
for (const flow of report.flows) {
  assert.ok(ids.has(flow.from), `flow source must exist: ${flow.from}`);
  assert.ok(ids.has(flow.to), `flow target must exist: ${flow.to}`);
}
for (const subsystem of report.subsystems) {
  for (const dependency of subsystem.dependsOn) {
    assert.ok(ids.has(dependency), `${subsystem.id} references missing dependency ${dependency}`);
  }
}

const componentResults = report.subsystems.flatMap(subsystem => subsystem.components.map(component => {
  const relative = component.replace(/^runtime\/neuro-kurisu\//, '');
  const absolute = resolve(root, relative);
  const exists = existsSync(absolute);
  return { subsystem: subsystem.id, component, exists, isDirectory: exists && statSync(absolute).isDirectory() };
}));
const missingComponents = componentResults.filter(x => !x.exists);
assert.deepEqual(missingComponents, [], `architecture map points to missing source paths: ${missingComponents.map(x => x.component).join(', ')}`);

const feedbackFlows = report.flows.filter(x => x.kind === 'feedback');
assert.ok(feedbackFlows.length >= 3, 'the architecture must explicitly retain recurrent feedback paths');
console.log(JSON.stringify({
  ok: true,
  subsystemCount: report.subsystems.length,
  flowCount: report.flows.length,
  authorityCount: report.authorities.length,
  componentReferenceCount: componentResults.length,
  feedbackFlowCount: feedbackFlows.length,
  limitation: 'Source-path existence and map integrity do not prove production call-path activation or autonomous behavior.'
}, null, 2));
