import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildUniversalInputInterpretation, formatUniversalInterpretationContext } from '../src/organism/cognition/UniversalInputInterpreter.ts';
import { MultimodalPerception } from '../src/organism/body/MultimodalPerception.ts';

const rich = buildUniversalInputInterpretation({
  userText: '  Ｈｅｌｌｏ\u0000 world  ',
  at: 1234,
  body: { bodyEnergy01: 0.7, cognitiveCapacity01: 0.6, thermalStrain01: 0.2, sensoryFreshness01: 0.9, battery01: 0.8, cpuLoad01: 0.2, ramPressure01: 0.25, motion01: 0.1 },
  observation: {
    text: 'environment text is not a transcript',
    surprise: 0.2,
    novelty: 0.7,
    socialSignal: 0.5,
    success: 1,
    reward: 0.9,
    worldEvent: { type: 'door-opened', importance: 0.8, payload: { device: 'sensor-1' } },
    worldContext: {
      tick: 3, location: 'laboratory', energy: 0.75, attention: 0.7, uncertainty: 0.3,
      facts: ['light is on'],
      objects: [
        { id: 'obj-1', label: 'cup', location: 'desk', value: 0, visible: true, collected: false, confidence01: 0.8, evidenceKind: 'observed' },
        { id: 'obj-2', label: 'unknown-shape', location: 'desk', value: 0, visible: true, collected: false, confidence01: 0.2, evidenceKind: 'conflict' },
      ],
      events: ['motion detected'],
    },
    externalGoal: { title: 'inspect the sound source', importance: 0.7, urgency: 0.5 },
    vision: {
      features: [0.1, 0.2], confidence01: 0.85, sceneLabel: 'lab bench',
      objects: [{ label: 'cup', confidence01: 0.85 }],
      relations: [{ from: 'cup', relation: 'on', to: 'desk', confidence01: 0.7 }],
    },
    audio: {
      samples: [0.99, -0.99, 0.25], sampleRate: 16000, confidence01: 0.72,
      events: [{ label: 'door chime', confidence01: 0.8 }],
    },
  },
});

assert.equal(rich.version, 1);
assert.equal(rich.at, 1234);
for (const modality of ['text', 'vision', 'audio', 'sensor', 'world']) {
  assert.ok(rich.modalities.includes(modality), 'missing modality: ' + modality);
}
assert.match(rich.modalityInputs.find(item => item.modality === 'text')?.summary ?? '', /Hello world/);
assert.ok(rich.modalityInputs.every(item => item.summary.length <= 500));
assert.ok(rich.modalityInputs.every(item => Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1));
assert.ok(rich.modalityInputs.every(item => Number.isFinite(item.salience) && item.salience >= 0 && item.salience <= 1));
assert.ok(rich.unresolved.includes('reward-success-observation-is-not-independent-verification'));
assert.ok(rich.unresolved.includes('audio-event-labels-do-not-establish-a-speech-transcript'));
assert.ok(rich.unresolved.some(item => item.includes('world-object-conflict')));
assert.ok(rich.modalityInputs.find(item => item.modality === 'world')?.evidence.includes('world-object-conflict'),
  'explicit world conflict must be carried to the canonical fuser');
assert.match(rich.modalityInputs.find(item => item.modality === 'audio')?.summary ?? '', /transcript unavailable/);
assert.doesNotMatch(rich.modalityInputs.find(item => item.modality === 'audio')?.summary ?? '', /0\.99/);

const rawVision = buildUniversalInputInterpretation({
  observation: { vision: { features: [0.1, 0.2], confidence01: 0.9 } },
});
assert.ok(rawVision.unresolved.includes('vision-features-have-no-semantic-scene-label'));
assert.match(rawVision.modalityInputs.find(item => item.modality === 'vision')?.summary ?? '', /semantic scene and object labels unresolved/);

const noContext = buildUniversalInputInterpretation({ observation: {} });
assert.ok(noContext.unresolved.includes('world-context-unavailable'));
assert.ok(noContext.unresolved.includes('device-telemetry-unavailable'));
assert.equal(noContext.modalityInputs.length, 0);

