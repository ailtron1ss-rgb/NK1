#!/usr/bin/env node
import { readFile, stat, open, link, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { previewNekoHybridMemoryRanking } from '../../../integrations/neko-memory-shadow/src/memoryos2-preview.mjs';

const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_LABEL_BYTES = 4 * 1024 * 1024;
const MAX_PROVENANCE_BYTES = 32 * 1024;
const MAX_EXAMPLES = 512;

function usage() {
  return [
    'Usage:',
    '  node --experimental-strip-types scripts/run-memory-retrieval-experiment.mjs --snapshot <MemoryOSState2.json> --labels <labels.jsonl> --provenance <dataset-provenance.json> --out <report.json> [--seeds 11,29,47,71,101] [--k 5] [--now <unix-ms>] [--inspect-evidence true] [--min-train-per-language 4] [--min-answerable-per-language 20] [--min-unanswerable-per-language 8] [--candidate-strategy memoryos2-canonical|neko-shadow-rrf] [--candidate-rrf-profile equal|memoryos2] [--shadow-vector true|false]',
    '',
    'The label file is JSONL; optional explicit language labels are "en", "ru", or "other".',
    'A tagged benchmark requires all rows tagged and both en and ru for promotion; per-language holdout gates run separately.',
    'For an explicitly unanswerable query, use "answerable":false with an empty relevantIds array; omitted answerable defaults to true.',
    'The snapshot must be the exported MemoryOSState2 object. The provenance file must contain datasetId, datasetVersion, sourceRef and labelingProtocol.',
    'The Inspect export contains only per-query HMAC digests and bounded ranked-memory flags; the ephemeral key is never written to the report.',
    'The default bilingual evidence minimums are 4 train, 20 answerable holdout, and 8 unanswerable holdout queries per language.',
    'This runs offline on a clone; it does not alter live memory or automatically promote a candidate.',
    'For --candidate-strategy neko-shadow-rrf, the existing Inspect holdout scorer evaluates the shadow arm; --shadow-vector true explicitly enables the configured semantic provider.',
  ].join('\n');
}
function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { help: true };
    if (!key?.startsWith('--')) throw new Error(`unexpected-argument:${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing-value:${key}`);
    if (options[key.slice(2)] !== undefined) throw new Error(`duplicate-argument:${key}`);
    options[key.slice(2)] = value;
  }
  for (const name of ['snapshot', 'labels', 'provenance', 'out']) if (!options[name]) throw new Error(`required-argument-missing:--${name}`);
  return options;
}
async function readBounded(file, maxBytes, label) {
  const absolute = path.resolve(file);
  const meta = await stat(absolute);
  if (!meta.isFile()) throw new Error(`${label}-not-a-file:${absolute}`);
  if (meta.size > maxBytes) throw new Error(`${label}-too-large:${meta.size}>${maxBytes}`);
  return { absolute, text: await readFile(absolute, 'utf8') };
}
/**
 * Publish a report atomically without clobbering an existing result. The temporary
 * file lives beside the destination, is flushed before publication, and `link` is
 * an atomic no-overwrite operation on the same filesystem. On failure the temporary
 * file is removed, so interrupted writes do not leave a partial report at --out.
 */
