import { createCognitiveSubsystemPorts, type CognitiveSubsystemPorts, type CognitiveSubsystemName } from './CognitiveSubsystemPorts.ts';
import { SubsystemFlightRecorder } from './SubsystemFlightRecorder.ts';
import { OrganismSystemFabric } from './OrganismSystemFabric.ts';
import type { PersonalityOutcomeRecord } from '../cognition/PersonalitySelfModelBridge.ts';
export interface CognitiveSubsystemHealth { name:CognitiveSubsystemName; available:boolean; probeMs:number; apiCount:number; checkedAt:number; ownership:'physical'|'mixed'|'adapter'; error?:string; }

/** Physical registry boundary for Stage-2/3 extraction.
 * The registry no longer depends on OrganismCore; it consumes stable accessors.
 */
function createPortsFromFabric(fabric:OrganismSystemFabric): CognitiveSubsystemPorts {
  return {
    self:{
      snapshot:()=>fabric.self.snapshot(),
      identityCausality:()=>fabric.self.p32CausalSelf.snapshot(),
      selfPrediction:()=>fabric.research.selfPredictionBenchmark.snapshot(),
      shadow:()=>fabric.research.shadowOrganism.snapshot(),
      consistency:()=>fabric.self.p71SelfConsistency.snapshot(),
    },
    world:{
      snapshot:()=>fabric.world.snapshot(),
      perception:()=>fabric.embodiment.perception.snapshot(),
      longHorizon:()=>fabric.research.longHorizonPrediction.snapshot(),
      reality:()=>fabric.world.p57RealityFirstObservatory.snapshot(),
      modelOlympics:()=>fabric.research.modelOlympics.snapshot(),
    },
    memory:{
      snapshot:()=>fabric.memory.snapshot(),
      epistemic:()=>fabric.memory.p65EpistemicLedger.snapshot(),
      prediction:()=>fabric.research.predictionLedger.snapshot(),
      predictionDebt:()=>fabric.research.predictionDebt.snapshot(),
      evidenceTrust:()=>fabric.research.externalEvidenceTrust.snapshot(),
      evidenceFirewall:()=>fabric.research.evidenceFirewall.snapshot(),
      skillAcquisition:()=>fabric.research.skillAcquisitionBenchmark.snapshot(),
    },
    agency:{
      snapshot:()=>fabric.agency.snapshot(),
      autonomousProject:()=>fabric.agency.projectExecutor.snapshot(),
      cognitiveBudget:()=>fabric.agency.budget.snapshot(),
      quorum:()=>fabric.agency.quorum.snapshot(),
      multiProjectSchedule:()=>fabric.agency.projectScheduler.snapshot(),
    },
    embodiment:{
      snapshot:()=>fabric.embodiment.snapshot(),
      multimodal:()=>fabric.embodiment.multimodal.snapshot(),
      perceptionRouting:()=>fabric.embodiment.perceptionRoutingSnapshot(),
    },
    research:{
      snapshot:()=>fabric.research.snapshot(),
      causal:()=>fabric.research.p38Research.snapshot(),
      developmental:()=>fabric.research.p53DevelopmentalSelfModification.snapshot(),
      externalResearch:()=>fabric.research.externalProjectResearchTool.snapshot(),
      researchSession:()=>fabric.research.projectResearchSession.snapshot(),
    },
    governance:{
      snapshot:()=>fabric.governance.snapshot(),
      capabilities:()=>fabric.governance.capabilities.snapshot(),
      identityGuardian:()=>fabric.self.p60IdentityGuardian.snapshot(),
      resilience:()=>fabric.governance.resilience.snapshot(),
    },
  };
}

export class CognitiveSubsystemRegistry {
  private readonly ports:CognitiveSubsystemPorts;
  private readonly organismSystems:OrganismSystemFabric|null;
  private lastHealthAt=0;
  private lastHealth:CognitiveSubsystemHealth[]=[];
  private readonly flightRecorder=new SubsystemFlightRecorder(16);
  constructor(source:Parameters<typeof createCognitiveSubsystemPorts>[0] | OrganismSystemFabric){
    this.organismSystems=source instanceof OrganismSystemFabric ? source : null;
    this.ports=this.organismSystems ? createPortsFromFabric(this.organismSystems) : createCognitiveSubsystemPorts(source as Parameters<typeof createCognitiveSubsystemPorts>[0]);
  }
  get(name:CognitiveSubsystemName){ return this.ports[name]; }
  /** Forward the composed personality signal through the canonical physical-system fabric. */
  preparePersonalityDecision(input:Parameters<OrganismSystemFabric['preparePersonalityDecision']>[0]) {
    if(!this.organismSystems) throw new Error('Personality bridge requires an OrganismSystemFabric-backed registry');
    return this.organismSystems.preparePersonalityDecision(input);
  }
  /** Persisted self/personality learning remains in its physical owners; registry adds no shadow state. */
  recordPersonalityOutcome(input:PersonalityOutcomeRecord) {
    if(!this.organismSystems) throw new Error('Personality bridge requires an OrganismSystemFabric-backed registry');
    return this.organismSystems.recordPersonalityOutcome(input);
  }
  all(){ return this.ports; }
  health():CognitiveSubsystemHealth[]{
    const now=Date.now();
    if(now-this.lastHealthAt<2000 && this.lastHealth.length) return this.lastHealth.map(x=>({...x}));
    const rows=(Object.keys(this.ports) as CognitiveSubsystemName[]).map(name=>{
      const ownership: CognitiveSubsystemHealth['ownership'] = ['self','world','memory','agency','embodiment','research','governance'].includes(name) ? 'physical' : 'adapter';
      const at=Date.now(); const apiCount=Object.keys(this.ports[name] as unknown as Record<string,unknown>).length;
      try{ this.ports[name].snapshot(); const probeMs=Date.now()-at; this.flightRecorder.record(name,{ok:true,latencyMs:probeMs}); return {name,available:true,probeMs,apiCount,checkedAt:Date.now(),ownership}; }
      catch(error){ const probeMs=Date.now()-at; const message=String((error as any)?.message||error).slice(0,160); this.flightRecorder.record(name,{ok:false,latencyMs:probeMs,error:message}); return {name,available:false,probeMs,apiCount,checkedAt:Date.now(),ownership,error:message}; }
    });
    this.lastHealthAt=Date.now(); this.lastHealth=rows; return rows.map(x=>({...x}));
  }
  flightSnapshot(){ return this.flightRecorder.snapshot(); }
  flightSummary(){ return this.flightRecorder.summary(); }
  manifest(){ return (Object.keys(this.ports) as CognitiveSubsystemName[]).map(name=>({name,ownership:['self','world','memory','agency','embodiment','research','governance'].includes(name)?'physical':'adapter',api:Object.keys(this.ports[name] as unknown as Record<string,unknown>)})); }
}
