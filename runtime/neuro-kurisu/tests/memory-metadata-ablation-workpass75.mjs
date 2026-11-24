import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const AS_OF = 2_000_000_000_000;
const SEEDS = [11, 23, 47, 89, 131];
const TOP_K = 5;
const definitions = [
  { id: 'en-meta-0', language: 'en', kind: 'metadata', query: 'quasar ledger frost', content: 'quasar signal was logged beside an observatory instrument', tags: ['ledger', 'frost'] },
  { id: 'en-meta-1', language: 'en', kind: 'metadata', query: 'tundra beacon cobalt', content: 'tundra field notes survived the winter survey', tags: ['beacon', 'cobalt'] },
  { id: 'en-meta-2', language: 'en', kind: 'metadata', query: 'vesper lattice saffron', content: 'vesper readings were checked after the laboratory cycle', tags: ['lattice', 'saffron'] },
  { id: 'en-meta-3', language: 'en', kind: 'metadata', query: 'fjord capsule thistle', content: 'fjord samples were sealed before transfer', tags: ['capsule', 'thistle'] },
  { id: 'ru-meta-0', language: 'ru', kind: 'metadata', query: 'спутник архив мороз', content: 'спутник прошёл проверку перед ночным наблюдением', tags: ['архив', 'мороз'] },
  { id: 'ru-meta-1', language: 'ru', kind: 'metadata', query: 'кварц маяк тундра', content: 'кварц зарегистрирован после полевого измерения', tags: ['маяк', 'тундра'] },
  { id: 'ru-meta-2', language: 'ru', kind: 'metadata', query: 'орбита чернила янтарь', content: 'орбита сохранена в журнале исследовательской смены', tags: ['чернила', 'янтарь'] },
  { id: 'ru-meta-3', language: 'ru', kind: 'metadata', query: 'кобальт луг сумерки', content: 'кобальт обнаружен при повторной калибровке', tags: ['луг', 'сумерки'] },
  { id: 'en-control-0', language: 'en', kind: 'lexical', query: 'helium meadow vector', content: 'helium meadow vector was the recorded calibration signature', tags: ['calibration'] },
  { id: 'en-control-1', language: 'en', kind: 'lexical', query: 'ceramic lantern willow', content: 'ceramic lantern willow describes the prototype fixture', tags: ['prototype'] },
  { id: 'en-control-2', language: 'en', kind: 'lexical', query: 'kinetic harbor violet', content: 'kinetic harbor violet was observed in the test sequence', tags: ['sequence'] },
  { id: 'en-control-3', language: 'en', kind: 'lexical', query: 'marble orbit cedar', content: 'marble orbit cedar names the archived experiment', tags: ['experiment'] },
  { id: 'ru-control-0', language: 'ru', kind: 'lexical', query: 'камера журнал свет', content: 'камера журнал свет отмечены в протоколе наблюдения', tags: ['протокол'] },
  { id: 'ru-control-1', language: 'ru', kind: 'lexical', query: 'робот память сигнал', content: 'робот память сигнал использованы в контрольном цикле', tags: ['контроль'] },
  { id: 'ru-control-2', language: 'ru', kind: 'lexical', query: 'сенсор карта ветер', content: 'сенсор карта ветер сохранены после измерения', tags: ['измерение'] },
  { id: 'ru-control-3', language: 'ru', kind: 'lexical', query: 'модуль данные зеркало', content: 'модуль данные зеркало проверены перед запуском', tags: ['запуск'] },
];

