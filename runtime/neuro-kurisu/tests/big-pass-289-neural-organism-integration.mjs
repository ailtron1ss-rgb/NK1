import { B289NeuralOrganismIntegrationSpine } from '../src/organism/system/B289NeuralOrganismIntegrationSpine.ts';

const assert=(x,m)=>{if(!x)throw new Error(m)};
const s=new B289NeuralOrganismIntegrationSpine();
const base={tick:1,worldLatent:new Array(16).fill(.18),selfLatent:new Array(16).fill(.12),memoryLatent:new Array(12).fill(.08),goalVector:new Array(12).fill(.2),workspaceLatent:new Array(12).fill(.1),socialLatent:new Array(12).fill(.05),predictionError01:.22,uncertainty01:.28,novelty01:.34,energy01:.82,thermal01:.18,cognitiveCapacity01:.84,identityContinuity01:.82,autobiographicalContinuity01:.78,realityAlignment01:.78,agency01:.58,socialNeed01:.20,selectedAction:'explore'};
for(let i=0;i<240;i++){
  const out=s.step({...base,tick:i+1,novelty01:.25+((i%9)/30),uncertainty01:.20+((i%7)/24),predictionError01:.18+((i%11)/40),worldLatent:base.worldLatent.map((v,j)=>v+Math.sin(i*.07+j)*.04),goalVector:base.goalVector.map((v,j)=>v+(i%5===0?.08:0)*(j%3===0?1:-1))});
  s.learnFromOutcome({tick:i+1,action:out.proposedAction,reward01:out.proposedAction==='explore'?0.67:0.48,predictionError01:base.predictionError01,externalEvidence01:i%4===0?1:.4,identityContinuity01:base.identityContinuity01});
}
const diag=s.diagnostics();
assert(diag.cycles===240,'240 cycles');
assert(diag.learningUpdates===240,'240 learning updates');
assert(diag.activeSetSize>=4 && diag.activeSetSize<=9,'bounded active set');
assert(diag.integration01>0.2,'integration emerged');
assert(diag.personalityCoherence01>0.55,'personality coherence retained');
const before=s.actionBias('explore');
s.lesion(.85); const lesioned=s.actionBias('explore'); s.clearLesion(); const restored=s.actionBias('explore');
assert(Math.abs(before-lesioned)>0.005,'lesion has measurable causal effect');
assert(Math.abs(restored-before)<.01,'lesion cleared');
const snap=s.snapshot(); const r=new B289NeuralOrganismIntegrationSpine(); r.restore(snap); const d2=r.diagnostics();
assert(JSON.stringify(d2.traits)===JSON.stringify(diag.traits),'traits persist');
console.log(JSON.stringify({pass:true,diagnostics:diag,causalLesionDrop01:Math.abs(before-lesioned),restore:true},null,2));
