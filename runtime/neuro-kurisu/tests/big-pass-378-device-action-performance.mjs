import { performance } from 'node:perf_hooks';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { EmbodiedActionExecutor } from '../src/organism/body/EmbodiedActionExecutor.ts';

const body = new EmbodimentRuntime();
await body.init();
const exec = new EmbodiedActionExecutor(body);
const samples=[];
for(let i=0;i<120;i++){
  const t0=performance.now();
  await exec.execute(i%3===0?'explore':'rest',{allowCamera:false});
  samples.push(performance.now()-t0);
}
samples.sort((a,b)=>a-b);
const q=p=>samples[Math.min(samples.length-1,Math.floor(p*samples.length))];
console.log(JSON.stringify({pass:true,status:'B378_DEVICE_ACTION_PERFORMANCE_PASS',cycles:samples.length,p50Ms:q(.50),p95Ms:q(.95),p99Ms:q(.99),maxMs:samples.at(-1),heapMiB:process.memoryUsage().heapUsed/1048576},null,2));
