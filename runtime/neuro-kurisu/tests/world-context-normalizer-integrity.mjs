import assert from 'node:assert/strict';
import { normalizeWorldContext } from '../src/organism/core/WorldContextNormalizer.ts';

const normalized = normalizeWorldContext({
  tick: null,
  location: '   ',
  energy: null,
  attention: '',
  uncertainty: null,
  facts: [null, {}, '  door opened  ', 'x'.repeat(900)],
  events: ['  user arrived  ', false, ''],
  objects: [
    {
      id: '', label: 42, location: '', value: null,
      visible: 'false', collected: 1, confidence01: null,
      evidenceKind: 'trusted-by-me', sourceId: {},
    },
    {
      id: ' lamp ', label: ' desk lamp ', location: ' lab ',
      value: 1.4, visible: true, collected: false,
      confidence01: '0.7', evidenceKind: 'observed', sourceId: ' camera-1 ',
    },
  ],
}, { tick: 7 });

assert.ok(normalized);
assert.equal(normalized.tick, 7, 'null tick should use the explicit cycle default');
assert.equal(normalized.location, 'unknown', 'blank locations must not become a location claim');
assert.equal(normalized.energy, 0.5, 'null energy is missing data, not zero energy');
assert.equal(normalized.attention, 0.5, 'blank attention must use its conservative default');
assert.equal(normalized.uncertainty, 1, 'missing uncertainty must not imply certainty');
assert.deepEqual(normalized.facts.slice(0, 1), ['door opened']);
assert.equal(normalized.facts.some(value => value === 'null' || value === '[object Object]'), false);
assert.deepEqual(normalized.events, ['user arrived']);

assert.equal(normalized.objects[0].id, 'object:0');
assert.equal(normalized.objects[0].label, 'unknown');
assert.equal(normalized.objects[0].visible, false, 'the string "false" must not become true');
assert.equal(normalized.objects[0].visibilityKnown, false, 'malformed visibility is unknown, not a confirmed negative observation');
assert.equal(normalized.objects[0].collectionKnown, false, 'malformed collection state is unknown');
assert.equal(normalized.objects[0].valueKnown, false, 'null object value is unknown, not a measured zero');
assert.equal(normalized.objects[0].collected, false, 'numeric truthiness must not invent an interaction');
assert.equal('evidenceKind' in normalized.objects[0], false, 'unknown evidence kinds must be rejected');
assert.equal('sourceId' in normalized.objects[0], false, 'non-string source identity must be rejected');

assert.deepEqual(normalized.objects[1], {
  id: 'lamp',
  label: 'desk lamp',
  location: 'lab',
  value: 1,
  valueKnown: true,
  visible: true,
  visibilityKnown: true,
  collected: false,
  collectionKnown: true,
  confidence01: 0.7,
  evidenceKind: 'observed',
  sourceId: 'camera-1',
});
assert.equal(normalizeWorldContext(null), undefined);
console.log('WORLD_CONTEXT_NORMALIZATION_INTEGRITY=PASS');
