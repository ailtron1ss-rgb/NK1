#!/usr/bin/env node
import { readFile, stat, open, link, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LocalEmbeddingProvider } from '../src/organism/developmental/LocalEmbeddingProvider.ts';
import { runMemoryOS2SemanticRetrievalBenchmark } from '../src/organism/memory/MemorySemanticRetrievalBenchmark.ts';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { parseLabels } from './run-memory-retrieval-experiment.mjs';

const MAX_SNAPSHOT_BYTES=64*1024*1024,MAX_LABEL_BYTES=4*1024*1024,MAX_PROVENANCE_BYTES=32*1024,MAX_EXAMPLES=512;
function usage(){return [
 'Usage:',
 '  npm --prefix runtime/neuro-kurisu run run:memory-semantic-retrieval-benchmark -- --snapshot <MemoryOSState2.json> --labels <labels.jsonl> --provenance <dataset-provenance.json> --out <report.json> [--k 5] [--now <unix-ms>] [--seed 31] [--bootstrap-samples 1000] [--min-similarity 0.72]',
 '',
 'Uses LocalEmbeddingProvider configured by NK_EMBEDDINGS_* environment variables.',
 'Default routing is loopback-only (Ollama at 127.0.0.1:11434); remote endpoints require explicit NK_EMBEDDINGS_ALLOW_REMOTE=1 and HTTPS.',
 'Snapshot, labels and queries stay local. The provider sanitizes obvious credentials and direct contact identifiers before embedding.',
 'The semantic index is built on an isolated bounded clone. Reports omit raw query text and memory IDs.',
 'Incomplete indexing/provider failures are written as skipped reports, never compared as partial results.',
 'Diagnostic only: the command never mutates live memory or automatically promotes a candidate.',
].join('\n');}
function parseArgs(argv){
 const out={};
 for(let i=0;i<argv.length;i++){
  const key=argv[i];if(key==='--help'||key==='-h')return {help:true};
  if(!key?.startsWith('--'))throw new Error('unexpected-argument:'+key);
  const value=argv[++i];if(!value||value.startsWith('--'))throw new Error('missing-value:'+key);
  const name=key.slice(2);if(out[name]!==undefined)throw new Error('duplicate-argument:'+key);out[name]=value;
 }
 for(const name of ['snapshot','labels','provenance','out'])if(!out[name])throw new Error('required-argument-missing:--'+name);
 return out;
}
async function readBounded(file,maxBytes,label){
 const absolute=path.resolve(file),meta=await stat(absolute);
 if(!meta.isFile())throw new Error(label+'-not-a-file');
 if(meta.size>maxBytes)throw new Error(label+'-too-large:'+meta.size);
 return {absolute,text:await readFile(absolute,'utf8')};
}
function numberOption(args,name,fallback,min,max,integer=false){
 if(args[name]===undefined)return fallback;
 const value=Number(args[name]);
 if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw new Error('--'+name+'-must-be-'+(integer?'integer-':'')+min+'-to-'+max);
 return value;
}
async function publishExclusive(file,text){
 const dir=path.dirname(file),base=path.basename(file);await mkdir(dir,{recursive:true});
 const temp=path.join(dir,'.'+base+'.'+process.pid+'.'+randomUUID()+'.tmp');
 let handle;
 try{handle=await open(temp,'wx',0o600);await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=undefined;await link(temp,file);await unlink(temp);}
 catch(error){try{await handle?.close();}catch{}try{await unlink(temp);}catch{}throw error;}
}
async function main(){
 const args=parseArgs(process.argv.slice(2));if(args.help){console.log(usage());return;}
 if(args['inspect-evidence']!==undefined&&!['true','false'].includes(args['inspect-evidence']))throw new Error('--inspect-evidence-must-be-true-or-false');
 const provider=LocalEmbeddingProvider.fromEnvironment(process.env);
 if(!provider)throw new Error('local-embedding-provider-not-configured-or-unsafe; use a loopback provider or explicitly configure a trusted HTTPS endpoint');
 const now=numberOption(args,'now',Date.now(),0,Number.MAX_SAFE_INTEGER,true);
 const k=numberOption(args,'k',5,1,10,true),seed=numberOption(args,'seed',31,1,0xffffffff,true);
 const bootstrapSamples=numberOption(args,'bootstrap-samples',1000,200,5000,true);
 const minSimilarity01=numberOption(args,'min-similarity',.72,.60,.95);
 const providerTimeoutMs=numberOption(args,'provider-timeout-ms',5000,500,20000,true);
 const maxIndexBatchItems=numberOption(args,'max-index-batch-items',16,1,16,true);
 const [snapshotFile,labelsFile,provenanceFile]=await Promise.all([
  readBounded(args.snapshot,MAX_SNAPSHOT_BYTES,'snapshot'),readBounded(args.labels,MAX_LABEL_BYTES,'labels'),readBounded(args.provenance,MAX_PROVENANCE_BYTES,'provenance'),
 ]);
 let snapshot,provenance;
 try{snapshot=JSON.parse(snapshotFile.text);}catch{throw new Error('snapshot-invalid-json');}
 try{provenance=JSON.parse(provenanceFile.text);}catch{throw new Error('provenance-invalid-json');}
 if(!snapshot||typeof snapshot!=='object'||!Array.isArray(snapshot.items))throw new Error('snapshot-must-contain-items-array');
 for(const field of ['datasetId','datasetVersion','sourceRef','labelingProtocol','licenseId','contentSha256'])if(typeof provenance?.[field]!=='string'||!provenance[field].trim())throw new Error('provenance-field-required:'+field);
 const examples=parseLabels(labelsFile.text);
 if(examples.length>MAX_EXAMPLES)throw new Error('labels-exceed-limit:'+MAX_EXAMPLES);
 if(fingerprintMemoryRetrievalDataset(examples)!==provenance.contentSha256)throw new Error('provenance-label-fingerprint-mismatch');
 const report=await runMemoryOS2SemanticRetrievalBenchmark(snapshot,examples,{
  embeddingProvider:provider,now,k,seed,bootstrapSamples,minSimilarity01,providerTimeoutMs,maxIndexBatchItems,maxExamples:MAX_EXAMPLES,
  includeQueryEvidence:args['inspect-evidence']==='true',
  minHoldoutQueries:numberOption(args,'min-answerable-holdout-queries',8,8,64,true),
  minUnanswerableHoldoutQueries:numberOption(args,'min-unanswerable-holdout-queries',4,4,32,true),
  minLanguageTrainQueries:numberOption(args,'min-language-train-queries',2,2,32,true),
  minLanguageAnswerableHoldoutQueries:numberOption(args,'min-language-answerable-holdout-queries',8,8,64,true),
  minLanguageUnanswerableHoldoutQueries:numberOption(args,'min-language-unanswerable-holdout-queries',2,2,32,true),
  datasetProvenance:provenance,
 });
 report.input={snapshotFile:path.basename(snapshotFile.absolute),labelsFile:path.basename(labelsFile.absolute),provenanceFile:path.basename(provenanceFile.absolute),labelRowsParsed:examples.length,provider:{id:provider.providerId,model:provider.modelId},note:'Absolute paths and raw query text are omitted; durable lineage is in dataset provenance.'};
 const output=path.resolve(args.out);await publishExclusive(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  output:path.basename(output),datasetFingerprint:report.datasetFingerprint,corpusFingerprint:report.corpusFingerprint,
  provider:provider.providerId,model:provider.modelId,indexedItems:report.semanticIndex.indexedItems,
  semanticEnabledQueries:report.semanticSelection?.semanticEnabledQueries??0,abstainedQueries:report.semanticSelection?.abstainedQueries??0,
  baselineRecallAtK01:report.metrics?.baseline?.recallAtK01??null,semanticRecallAtK01:report.metrics?.semantic?.recallAtK01??null,
  recallDelta:report.metrics?.deltas?.recallAtK01??null,unsupportedRetrievalRate01:report.metrics?.semantic?.unsupportedRetrievalRate01??null,
  promotion:report.promotion.status,reason:report.promotion.reason,
 },null,2));
 if(report.skipped)process.exitCode=3;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error('MEMORY_SEMANTIC_EXPERIMENT_FAILED: '+String(error?.message??error));console.error(usage());process.exitCode=2;});
