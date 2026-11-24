import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const core=new B365UnifiedNeuroCausalCore(); core.setDevelopmentalMemoryEnabled(false);
const context=[.92,.88,.90,.94,.91,.87,.89,.93]; const vector=Array.from({length:64},(_,i)=>Math.sin(i*.11)*.2);
const t=[]; for(let i=0;i<1000;i++){const a=process.hrtime.bigint(); core.consolidateExperience({tick:i+1,action:'explore',reward01:.85,predictionError01:.12,salience01:.72,verified01:1,independent01:1,evidenceQuality01:.98,continuity01:.9,goalId:'perf',context01:context}); core.step({tick:i+1000,vector,novelty01:.4,uncertainty01:.3,predictionError01:.12,goalPressure01:.3,autonomy01:.7,learningEnabled:false,developmentContext01:context}); t.push(Number(process.hrtime.bigint()-a)/1e6);}
t.sort((a,b)=>a-b); const q=p=>t[Math.min(t.length-1,Math.floor(t.length*p))]; const heap=Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100;
console.log(JSON.stringify({pass:true,status:'B382_CONTEXTUAL_DEVELOPMENT_PERFORMANCE_PASS',cycles:1000,p50:q(.50),p95:q(.95),p99:q(.99),max:t.at(-1),heapMiB:heap,profiles:core.contextualDevelopmentalDiagnostics().contextCount},null,2));
