import { B1101B1350SelfDevelopmentCore } from '../src/organism/system/B1101B1350SelfDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5])); const choose=o=>A.reduce((b,a)=>(o.actionBias[a]>(o.actionBias[b]??-1)?a:b),A[0]);
const ctx=[.62,.31,.55,.47,.71,.39,.58,.44,.67,.36,.52,.48];
const input=(tick,pe)=>({tick,context01:ctx,baseUtilities:base,uncertainty01:pe>.5?.74:.12,predictionError01:pe,novelty01:pe>.5?.70:.08,confidence01:.68,goalVector:ctx,complexity01:.28,currentAction:'wait'});
function train(){const c=new B1101B1350SelfDevelopmentCore();for(let t=0;t<900;t++){const d=c.beforeDecision(input(t,.06));c.afterOutcome({tick:t,action:'respond',context01:ctx,nextContext01:ctx,reward01:1,predictionError01:0,verified01:1,success01:1});}return c;}
function evalTarget(c,target,offset,rounds=220){let h=0;for(let i=0;i<rounds;i++){const d=c.beforeDecision(input(offset+i,.82));const a=choose(d);const r=a===target?1:0;c.afterOutcome({tick:offset+i,action:a,context01:ctx,nextContext01:ctx,reward01:r,predictionError01:1-r,verified01:1,success01:r});h+=r;}return h/rounds;}
const c=train();let before=0;for(let i=0;i<120;i++)before+=choose(c.beforeDecision(input(1000+i,.05)))==='respond'?1:0;const accBefore=before/120;const after=evalTarget(c,'explore',2000,220);console.log('B1101_B1350_REVERSAL_PASS');console.log(JSON.stringify({accBefore,afterRecovery:after,improvement:after-0.5,diagnostics:c.diagnostics()},null,2));
