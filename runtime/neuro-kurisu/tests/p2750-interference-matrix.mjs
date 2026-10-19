import assert from 'node:assert/strict';
import { P2750UnifiedCausalWorldLoop } from '../src/organism/cognition/P2750UnifiedCausalWorldLoop.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.28+i*.05]));
const latent=(ctx,t)=>Array.from({length:8},(_,k)=>.62*Math.sin((k+1)*.31+t*.017+ctx*1.13)+.11*ctx+.05*Math.cos(t*.07+k*.19));
function run(seq){
  const c=new P2750UnifiedCausalWorldLoop();
  const ids=[];
  for(let t=0;t<seq.length;t++){
    const ctx=seq[t];
    const l=latent(ctx,t), high=(t%29===0||ctx===3);
    const d=c.beforeDecision({tick:t,latent:l,baseUtilities:base,novelty01:high?.78:.18+.05*(ctx%3),uncertainty01:high?.71:.26+.04*(ctx%2),predictionError01:high?.63:.18+.03*(ctx%4),resource01:.74,goalPressure01:.45,identityGap01:.16});
    ids.push(d.contextId);
    const action=ctx===0?'respond':ctx===1?'verify':ctx===2?'explore':ctx===3?'reflect':'wait';
    const next=latent(ctx,t+1);
    const reward=((action==='respond'&&ctx===0)||(action==='verify'&&ctx===1)||(action==='explore'&&ctx===2)||(action==='reflect'&&ctx===3)||(action==='wait'&&ctx>=4))?.90:.58;
    c.observeOutcome({tick:t+1,latentBefore:l,latentAfter:next,action,reward01:reward,predictionError01:1-reward,novelty01:high?.78:.2,uncertainty01:high?.68:.3,verified01:reward>.8?1:.7,contextId:d.contextId});
    const synthetic=c.syntheticReplay(1);if(synthetic.length)c.noteSyntheticCredit(synthetic[0].confidence01*(.5+synthetic[0].priority01*.5));
  }
  return {c,m:c.metrics(),ids};
}

const seq=[...Array.from({length:90},()=>0),...Array.from({length:90},()=>1),...Array.from({length:90},()=>2),...Array.from({length:90},()=>0),...Array.from({length:90},()=>1),...Array.from({length:90},()=>3),...Array.from({length:90},()=>2),...Array.from({length:90},()=>0)];
const {c,m,ids}=run(seq);
assert.ok(m.contextSwitches>=4,'too few context switches');
assert.ok(m.contextVisits.filter(x=>x>0).length>=4,'context matrix collapsed');
assert.ok(m.contextVisits[0]>100,'return-to-A context was not retained');
assert.ok(m.causalStrength.flat().some(x=>x>.001),'causal strength never developed');
assert.ok(m.fast.writes>=seq.length,'fast memory write count mismatch');
assert.ok(m.medium.confidence01>.15&&m.slow.confidence01>.15,'slow/medium memory confidence inert');
assert.ok(m.memoryConsensus01>=0&&m.memoryConsensus01<=1);
assert.ok(m.syntheticReplayUsed>20,'model-generated experience transfer did not activate');
assert.ok(ids.filter((id,i)=>i>270&&id!==ids[i-1]).length>0,'no regime return was detected');
console.log(`P2750_INTERFERENCE_MATRIX=PASS outcomes=${m.outcomes} contexts=${m.contextVisits.filter(x=>x>0).length} switches=${m.contextSwitches} `+
`A_visits=${m.contextVisits[0]} memory=${m.memoryConsensus01.toFixed(4)} world=${m.worldConfidence01.toFixed(4)} causal=${m.causalCredit01.toFixed(4)} synth=${m.syntheticReplayUsed}`);
