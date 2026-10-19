import { AdaptiveMemoryPolicy } from '../src/organism/developmental/AdaptiveMemoryPolicy.ts';

const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const policies=['semantic','hybrid','causal','temporal','balanced'];
const contexts=[
  {name:'semantic',goal01:.9,causal01:.1,temporal01:.1,pressure01:.1,mobile:true},
  {name:'hybrid',goal01:.1,causal01:.1,temporal01:.1,pressure01:.1,mobile:true},
  {name:'causal',goal01:.2,causal01:.9,temporal01:.1,pressure01:.2,mobile:true},
  {name:'temporal',goal01:.2,causal01:.1,temporal01:.9,pressure01:.2,mobile:true},
  {name:'balanced',goal01:.5,causal01:.5,temporal01:.5,pressure01:.8,mobile:true},
];
function reward(context,policy){return policy===context.name?.93:.34;}
function outcome(context,policy){const r=reward(context,policy);return {quality01:r,retention01:clamp(r*.94),transfer01:clamp(r*.88+.05),interference01:policy===context.name?1:.72,computeCost01:{semantic:.10,hybrid:.18,causal:.24,temporal:.16,balanced:.14}[policy],delayed01:r};}

const policy=new AdaptiveMemoryPolicy();
const train=200;
for(let i=0;i<train;i++){
  const context=contexts[i%contexts.length];
  const chosen=policy.choose(context,1000+i);
  policy.observeOutcome(chosen,outcome(context,chosen),1000+i);
}
const selections=contexts.map(context=>({context:context.name,chosen:policy.choose(context,999999),expected:context.name}));
const accuracy=selections.filter(x=>x.chosen===x.expected).length/selections.length;
const diagnostics=policy.diagnostics();
if(accuracy<.8) throw new Error(`contextual selection accuracy too low: ${accuracy}`);
if(diagnostics.contextCount<5) throw new Error('context-local state was not created');
if(diagnostics.trials.semantic<2||diagnostics.trials.hybrid<2||diagnostics.trials.causal<2||diagnostics.trials.temporal<2||diagnostics.trials.balanced<2) throw new Error('global trial counters invalid');
const sameContext=policy.choose(contexts[0],1000);
const otherContext=policy.choose(contexts[1],1000);
if(!sameContext||!otherContext) throw new Error('cross-context cooldown returned no action');
console.log('P2696_CONTEXTUAL_POLICY='+JSON.stringify({version:'P2696',train,accuracy,selections,contextCount:diagnostics.contextCount,trials:diagnostics.trials,weights:diagnostics.weights}));