function hashSeed(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}
function shuffled(values, seed) {
  const result = [...values];
  const random = hashSeed(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function summarize(rows) {
  const sorted = rows.map(row => row.latencyMs).sort((a, b) => a - b);
  const pct = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : 0;
  const avg = fn => rows.length ? rows.reduce((sum, row) => sum + fn(row), 0) / rows.length : 0;
  return {
    queries: rows.length,
    recallAt5: avg(row => Number(row.rank <= TOP_K)),
    precisionAt1: avg(row => Number(row.rank === 1)),
    mrrAt5: avg(row => row.rank <= TOP_K ? 1 / row.rank : 0),
    ndcgAt5: avg(row => row.rank <= TOP_K ? 1 / Math.log2(row.rank + 1) : 0),
    latencyP50Ms: pct(.50),
    latencyP95Ms: pct(.95),
  };
}
function summarizeBy(rows, key) {
  return Object.fromEntries([...new Set(rows.map(row => row[key]))].sort()
    .map(value => [value, summarize(rows.filter(row => row[key] === value))]));
}
function encode(memory, row) {
  memory.encode({
    id: row.id, content: row.content, kind: 'semantic',
    source: 'workpass75-bilingual-synthetic-fixture',
    tags: row.tags, context: { topic: 'fixture-' + row.id },
    salience: .5, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1,
    socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact',
    entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: AS_OF - 10_000, observedAt: AS_OF - 5_000,
  });
}
function buildRows(seed) {
  const rows = [];
  for (const item of definitions) {
    const tokens = item.query.split(/\s+/u);
    rows.push({ id: item.id, content: item.content, tags: item.tags });
    rows.push({ id: item.id + '-decoy-a', content: tokens[0] + ' unrelated instrument note ' + item.id, tags: [tokens[1]] });
    rows.push({ id: item.id + '-decoy-b', content: tokens[0] + ' secondary unrelated note ' + item.id, tags: [tokens[2]] });
  }
  return shuffled(rows, seed);
}

const observations = [];
const paired = [];
for (const seed of SEEDS) {
  const rows = buildRows(seed);
  const arms = new Map();
  for (const enabled of [false, true]) {
    const memory = new MemoryOS2({ metadataRecallEnabled: enabled, embeddingProvider: null });
    for (const row of rows) encode(memory, row);
    assert.equal(memory.snapshot().items.length, rows.length);
    arms.set(enabled, memory);
  }
  for (const item of definitions) {
    const resultByArm = {};
    for (const enabled of [false, true]) {
      const started = performance.now();
      const result = arms.get(enabled).previewRetrieveWithRankedChannels(
        item.query, TOP_K, 0, 0, { temporalMode: 'at', asOfAt: AS_OF },
      );
      const latencyMs = performance.now() - started;
      const foundAt = result.itemIds.indexOf(item.id);
      const rank = foundAt < 0 ? Number.POSITIVE_INFINITY : foundAt + 1;
      resultByArm[enabled ? 'on' : 'off'] = {
        rank, latencyMs, metadataHit: result.rankedChannels.metadata.includes(item.id),
      };
      observations.push({
        seed, id: item.id, language: item.language, kind: item.kind,
        arm: enabled ? 'metadata-on' : 'metadata-off', rank, latencyMs,
      });
    }
    paired.push({
      seed, id: item.id, language: item.language, kind: item.kind,
      metadataOnlyRecovery: !Number.isFinite(resultByArm.off.rank)
        && Number.isFinite(resultByArm.on.rank) && resultByArm.on.metadataHit,
    });
  }
}

const off = observations.filter(row => row.arm === 'metadata-off');
const on = observations.filter(row => row.arm === 'metadata-on');
const offOverall = summarize(off);
const onOverall = summarize(on);
const offLanguage = summarizeBy(off, 'language');
const onLanguage = summarizeBy(on, 'language');
const offKind = summarizeBy(off, 'kind');
const onKind = summarizeBy(on, 'kind');
const recoveries = paired.filter(row => row.metadataOnlyRecovery).length;
const controlsOff = paired.filter(row => row.kind === 'lexical' && observations.some(obs => obs.seed === row.seed && obs.id === row.id && obs.arm === 'metadata-off' && obs.rank <= TOP_K)).length;
const controlsOn = paired.filter(row => row.kind === 'lexical' && observations.some(obs => obs.seed === row.seed && obs.id === row.id && obs.arm === 'metadata-on' && obs.rank <= TOP_K)).length;

assert.equal(definitions.length, 16);
assert.equal(SEEDS.length, 5);
assert.equal(controlsOff, 40, 'content-only lexical control targets must remain retrievable with metadata off');
assert.equal(controlsOn, 40, 'metadata recall must not break the lexical control set');
assert.ok(recoveries >= 30, 'metadata-enabled arm must recover metadata-dependent cases across row-order seeds');
assert.ok(onOverall.recallAt5 > offOverall.recallAt5, 'metadata-enabled arm must outperform the constructed metadata-dependent fixture');
assert.ok(offLanguage.en.recallAt5 <= onLanguage.en.recallAt5, 'English paired recall must not regress');
assert.ok(offLanguage.ru.recallAt5 <= onLanguage.ru.recallAt5, 'Russian paired recall must not regress');

const report = {
  protocol: 'paired-synthetic-ablation-v1',
  independentHoldout: false,
  licensedDataset: false,
  seeds: SEEDS,
  queryCountPerSeed: definitions.length,
  pairedComparisons: paired.length,
  topK: TOP_K,
  metadataRecall: {
    off: { overall: offOverall, byLanguage: offLanguage, byQueryKind: offKind },
    on: { overall: onOverall, byLanguage: onLanguage, byQueryKind: onKind },
    delta: {
      recallAt5: onOverall.recallAt5 - offOverall.recallAt5,
      precisionAt1: onOverall.precisionAt1 - offOverall.precisionAt1,
      mrrAt5: onOverall.mrrAt5 - offOverall.mrrAt5,
      ndcgAt5: onOverall.ndcgAt5 - offOverall.ndcgAt5,
    },
    metadataOnlyRecoveries: recoveries,
    lexicalControlsRetrievedOff: controlsOff,
    lexicalControlsRetrievedOn: controlsOn,
  },
  interpretation: 'Synthetic diagnostic of the optional metadata candidate-recall channel only; not a whole-organism memory ablation, licensed holdout, or independent uplift proof. Metadata recall remains opt-in.',
};
console.log('MEMORY_METADATA_ABLATION_WORKPASS75=PASS', JSON.stringify(report));
