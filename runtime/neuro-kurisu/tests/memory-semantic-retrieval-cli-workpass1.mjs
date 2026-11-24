import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runner=path.join(root,'scripts/run-memory-semantic-retrieval-benchmark.mjs');
const temp=await mkdtemp(path.join(os.tmpdir(),'nk1-semantic-cli-'));
const now=2_000_000_000_000;
function runChild(args,env){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--experimental-strip-types',runner,...args],{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.setEncoding('utf8').on('data',x=>stdout+=x);child.stderr.setEncoding('utf8').on('data',x=>stderr+=x);
  child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,stdout,stderr}));
 });
}
const server=createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(req.method!=='POST'||req.url!=='/api/embed'){res.writeHead(404).end();return;}
 const embeddings=(body.input??[]).map(raw=>{
  const text=String(raw).toLowerCase();
  if(/qzxv|glarpen|unikora|orbital|nonsense/.test(text))return [0,0,1];
  if(/credential|password|login|authenticate|sign.in|account access|пароль|вход|аккаунт/.test(text))return [1,0,0];
  return [0,1,0];
 });
 res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({embeddings}));
});
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const endpoint='http://127.0.0.1:'+server.address().port;
 const memory=new MemoryOS2({embeddingProvider:null});
 for(let i=0;i<8;i++)memory.encode({id:'credential-'+i,content:'credential password recovery login authentication account access procedure number '+i,kind:'semantic',source:'semantic-cli-fixture',tags:[],context:{},salience:.6,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.1,socialRelevance:.1,predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-1000,observedAt:now-500,createdAt:now});
 for(let i=0;i<8;i++)memory.encode({id:'decoy-'+i,content:'network routing database avatar palette cooking landscape science unrelated record '+i,kind:'semantic',source:'semantic-cli-fixture',tags:[],context:{},salience:.5,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.1,socialRelevance:.1,predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-1000,observedAt:now-500,createdAt:now});
 const snapshotFile=path.join(temp,'snapshot.json'),labelsFile=path.join(temp,'labels.jsonl'),provenanceFile=path.join(temp,'provenance.json'),outFile=path.join(temp,'report.json');
 await writeFile(snapshotFile,JSON.stringify(memory.snapshot()));
 const examples=[
  ...Array.from({length:2},(_,i)=>({id:'en-train-'+i,query:'restore account password login procedure training '+i,relevantIds:['credential-'+i],split:'train',language:'en'})),
  ...Array.from({length:8},(_,i)=>({id:'en-holdout-'+i,query:'I cannot sign in to my account password access '+i,relevantIds:['credential-'+i],split:'holdout',language:'en'})),
  ...Array.from({length:2},(_,i)=>({id:'en-noanswer-'+i,query:'qzxv glarpen orbital nonsense token '+i,relevantIds:[],split:'holdout',answerable:false,language:'en'})),
  ...Array.from({length:2},(_,i)=>({id:'ru-train-'+i,query:'восстановить вход пароль аккаунт тренировка '+i,relevantIds:['credential-'+(i+2)],split:'train',language:'ru'})),
  ...Array.from({length:8},(_,i)=>({id:'ru-holdout-'+i,query:'не могу войти в аккаунт сбросить пароль '+i,relevantIds:['credential-'+i],split:'holdout',language:'ru'})),
  ...Array.from({length:2},(_,i)=>({id:'ru-noanswer-'+i,query:'qzxv glarpen орбитальный шифр nonsense '+i,relevantIds:[],split:'holdout',answerable:false,language:'ru'})),
 ];
 await writeFile(labelsFile,examples.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const provenance={datasetId:'semantic-cli-fixture',datasetVersion:'1.0.0',sourceRef:'test-only-loopback-fixture',labelingProtocol:'Synthetic local test only; not real quality evidence.',licenseId:'LicenseRef-NK1-TestFixture',contentSha256:fingerprintMemoryRetrievalDataset(examples)};
 await writeFile(provenanceFile,JSON.stringify(provenance));
 const args=['--snapshot',snapshotFile,'--labels',labelsFile,'--provenance',provenanceFile,'--out',outFile,'--now',String(now),'--seed','31','--bootstrap-samples','200'];
 const env={NK_EMBEDDINGS_ENABLED:'1',NK_EMBEDDINGS_PROVIDER:'ollama',NK_EMBEDDINGS_BASE_URL:endpoint,NK_EMBEDDINGS_MODEL:'fixture-embed',NK_EMBEDDINGS_TIMEOUT_MS:'3000'};
 const result=await runChild(args,env);
 assert.equal(result.code,0,'semantic runner failed: '+result.stderr+result.stdout);
 const report=JSON.parse(await readFile(outFile,'utf8'));
 assert.equal(report.semanticIndex.indexedItems,16);
 assert.equal(report.semanticSelection.semanticEnabledQueries,20);
 assert.equal(report.semanticSelection.abstainedQueries,4);
 assert.equal(report.metrics.semantic.unsupportedRetrievalCount,0);
 assert.equal(report.promotion.allowed,false);
 assert.equal(report.promotion.candidateAutomaticallyPromoted,false);
 assert.equal(report.promotion.liveStateChanged,false);
 assert.ok(!JSON.stringify(report).includes('qzxv glarpen'),'raw query text must not appear in report');
 const help=await runChild(['--help'],{NK_EMBEDDINGS_ENABLED:'0'});
 assert.equal(help.code,0);assert.match(help.stdout,/diagnostic only/i);
 const disabled=await runChild(args,{NK_EMBEDDINGS_ENABLED:'0'});
 assert.equal(disabled.code,2);assert.match(disabled.stderr,/local-embedding-provider-not-configured-or-unsafe/);
 console.log('MEMORY_SEMANTIC_RETRIEVAL_CLI_WORKPASS1=PASS',JSON.stringify({indexed:report.semanticIndex.indexedItems,queries:report.semanticSelection.queries,abstained:report.semanticSelection.abstainedQueries,recallDelta:report.metrics.deltas.recallAtK01,unsupported:report.metrics.semantic.unsupportedRetrievalCount,promotion:report.promotion.status}));
}finally{await new Promise(resolve=>server.close(()=>resolve()));await rm(temp,{recursive:true,force:true});}
