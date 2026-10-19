import { AdaptiveMemoryPolicy } from '../src/organism/developmental/AdaptiveMemoryPolicy.ts';
import { CausalReplayCreditAssigner } from '../src/organism/system/CausalReplayCreditAssigner.ts';

const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const policies=['semantic','hybrid','causal','temporal','balanced'];
const contexts=[
  {name:'semantic',goal:.9,causal:.1,temporal:.1,pressure:.1,mobile:true,best:'semantic'},
  {name:'hybrid',goal:.1,causal:.1,temporal:.1,pressure:.1,mobile:true,best:'hybrid'},
  {name:'causal',goal:.2,causal:.9,temporal:.1,pressure:.2,mobile:true,best:'causal'},
  {name:'temporal',goal:.2,causal:.1,temporal:.9,pressure:.2,mobile:true,best:'temporal'},
  {name:'balanced',goal:.5,causal:.5,temporal:.5,pressure:.8,mobile:true,best:'balanced'},
];

function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
function latent(ctx,p){
  const base=p===ctx.best?.93:.34;
  const mismatch=(p===ctx.best?0:1);
  const pressurePenalty=ctx.pressure>.65 && p==='semantic'?.08:0;
  const cost={semantic:.10,hybrid:.18,causal:.24,temporal:.16,balanced:.14}[p];
  return {quality:clamp(base-pressurePenalty),retention:clamp(base*.94),transfer:clamp(base*.88+.05),interference:clamp(1-(mismatch*.28)),cost};
}
function noisy(v,r,spread=.08){return clamp(v+(r()-.5)*spread);}
function outcome(ctx,p,r,delayed=false){const l=latent(ctx,p);const q=noisy(l.quality,r,delayed?.025:.16);const ret=noisy(l.retention,r,delayed?.02:.14);const tr=noisy(l.transfer,r,delayed?.02:.14);const int=noisy(l.interference,r,delayed?.02:.12);return {quality01:q,retention01:ret,transfer01:tr,interference01:int,computeCost01:l.cost,delayed01:delayed?clamp(.55*q+.25*ret+.12*tr+.08*int):q};}
function score(o){return clamp(.32*o.quality01+.18*o.retention01+.16*o.transfer01+.14*o.interference01+.16*o.delayed01-.04*o.computeCost01);}

function runArm(kind,seed){
  const r=rng(seed+17), adaptive=!kind.startsWith('fixed-');
  const fixedPolicy=kind.startsWith('fixed-')?kind.slice(6):null;
  const policy=adaptive?new AdaptiveMemoryPolicy():null;
  const credit=kind==='adaptive+causal-credit'?new CausalReplayCreditAssigner():null;
  const stats={reward:0,quality:0,retention:0,transfer:0,interference:0,cost:0,correct:0,steps:0,delayed:0,credit:0};
  const trainPerContext=32, evalN=160;
  let i=0;
  for(const c of contexts) for(let round=0;round<trainPerContext;round++,i++){
    const chosen=adaptive?policy.choose({pressure01:c.pressure,goal01:c.goal,causal01:c.causal,temporal01:c.temporal,mobile:c.mobile}):fixedPolicy;
    const immediate=outcome(c,chosen,r,false);
    if(adaptive) policy.observeOutcome(chosen,immediate);
    if(kind==='adaptive+causal-credit'){
      const v=outcome(c,chosen,r,true);
      const cr=credit.assign({memoryId:`m${i%24}`,replayEventId:`replay-${i}`,validationId:`v${i}`,replayAt:i,validationAt:i+1,delayMs:1,retentionGain01:v.retention01,transferPotential01:v.transfer01,interferenceRisk01:1-v.interference01,learningOpportunity01:v.transfer01,priorityAfter01:v.delayed01,independentVerified:true});
      if(cr&&adaptive) policy.observe(chosen,clamp(.25*immediate.quality01+.25*immediate.retention01+.20*immediate.transfer01+.30*cr.credit01));
    }
  }
  for(let j=0;j<evalN;j++){
    const c=contexts[j%contexts.length];
    const chosen=adaptive?policy.choose({pressure01:c.pressure,goal01:c.goal,causal01:c.causal,temporal01:c.temporal,mobile:c.mobile}):fixedPolicy;
    const truth=outcome(c,chosen,r,true);
    stats.steps++;stats.reward+=score(truth);stats.quality+=truth.quality01;stats.retention+=truth.retention01;stats.transfer+=truth.transfer01;stats.interference+=truth.interference01;stats.cost+=truth.computeCost01;stats.delayed+=truth.delayed01;stats.correct+=chosen===c.best?1:0;
  }
  if(credit) stats.credit=credit.diagnostics().meanCredit01;
  for(const k of ['reward','quality','retention','transfer','interference','cost','delayed','correct'])stats[k]/=stats.steps;
  return stats;
}

const arms=['fixed-semantic','fixed-hybrid','fixed-causal','fixed-temporal','fixed-balanced','adaptive','adaptive+causal-credit'];
const rows=[];
for(const arm of arms){
  const all=[];for(let seed=1;seed<=5;seed++)all.push(runArm(arm,seed));
  const mean=k=>all.reduce((a,x)=>a+x[k],0)/all.length;
  rows.push({arm,reward:mean('reward'),quality:mean('quality'),retention:mean('retention'),transfer:mean('transfer'),interference:mean('interference'),compute:mean('cost'),delayed:mean('delayed'),selectionAccuracy:mean('correct'),causalCredit:mean('credit')});
}
const adaptive=rows.find(x=>x.arm==='adaptive'), causal=rows.find(x=>x.arm==='adaptive+causal-credit');
const fixedBest=Math.max(...rows.filter(x=>x.arm.startsWith('fixed-')).map(x=>x.reward));
const report={version:'P2694',seeds:5,trainSteps:160,evalSteps:160,rows,deltaAdaptivePlusCreditVsAdaptive:{reward:causal.reward-adaptive.reward,retention:causal.retention-adaptive.retention,transfer:causal.transfer-adaptive.transfer,delayed:causal.delayed-adaptive.delayed,selectionAccuracy:causal.selectionAccuracy-adaptive.selectionAccuracy},fixedBestReward:fixedBest,peakRssMB:Math.round(process.memoryUsage().rss/1024/1024*10)/10};
if(!rows.every(x=>Number.isFinite(x.reward)&&x.reward>=0&&x.reward<=1))throw new Error('invalid benchmark reward');
if(!(causal.delayed>=0&&causal.delayed<=1))throw new Error('invalid delayed signal');
console.log('P2694_POLICY_ABLATION='+JSON.stringify(report));
