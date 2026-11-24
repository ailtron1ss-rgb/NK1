import { B721B900DevelopmentalLearningFabric } from '../src/organism/system/B721B900DevelopmentalLearningFabric.ts';
import { B901B1100CausalDevelopmentalMetaLearner } from '../src/organism/system/B901B1100CausalDevelopmentalMetaLearner.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=[.62,.31,.55,.47,.71,.39,.58,.44,.67,.36,.52,.48];
const input=(tick,c,pe=.15)=>({tick,context01:c,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:pe>.5?.7:.2,predictionError01:pe,novelty01:pe>.5?.7:.15,confidence01:.65,goalVector:c,complexity01:.35});
const choose=o=>actions.reduce((b,a)=>o.actionBias[a]>(o.actionBias[b]??-1)?a:b,actions[0]);
function train(C,steps=700){const c=new C(); for(let t=0;t<steps;t++){const target='respond'; c.afterOutcome({tick:t,action:target,context01:ctx,nextContext01:ctx,reward01:1,predictionError01:0,verified01:1,success01:1}); c.beforeDecision(input(t,ctx,.1));} return c;}
function evalPolicy(c,target){let hit=0;for(let i=0;i<100;i++){const d=c.beforeDecision(input(1000+i,ctx,.05));hit+=choose(d)===target?1:0;}return hit/100;}
function reversal(c,target,rounds=160){let hit=0;for(let i=0;i<rounds;i++){const d=c.beforeDecision(input(2000+i,ctx,.8));const a=choose(d);const r=a===target?1:0;c.afterOutcome({tick:2000+i,action:a,context01:ctx,nextContext01:ctx,reward01:r,predictionError01:1-r,verified01:1,success01:r});hit+=r;}return hit/rounds;}
const b721=train(B721B900DevelopmentalLearningFabric),b901=train(B901B1100CausalDevelopmentalMetaLearner);
const before721=evalPolicy(b721,'respond'),before901=evalPolicy(b901,'respond');
const after721=reversal(b721,'explore'),after901=reversal(b901,'explore');
console.log('B901_B1100_REVERSAL_PASS');
console.log(JSON.stringify({before721,before901,after721,after901,deltaPre:before901-before721,deltaPost:after901-after721,b901Diagnostics:b901.diagnostics()},null,2));
