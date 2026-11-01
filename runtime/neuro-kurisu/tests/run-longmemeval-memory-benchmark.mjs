import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_LONGMEMEVAL_REVISION, runLongMemEvalMemoryBenchmark } from '../src/organism/memory/LongMemEvalAdapter.ts';

const args=process.argv.slice(2);
const flag=(name)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const input=flag('--dataset');
if(!input){console.error('Usage: node --experimental-strip-types tests/run-longmemeval-memory-benchmark.mjs --dataset <path>/longmemeval_s_cleaned.json [--revision <40-char-sha>] [--out <report.json>]');process.exit(2);}
if(!['longmemeval_s_cleaned.json','longmemeval_s_reme_cleaned.json'].includes(path.basename(input))){console.error('Use LongMemEval-S cleaned or reviewed cleaned-S JSON; do not pass M or oracle data to this adapter.');process.exit(2);}
let raw=await readFile(path.resolve(input),'utf8');
const datasetFileSha256=createHash('sha256').update(raw).digest('hex');
let rows=JSON.parse(raw);
raw='';
if(!Array.isArray(rows)){console.error('LongMemEval-S file must contain a JSON array.');process.exit(2);}
const report=runLongMemEvalMemoryBenchmark(rows,{
 datasetRevision:flag('--revision')??DEFAULT_LONGMEMEVAL_REVISION,
 datasetFileSha256,
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
