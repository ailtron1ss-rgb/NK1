import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const assert=(x,m)=>{if(!x)throw new Error(m)};
const store=new MemoryStateStore();
const makeRuntime=()=>new OrganismRuntime({stateFile:'b298-closed-loop.json',worldStateFile:'b298-world.json',enableLanguage:false,performanceProfile:'mobile',stateStore:store,worldStateStore:store,journal:new BoundedOperationalJournal()});

const r=makeRuntime();
await r.init();
const initialB296=r.core.b296NeuralPersonalityAgencySnapshot();
const initialDreams=r.core.snapshot().facets.advanced.microDreams?.dreams?.length??0;

for(let i=0;i<36;i++) await r.step(i%9===0?'Investigate an uncertain claim and verify the consequences.':undefined);

const afterB296=r.core.b296NeuralPersonalityAgencySnapshot();
const afterDiag=r.core.b296NeuralPersonalityAgencyDiagnostics();
const ownership=r.core.b298ActionOwnershipDiagnostics();
const world=r.core.worldModel2Snapshot();
const dreams=r.core.snapshot().facets.advanced.microDreams?.dreams??[];

assert(afterB296.cycles>initialB296.cycles,'B296 did not execute in the live closed loop');
assert(afterDiag.learningUpdates>initialB296.learningUpdates,'B296 did not learn from live world transitions');
assert(afterDiag.learningEligibleCycles>0,'B296 learning gate never opened');
assert(afterDiag.synapticUpdates>0,'B296 synapses never changed');
assert(world.learnedTransitions>0,'world model did not learn transitions');
assert(dreams.length>initialDreams,'micro-dream did not execute');
assert(dreams.every(d=>d.confidence>=0 && d.confidence<=1),'micro-dream confidence out of bounds');
assert(new Set(dreams.map(d=>Number(d.confidence).toFixed(4))).size>1,'micro-dream confidence is still effectively constant');
assert(ownership.cycles>0,'action ownership graph did not execute');
assert(ownership.postB297Mutations>0,'post-B297 score mutation provenance was not observed');
assert(ownership.unauthorizedAfterFinalizer===0,'action ownership graph detected mutation after declared finalization');

const biasBefore=r.core.b296NeuralPersonalityAgencyBias('explore');
r.core.b296NeuralPersonalityAgencyLesion(.85);
const biasLesioned=r.core.b296NeuralPersonalityAgencyBias('explore');
r.core.b296NeuralPersonalityAgencyClearLesion();
assert(Math.abs(biasLesioned)<=Math.abs(biasBefore)+.05,'B296 lesion did not suppress its behavioral readout');

const persistedB296=structuredClone(afterB296);
const { B296NeuralPersonalityAgencyNucleus } = await import('../src/organism/system/B296NeuralPersonalityAgencyNucleus.ts');
const restoredNucleus=new B296NeuralPersonalityAgencyNucleus();
restoredNucleus.restore(persistedB296);
assert(restoredNucleus.diagnostics().learningUpdates>=afterDiag.learningUpdates,'B296 learning did not survive state restore');

await r.stop();
console.log(JSON.stringify({pass:true,liveClosedLoop:{cycles:afterDiag.cycles,learningUpdates:afterDiag.learningUpdates,learningEligibleCycles:afterDiag.learningEligibleCycles,learningSuppressedCycles:afterDiag.learningSuppressedCycles,synapticUpdates:afterDiag.synapticUpdates,lastLearningGate01:afterDiag.lastLearningGate01},worldModel:{learnedTransitions:world.learnedTransitions,readyForLearning:world.readyForLearning},dreams:{count:dreams.length,confidences:dreams.slice(-6).map(d=>d.confidence)},ownership:{cycles:ownership.cycles,postB297Mutations:ownership.postB297Mutations,unauthorizedAfterFinalizer:ownership.unauthorizedAfterFinalizer},lesion:{before:biasBefore,after:biasLesioned},restore:{learningUpdates:restoredNucleus.diagnostics().learningUpdates}}));
