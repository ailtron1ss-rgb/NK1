#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_LABEL_BYTES = 4 * 1024 * 1024;
const MAX_PROVENANCE_BYTES = 32 * 1024;
const MAX_ITEMS = 1600;
const MAX_EXAMPLES = 512;
const LANGUAGES = new Set(['en', 'ru', 'other']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalizeQuery = query => String(query).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const queryTokens = query => normalizeQuery(query).match(/[\p{L}\p{N}]{2,}|\p{N}/gu) ?? [];
function queryNearDuplicate(left, right) {
  const a = queryTokens(left), b = queryTokens(right);
  if (Math.min(a.length, b.length) < 6) return false;
  const shingles = tokens => {
    const set = new Set();
    for (let i = 0; i + 2 < tokens.length; i++) set.add(tokens[i] + '\u0000' + tokens[i + 1] + '\u0000' + tokens[i + 2]);
    return set;
  };
  const sa = shingles(a), sb = shingles(b);
  if (!sa.size || !sb.size) return false;
  let intersection = 0;
  for (const item of sa) if (sb.has(item)) intersection++;
  return intersection / (sa.size + sb.size - intersection) >= .88;
}
function usage() {
  return [
    'Prepare a local, human-labelled bilingual retrieval dataset without inventing queries or labels:',
    '  node --experimental-strip-types scripts/memory-retrieval-annotation-pack.mjs prepare --snapshot <MemoryOSState2.json> --queries <queries.jsonl> --outdir <private-pack-dir> [--include-content]',
    '',
    'Finalize completed human annotations and create CLI-ready labels plus hash-bound provenance:',
    '  node --experimental-strip-types scripts/memory-retrieval-annotation-pack.mjs finalize --pack <private-pack-dir> --annotations <completed-annotations.jsonl> --provenance <source-provenance.json> --outdir <validated-output-dir>',
    '',
    'Query JSONL rows: {"id":"q-001","query":"...","split":"train|holdout","language":"en|ru|other"}.',
    'During annotation fill answerable, relevantIds, annotatorId, and reviewedAt (ISO timestamp with timezone).',
    'The finalizer requires, per language, at least 2 train, 8 answerable holdout, and 2 unanswerable holdout rows.',
    'Use the exact source license; this workflow never infers licensing or claims retrieval uplift.',
  ].join('\n');
}
function parseArgs(argv) {
  const mode = argv[0];
  if (!['prepare', 'finalize'].includes(mode)) throw new Error('mode-must-be-prepare-or-finalize');
  const allowed = mode === 'prepare'
    ? new Set(['snapshot', 'queries', 'outdir', 'include-content'])
    : new Set(['pack', 'annotations', 'provenance', 'outdir']);
  const options = {};
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { mode, help: true };
    if (!key?.startsWith('--')) throw new Error('unexpected-argument:' + key);
    const name = key.slice(2);
    if (!allowed.has(name)) throw new Error('unknown-argument:' + key);
    if (name === 'include-content') {
      if (options[name]) throw new Error('duplicate-argument:' + key);
      options[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error('missing-value:' + key);
    if (options[name] !== undefined) throw new Error('duplicate-argument:' + key);
    options[name] = value;
  }
  const required = mode === 'prepare' ? ['snapshot', 'queries', 'outdir'] : ['pack', 'annotations', 'provenance', 'outdir'];
  for (const name of required) if (!options[name]) throw new Error('required-argument-missing:--' + name);
  return { mode, ...options };
}
async function readBounded(file, maxBytes, label) {
  const absolute = path.resolve(file);
  const metadata = await stat(absolute);
  if (!metadata.isFile()) throw new Error(label + '-not-a-file');
  if (metadata.size > maxBytes) throw new Error(label + '-too-large:' + metadata.size + '>' + maxBytes);
  const bytes = await readFile(absolute);
  return { absolute, bytes, text: bytes.toString('utf8') };
}
function parseJsonObject(text, label) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(label + '-invalid-json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + '-must-be-json-object');
  return value;
}
function parseJsonl(text, label, maxRows) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(label + '-invalid-json-line:' + (index + 1)); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(label + '-row-not-object:' + (index + 1));
    rows.push(row);
    if (rows.length > maxRows) throw new Error(label + '-exceed-limit:' + maxRows);
  }
  if (!rows.length) throw new Error(label + '-empty');
  return rows;
}
function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    const row = value;
    return Object.fromEntries(Object.keys(row).sort().map(key => [key, canonicalJsonValue(row[key])]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}
function fingerprintCorpus(items) {
  return sha256(JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)).map(canonicalJsonValue)));
}
function canonicalQueryRows(rows) {
  return [...rows].map(row => ({
    id: row.id,
    query: normalizeQuery(row.query),
    split: row.split,
    language: row.language,
  })).sort((a, b) => a.id.localeCompare(b.id));
}
function fingerprintQueries(rows) {
  return sha256(JSON.stringify(canonicalQueryRows(rows)));
}
function validateQueryRows(rawRows) {
  const ids = new Set(), normalized = new Map(), rows = [];
  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];
    if (typeof row.id !== 'string' || !row.id.trim() || row.id.trim().length > 120) throw new Error('queries-invalid-id-row:' + (index + 1));
    if (typeof row.query !== 'string' || !row.query.trim() || row.query.trim().length > 500) throw new Error('queries-invalid-query-row:' + (index + 1));
    if (row.split !== 'train' && row.split !== 'holdout') throw new Error('queries-invalid-split-row:' + (index + 1));
    if (!LANGUAGES.has(row.language)) throw new Error('queries-invalid-language-row:' + (index + 1));
    if (Object.hasOwn(row, 'relevantIds') || Object.hasOwn(row, 'answerable') || Object.hasOwn(row, 'annotatorId')) {
      throw new Error('queries-must-not-contain-preassigned-labels-row:' + (index + 1));
    }
    const id = row.id.trim(), query = row.query.trim(), normalizedQuery = normalizeQuery(query);
    if (ids.has(id)) throw new Error('queries-duplicate-id:' + id);
    if (normalized.has(normalizedQuery)) throw new Error('queries-duplicate-normalized-query:' + id);
    ids.add(id);
    normalized.set(normalizedQuery, row.split);
    rows.push({ id, query, split: row.split, language: row.language });
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].split !== rows[j].split && queryNearDuplicate(rows[i].query, rows[j].query)) {
        throw new Error('queries-near-duplicate-cross-split:' + rows[i].id + ':' + rows[j].id);
      }
    }
  }
  return rows;
}
function jsonl(rows) {
  return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}
