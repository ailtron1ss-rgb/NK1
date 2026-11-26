import { MemoryOS2 } from '../../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset } from '../../src/organism/memory/MemoryRetrievalBenchmark.ts';

// Curated bilingual (ru/en) fixture for the canonical retrieval benchmark. It exists because
// earlier policy measurements used single-language make-believe tokens: the instrument requires
// >= 8 answerable and >= 2 unanswerable holdout queries plus >= 2 train queries per language,
// each holdout row in its own independence group, and no train/holdout query overlap. Labels are
// hand-authored and point at the one record that carries the cited code; this is a declared
// fixture, not production evidence.
export const CORPUS_NOW = Date.now();
export const LABELLED_PER_LANGUAGE = 10;
export const DISTRACTORS_PER_LANGUAGE = 20;

export const codeFor = (language, index) => (language === 'ru' ? `КХ-РУ-${index}` : `KX-EN-${index}`);
export const labelledId = (language, index) => `${language}-note-${index}`;

export function buildBilingualCorpus() {
    const memory = new MemoryOS2();
    const encode = (id, content, extras = {}) => memory.encode({
        id, content, kind: 'episodic', source: 'bilingual-corpus-fixture', tags: ['bilingual-corpus'],
        context: { fixture: 'bilingual-corpus' },
        salience: .45, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .3, socialRelevance: .1,
        predictionError: .1, confidence: .9, epistemicStatus: 'fact',
        entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
        validFromAt: CORPUS_NOW - 60_000, provenanceClass: 'external', sourceAuthority01: .9,
        observedAt: CORPUS_NOW - 30_000, ...extras,
    });

    for (const language of ['ru', 'en']) {
        for (let index = 0; index < LABELLED_PER_LANGUAGE; index++) {
            encode(labelledId(language, index), language === 'ru'
                ? `Заметка о регламенте участка ${index}: код ${codeFor(language, index)} и порядок приёмки партии на складе.`
                : `Site regulation note ${index}: code ${codeFor(language, index)} and the batch acceptance order at the warehouse.`);
        }
    }
    // Distractors are topically adjacent and slightly more salient than the labelled rows - the
    // ordinary case where "looks important" and "is asked about" disagree.
    for (let index = 0; index < DISTRACTORS_PER_LANGUAGE; index++) {
        encode(`ru-noise-${index}`, `Общая заметка о погоде, расписании столовой и сменах ${index}, без кодов и регламентов.`, { salience: .6 });
        encode(`en-noise-${index}`, `General note about weather, the cafeteria schedule and shifts ${index}, with no codes or regulations.`, { salience: .6 });
    }

    const examples = [];
    for (const language of ['ru', 'en']) {
        for (let index = 0; index < 4; index++) {
            examples.push({
                id: `train-${language}-${index}`,
                query: language === 'ru'
                    ? `как звучит регламент участка код ${codeFor(language, index)}`
                    : `how is the site regulation filed under code ${codeFor(language, index)}`,
                relevantIds: [labelledId(language, index)],
                split: 'train',
                language,
                answerable: true,
                independenceGroupId: `train-group-${language}-${index}`,
            });
        }
        for (let index = 2; index < LABELLED_PER_LANGUAGE; index++) {
            examples.push({
                id: `holdout-${language}-${index}`,
                query: language === 'ru'
                    ? `порядок приёмки партии на складе по коду ${codeFor(language, index)}`
                    : `batch acceptance order at the warehouse for code ${codeFor(language, index)}`,
                relevantIds: [labelledId(language, index)],
                split: 'holdout',
                language,
                answerable: true,
                independenceGroupId: `holdout-group-${language}-${index}`,
            });
        }
        for (let index = 0; index < 2; index++) {
            examples.push({
                id: `unanswerable-${language}-${index}`,
                // Deliberately free of every corpus term: a query that shares "код" or "code" with
                // the corpus is answerable-ish by lexical overlap and cannot test abstention.
                query: language === 'ru'
                    ? `пломба гидроцилиндра КХ-ПЛОМБА-${index} лебёдка`
                    : `hydrocylinder seal KX-SEAL-${index} winch`,
                relevantIds: [],
                split: 'holdout',
                language,
                answerable: false,
                independenceGroupId: `unanswerable-group-${language}-${index}`,
            });
        }
    }

    const provenance = {
        datasetId: 'nk1-bilingual-curated-fixture',
        datasetVersion: 'fixture-v1',
        sourceRef: 'runtime/neuro-kurisu/tests/fixtures/memory-retrieval-bilingual-corpus.mjs',
        labelingProtocol: 'Curated by NK-1 maintainers: the label is the single record carrying the cited code; synthetic corpus, not production evidence.',
        licenseId: 'LicenseRef-NK1-Curated-Fixture',
        contentSha256: fingerprintMemoryRetrievalDataset(examples),
    };

    return {
        memory,
        examples,
        provenance,
        holdoutLabelledIds: [...new Set(examples.filter((row) => row.split === 'holdout' && row.answerable !== false).flatMap((row) => row.relevantIds))],
    };
}

export const benchmarkOptions = (overrides = {}) => ({
    now: CORPUS_NOW,
    k: 5,
    minHoldoutQueries: 20,
    minUnanswerableHoldoutQueries: 4,
    minLanguageTrainQueries: 2,
    minLanguageAnswerableHoldoutQueries: 8,
    minLanguageUnanswerableHoldoutQueries: 2,
    bootstrapSamples: 400,
    seed: 41,
    ...overrides,
});
