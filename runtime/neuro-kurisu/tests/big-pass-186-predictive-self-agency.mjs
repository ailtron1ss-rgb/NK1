import assert from 'node:assert/strict';
import { PredictiveSelfAgencySubstrate } from '../src/organism/cognition/PredictiveSelfAgencySubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const state=(tick,at)=>({tick,at,needs:{energy:.82,cognitiveLoad:.22,uncertainty:.28,novelty:.46,goalPressure:.58,socialNeed:.24,identityCoherence:.91}});
const input=(tick,at,requested=false)=>({
  self:[.91,.84,.63,.78,.87,.13],body:[.82,.17,.8],world:[.24,.71,.49,.66],memory:[.62,.77,.31,.54],motivation:[.58,.26,.42,.49],state:state(tick,at),externalRequested:requested
});

const brain=new PredictiveSelfAgencySubstrate();
let last;
for(let i=0;i<96;i++){
  last=brain.observe(input(i,1000+i,i%5===0));
  const action=i%2?'explore':'verify';
  brain.predict(action);
  brain.learnOutcome(action, i%3===0?.84:.61, state(i,1000+i), i%5===0, .72);
}
const q=brain.agencyDiagnostics();
assert(q.samples>=192);
assert(Number.isFinite(q.predictionError01));
assert(Number.isFinite(q.agencyConfidence01));
assert(q.ownership01>=0&&q.ownership01<=1);
assert(last?.latent.length===24);

const snap=brain.snapshot();
const restored=new PredictiveSelfAgencySubstrate();
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap,'predictive self/agency snapshot must restore exactly');

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick)=>({tick,location:'self-agency-lab',energy:.84,attention:.8,uncertainty:.2,facts:['self','agency','prediction'],objects:['agent'],events:['action']});
for(let i=0;i<3;i++){
  await core.observe({text:`self agency test ${i}`,novelty:.6,worldContext:world(i)});
  await core.feedback({success:i===1?.81:.72,reward:.73,surprise:.12,worldTransition:{action:'explore',before:world(i),after:world(i+1),reward:.73,surprise:.12,at:50000+i}});
}
const s=core.snapshot();
assert((s.facets.cognition.predictiveSelfAgency?.learningSteps??0)>=3,'predictive self substrate must be live in core');
assert((s.facets.cognition.predictiveSelfAgency?.predictionSamples??0)>=3,'predictive self substrate must observe core cycles');
assert(Number.isFinite(s.facets.cognition.predictiveSelfAgency?.lastAt??NaN),'predictive self state must track canonical time');
console.log(JSON.stringify({pass:186,standalone:{samples:q.samples,agencyConfidence01:q.agencyConfidence01,ownership01:q.ownership01,authorship01:q.authorship01,predictionError01:q.predictionError01},core:{learningSteps:s.facets.cognition.predictiveSelfAgency?.learningSteps,predictionSamples:s.facets.cognition.predictiveSelfAgency?.predictionSamples,ownership01:s.facets.cognition.predictiveSelfAgency?.ownership01,authorship01:s.facets.cognition.predictiveSelfAgency?.authorship01}},null,2));
