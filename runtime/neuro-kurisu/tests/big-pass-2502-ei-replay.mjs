import assert from 'node:assert/strict';
import { B2502EINeuralReplayField, defaultB2502State } from '../src/organism/cognition/B2502EINeuralReplayField.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map((a,i)=>[a,i===1?.72:i===2?.64:.48]));
const ctx=(s,t)=>Array.from({length:32},(_,i)=>((s*17+t*11+i*7)%37)/36);
const rows=[];
for(let seed=1;seed<=6;seed++){
  const n=new B2502EINeuralReplayField(); n.restore(defaultB2502State());
  for(let t=1;t<=220;t++){
    const x=ctx(seed,t%13); const r=n.beforeDecision({tick:t,context01:x,baseUtilities:base,latent01:x.slice(0,24),uncertainty01:t%9===0?.72:.22,novelty01:t%11===0?.78:.25,predictionError01:t%17===0?.62:.12,energy01:.76,motivation01:.58});
    n.afterOutcome({tick:t,action:r.selectedAction,reward01:r.selectedAction==='explore'&&t%13===0?.96:.37,predictionError01:t%17===0?.45:.12,verified01:t%5===0?1:0,salience01:.5});
  }
  const snap=n.snapshot(); const on=n.beforeDecision({tick:221,context01:ctx(seed,3),baseUtilities:base,uncertainty01:.3,novelty01:.4,predictionError01:.16,energy01:.7,motivation01:.6});
  const n2=new B2502EINeuralReplayField();n2.restore(snap); const restart=n2.beforeDecision({tick:221,context01:ctx(seed,3),baseUtilities:base,uncertainty01:.3,novelty01:.4,predictionError01:.16,energy01:.7,motivation01:.6});
  assert.ok(A.reduce((z,a)=>z+Math.abs(on.neuralUtility[a]-restart.neuralUtility[a]),0)<1e-10);
  const n3=new B2502EINeuralReplayField();n3.restore(snap); const lesion=n3.lesionFraction(.5); assert.ok(lesion.effect01>.001);
  assert.ok(snap.learningUpdates>0 && snap.prototypeCreates>0 && snap.replaySteps>0);
  rows.push({seed,lesion01:+lesion.effect01.toFixed(5),learningUpdates:snap.learningUpdates,prototypes:snap.prototypes.length,replay:snap.replay.length,eRate01:+snap.eRate01.toFixed(4),iRate01:+snap.iRate01.toFixed(4),sparsity01:+snap.sparsity01.toFixed(4)});
}
console.log(JSON.stringify({pass:true,status:'B2502_EI_REPLAY_PASS',minLesion01:Math.min(...rows.map(r=>r.lesion01)),rows},null,2));