async function publishReportExclusive(outputPath, contents) {
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath);
  await mkdir(dir, { recursive: true });
  const temporaryPath = path.join(dir, `.${base}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, outputPath);
    await unlink(temporaryPath);
  } catch (error) {
    try { await handle?.close(); } catch {}
    try { await unlink(temporaryPath); } catch {}
    throw error;
  }
}
export function parseLabels(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    let row;
    try { row = JSON.parse(line); }
    catch { throw new Error(`labels-invalid-json-line:${index + 1}`); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`labels-row-not-object:${index + 1}`);
    if (typeof row.id !== 'string' || !row.id.trim() || row.id.length > 120) throw new Error(`labels-invalid-id-line:${index + 1}`);
    if (typeof row.query !== 'string' || !row.query.trim() || row.query.length > 500) throw new Error(`labels-invalid-query-line:${index + 1}`);
    if (row.answerable !== undefined && typeof row.answerable !== 'boolean') throw new Error(`labels-invalid-answerable-line:${index + 1}`);
    if (row.language !== undefined && !['en', 'ru', 'other'].includes(row.language)) throw new Error(`labels-invalid-language-line:${index + 1}`);
    if (row.independenceGroupId !== undefined && (typeof row.independenceGroupId !== 'string' || !row.independenceGroupId.trim() || row.independenceGroupId.trim().length > 120)) throw new Error(`labels-invalid-independence-group-id-line:${index + 1}`);
    const answerable = row.answerable !== false;
    if (!Array.isArray(row.relevantIds) || row.relevantIds.length > 24 ||
        (answerable ? row.relevantIds.length < 1 : row.relevantIds.length !== 0) ||
        row.relevantIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 160)) {
      throw new Error(`labels-invalid-relevantIds-line:${index + 1}`);
    }
    if (row.split !== 'train' && row.split !== 'holdout') throw new Error(`labels-invalid-split-line:${index + 1}`);
    rows.push({ id: row.id.trim(), query: row.query.trim(), relevantIds: row.relevantIds.map(id => id.trim()), split: row.split, answerable, ...(row.language === undefined ? {} : { language: row.language }), ...(row.independenceGroupId === undefined ? {} : { independenceGroupId: row.independenceGroupId.trim() }) });
    if (rows.length > MAX_EXAMPLES) throw new Error(`labels-exceed-limit:${MAX_EXAMPLES}`);
  }
  if (!rows.length) throw new Error('labels-empty');
  return rows;
}
function parseSeeds(value) {
  if (!value) return undefined;
  const seeds = value.split(',').map(x => x.trim()).filter(Boolean).map(Number);
  if (seeds.length < 3 || seeds.length > 9 || seeds.some(seed => !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)) throw new Error('seeds-must-be-3-to-9-uint32-values');
  if (new Set(seeds).size !== seeds.length) throw new Error('seeds-must-be-distinct');
  return seeds;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  if (args['inspect-evidence'] !== undefined && !['true','false'].includes(args['inspect-evidence'])) {
    throw new Error('--inspect-evidence-must-be-true-or-false');
  }
  const includeQueryEvidence=args['inspect-evidence']==='true';
  const boundedIntegerOption=(name,fallback,min,max)=>{
    if(args[name]===undefined)return fallback;
    const value=Number(args[name]);
    if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`--${name}-must-be-integer-${min}-to-${max}`);
    return value;
  };
  const minTrainPerLanguage=boundedIntegerOption('min-train-per-language',includeQueryEvidence?4:2,includeQueryEvidence?4:2,32);
  const minAnswerablePerLanguage=boundedIntegerOption('min-answerable-per-language',includeQueryEvidence?20:8,includeQueryEvidence?20:8,64);
  const minUnanswerablePerLanguage=boundedIntegerOption('min-unanswerable-per-language',includeQueryEvidence?8:2,includeQueryEvidence?8:2,32);
  const [snapshotFile, labelsFile, provenanceFile] = await Promise.all([
    readBounded(args.snapshot, MAX_SNAPSHOT_BYTES, 'snapshot'),
    readBounded(args.labels, MAX_LABEL_BYTES, 'labels'),
    readBounded(args.provenance, MAX_PROVENANCE_BYTES, 'provenance'),
  ]);
  let snapshot, provenance;
  try { snapshot = JSON.parse(snapshotFile.text); } catch { throw new Error('snapshot-invalid-json'); }
  try { provenance = JSON.parse(provenanceFile.text); } catch { throw new Error('provenance-invalid-json'); }
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) throw new Error('snapshot-must-be-MemoryOSState2-with-items-array');
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new Error('provenance-must-be-json-object');
  for (const key of ['datasetId', 'datasetVersion', 'sourceRef', 'labelingProtocol', 'licenseId']) if (typeof provenance[key] !== 'string' || !provenance[key].trim()) throw new Error(`provenance-field-required:${key}`);
  const examples = parseLabels(labelsFile.text);
  const seeds = parseSeeds(args.seeds);
  const k = args.k === undefined ? 5 : Number(args.k);
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error('k-must-be-integer-1-to-10');
  const now = args.now === undefined ? Date.now() : Number(args.now);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('now-must-be-nonnegative-unix-milliseconds');
  const candidateStrategy=args['candidate-strategy']??'memoryos2-canonical';
  if(!['memoryos2-canonical','neko-shadow-rrf'].includes(candidateStrategy))throw new Error('--candidate-strategy-invalid');
  const candidateRrfProfile=args['candidate-rrf-profile']??'equal';
  if(!['equal','memoryos2'].includes(candidateRrfProfile))throw new Error('--candidate-rrf-profile-invalid');
  if(args['shadow-vector']!==undefined&&!['true','false'].includes(args['shadow-vector']))throw new Error('--shadow-vector-must-be-true-or-false');
  const shadowVectorRequested=args['shadow-vector']==='true';
  if(candidateStrategy!=='neko-shadow-rrf'&&(shadowVectorRequested||args['candidate-rrf-profile']!==undefined))throw new Error('--shadow-options-require-neko-shadow-rrf');
  let candidateRetriever;
  let shadowRrfDiagnostics=null;
  let candidateVectorEnabled=false;
  if(candidateStrategy==='neko-shadow-rrf'){
    const boundedShadowItems=snapshot.items.slice(0,1600).filter(item=>item&&typeof item.id==='string'&&item.id.trim()&&typeof item.content==='string');
    const shadowSnapshot={...structuredClone(snapshot),items:structuredClone(boundedShadowItems)};
    const shadowMemory=new MemoryOS2({embeddingProvider:shadowVectorRequested?undefined:null});
    shadowMemory.restore(shadowSnapshot);
    const itemById=new Map(boundedShadowItems.map(item=>[item.id,item]));
    const shadowByQuery=new Map();
    const previewLatencies=[];
    const semanticProviders=new Set();
    const fallbackReasons={};
    let vectorEnabledQueries=0;
    let exploratorySemanticCandidateCount=0;
    let unmappedShadowCandidateIds=0;
    let shadowCandidateIds=0;
    let vectorCoverageSum=0;
    for(const query of new Set(examples.map(example=>example.query))){
      const started=performance.now();
      const preview=await previewNekoHybridMemoryRanking(shadowMemory,query,{
        limit:k,
        maxPerChannel:64,
        includeSemanticEmbeddingChannel:shadowVectorRequested,
        useCanonicalWeights:candidateRrfProfile==='memoryos2',
        temporalOptions:{temporalMode:'at',asOfAt:now},
      });
      const latencyMs=Math.max(0,performance.now()-started);
      previewLatencies.push(latencyMs);
      if(preview.semantic.enabled){
        vectorEnabledQueries++;
        semanticProviders.add(preview.semantic.provider);
        vectorCoverageSum+=preview.semantic.coverage01;
      }
      if(preview.semantic.fallbackReason){
        fallbackReasons[preview.semantic.fallbackReason]=(fallbackReasons[preview.semantic.fallbackReason]??0)+1;
      }
      exploratorySemanticCandidateCount+=preview.exploratorySemanticIds.length;
      shadowCandidateIds+=preview.shadowIds.length;
      const items=preview.shadowIds.map(id=>itemById.get(id)).filter(Boolean);
      unmappedShadowCandidateIds+=preview.shadowIds.length-items.length;
      shadowByQuery.set(query,{items,latencyMs,isolationSetupMs:0});
    }
    const sortedLatencies=[...previewLatencies].sort((a,b)=>a-b);
    const percentile=(values,p)=>values.length?Number(values[Math.min(values.length-1,Math.ceil(values.length*p)-1)].toFixed(3)):0;
    candidateVectorEnabled=vectorEnabledQueries>0;
    candidateRetriever=(query,limit)=>{
      const cached=shadowByQuery.get(query);
      return cached?{...cached,items:cached.items.slice(0,limit)}:{items:[],latencyMs:0,isolationSetupMs:0};
    };
    shadowRrfDiagnostics={
      mode:'offline-shadow-only',
      rrfProfile:candidateRrfProfile,
      vectorRequested:shadowVectorRequested,
      vectorEnabled:candidateVectorEnabled,
      vectorEnabledQueries,
      semanticProviders:[...semanticProviders].sort(),
      semanticFallbackReasons:fallbackReasons,
      meanVectorCoverage01:vectorEnabledQueries?Number((vectorCoverageSum/vectorEnabledQueries).toFixed(4)):0,
      uniqueQueries:previewLatencies.length,
      shadowCandidateIds,
      exploratorySemanticCandidateIds:exploratorySemanticCandidateCount,
      unmappedShadowCandidateIds,
      previewLatencyP50Ms:percentile(sortedLatencies,.5),
      previewLatencyP95Ms:percentile(sortedLatencies,.95),
      userFacingEligible:false,
      promotionEligible:false,
    };
  }
  const report = runMemoryOS2RetrievalExperiment(snapshot, examples, {
    now, k, seeds, maxExamples: MAX_EXAMPLES,
    includeQueryEvidence,
    minHoldoutQueries: includeQueryEvidence ? minAnswerablePerLanguage * 2 : 8,
    minUnanswerableHoldoutQueries: includeQueryEvidence ? minUnanswerablePerLanguage * 2 : 4,
    minLanguageTrainQueries: minTrainPerLanguage,
    minLanguageAnswerableHoldoutQueries: minAnswerablePerLanguage,
    minLanguageUnanswerableHoldoutQueries: minUnanswerablePerLanguage,
    datasetProvenance: provenance,
    candidateStrategy,
    candidateRrfProfile,
    candidateVectorEnabled,
    ...(candidateRetriever?{candidateRetriever}:{}),
  });
  report.input = {
    snapshotFile: path.basename(snapshotFile.absolute),
    labelsFile: path.basename(labelsFile.absolute),
    provenanceFile: path.basename(provenanceFile.absolute),
    labelRowsParsed: examples.length,
    note: 'Absolute local paths are deliberately omitted from the report; use sourceRef in provenance for durable lineage.',
  };
  if(shadowRrfDiagnostics)report.shadowRrf=shadowRrfDiagnostics;
  const outputPath = path.resolve(args.out);
  await publishReportExclusive(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  const holdoutMetrics = report.runs[0]?.candidateHoldout;
  console.log(JSON.stringify({
    output: outputPath,
    candidateStrategy: report.candidateStrategy,
    shadowRrf: report.shadowRrf??null,
    datasetFingerprint: report.datasetFingerprint,
    corpusFingerprint: report.corpusFingerprint,
    seedCount: report.seedCount,
    trainQueries: report.trainQueries,
    holdoutQueries: report.holdoutQueries,
    answerableHoldoutQueries: holdoutMetrics?.answerableQueries ?? 0,
    unanswerableHoldoutQueries: holdoutMetrics?.unanswerableQueries ?? 0,
    unsupportedRetrievalRate01: holdoutMetrics?.unsupportedRetrievalRate01 ?? 0,
    correctAbstentionRate01: holdoutMetrics?.correctAbstentionRate01 ?? 0,
    queryEvidenceIncluded: Boolean(report.queryEvidence),
    promotion: report.promotion.status,
    reason: report.promotion.reason,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`MEMORY_EXPERIMENT_FAILED: ${String(error?.message ?? error)}`); console.error(usage()); process.exitCode = 2; });
}
