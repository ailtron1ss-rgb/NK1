import assert from 'node:assert/strict';
import { NeuroDigitalFusionKernel } from '../src/organism/cognition/NeuroDigitalFusionKernel.ts';
import { PlasticityHomeostasisGovernor } from '../src/organism/system/PlasticityHomeostasisGovernor.ts';
import { CausalSelfExperimentLab } from '../src/organism/system/CausalSelfExperimentLab.ts';
import { DreamCounterfactualLaboratory } from '../src/organism/system/DreamCounterfactualLaboratory.ts';
import { CapabilitySelfModelGraph } from '../src/organism/system/CapabilitySelfModelGraph.ts';
import { NeuroSymbolicConceptCompiler } from '../src/organism/cognition/NeuroSymbolicConceptCompiler.ts';
import { NeuralMorphogenesisEngine } from '../src/organism/system/NeuralMorphogenesisEngine.ts';
import { HybridNeuroCognitiveLoop } from '../src/organism/system/HybridNeuroCognitiveLoop.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const fusion=new NeuroDigitalFusionKernel();
for(let i=0;i<18;i++) fusion.cycle({drive01:.72,predictionError01:.38,novelty01:.65,reward01:.72,plasticity01:.6});
const healthy=fusion.summary();
fusion.lesion(.92);const lesioned=fusion.cycle({drive01:.72,predictionError01:.38,novelty01:.65,reward01:.72,plasticity01:.6});
assert.ok(healthy.spikes>0); assert.ok(Math.abs(lesioned.spikeRate01-healthy.lastSpikeRate01)>.005 || lesioned.coherence01<healthy.coherence01);

const homeo=new PlasticityHomeostasisGovernor();
const calm=homeo.regulate({surprise01:.18,energy01:.88,thermal01:.08,memoryLoad01:.18,goalPressure01:.2});
const hot=homeo.regulate({surprise01:.84,energy01:.32,thermal01:.78,memoryLoad01:.72,goalPressure01:.81});
assert.ok(calm.plasticity01!==hot.plasticity01);assert.ok(hot.freeze01>calm.freeze01);

const lab=new CausalSelfExperimentLab();
const exp=lab.run({at:1,domain:'prediction',baseline01:.62,intervention01:.48,predictedDelta01:.07,minEffect01:.05,executed:true,evidenceClass:'observed',source:'controlled-test'});
const expBad=lab.run({at:2,domain:'prediction',baseline01:.62,intervention01:.61,predictedDelta01:.08,minEffect01:.05,executed:true,evidenceClass:'observed',source:'controlled-test'});
const synthetic=lab.run({at:3,domain:'prediction',baseline01:.62,intervention01:.45,predictedDelta01:.12,minEffect01:.05,executed:false,evidenceClass:'synthetic',source:'simulation'});
assert.equal(exp.verified,true);assert.equal(expBad.verified,false);assert.equal(synthetic.verified,false);assert.ok(lab.summary().verified===1);assert.ok(lab.summary().synthetic===1);

const dream=new DreamCounterfactualLaboratory();
const d=dream.rehearse({at:1,domain:'planning',prediction01:.82,alternative01:.84,uncertainty01:.12,resource01:.84});
assert.equal(d.promoted,true);assert.ok(dream.summary().promoted>=1);

const caps=new CapabilitySelfModelGraph();
const n1=caps.observe({skill:'prediction',success01:.86,confidence01:.8,difficulty01:.45});
const n2=caps.observe({skill:'unknown-hard',success01:.2,confidence01:.25,difficulty01:.92});
assert.ok(n2.gap01>n1.gap01);assert.equal(caps.summary().lastGap,'unknown-hard');

const compiler=new NeuroSymbolicConceptCompiler();
const c1=compiler.compile({label:'prediction',latent:Array(12).fill(.62),outcome01:.75,novelty01:.4});
const c2=compiler.compile({label:'prediction',latent:Array(12).fill(.64),outcome01:.8,novelty01:.4});
assert.ok(c1.label==='prediction');assert.ok(c2.confidence01>=c1.confidence01);assert.ok(compiler.summary().concepts===1);

const morph=new NeuralMorphogenesisEngine();
const m1=morph.adapt({at:1,demand01:.91,predictionError01:.76,energy01:.83,plasticity01:.7});
const before=m1.neurons;
const m2=morph.adapt({at:2,demand01:.04,predictionError01:.05,energy01:.25,plasticity01:.2});
assert.ok(m1.grew>0);assert.ok(m2.pruned>=0);assert.ok(m2.neurons>=before);

const hybrid=new HybridNeuroCognitiveLoop();
const h=hybrid.integrate({domain:'prediction',coherence01:.82,concept01:.8,causal01:.78,structuralFitness01:.74,plasticity01:.6,stability01:.72,capabilityGap01:.28});
assert.ok(h.integration01>.45);

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg); await core.init();
for(let i=0;i<18;i++) await core.autonomousHeartbeat(400000+i*10000);
await core.flush();
const s1=core.systemSnapshot();
for(const key of ['neuroDigitalFusion','plasticityHomeostasis','causalSelfExperimentLab','dreamCounterfactualLab','capabilitySelfModel','neuroSymbolicCompiler','neuralMorphogenesis','hybridNeuroCognitiveLoop']) assert.ok(s1[key],`${key} missing from Core snapshot`);
assert.ok(s1.neuroDigitalFusion.cycles>=1);assert.ok(s1.plasticityHomeostasis.cycles>=1);assert.ok(s1.causalSelfExperimentLab.cycles>=1);assert.ok(s1.dreamCounterfactualLab.cycles>=1);assert.ok(s1.capabilitySelfModel.cycles>=1);assert.ok(s1.neuroSymbolicCompiler.cycles>=1);assert.ok(s1.neuralMorphogenesis.cycles>=1);assert.ok(s1.hybridNeuroCognitiveLoop.cycles>=1);
const core2=new OrganismCore(store,cfg);await core2.init();const s2=core2.systemSnapshot();
for(const key of ['neuroDigitalFusion','plasticityHomeostasis','causalSelfExperimentLab','dreamCounterfactualLab','capabilitySelfModel','neuroSymbolicCompiler','neuralMorphogenesis','hybridNeuroCognitiveLoop']) assert.equal(s2[key]?.cycles,s1[key]?.cycles,`${key} restart mismatch`);
console.log(JSON.stringify({pass:'BIG_PASS_234_241_NEURO_DIGITAL_SUPERUPDATE',modules:{fusion:fusion.summary(),homeostasis:homeo.summary(),experiments:lab.summary(),dream:dream.summary(),capabilities:caps.summary(),compiler:compiler.summary(),morphogenesis:morph.summary(),hybrid:hybrid.summary()},core:{cycles:Object.fromEntries(['neuroDigitalFusion','plasticityHomeostasis','causalSelfExperimentLab','dreamCounterfactualLab','capabilitySelfModel','neuroSymbolicCompiler','neuralMorphogenesis','hybridNeuroCognitiveLoop'].map(k=>[k,s1[k]?.cycles])),restartPreserved:true},verified:true},null,2));
