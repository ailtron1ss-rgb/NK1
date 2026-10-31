import assert from 'node:assert/strict';
import { runLongMemEvalMemoryBenchmark } from '../src/organism/memory/LongMemEvalAdapter.ts';

const rows = [
  {
    question_id: 'lme-answerable-001',
    question_type: 'single-session-user',
    question: 'Which vehicle is scheduled for the 2030 launch?',
    answer: 'Orion',
    question_date: '2030-06-01T00:00:00.000Z',
    haystack_session_ids: ['session-a', 'session-b'],
    haystack_dates: ['2030-04-01T00:00:00.000Z', '2030-04-03T00:00:00.000Z'],
    haystack_sessions: [
      [
        { role: 'user', content: 'We are preparing the Orion vehicle for its 2030 launch.' },
        { role: 'assistant', content: 'I will remember the Orion launch plan.' },
      ],
      [
        { role: 'user', content: 'I also like quiet gardens and old maps.' },
        { role: 'assistant', content: 'Those are useful interests to remember.' },
      ],
    ],
    answer_session_ids: ['session-a'],
  },
  {
    question_id: 'lme-abstention-002_abs',
    question_type: 'abstention',
    question: 'What is the encrypted orbital recovery key?',
    answer: '',
    question_date: '2030-06-01T00:00:00.000Z',
    haystack_session_ids: ['session-c'],
    haystack_dates: ['2030-04-02T00:00:00.000Z'],
    haystack_sessions: [[
      { role: 'user', content: 'I prefer saffron tea and quiet music.' },
      { role: 'assistant', content: 'I will keep those preferences in mind.' },
    ]],
    answer_session_ids: [],
  },
];

const report = runLongMemEvalMemoryBenchmark(rows, {
  datasetRevision: '98d7416c24c778c2fee6e6f3006e7a073259d48f',
  datasetFileSha256: 'a'.repeat(64),
  bootstrapSamples: 200,
  seeds: [13, 29, 53],
  minAnswerableQueries: 1,
  minUnanswerableQueries: 1,
});

assert.equal(report.schemaVersion, 1);
assert.equal(report.evaluation, 'longmemeval-s-memory-retrieval');
assert.equal(report.sourceDataset.datasetId, 'xiaowu0162/longmemeval-cleaned');
assert.equal(report.sourceDataset.licenseId, 'MIT');
assert.equal(report.sourceDataset.languages.join(','), 'en');
assert.equal(report.sourceDataset.datasetRevision, '98d7416c24c778c2fee6e6f3006e7a073259d48f');
assert.equal(report.sourceDataset.fileSha256, 'a'.repeat(64));
assert.equal(report.metrics.baseline.queries, 2);
assert.equal(report.metrics.candidate.queries, 2);
assert.equal(report.metrics.candidate.answerableQueries, 1);
assert.equal(report.metrics.candidate.unanswerableQueries, 1);
assert.equal(report.metrics.candidate.recallAtK01, 1);
assert.equal(report.metrics.candidate.correctAbstentionRate01, 1);
assert.equal(report.metrics.candidate.unsupportedRetrievalCount, 0);
assert.equal(report.confidence.seedCount, 3);
assert.equal(report.confidence.runs.length, 3);
assert.equal(report.promotion.allowed, false,
  'English-only external evidence cannot auto-promote a bilingual retrieval policy');
assert.equal(report.guardrails.rawQueriesIncluded, false);
assert.equal(report.guardrails.rawSessionContentIncluded, false);
assert.equal(report.guardrails.liveMemoryMutation, false);
assert.equal(JSON.stringify(report).includes('Which vehicle is scheduled'), false);
assert.equal(JSON.stringify(report).includes('Orion vehicle for its 2030 launch'), false);
assert.equal(report.perQuestion.length, 2);
assert.equal(report.perQuestion.every(row => row.queryDigest.length === 64), true);
assert.equal(report.perQuestion.every(row => row.questionIdDigest.length === 64), true);

const shuffled = runLongMemEvalMemoryBenchmark([...rows].reverse(), {
  datasetRevision: '98d7416c24c778c2fee6e6f3006e7a073259d48f',
  datasetFileSha256: 'a'.repeat(64),
  bootstrapSamples: 200,
  seeds: [13, 29, 53],
  minAnswerableQueries: 1,
  minUnanswerableQueries: 1,
});
assert.equal(shuffled.datasetFingerprint, report.datasetFingerprint,
  'input order must not alter the canonical dataset fingerprint');
for (const key of ['queries', 'answerableQueries', 'unanswerableQueries', 'recallAtK01', 'mrr01', 'precisionAtK01', 'unsupportedRetrievalCount', 'unsupportedRetrievalRate01', 'correctAbstentionRate01', 'falseAbstentionCount', 'falseAbstentionRate01', 'queryCoverage01']) {
  assert.equal(shuffled.metrics.candidate[key], report.metrics.candidate[key],
    'input order must not change retrieval metric ' + key);
}

assert.throws(() => runLongMemEvalMemoryBenchmark([{
  ...rows[0],
  answer_session_ids: ['missing-session'],
}], {
  datasetRevision: '98d7416c24c778c2fee6e6f3006e7a073259d48f',
  datasetFileSha256: 'a'.repeat(64),
}), /unknown answer session/i);

assert.throws(() => runLongMemEvalMemoryBenchmark([{
  ...rows[1],
  question_id: 'broken_abs',
  answer_session_ids: ['session-c'],
}], {
  datasetRevision: '98d7416c24c778c2fee6e6f3006e7a073259d48f',
  datasetFileSha256: 'a'.repeat(64),
}), /abstention/i);

console.log('LONGMEMEVAL_MEMORY_ADAPTER=PASS');
