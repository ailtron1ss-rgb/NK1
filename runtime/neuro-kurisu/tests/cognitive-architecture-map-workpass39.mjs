import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCognitiveArchitectureSnapshot, validateCognitiveArchitecture } from '../src/organism/core/CognitiveArchitectureMap.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const report = validateCognitiveArchitecture();
assert.equal(report.ok, true, JSON.stringify(report));
const architecture = buildCognitiveArchitectureSnapshot();
assert.equal(architecture.mainSystem.owner, 'runtime/neuro-kurisu/src/organism/core/OrganismCore.ts');
assert.ok(architecture.subsystems.length >= 12);
assert.ok(architecture.flows.some(flow => flow.kind === 'feedback' && flow.from === 'outcome-learning' && flow.to === 'memory'));
assert.ok(architecture.authorities.some(item => item.role === 'writable-canonical-memory' && item.owner === 'MemoryOS2'));
assert.ok(architecture.authorities.some(item => item.role === 'side-effect-execution' && item.owner === 'ActionGateway'));
const missing=[];
for (const system of architecture.subsystems) for (const component of system.components) {
  const target=path.join(root, component);
  if (!fs.existsSync(target)) missing.push(`${system.id}:${component}`);
}
assert.deepEqual(missing, [], `unresolved component paths: ${missing.join(', ')}`);
console.log(`COGNITIVE_ARCHITECTURE_MAP_WORKPASS39=PASS subsystems=${report.subsystemCount} flows=${report.flowCount} componentPaths=PASS`);
