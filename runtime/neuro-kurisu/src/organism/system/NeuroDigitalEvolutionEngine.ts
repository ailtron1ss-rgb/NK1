import {NeuralEcologyRouter} from './NeuralEcologyRouter.ts';

import {DualTimescaleMemoryBridge} from './DualTimescaleMemoryBridge.ts';

import {NeuralPhaseTransitionDetector} from './NeuralPhaseTransitionDetector.ts';

import {SelfGeneratedCurriculumEngine} from './SelfGeneratedCurriculumEngine.ts';

import {CounterfactualWorldCompiler} from './CounterfactualWorldCompiler.ts';

import {NeuralMorphogeneticConstraintSolver} from './NeuralMorphogeneticConstraintSolver.ts';

import {NeuralDigitalCoevolutionController} from './NeuralDigitalCoevolutionController.ts';

import {UnifiedDevelopmentalCompiler} from './UnifiedDevelopmentalCompiler.ts';

import {SparsePredictiveGraph} from './SparsePredictiveGraph.ts';

import {LocalNeuralCreditAssigner} from './LocalNeuralCreditAssigner.ts';

import {MetaMemoryController} from './MetaMemoryController.ts';

import {SandboxedSelfRewriteEngine} from './SandboxedSelfRewriteEngine.ts';

import {SensorimotorCoSimulationEngine} from './SensorimotorCoSimulationEngine.ts';

import {DevelopmentalPhaseScheduler} from './DevelopmentalPhaseScheduler.ts';

import {SubstratePortabilityEngine} from './SubstratePortabilityEngine.ts';

import {LongitudinalOrganismBenchmarkEngine} from './LongitudinalOrganismBenchmarkEngine.ts';

import {HybridCausalPlasticityCompiler} from './HybridCausalPlasticityCompiler.ts';


export interface NeuroDigitalEvolutionState{
 version:1;
 cycles:number;
 lastOperation:string;
 lastChannel:string;

 neuralEcology:ReturnType<NeuralEcologyRouter['snapshot']>;

 dualMemory:ReturnType<DualTimescaleMemoryBridge['snapshot']>;

 phase:ReturnType<NeuralPhaseTransitionDetector['snapshot']>;

 curriculum:ReturnType<SelfGeneratedCurriculumEngine['snapshot']>;

 counterfactual:ReturnType<CounterfactualWorldCompiler['snapshot']>;

 morphConstraint:ReturnType<NeuralMorphogeneticConstraintSolver['snapshot']>;

 coevolution:ReturnType<NeuralDigitalCoevolutionController['snapshot']>;

 developmental:ReturnType<UnifiedDevelopmentalCompiler['snapshot']>;

 sparsePredictive:ReturnType<SparsePredictiveGraph['snapshot']>;
 localCredit:ReturnType<LocalNeuralCreditAssigner['snapshot']>;
 metaMemory:ReturnType<MetaMemoryController['snapshot']>;
 selfRewrite:ReturnType<SandboxedSelfRewriteEngine['snapshot']>;
 sensorimotor:ReturnType<SensorimotorCoSimulationEngine['snapshot']>;
 phaseScheduler:ReturnType<DevelopmentalPhaseScheduler['snapshot']>;
 substratePortability:ReturnType<SubstratePortabilityEngine['snapshot']>;
 longitudinalBenchmark:ReturnType<LongitudinalOrganismBenchmarkEngine['snapshot']>;
 hybridCompiler:ReturnType<HybridCausalPlasticityCompiler['snapshot']>;

}
const blank = (): NeuroDigitalEvolutionState => ({
 version:1,
 cycles:0,
 lastOperation:'observe',
 lastChannel:'fast',
 neuralEcology:new NeuralEcologyRouter().snapshot(),
 dualMemory:new DualTimescaleMemoryBridge().snapshot(),
 phase:new NeuralPhaseTransitionDetector().snapshot(),
 curriculum:new SelfGeneratedCurriculumEngine().snapshot(),
 counterfactual:new CounterfactualWorldCompiler().snapshot(),
 morphConstraint:new NeuralMorphogeneticConstraintSolver().snapshot(),
 coevolution:new NeuralDigitalCoevolutionController().snapshot(),
 developmental:new UnifiedDevelopmentalCompiler().snapshot(),
 sparsePredictive:new SparsePredictiveGraph().snapshot(),
 localCredit:new LocalNeuralCreditAssigner().snapshot(),
 metaMemory:new MetaMemoryController().snapshot(),
 selfRewrite:new SandboxedSelfRewriteEngine().snapshot(),
 sensorimotor:new SensorimotorCoSimulationEngine().snapshot(),
 phaseScheduler:new DevelopmentalPhaseScheduler().snapshot(),
 substratePortability:new SubstratePortabilityEngine().snapshot(),
 longitudinalBenchmark:new LongitudinalOrganismBenchmarkEngine().snapshot(),
 hybridCompiler:new HybridCausalPlasticityCompiler().snapshot(),
})


