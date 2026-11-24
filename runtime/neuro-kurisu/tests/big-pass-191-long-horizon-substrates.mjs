import assert from 'node:assert/strict';
import { MultiHorizonAllostasisSubstrate } from '../src/organism/cognition/MultiHorizonAllostasisSubstrate.ts';
const m=new MultiHorizonAllostasisSubstrate();
for(let t=0;t<1000;t++){
  const phase=(t%200)/200;
  m.observe({tick:t,at:700000+t,energy01:.55+.3*(1-phase),thermal01:.18+.38*phase,capacity01:.55+.25*(1-phase),load01:.25+.5*phase,arousal01:.55+.3*(1-phase),recoveryDebt01:.12+.45*phase,pressure01:.16+.62*phase,awake:t%83!==0,uncertainty01:.12+.4*phase,predictionError01:.08+.32*phase});
}
const q=m.globalState();
assert.equal(m.snapshot().samples,1000); assert(q.horizonErrors.every(Number.isFinite)); assert(q.modelMAE>=0&&q.modelMAE<=1);
const r=new MultiHorizonAllostasisSubstrate();r.restore(m.snapshot());assert.deepEqual(r.snapshot(),m.snapshot());
console.log(JSON.stringify({pass:191,longHorizon:1000,quality:q},null,2));
