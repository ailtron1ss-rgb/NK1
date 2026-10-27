import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const args=process.argv.slice(2);
const flag=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const input=flag('--dataset')??process.env.NK1_MEMORY_HOLDOUT_DATASET;
if(!input){console.error('Usage: node --experimental-strip-types tests/run-independent-bilingual-memory-holdout.mjs --dataset <external-dataset.json> [--out <report.json>]');process.exit(2);}
const raw=await readFile(path.resolve(input),'utf8');
const data=JSON.parse(raw);
assert.equal(data.schemaVersion,1,'schemaVersion must be 1');
assert.ok(data.snapshot&&Array.isArray(data.snapshot.items),'snapshot.items is required');
assert.ok(Array.isArray(data.examples),'examples is required');
const provenance=data.provenance??{};
for(const key of ['datasetId','datasetVersion','sourceRef','labelingProtocol','licenseId']) assert.ok(typeof provenance[key]==='string'&&provenance[key].trim(), 'missing provenance: '+key);
assert.doesNotMatch(provenance.sourceRef,/fixture|synthetic|test-only|hand-authored/i,'test fixtures cannot count as independent evidence');
const normalize=q=>String(q).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu,' ').replace(/\\s+/g,' ').trim();
const canonical=rows=>[...rows].map(x=>({id:x.id,query:normalize(x.query),relevantIds:[...new Set(x.relevantIds)].sort(),split:x.split,answerable:x.answerable!==false})).sort((a,b)=>a.id.localeCompare(b.id)||a.split.localeCompare(b.split)||a.query.localeCompare(b.query)||a.relevantIds.join('\0').localeCompare(b.relevantIds.join('\0')));
const hashRows=rows=>createHash('sha256').update(JSON.stringify(canonical(rows))).digest('hex');
const corpusIds=data.snapshot.items.map(x=>x?.id);
assert.ok(corpusIds.length>=12&&corpusIds.length<=1600,'corpus must have 12–1600 rows');
assert.equal(new Set(corpusIds).size,corpusIds.length,'duplicate memory IDs invalidate the dataset');
const ids=new Set(corpusIds);
const exampleIds=new Set();
for(const row of data.examples){
 assert.ok(row&&typeof row.id==='string'&&row.id.trim(),'example id required');
 assert.ok(!exampleIds.has(row.id),'duplicate example id: '+row.id); exampleIds.add(row.id);
 assert.ok(typeof row.query==='string'&&row.query.trim(),'query required');
 assert.ok(row.split==='train'||row.split==='holdout','split must be train or holdout');
 assert.ok(row.language==='ru'||row.language==='en','language must be explicitly ru or en');
 assert.ok(Array.isArray(row.relevantIds),'relevantIds must be an array');
 assert.ok(row.answerable===false?row.relevantIds.length===0:row.relevantIds.length>0,'answerability and labels disagree');
 for(const rid of row.relevantIds) assert.ok(ids.has(rid),'unknown ground-truth memory ID: '+rid);
}
const seeds=[13,29,53,71,101], reports={};
for(const language of ['ru','en']){
 const examples=data.examples.filter(x=>x.language===language);
 const train=examples.filter(x=>x.split==='train'), holdout=examples.filter(x=>x.split==='holdout');
 assert.ok(new Set(train.map(x=>normalize(x.query))).size>=4,language+': require 4 unique training queries');
 assert.ok(holdout.filter(x=>x.answerable!==false).length>=20,language+': require 20 answerable holdout queries');
 assert.ok(holdout.filter(x=>x.answerable===false).length>=8,language+': require 8 unanswerable holdout queries');
 const langProvenance={datasetId:provenance.datasetId,datasetVersion:provenance.datasetVersion,sourceRef:provenance.sourceRef,labelingProtocol:provenance.labelingProtocol,licenseId:provenance.licenseId,contentSha256:hashRows(examples)};
 const opts={now:Number.isFinite(Number(data.now))?Number(data.now):Date.now(),k:5,bootstrapSamples:2000,maxExamples:512,minHoldoutQueries:20,minUnanswerableHoldoutQueries:8,minimumRecallUplift01:.02,maximumMrrRegression01:.01,maximumUnsupportedRetrievalRegression01:0,datasetProvenance:langProvenance,seeds};
 const sensitivity=runMemoryOS2RetrievalExperiment(data.snapshot,examples,opts);
 assert.equal(sensitivity.datasetProvenance.contentHashValid,true,language+': label fingerprint mismatch');
 assert.equal(sensitivity.corpusIntegrity.validForPromotion,true,language+': corpus integrity failed');
 assert.equal(sensitivity.datasetIntegrity.validForPromotion,true,language+': dataset integrity failed');
 const runs=seeds.map(seed=>{const r=runMemoryOS2RetrievalBenchmark(data.snapshot,examples,{...opts,seed});return {seed,baseline:r.metrics.baseline,candidate:r.metrics.candidate,deltas:r.deltas,confidence:r.confidence,promotionGates:r.promotion.gates,promotionStatus:r.promotion.status};});
 reports[language]={datasetFingerprint:sensitivity.datasetFingerprint,corpusFingerprint:sensitivity.corpusFingerprint,retrievalConfigurationFingerprint:sensitivity.retrievalConfigurationFingerprint,datasetProvenance:sensitivity.datasetProvenance,corpusIntegrity:sensitivity.corpusIntegrity,datasetIntegrity:sensitivity.datasetIntegrity,determinism:sensitivity.determinism,sensitivity:sensitivity.sensitivity,runs,promotion:{allowedAutomatically:false,status:'requires-independent-review'}};
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),evaluation:'independent-bilingual-holdout',mode:'offline-only; no-live-memory-mutation; no-auto-promotion',sourceDataset:{datasetId:provenance.datasetId,datasetVersion:provenance.datasetVersion,sourceRef:provenance.sourceRef,licenseId:provenance.licenseId,rawFileSha256:createHash('sha256').update(raw).digest('hex')},guardrails:{labelsInferredFromPredictions:false,holdoutUsedForTraining:false,sameCorpusForBaselineAndCandidate:true,languageScoresSeparated:true,promotionRequiresIndependentReview:true},reports};
const output=JSON.stringify(report,null,2)+'\n';
const out=flag('--out'); if(out) await writeFile(path.resolve(out),output,'utf8');
console.log(output);
