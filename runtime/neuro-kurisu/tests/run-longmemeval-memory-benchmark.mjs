import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_LONGMEMEVAL_REVISION, LONGMEMEVAL_DATASET_ID, LONGMEMEVAL_LICENSE_ID, ORIGINAL_LONGMEMEVAL_FILE_SHA256, REVIEWED_LONGMEMEVAL_DATASET_ID, REVIEWED_LONGMEMEVAL_FILE_SHA256, runLongMemEvalMemoryBenchmark } from '../src/organism/memory/LongMemEvalAdapter.ts';

const args=process.argv.slice(2);
const flag=(name)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const input=flag('--dataset');
if(!input){console.error('Usage: node --experimental-strip-types tests/run-longmemeval-memory-benchmark.mjs --dataset <path>/longmemeval_s_cleaned.json [--revision <40-char-sha>] [--expected-sha256 <sha256>] [--out <report.json>]');process.exit(2);}
const fileName=path.basename(input);
if(!['longmemeval_s_cleaned.json','longmemeval_s_reme_cleaned.json'].includes(fileName)){console.error('Use LongMemEval-S cleaned or reviewed cleaned-S JSON; do not pass M or oracle data to this adapter.');process.exit(2);}
const reviewed=fileName==='longmemeval_s_reme_cleaned.json';
const datasetId=flag('--dataset-id')??(reviewed?REVIEWED_LONGMEMEVAL_DATASET_ID:LONGMEMEVAL_DATASET_ID);
const revision=flag('--revision')??(reviewed?'':DEFAULT_LONGMEMEVAL_REVISION);
if(!/^[a-f0-9]{40}$/iu.test(revision)){console.error('A pinned 40-character --revision is required for the reviewed dataset; do not reuse the upstream revision.');process.exit(2);}
const expectedSha=(flag('--expected-sha256')??(reviewed?REVIEWED_LONGMEMEVAL_FILE_SHA256:ORIGINAL_LONGMEMEVAL_FILE_SHA256)).toLowerCase();
if(!/^[a-f0-9]{64}$/u.test(expectedSha)){console.error('--expected-sha256 must be a 64-character SHA-256 digest.');process.exit(2);}
let raw=await readFile(path.resolve(input),'utf8');
const datasetFileSha256=createHash('sha256').update(raw).digest('hex');
if(datasetFileSha256!==expectedSha){console.error('Dataset SHA-256 mismatch: expected '+expectedSha+' but received '+datasetFileSha256);process.exit(2);}
let rows=JSON.parse(raw);
raw='';
if(!Array.isArray(rows)){console.error('LongMemEval-S file must contain a JSON array.');process.exit(2);}
const report=runLongMemEvalMemoryBenchmark(rows,{
 datasetRevision:revision,
 datasetFileSha256,
 datasetId,
 datasetFileName:fileName,
 licenseId:flag('--license-id')??(reviewed?'not-verified':LONGMEMEVAL_LICENSE_ID),
});
rows=[];
const output=JSON.stringify(report,null,2)+'\n';
const out=flag('--out');
if(out)await writeFile(path.resolve(out),output,'utf8');
console.log(JSON.stringify({
 evaluation:report.evaluation,
 datasetFingerprint:report.sourceDataset.datasetFingerprint,
 fileSha256:report.sourceDataset.fileSha256,
 questions:report.sourceDataset.questionCount,
 sessions:report.sourceDataset.sessionCount,
 metrics:report.metrics,
 confidence:report.confidence,
 sampleAdequacy:report.sampleAdequacy,
 promotion:report.promotion,
 output:out??null,
},null,2));
