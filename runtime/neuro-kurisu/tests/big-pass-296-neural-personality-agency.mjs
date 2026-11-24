import { B296NeuralPersonalityAgencyNucleus } from '../src/organism/system/B296NeuralPersonalityAgencyNucleus.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const assert=(x,m)=>{if(!x)throw new Error(m)};
const q=new B296NeuralPersonalityAgencyNucleus();
let last;
for(let tick=1;tick<=384;tick++){
  last=q.step({tick,currentAction:tick%3===0?'explore':'verify',b269Assembly:Array.from({length:16},(_,i)=>i%5===0?.7:0),b270SelfLatent:Array.from({length:12},(_,i)=>Math.sin(i+tick*.01)*.35),b289Latent:Array.from({length:24},(_,i)=>Math.cos(i*.13+tick*.008)*.25),b291Agency01:.72,b291IdentityFit01:.81,b291PersonalityFit01:.79,b293PredictedSelf01:.72,b293PredictedWorld01:.68,b293PredictionError01:.21,b294CausalConfidence01:.72,b295Budget01:.7,novelty01:.43,uncertainty01:.31,energy01:.79,goalPressure01:.55});
  if(tick%8===0) q.learnFromOutcome({tick,action:tick%2?'explore':'verify',reward01:tick%16? .73:.34,predictionError01:tick%16? .18:.58,identityContinuity01:.84,causalConfidence01:.72,externalEvidence01:.9});
}
const d=q.diagnostics();
assert(d.cycles===384,'cycle count');
assert(d.learningUpdates===48,'learning count');
assert(d.synapticUpdates>0,'neural synapses did not learn');
assert(d.spikes>0,'no spikes emitted');
assert(d.activeSynapses>0,'all synapses inactive');
assert(d.homeostaticError01<.25,'homeostasis diverged');
assert(Object.values(last.actionBias).every(Number.isFinite),'non-finite action bias');

const runtime=new OrganismRuntime({stateFile:'b296-test.json',worldStateFile:'b296-world.json',enableLanguage:false,performanceProfile:'mobile',stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
await runtime.init();
for(let i=0;i<40;i++) await runtime.step(i%5===0?'Investigate a surprising claim and verify it.':undefined);
const core=runtime.core;
const rd=core.b296NeuralPersonalityAgencyDiagnostics();
const snap=core.snapshot();
assert(rd.cycles>0,'B296 did not enter OrganismCore cycle');
assert(Boolean(snap.system.neuralPersonalityAgencyNucleusB296),'B296 persistence missing');
assert(Number.isFinite(core.b296NeuralPersonalityAgencyBias('explore')),'B296 core bias not finite');
const before=core.b296NeuralPersonalityAgencyBias('explore');
core.b296NeuralPersonalityAgencyLesion(.8);
const afterLesion=core.b296NeuralPersonalityAgencyBias('explore');
assert(Math.abs(afterLesion)<=Math.abs(before)+.05,'lesion does not reduce readout');
core.b296NeuralPersonalityAgencyClearLesion();
console.log(JSON.stringify({pass:true,standalone:{cycles:d.cycles,learningUpdates:d.learningUpdates,spikes:d.spikes,synapticUpdates:d.synapticUpdates,activeSynapses:d.activeSynapses,homeostaticError01:d.homeostaticError01,developmentalReadiness01:d.developmentalReadiness01},core:{cycles:rd.cycles,learningUpdates:rd.learningUpdates,agency01:rd.agency01,personalityCoherence01:rd.personalityCoherence01,developmentalReadiness01:rd.developmentalReadiness01}}));
await runtime.stop();
