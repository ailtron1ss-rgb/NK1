import assert from 'node:assert/strict';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
const p=new P64IntegratedOrganismDynamics();
for(let tick=1;tick<=36;tick++){
  p.arbitrate({tick,at:tick,signals:{identity01:.92,workspace01:.86,metacognitive01:.82,predictionError01:.18,uncertainty01:.72,novelty01:.92,grounding01:.9,causal01:.82,bodyEnergy01:.88,thermal01:.16,cognitiveCapacity01:.88,memoryPressure01:.18,socialNeed01:.12,goalPressure01:.55,realityGap01:.12,memoryHealth01:.88,agency01:.82,externalInput:false,identityDecision:'allow',p58Mode:'explore',p61Mode:'explore',p63Mode:'explore',retrievalQuality01:.82,conflictPressure01:.05,homeostaticPressure01:.08,homeostaticMode:'explore',goalFocus01:.62,goalStaleness01:.01},candidates:[{action:'explore',score:.9,confidence01:.8},{action:'verify',score:.72,confidence01:.82},{action:'reflect',score:.68,confidence01:.78},{action:'wait',score:.46,confidence01:.7},{action:'rest',score:.4,confidence01:.8}]});
}
const s=p.snapshot();
assert.ok(s.modeCounts.explore < 32,'explore monoculture should be interrupted');
assert.ok(Object.entries(s.modeCounts).filter(([k,v])=>k!=='explore'&&v>0).length>=1,'at least one alternate mode must emerge');
console.log(JSON.stringify({modeCounts:s.modeCounts,forcedDiversions:s.forcedDiversions}));
