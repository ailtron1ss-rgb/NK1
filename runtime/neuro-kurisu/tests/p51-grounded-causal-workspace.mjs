import { P51GroundedCausalWorkspace } from '../src/organism/world/P51GroundedCausalWorkspace.ts';
const p=new P51GroundedCausalWorkspace();
p.observe({at:1,text:'user asked about the laboratory',action:'verify',success01:.9,predictionConfidence01:.7,predictionError01:.2,selfLabel:'energy:.8',worldLabel:'location:lab',goals:['learn'],sceneObjects:['camera','desk'],facts:['quiet']});
p.counterfactual('explore',.6,.2,3,2); p.intervene('verification',.7,.9,3);
const b=p.broadcast(5),s=p.snapshot();
if(s.cycles!==1||s.branches.length!==1||s.broadcasts!==1) throw new Error('P51 accounting failed');
if(!b.concepts.length||b.hypotheses.length<1) throw new Error('P51 grounding failed');
for(const k of ['semanticCoverage01','causalReadiness01','groundingQuality01','selfWorldAlignment01']) if(!(s[k]>=0&&s[k]<=1)) throw new Error(`P51 ${k} out of range`);
console.log('P51 GROUNDED CAUSAL WORKSPACE PASS');