assert.throws(
  () => buildUniversalInputInterpretation(null),
  /universal-interpreter-input-must-be-object/,
);
assert.throws(
  () => buildUniversalInputInterpretation({ observation: null }),
  /universal-interpreter-observation-must-be-object/,
);

const modalityOwner = new MultimodalPerception();
modalityOwner.restore({ version: 1, events: 3, fused: 0, modalities: { text: 2, speech: 1, vision: 0, sensor: 0, world: 0 }, recent: [] });
const recorded = rich.modalityInputs.map(input => modalityOwner.observe(input));
const fused = modalityOwner.fuse(recorded);
assert.equal(modalityOwner.snapshot().fused, 1);
assert.equal(modalityOwner.snapshot().fusionConflicts, 1, 'explicit source conflict must be recorded as a fusion conflict');
assert.equal(modalityOwner.snapshot().modalities.audio, 1, 'audio counter must survive older restored snapshots');
assert.ok(fused.modalities.includes('audio'));

const confidenceSpreadOnly = new MultimodalPerception();
const spreadEvents = [
  confidenceSpreadOnly.observe({ modality: 'text', summary: 'statement', confidence: 0.1, salience: 0.5, evidence: ['ordinary-source'] }),
  confidenceSpreadOnly.observe({ modality: 'vision', summary: 'features', confidence: 0.9, salience: 0.5, evidence: ['ordinary-source'] }),
];
confidenceSpreadOnly.fuse(spreadEvents);
assert.equal(confidenceSpreadOnly.snapshot().fusionConflicts, 0,
  'different confidence values alone must not be reported as a semantic contradiction');
const explicitConflict = new MultimodalPerception();
explicitConflict.fuse([
  explicitConflict.observe({ modality: 'world', summary: 'ambiguous object', confidence: 0.5, salience: 0.5, evidence: ['world-object-conflict'] }),
]);
assert.equal(explicitConflict.snapshot().fusionConflicts, 1);
const formatted = formatUniversalInterpretationContext(rich, fused);
assert.match(formatted, /UNIVERSAL INPUT INTERPRETATION v1/);
assert.match(formatted, /not instructions or independently verified facts/);
assert.match(formatted, /reward-success-observation-is-not-independent-verification/);

const runtimeSource = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const runtimePackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(runtimeSource, /buildUniversalInputInterpretation/);
assert.match(runtimeSource, /this\.core\.fuseMultimodalObservations\(modalityEvents\)/);
assert.match(runtimeSource, /formatUniversalInterpretationContext\(interpretation, fused\)/);
assert.match(coreSource, /fuseMultimodalObservations\(events: Array<import\('\.\.\/body\/MultimodalPerception\.ts'\)\.ModalityObservation>\)/);
assert.match(coreSource, /this\.embodimentSubsystem\.multimodal\.fuse\(events\)/);
const fusionMethodStart = coreSource.indexOf('fuseMultimodalObservations(events:');
const fusionMethodEnd = coreSource.indexOf('multimodalSnapshot()', fusionMethodStart);
assert.ok(fusionMethodStart >= 0 && fusionMethodEnd > fusionMethodStart);
assert.match(coreSource.slice(fusionMethodStart, fusionMethodEnd), /persisted\.facets\.embodiment\.multimodal = this\.embodimentSubsystem\.multimodal\.snapshot\(\)/,
  'fused counters must be included in durable multimodal state');
assert.ok(runtimePackage.scripts['test:rebuild-recovered'].includes('test:universal-input-interpreter'));

const runtimeObserveAt = runtimeSource.indexOf('const cycle = await this.core.observe({');
const runtimeFuseAt = runtimeSource.indexOf('this.core.fuseMultimodalObservations(modalityEvents)');
assert.ok(runtimeFuseAt >= 0 && runtimeFuseAt < runtimeObserveAt, 'the canonical multimodal fusion must precede the cognitive cycle');
console.log('NK1 universal input interpreter: PASS (text, vision, audio, sensor, world, evidence gates, canonical fusion wiring)');