export class NeuroDigitalEvolutionEngine{
 readonly neuralEcology=new NeuralEcologyRouter();
 readonly dualMemory=new DualTimescaleMemoryBridge();
 readonly phase=new NeuralPhaseTransitionDetector();
 readonly curriculum=new SelfGeneratedCurriculumEngine();
 readonly counterfactual=new CounterfactualWorldCompiler();
 readonly morphConstraint=new NeuralMorphogeneticConstraintSolver();
 readonly coevolution=new NeuralDigitalCoevolutionController();
 readonly developmental=new UnifiedDevelopmentalCompiler();

 readonly sparsePredictive=new SparsePredictiveGraph();
 readonly localCredit=new LocalNeuralCreditAssigner();
 readonly metaMemory=new MetaMemoryController();
 readonly selfRewrite=new SandboxedSelfRewriteEngine();
 readonly sensorimotor=new SensorimotorCoSimulationEngine();
 readonly phaseScheduler=new DevelopmentalPhaseScheduler();
 readonly substratePortability=new SubstratePortabilityEngine();
 readonly longitudinalBenchmark=new LongitudinalOrganismBenchmarkEngine();
 readonly hybridCompiler=new HybridCausalPlasticityCompiler();

 restore(raw?:Partial<NeuroDigitalEvolutionState>|null){const d=blank(),r=raw??{};
this.neuralEcology.restore(r.neuralEcology??d.neuralEcology);
this.dualMemory.restore(r.dualMemory??d.dualMemory);
this.phase.restore(r.phase??d.phase);
this.curriculum.restore(r.curriculum??d.curriculum);
this.counterfactual.restore(r.counterfactual??d.counterfactual);
this.morphConstraint.restore(r.morphConstraint??d.morphConstraint);
this.coevolution.restore(r.coevolution??d.coevolution);
this.developmental.restore(r.developmental??d.developmental);
this.sparsePredictive.restore(r.sparsePredictive??d.sparsePredictive);
this.localCredit.restore(r.localCredit??d.localCredit);
this.metaMemory.restore(r.metaMemory??d.metaMemory);
this.selfRewrite.restore(r.selfRewrite??d.selfRewrite);
this.sensorimotor.restore(r.sensorimotor??d.sensorimotor);
this.phaseScheduler.restore(r.phaseScheduler??d.phaseScheduler);
this.substratePortability.restore(r.substratePortability??d.substratePortability);
this.longitudinalBenchmark.restore(r.longitudinalBenchmark??d.longitudinalBenchmark);
this.hybridCompiler.restore(r.hybridCompiler??d.hybridCompiler);
}
 snapshot():NeuroDigitalEvolutionState{return{
  version:1,
  cycles:Math.max(this.neuralEcology.summary().cycles,this.developmental.summary().cycles),
  lastOperation:this.developmental.summary().nextOperation,
  lastChannel:this.neuralEcology.summary().lastChannel,
  neuralEcology:this.neuralEcology.snapshot(),
  dualMemory:this.dualMemory.snapshot(),
  phase:this.phase.snapshot(),
  curriculum:this.curriculum.snapshot(),
  counterfactual:this.counterfactual.snapshot(),
  morphConstraint:this.morphConstraint.snapshot(),
  coevolution:this.coevolution.snapshot(),
  developmental:this.developmental.snapshot(),
  sparsePredictive:this.sparsePredictive.snapshot(),
  localCredit:this.localCredit.snapshot(),
  metaMemory:this.metaMemory.snapshot(),
  selfRewrite:this.selfRewrite.snapshot(),
  sensorimotor:this.sensorimotor.snapshot(),
  phaseScheduler:this.phaseScheduler.snapshot(),
  substratePortability:this.substratePortability.snapshot(),
  longitudinalBenchmark:this.longitudinalBenchmark.snapshot(),
  hybridCompiler:this.hybridCompiler.snapshot(),
 }
 }

