import { createCognitiveSubsystemPorts, type CognitiveSubsystemPorts, type CognitiveSubsystemName } from './CognitiveSubsystemPorts.ts';
import { SubsystemFlightRecorder } from './SubsystemFlightRecorder.ts';
import { OrganismSystemFabric } from './OrganismSystemFabric.ts';
export type CognitiveSubsystemProbeStatus = 'ok'|'empty'|'throw'|'invalid';

export interface CognitiveSubsystemProbe {
  domain:CognitiveSubsystemName;
  port:string;
  status:CognitiveSubsystemProbeStatus;
  available:boolean;
  probeMs:number;
  checkedAt:number;
  keyCount:number;
  probeKind:'read-only-snapshot';
  evidence:'snapshot-only';
  errorType?:string;
}

export interface CognitiveSubsystemHealth {
  name:CognitiveSubsystemName;
  available:boolean;
  probeMs:number;
  apiCount:number;
  probeCount:number;
  failedProbeCount:number;
  failedPorts:string[];
  checkedAt:number;
  ownership:'physical'|'mixed'|'adapter';
  probeKind:'read-only-snapshot';
  evidence:'snapshot-only';
  error?:string;
}

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

function safeErrorType(error:unknown):string {
  try {
    if(error instanceof Error) {
      const name=String(error.name||'Error').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,48);
      return name||'Error';
    }
  } catch { /* A hostile thrown value is intentionally not inspected further. */ }
  return 'ThrownValue';
}

function inspectSnapshot(value:unknown):{status:'ok'|'empty'|'invalid';keyCount:number} {
  if(value===null) return {status:'empty',keyCount:0};
  if(typeof value!=='object' || Array.isArray(value)) return {status:'invalid',keyCount:0};
  try {
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype && prototype!==null) return {status:'invalid',keyCount:0};
    return {status:'ok',keyCount:Object.keys(value).length};
  } catch {
    return {status:'invalid',keyCount:0};
  }
}

export class CognitiveSubsystemRegistry {
  private readonly ports:CognitiveSubsystemPorts;
  private lastProbeDetailsAt=0;
  private lastProbeDetails:CognitiveSubsystemProbe[]=[];
  private readonly probeCacheMs=2000;
  private readonly flightRecorder=new SubsystemFlightRecorder(16);
  constructor(source:Parameters<typeof createCognitiveSubsystemPorts>[0] | OrganismSystemFabric){
    this.ports=source instanceof OrganismSystemFabric ? createPortsFromFabric(source) : createCognitiveSubsystemPorts(source);
  }
  get(name:CognitiveSubsystemName){ return this.ports[name]; }
  all(){ return this.ports; }

  /**
   * Read-only observation of every declared snapshot port. This does not prove
   * that a subsystem was invoked on a live tick or that its behavior is correct.
   */
  probeDetails(force=false):CognitiveSubsystemProbe[]{
    const now=Date.now();
    if(!force && now-this.lastProbeDetailsAt<this.probeCacheMs && this.lastProbeDetails.length) {
      return this.lastProbeDetails.map(row=>({...row}));
    }
    const rows:CognitiveSubsystemProbe[]=[];
    for(const domain of Object.keys(this.ports) as CognitiveSubsystemName[]) {
      const ports=this.ports[domain] as unknown as Record<string,()=>unknown>;
      for(const [port,probe] of Object.entries(ports)) {
        const startedAt=Date.now();
        let status:CognitiveSubsystemProbeStatus='invalid';
        let keyCount=0;
        let errorType:string|undefined;
        try {
          if(typeof probe!=='function') {
            status='invalid';
          } else {
            const inspected=inspectSnapshot(probe());
            status=inspected.status;
            keyCount=inspected.keyCount;
          }
        } catch(error) {
          status='throw';
          errorType=safeErrorType(error);
        }
        const checkedAt=Date.now();
        const probeMs=Math.max(0,checkedAt-startedAt);
        const available=status==='ok'||status==='empty';
        rows.push({
          domain,port,status,available,probeMs,checkedAt,keyCount,
          probeKind:'read-only-snapshot',evidence:'snapshot-only',
          ...(errorType?{errorType}:{}),
        });
        this.flightRecorder.record(domain+'.'+port,{
          ok:available,latencyMs:probeMs,at:checkedAt,
          error:status==='throw'?'snapshot-threw:'+(errorType??'Error'):status==='invalid'?'invalid-snapshot-shape':undefined,
        });
      }
    }
    this.lastProbeDetailsAt=Date.now();
    this.lastProbeDetails=rows;
    return rows.map(row=>({...row}));
  }

  health():CognitiveSubsystemHealth[]{
    const details=this.probeDetails();
    return (Object.keys(this.ports) as CognitiveSubsystemName[]).map(name=>{
      const domainRows=details.filter(row=>row.domain===name);
      const failedPorts=domainRows.filter(row=>!row.available).map(row=>row.port);
      const apiCount=Object.keys(this.ports[name] as unknown as Record<string,unknown>).length;
      const ownership:CognitiveSubsystemHealth['ownership']=['self','world','memory','agency','embodiment','research','governance'].includes(name)?'physical':'adapter';
      const probeMs=domainRows.reduce((sum,row)=>sum+row.probeMs,0);
      const checkedAt=domainRows.reduce((latest,row)=>Math.max(latest,row.checkedAt),0);
      return {
        name,available:failedPorts.length===0,probeMs,apiCount,
        probeCount:domainRows.length,failedProbeCount:failedPorts.length,failedPorts,checkedAt,ownership,
        probeKind:'read-only-snapshot',evidence:'snapshot-only',
        ...(failedPorts.length?{error:'unreadable snapshot ports: '+failedPorts.join(',').slice(0,120)}:{}),
      };
    });
  }
  flightSnapshot(){ return this.flightRecorder.snapshot(); }
  flightSummary(){
    const summary=this.flightRecorder.summary();
    const probes=Object.keys(this.flightRecorder.snapshot()).length;
    return {...summary,subsystems:Object.keys(this.ports).length,probes};
  }
  manifest(){ return (Object.keys(this.ports) as CognitiveSubsystemName[]).map(name=>({name,ownership:['self','world','memory','agency','embodiment','research','governance'].includes(name)?'physical':'adapter',api:Object.keys(this.ports[name] as unknown as Record<string,unknown>),probeKind:'read-only-snapshot' as const,evidence:'snapshot-only' as const})); }
}