async function publishDirectory(outputDirectory, files) {
  const target = path.resolve(outputDirectory);
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  try {
    await stat(target);
    throw new Error('output-directory-already-exists:' + target);
  } catch (error) {
    if (error?.message?.startsWith('output-directory-already-exists:')) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = await mkdtemp(path.join(parent, '.' + path.basename(target) + '.tmp-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      if (path.basename(name) !== name) throw new Error('invalid-output-file-name');
      await writeFile(path.join(temporary, name), contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    }
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return target;
}
async function prepare(options) {
  const [snapshotFile, queriesFile] = await Promise.all([
    readBounded(options.snapshot, MAX_SNAPSHOT_BYTES, 'snapshot'),
    readBounded(options.queries, MAX_LABEL_BYTES, 'queries'),
  ]);
  const snapshot = parseJsonObject(snapshotFile.text, 'snapshot');
  if (!Array.isArray(snapshot.items)) throw new Error('snapshot-must-have-items-array');
  if (snapshot.items.length < 1) throw new Error('snapshot-items-empty');
  if (snapshot.items.length > MAX_ITEMS) throw new Error('corpus-exceeds-benchmark-limit:' + MAX_ITEMS);
  const ids = new Set();
  for (let index = 0; index < snapshot.items.length; index++) {
    const row = snapshot.items[index];
    if (!row || typeof row.id !== 'string' || !row.id.trim() || typeof row.content !== 'string') {
      throw new Error('snapshot-malformed-memory-row:' + index);
    }
    if (ids.has(row.id)) throw new Error('snapshot-duplicate-memory-id:' + row.id);
    ids.add(row.id);
  }
  const rows = validateQueryRows(parseJsonl(queriesFile.text, 'queries', MAX_EXAMPLES));
  const catalog = [...snapshot.items].sort((a, b) => a.id.localeCompare(b.id)).map(row => ({
    id: row.id,
    kind: typeof row.kind === 'string' ? row.kind : 'unknown',
    epistemicStatus: typeof row.epistemicStatus === 'string' ? row.epistemicStatus : 'unknown',
    dormant: row.dormant === true,
    validFromAt: Number.isFinite(row.validFromAt) ? row.validFromAt : null,
    validUntilAt: Number.isFinite(row.validUntilAt) ? row.validUntilAt : null,
    contentSha256: sha256(Buffer.from(row.content, 'utf8')),
    ...(options['include-content'] ? { content: row.content } : {}),
  }));
  const taskRows = rows.map(row => ({
    ...row, answerable: null, relevantIds: [], annotatorId: '', reviewedAt: '', notes: '',
  }));
  const catalogText = jsonl(catalog), queueText = jsonl(taskRows);
  const counts = {
    total: rows.length,
    byLanguage: Object.fromEntries(['en', 'ru', 'other'].map(language => [language, rows.filter(row => row.language === language).length])),
    bySplit: Object.fromEntries(['train', 'holdout'].map(split => [split, rows.filter(row => row.split === split).length])),
  };
  const manifest = {
    schemaVersion: 1,
    kind: 'nk1-memory-retrieval-human-annotation-pack',
    purpose: 'Local human annotation only; this artifact is not retrieval evidence and is not a promotion decision.',
    sourceFiles: {
      snapshotBasename: path.basename(snapshotFile.absolute),
      snapshotSha256: sha256(snapshotFile.bytes),
      queriesBasename: path.basename(queriesFile.absolute),
      queriesSha256: sha256(queriesFile.bytes),
    },
    corpus: {
      itemCount: snapshot.items.length,
      corpusFingerprint: fingerprintCorpus(snapshot.items),
      includesContent: Boolean(options['include-content']),
      catalogSha256: sha256(Buffer.from(catalogText, 'utf8')),
    },
    queries: {
      ...counts,
      normalizedQueryFingerprint: fingerprintQueries(rows),
      annotationGateBaseline: {
        trainPerRequiredLanguageMinimum: 2,
        answerableHoldoutPerRequiredLanguageMinimum: 8,
        unanswerableHoldoutPerRequiredLanguageMinimum: 2,
        requiredLanguages: ['en', 'ru'],
      },
    },
    artifacts: {
      catalogFile: 'corpus-catalog.jsonl',
      catalogSha256: sha256(Buffer.from(catalogText, 'utf8')),
      queueFile: 'annotation-queue.jsonl',
      queueSha256: sha256(Buffer.from(queueText, 'utf8')),
    },
    privacy: {
      privateCorpusTextIncluded: Boolean(options['include-content']),
      localOnly: true,
      warning: 'Never commit this generated directory, corpus content, annotations, or user-memory snapshot.',
    },
  };
  const target = await publishDirectory(options.outdir, {
    'corpus-catalog.jsonl': catalogText,
    'annotation-queue.jsonl': queueText,
    'manifest.json': JSON.stringify(manifest, null, 2) + '\n',
    'ANNOTATION-INSTRUCTIONS-RU.md': [
      '# Разметка памяти NK1',
      '',
      '1. Размечайте запросы относительно всего замороженного корпуса, а не только результатов одного алгоритма.',
      '2. Не меняйте id, query, split или language. Сохраните исходный annotation-queue.jsonl и редактируйте копию.',
      '3. Для каждого запроса задайте answerable: true и непустой relevantIds, либо answerable: false и пустой relevantIds.',
      '4. relevantIds должны быть точными id элементов из corpus-catalog.jsonl; один id указывается один раз.',
      '5. Заполните annotatorId и reviewedAt (ISO 8601 с часовым поясом). В notes зафиксируйте неоднозначность или правило решения.',
      '6. Для promotion-кандидата требуется минимум 2 train, 8 answerable holdout и 2 unanswerable holdout для каждого из языков en и ru.',
      '7. Используйте finalize только после завершения разметки. Полученный набор остаётся кандидатом на эксперимент; он не доказывает улучшение сам по себе.',
      '',
      'Этот каталог может содержать личные воспоминания. Храните его локально и не добавляйте в Git.',
      '',
    ].join('\n'),
  });
  console.log(JSON.stringify({
    pass: true, mode: 'prepare', outdir: target, corpusItems: catalog.length,
    queries: rows.length, corpusFingerprint: manifest.corpus.corpusFingerprint,
    normalizedQueryFingerprint: manifest.queries.normalizedQueryFingerprint,
    privateCorpusTextIncluded: manifest.privacy.privateCorpusTextIncluded,
    readyForBilingualAnnotation: manifest.queries.byLanguage.en > 0 && manifest.queries.byLanguage.ru > 0,
  }, null, 2));
}
function benchmarkDatasetFingerprint(rows) {
  const canonical = [...rows].map(row => ({
    id: row.id,
    query: normalizeQuery(row.query),
    ...(row.language === undefined ? {} : { language: row.language }),
    relevantIds: [...new Set(row.relevantIds)].sort(),
    split: row.split,
    answerable: row.answerable !== false,
  })).sort((a, b) => a.id.localeCompare(b.id) || a.split.localeCompare(b.split) ||
    a.query.localeCompare(b.query) || a.relevantIds.join('\u0000').localeCompare(b.relevantIds.join('\u0000')));
  return sha256(JSON.stringify(canonical));
}
function validateAnnotationCounts(rows) {
  const slices = {};
  for (const language of ['en', 'ru', 'other']) {
    const subset = rows.filter(row => row.language === language);
    slices[language] = {
      train: subset.filter(row => row.split === 'train').length,
      answerableHoldout: subset.filter(row => row.split === 'holdout' && row.answerable).length,
      unanswerableHoldout: subset.filter(row => row.split === 'holdout' && !row.answerable).length,
    };
  }
  for (const language of ['en', 'ru']) {
    if (slices[language].train < 2) throw new Error('annotation-insufficient-train-' + language);
    if (slices[language].answerableHoldout < 8) throw new Error('annotation-insufficient-answerable-holdout-' + language);
    if (slices[language].unanswerableHoldout < 2) throw new Error('annotation-insufficient-unanswerable-holdout-' + language);
  }
  return slices;
}
async function finalize(options) {
  const packDir = path.resolve(options.pack);
  const [manifestFile, catalogFile, queueFile, annotationsFile, provenanceFile] = await Promise.all([
    readBounded(path.join(packDir, 'manifest.json'), MAX_PROVENANCE_BYTES, 'pack-manifest'),
    readBounded(path.join(packDir, 'corpus-catalog.jsonl'), MAX_SNAPSHOT_BYTES, 'pack-catalog'),
    readBounded(path.join(packDir, 'annotation-queue.jsonl'), MAX_LABEL_BYTES, 'pack-queue'),
    readBounded(options.annotations, MAX_LABEL_BYTES, 'annotations'),
    readBounded(options.provenance, MAX_PROVENANCE_BYTES, 'provenance'),
  ]);
  const manifest = parseJsonObject(manifestFile.text, 'pack-manifest');
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'nk1-memory-retrieval-human-annotation-pack') {
    throw new Error('unsupported-annotation-pack');
  }
  if (sha256(catalogFile.bytes) !== manifest.artifacts?.catalogSha256 ||
      sha256(queueFile.bytes) !== manifest.artifacts?.queueSha256 ||
      manifest.artifacts?.catalogFile !== 'corpus-catalog.jsonl' ||
      manifest.artifacts?.queueFile !== 'annotation-queue.jsonl') {
    throw new Error('annotation-pack-artifact-hash-mismatch');
  }
  const catalog = parseJsonl(catalogFile.text, 'pack-catalog', MAX_ITEMS);
  const queue = parseJsonl(queueFile.text, 'pack-queue', MAX_EXAMPLES);
  const annotations = parseJsonl(annotationsFile.text, 'annotations', MAX_EXAMPLES);
  const provenance = parseJsonObject(provenanceFile.text, 'provenance');
  const catalogIds = new Set();
  for (const row of catalog) {
    if (typeof row.id !== 'string' || !row.id.trim() || catalogIds.has(row.id)) throw new Error('catalog-invalid-or-duplicate-id');
    if (!/^[a-f0-9]{64}$/.test(String(row.contentSha256 ?? ''))) throw new Error('catalog-invalid-content-hash:' + row.id);
    catalogIds.add(row.id);
  }
  if (catalogIds.size !== manifest.corpus?.itemCount || !/^[a-f0-9]{64}$/.test(String(manifest.corpus?.corpusFingerprint ?? ''))) {
    throw new Error('annotation-pack-corpus-manifest-invalid');
  }
  if (fingerprintQueries(queue) !== manifest.queries?.normalizedQueryFingerprint) throw new Error('annotation-pack-query-fingerprint-mismatch');
  const queueById = new Map(queue.map(row => [row.id, row]));
  if (queueById.size !== queue.length || annotations.length !== queue.length) throw new Error('annotations-row-count-or-id-uniqueness-mismatch');
  const annotationById = new Map();
  for (let index = 0; index < annotations.length; index++) {
    const row = annotations[index];
    const original = queueById.get(row.id);
    if (!original || annotationById.has(row.id)) throw new Error('annotations-unknown-or-duplicate-id:' + String(row.id));
    if (row.query !== original.query || row.split !== original.split || row.language !== original.language) {
      throw new Error('annotations-query-identity-changed:' + row.id);
    }
    if (typeof row.answerable !== 'boolean') throw new Error('annotations-answerable-required:' + row.id);
    if (!Array.isArray(row.relevantIds) || row.relevantIds.length > 24 ||
        (row.answerable ? row.relevantIds.length < 1 : row.relevantIds.length !== 0)) {
      throw new Error('annotations-invalid-relevantIds:' + row.id);
    }
    const relevantIds = [];
    const seenRelevant = new Set();
    for (const value of row.relevantIds) {
      if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new Error('annotations-invalid-memory-id:' + row.id);
      const id = value.trim();
      if (seenRelevant.has(id)) throw new Error('annotations-duplicate-memory-id:' + row.id + ':' + id);
      if (!catalogIds.has(id)) throw new Error('annotations-unknown-memory-id:' + row.id + ':' + id);
      seenRelevant.add(id);
      relevantIds.push(id);
    }
    if (typeof row.annotatorId !== 'string' || !row.annotatorId.trim() || row.annotatorId.trim().length > 120) {
      throw new Error('annotations-annotator-required:' + row.id);
    }
    if (typeof row.reviewedAt !== 'string' || !Number.isFinite(Date.parse(row.reviewedAt)) || !/(?:z|[+-]\d{2}:\d{2})$/i.test(row.reviewedAt)) {
      throw new Error('annotations-reviewedAt-must-be-iso-with-timezone:' + row.id);
    }
    if (row.notes !== undefined && (typeof row.notes !== 'string' || row.notes.length > 1000)) {
      throw new Error('annotations-invalid-notes:' + row.id);
    }
    annotationById.set(row.id, {
      id: row.id, query: row.query, relevantIds, split: row.split, answerable: row.answerable,
      language: row.language, annotatorId: row.annotatorId.trim(), reviewedAt: row.reviewedAt,
      notes: String(row.notes ?? ''),
    });
  }
  const finalRows = queue.map(row => annotationById.get(row.id));
  const seenQueries = new Set();
  for (const row of finalRows) {
    const q = normalizeQuery(row.query);
    if (seenQueries.has(q)) throw new Error('annotations-duplicate-normalized-query:' + row.id);
    seenQueries.add(q);
  }
  for (let i = 0; i < finalRows.length; i++) {
    for (let j = i + 1; j < finalRows.length; j++) {
      if (finalRows[i].split !== finalRows[j].split && queryNearDuplicate(finalRows[i].query, finalRows[j].query)) {
        throw new Error('annotations-near-duplicate-cross-split:' + finalRows[i].id + ':' + finalRows[j].id);
      }
    }
  }
  const countsByLanguage = validateAnnotationCounts(finalRows);
  for (const key of ['datasetId', 'datasetVersion', 'sourceRef', 'labelingProtocol', 'licenseId']) {
    if (typeof provenance[key] !== 'string' || !provenance[key].trim() || provenance[key].trim().length > (key === 'labelingProtocol' ? 500 : (key === 'datasetId' || key === 'datasetVersion' || key === 'licenseId') ? 120 : 240)) {
      throw new Error('provenance-field-required-or-too-long:' + key);
    }
  }
  const benchmarkRows = finalRows.map(row => ({
    id: row.id, query: row.query, relevantIds: row.relevantIds, split: row.split,
    answerable: row.answerable, language: row.language,
  }));
  const datasetFingerprint = benchmarkDatasetFingerprint(benchmarkRows);
  const outputProvenance = {
    ...provenance,
    datasetId: provenance.datasetId.trim(),
    datasetVersion: provenance.datasetVersion.trim(),
    sourceRef: provenance.sourceRef.trim(),
    labelingProtocol: provenance.labelingProtocol.trim(),
    licenseId: provenance.licenseId.trim(),
    contentSha256: datasetFingerprint,
  };
  const labelsText = jsonl(benchmarkRows);
  const provenanceText = JSON.stringify(outputProvenance, null, 2) + '\n';
  const sortedReviewTimes = finalRows.map(row => Date.parse(row.reviewedAt)).sort((a, b) => a - b);
  const outputManifest = {
    schemaVersion: 1,
    kind: 'nk1-memory-retrieval-validated-human-annotations',
    status: 'ready-for-offline-benchmark-only-not-promotion',
    datasetFingerprint,
    sourcePack: {
      snapshotSha256: manifest.sourceFiles?.snapshotSha256,
      corpusFingerprint: manifest.corpus.corpusFingerprint,
      normalizedQueryFingerprint: manifest.queries.normalizedQueryFingerprint,
      catalogSha256: manifest.artifacts.catalogSha256,
      queueSha256: manifest.artifacts.queueSha256,
    },
    annotations: {
      rows: finalRows.length,
      sha256: sha256(Buffer.from(labelsText, 'utf8')),
      reviewerCount: new Set(finalRows.map(row => row.annotatorId)).size,
      reviewedAtRange: { from: new Date(sortedReviewTimes[0]).toISOString(), to: new Date(sortedReviewTimes[sortedReviewTimes.length - 1]).toISOString() },
      byLanguage: countsByLanguage,
      note: 'Completeness and provenance checks do not establish inter-annotator agreement or retrieval uplift.',
    },
    provenanceFileSha256: sha256(provenanceFile.bytes),
    benchmarkInputFiles: { labels: 'labels.jsonl', provenance: 'dataset-provenance.json' },
  };
  const target = await publishDirectory(options.outdir, {
    'labels.jsonl': labelsText,
    'dataset-provenance.json': provenanceText,
    'finalization-manifest.json': JSON.stringify(outputManifest, null, 2) + '\n',
  });
  console.log(JSON.stringify({
    pass: true, mode: 'finalize', outdir: target, rows: finalRows.length,
    datasetFingerprint, corpusFingerprint: manifest.corpus.corpusFingerprint,
    reviewerCount: outputManifest.annotations.reviewerCount,
    status: outputManifest.status,
    next: 'Run the existing offline experiment against the same frozen snapshot; do not treat this preflight as uplift evidence.',
  }, null, 2));
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (options.mode === 'prepare') await prepare(options);
  else await finalize(options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('MEMORY_ANNOTATION_PACK_FAILED: ' + String(error?.message ?? error));
    console.error(usage());
    process.exitCode = 2;
  });
}
