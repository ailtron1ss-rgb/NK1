import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const requireText = (source, text, label) => assert.ok(source.includes(text), 'missing persistence contract: ' + label);

requireText(core, 'runtimeCognitiveEventFabric?: import(\'../system/CognitiveEventFabric.ts\').CognitiveEventFabricSnapshot;', 'separate outer event trace state');
requireText(core, 'runtimeCognitiveResourceEconomy?: import(\'../system/CognitiveResourceEconomy.ts\').CognitiveResourceEconomyState;', 'separate outer resource budget state');
requireText(core, 'runtimeUnifiedCognitiveCycle?: import(\'../system/UnifiedCognitiveCycle.ts\').UnifiedCognitiveCycleState;', 'separate outer cycle verifier state');
requireText(core, 'setRuntimeCognitiveEventFabric(snapshot:', 'outer event trace setter');
requireText(core, 'setRuntimeCognitiveResourceEconomy(snapshot:', 'outer resource economy setter');
requireText(core, 'setRuntimeUnifiedCognitiveCycle(snapshot:', 'outer cycle verifier setter');
requireText(core, 'this.persisted.system.cognitiveEventFabric = snapshot;', 'internal Core trace remains in its own persisted slot');
requireText(core, 'this.persisted.system.runtimeCognitiveEventFabric = snapshot;', 'outer trace cannot overwrite internal trace');
requireText(runtime, 'this.cognitiveEventFabric.restore(systemSnapshot.runtimeCognitiveEventFabric ?? systemSnapshot.cognitiveEventFabric ?? undefined);', 'legacy event trace migration fallback');
requireText(runtime, 'this.resourceEconomy.restore(systemSnapshot.runtimeCognitiveResourceEconomy ?? systemSnapshot.cognitiveResourceEconomy ?? undefined);', 'legacy resource budget migration fallback');
requireText(runtime, 'this.unifiedCycle.restore(systemSnapshot.runtimeUnifiedCognitiveCycle ?? systemSnapshot.unifiedCognitiveCycle ?? undefined);', 'legacy cycle verifier migration fallback');
requireText(runtime, 'this.core.setRuntimeCognitiveEventFabric(', 'external loop writes namespaced trace');
requireText(runtime, 'this.core.setRuntimeCognitiveResourceEconomy(', 'external loop writes namespaced resource state');
requireText(runtime, 'this.core.setRuntimeUnifiedCognitiveCycle(', 'external loop writes namespaced cycle state');
assert.equal(runtime.includes('this.core.setCognitiveEventFabric('), false, 'runtime must not overwrite Core-owned event trace');
assert.equal(runtime.includes('this.core.setCognitiveResourceEconomy('), false, 'runtime must not overwrite Core-owned resource economy');
assert.equal(runtime.includes('this.core.setUnifiedCognitiveCycle('), false, 'runtime must not overwrite Core-owned cycle verifier');

console.log('WorkPass323 nested cognitive-loop persistence separation: PASS');
