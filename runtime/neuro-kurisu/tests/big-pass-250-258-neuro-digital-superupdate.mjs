import assert from 'node:assert/strict';

import {SparsePredictiveGraph} from '../src/organism/system/SparsePredictiveGraph.ts';

import {LocalNeuralCreditAssigner} from '../src/organism/system/LocalNeuralCreditAssigner.ts';

import {MetaMemoryController} from '../src/organism/system/MetaMemoryController.ts';

import {SandboxedSelfRewriteEngine} from '../src/organism/system/SandboxedSelfRewriteEngine.ts';

import {SensorimotorCoSimulationEngine} from '../src/organism/system/SensorimotorCoSimulationEngine.ts';

import {DevelopmentalPhaseScheduler} from '../src/organism/system/DevelopmentalPhaseScheduler.ts';

import {SubstratePortabilityEngine} from '../src/organism/system/SubstratePortabilityEngine.ts';

import {LongitudinalOrganismBenchmarkEngine} from '../src/organism/system/LongitudinalOrganismBenchmarkEngine.ts';

import {HybridCausalPlasticityCompiler} from '../src/organism/system/HybridCausalPlasticityCompiler.ts';

import {NeuroDigitalEvolutionEngine} from '../src/organism/system/NeuroDigitalEvolutionEngine.ts';

import {OrganismCore} from '../src/organism/core/OrganismCore.ts';

import {MemoryStateStore} from '../src/organism/persistence/MemoryStateStore.ts';

const input={surprise01:.68,novelty01:.71,goalPressure01:.62,memorySalience01:.77,energy01:.86,causalUncertainty01:.29,predictionError01:.37,coherence01:.84,plasticity01:.63,stability01:.78,repeat01:.81,reliability01:.88,reward01:.73,capabilityGap01:.69,resource01:.84};

const sp=new SparsePredictiveGraph();
 for(let i=0;
i<12;
i++) sp.step({novelty01:.7,predictionError01:.35,coherence01:.82,sparsity01:.6});
 assert.ok(sp.summary().edges>0);

const lc=new LocalNeuralCreditAssigner();
 const l=lc.assign({predictionError01:.22,reward01:.82,eligibility01:.8,stability01:.78});
 assert.ok(l.credit01>.6);

const mm=new MetaMemoryController();
 for(let i=0;
i<12;
i++) mm.step({salience01:.72,repeat01:.82,reliability01:.88,load01:.34,uncertainty01:.2});
 assert.ok(mm.summary().retrievals>=12 && mm.summary().semanticCompression01>=0);

const rw=new SandboxedSelfRewriteEngine();
 const good=rw.propose({expectedGain01:.84,holdoutGain01:.79,risk01:.2,rollbackReady:true});
 const bad=rw.propose({expectedGain01:.9,holdoutGain01:.2,risk01:.8,rollbackReady:false});
 assert.equal(good.outcome,'validated');
 assert.equal(bad.outcome,'rollback');

const sm=new SensorimotorCoSimulationEngine();
 const sim1=sm.simulate({action01:.8,bodyState01:.85,expectedOutcome01:.8,observedOutcome01:.76});
 assert.ok(sim1.prediction01>.9);

const ps=new DevelopmentalPhaseScheduler();
 const stable=ps.decide({stability01:.84,causalConfidence01:.8,memoryLoad01:.2,capabilityGap01:.7,resource01:.86});
 const freeze=ps.decide({stability01:.15,causalConfidence01:.2,memoryLoad01:.9,capabilityGap01:.8,resource01:.18});
 assert.equal(freeze.phase,'stabilize');
 assert.ok(freeze.freeze01>stable.freeze01);

const port=new SubstratePortabilityEngine();
 const pp=port.assess({sourceStability01:.82,targetResource01:.86,stateComplexity01:.25,target:'mobile-cpu'});
 assert.ok(pp.portable01>.7);

const lb=new LongitudinalOrganismBenchmarkEngine();
 for(let i=0;
i<18;
i++) lb.observe({stability01:.8,transfer01:.72,identity01:.94,drift01:.08,holdout01:.81});
 assert.ok(lb.summary().episodes>=18);

const hc=new HybridCausalPlasticityCompiler();
 const commit=hc.compile({causal01:.86,localCredit01:.78,stability01:.82,plasticity01:.64,holdout01:.81,phaseFreeze01:.12});
 const block=hc.compile({causal01:.25,localCredit01:.3,stability01:.2,plasticity01:.9,holdout01:.2,phaseFreeze01:.8});
 assert.equal(commit.commit,true);
 assert.equal(block.commit,false);

const eng=new NeuroDigitalEvolutionEngine();
 for(let i=0;
i<30;
i++) eng.cycle(input);
 const e1=eng.summary();
 for(const k of ['sparsePredictive','localCredit','metaMemory','selfRewrite','sensorimotor','phaseScheduler','substratePortability','longitudinalBenchmark','hybridCompiler']) assert.ok(e1[k].cycles>=30,k);

const store=new MemoryStateStore();
 const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
 const core=new OrganismCore(store,cfg);
 await core.init();
 for(let i=0;
i<12;
i++) await core.autonomousHeartbeat(800000+i*10000);
 await core.flush();
 const s1=core.systemSnapshot();
 assert.ok(s1.neuroDigitalEvolution?.sparsePredictive?.cycles>=12);
 const core2=new OrganismCore(store,cfg);
 await core2.init();
 const s2=core2.systemSnapshot();
 assert.equal(s2.neuroDigitalEvolution?.sparsePredictive?.cycles,s1.neuroDigitalEvolution?.sparsePredictive?.cycles);
 assert.equal(s2.neuroDigitalEvolution?.selfRewrite?.proposals,s1.neuroDigitalEvolution?.selfRewrite?.proposals);

console.log(JSON.stringify({ pass:'BIG_PASS_250_258_NEURO_DIGITAL_SUPERUPDATE', verified:true, cycles:e1.cycles, sparseEdges:e1.sparsePredictive.edges, credits:e1.localCredit.assignments, rewriteValidated:e1.selfRewrite.validated, rewriteRollbacks:e1.selfRewrite.rollbacks, metaPrecision01:e1.metaMemory.meanPrecision01, sensorTransfer01:e1.sensorimotor.transfer01, phase:e1.phaseScheduler.phase, portability01:e1.substratePortability.meanPortability01, longitudinal:e1.longitudinalBenchmark.episodes, compilerCommits:e1.hybridCompiler.commits, restartPreserved:true }, null, 2));

