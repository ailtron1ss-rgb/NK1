import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { B1701B2200UnifiedLifeContinuityCore, defaultB1701B2200State } from '../src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const makeInput=(tick,actionBias=0)=>({tick,context01:Array.from({length:48},(_,i)=>((tick+i)%17)/16),baseUtilities:Object.fromEntries(actions.map((a,i)=>[a,(i===tick%7?1:0)+actionBias])),priorBias:{respond:.02,explore:.01,verify:.03,rest:0,reflect:.01,wait:-.01,defer:0},uncertainty01:(tick%13)/12,predictionError01:(tick%9)/8,novelty01:(tick%19)/18,confidence01:.72,energy01:.7,cognitiveLoad01:.3,identityContinuity01:.95,subjectId:'perf-subject',identityFingerprint:'perf-id',activeGoalIds:['goal:perf'],intentionIds:['intent:perf'],activeProjectId:'perf',preferenceKeys:['pref:consistency'],valueKeys:['value:learning'],p84MomentId:`p:${tick}`,memoryAnchorIds:[`m:${tick%32}`],reward01:tick%3===0?.8:-.2});
const core=new B1701B2200UnifiedLifeContinuityCore();
core.restore(defaultB1701B2200State());
core.beginSession('perf-subject','',0,Date.now());
const xs=[];
for(let i=0;i<100;i++){const t0=performance.now();core.beforeDecision(makeInput(i));core.afterOutcome({tick:i,at:Date.now(),action:actions[i%7],context01:Array(48).fill(.5),nextContext01:Array(48).fill(.52),reward01:i%3===0?.8:-.2,predictionError01:.2,verified01:1,success01:i%3===0?1:0,goalIds:['goal:perf'],memoryIds:[`m:${i%32}`]});xs.push(performance.now()-t0);}
for(let i=100;i<3100;i++){const t0=performance.now();core.beforeDecision(makeInput(i));core.afterOutcome({tick:i,at:Date.now(),action:actions[i%7],context01:Array(48).fill(.5),nextContext01:Array(48).fill(.52),reward01:i%3===0?.8:-.2,predictionError01:.2,verified01:1,success01:i%3===0?1:0,goalIds:['goal:perf'],memoryIds:[`m:${i%32}`]});xs.push(performance.now()-t0);}
xs.sort((a,b)=>a-b);const mean=xs.reduce((a,b)=>a+b,0)/xs.length;const p95=xs[Math.floor(xs.length*.95)];const p99=xs[Math.floor(xs.length*.99)];const max=xs.at(-1);assert.ok(Number.isFinite(mean)&&mean<5);assert.ok(p95<10);console.log('B1701_B2200_PERFORMANCE_PASS');console.log(JSON.stringify({cycles:xs.length,meanMs:+mean.toFixed(4),p95Ms:+p95.toFixed(4),p99Ms:+p99.toFixed(4),maxMs:+max.toFixed(4)}));
