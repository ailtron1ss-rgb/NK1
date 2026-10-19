import assert from 'node:assert/strict';
import { B288SocialPredictiveSelfOtherBrain } from '../src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts';
const n=new B288SocialPredictiveSelfOtherBrain();
for(let t=1;t<=120;t++) n.step(t%2?'A':'B',{selfLatent:Array(24).fill(.2),worldLatent:Array(24).fill(.3),goalVector:[.8,.2],futureSelf:Array(32).fill(.4),personalityVector:Array(24).fill(.1),relationshipLatent:t%2?[.8,.2]:[.2,.8],action:'respond',reward01:.8,predictionError01:.15,surprise01:.1,importance01:.7,socialState:{trust01:.75,warmth01:.7,predictability01:.8,guardedness01:.25,agency01:.6,intentUncertainty01:.2,relationshipStrength01:.7}});
const s=n.snapshot();const m=new B288SocialPredictiveSelfOtherBrain();m.restore(s);assert.deepEqual(m.snapshot(),s);console.log(JSON.stringify({pass:true,bytes:JSON.stringify(s).length,persons:s.persons.length}));