 cycle(input:{surprise01:number;
novelty01:number;
goalPressure01:number;
memorySalience01:number;
energy01:number;
causalUncertainty01:number;
predictionError01:number;
coherence01:number;
plasticity01:number;
stability01:number;
repeat01:number;
reliability01:number;
reward01:number;
capabilityGap01:number;
resource01:number}){
  const r=this.neuralEcology.route(input), m=this.dualMemory.update(input), p=this.phase.observe(input), c=this.curriculum.generate({skill:r.channel,gap01:input.capabilityGap01,novelty01:input.novelty01,uncertainty01:input.causalUncertainty01,energy01:input.energy01,goalPressure01:input.goalPressure01});

  const cf=this.counterfactual.compile({domain:r.channel,baseline01:clamp01(input.predictionError01),intervention01:clamp01(input.predictionError01*(1-.3*input.reward01)),uncertainty01:input.causalUncertainty01,resource01:input.resource01,predictedGain01:clamp01(input.capabilityGap01*.6+input.novelty01*.2+input.reward01*.2)});

  const mc=this.morphConstraint.solve({demand01:clamp01(input.goalPressure01*.55+input.novelty01*.25+input.capabilityGap01*.2),energy01:input.energy01,stability01:input.stability01,plasticity01:input.plasticity01,uncertainty01:input.causalUncertainty01});

  const co=this.coevolution.adapt({predictionError01:input.predictionError01,reward01:input.reward01,stability01:input.stability01,resource01:input.resource01,humanOrEnvironmentDrift01:input.novelty01*.25+input.causalUncertainty01*.35});

  const dev=this.developmental.decide({gap01:input.capabilityGap01,uncertainty01:input.causalUncertainty01,phaseFreeze01:p.freeze01,counterfactualSupport01:cf.score01,coadaptation01:co.coadaptation01,resourceDebt01:mc.resourceDebt01,causalConfidence01:clamp01(m.stability01*.45+cf.score01*.25+co.alignment01*.3)});

  const sp=this.sparsePredictive.step({novelty01:input.novelty01,predictionError01:input.predictionError01,coherence01:input.coherence01,sparsity01:clamp01(1-input.resource01*.45)});

  const lc=this.localCredit.assign({predictionError01:input.predictionError01,reward01:input.reward01,eligibility01:clamp01(input.repeat01*.7+input.novelty01*.3),stability01:input.stability01});

  const mm=this.metaMemory.step({salience01:input.memorySalience01,repeat01:input.repeat01,reliability01:input.reliability01,load01:clamp01(1-input.resource01),uncertainty01:input.causalUncertainty01});

  const sim=this.sensorimotor.simulate({action01:input.goalPressure01,bodyState01:input.energy01,expectedOutcome01:input.coherence01,observedOutcome01:clamp01(input.coherence01-input.predictionError01*.35)});

  const ph=this.phaseScheduler.decide({stability01:input.stability01,causalConfidence01:clamp01(m.stability01*.5+cf.score01*.5),memoryLoad01:mm.forgettingRisk01,capabilityGap01:input.capabilityGap01,resource01:input.resource01});

  const port=this.substratePortability.assess({sourceStability01:input.stability01,targetResource01:input.resource01,stateComplexity01:clamp01(.2+input.causalUncertainty01*.5),target:'mobile-cpu'});

  const holdout=clamp01(.35+cf.score01*.35+mm.meanPrecision01*.2+port.portable01*.1);

  const rewrite=this.selfRewrite.propose({expectedGain01:clamp01(input.capabilityGap01*.65+lc.credit01*.35),holdoutGain01:holdout,risk01:clamp01(input.causalUncertainty01*.55+mm.forgettingRisk01*.25+(1-input.stability01)*.2),rollbackReady:true});

  const long=this.longitudinalBenchmark.observe({stability01:input.stability01,transfer01:sim.transfer01,identity01:input.coherence01,drift01:clamp01(input.causalUncertainty01*.6+(1-input.coherence01)*.4),holdout01:holdout});

  const compiler=this.hybridCompiler.compile({causal01:clamp01(cf.score01*.6+co.alignment01*.4),localCredit01:lc.credit01,stability01:input.stability01,plasticity01:input.plasticity01,holdout01:holdout,phaseFreeze01:ph.freeze01});

  const next=this.snapshot();

  next.cycles++;
next.lastOperation=dev.operation;
next.lastChannel=r.channel;

  // queue one self-generated task only per cycle; completion remains explicit via evidence.
  return {
    route:r,
    memory:m,
    phase:p,
    curriculum:c,
    counterfactual:cf,
    morphConstraint:mc,
    coevolution:co,
    developmental:dev,
    sparsePredictive:sp,
    localCredit:lc,
    metaMemory:mm,
    selfRewrite:rewrite,
    sensorimotor:sim,
    phaseScheduler:ph,
    substratePortability:port,
    longitudinalBenchmark:long,
    hybridCompiler:compiler,
    snapshot:next,
  };

 }
 summary(){return this.snapshot();
}
}
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

