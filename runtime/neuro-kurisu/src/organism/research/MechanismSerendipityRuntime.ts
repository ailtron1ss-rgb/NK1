import type { MechanismDescription,MechanismSerendipityOptions,MechanismSerendipityResult } from './MechanismSerendipityEngine.ts';
import { MechanismSerendipityEngine } from './MechanismSerendipityEngine.ts';
import { MechanismProblemAdapter,type MechanismProblemInput } from './MechanismProblemAdapter.ts';
import { IntrinsicExperimentGenerator,type MechanismDiscoveryExperimentInput,type IntrinsicExperiment } from '../cognition/IntrinsicExperimentGenerator.ts';
export interface MechanismSerendipityRuntimeState {
 version:1;scans:number;queuedExperiments:number;suppressedDuplicates:number;lastProblemId:string|null;
 lastStatus:'matched'|'no-match'|'insufficient-structure'|'invalid-input'|null;seenDiscoveryIds:string[];
}
export interface MechanismSerendipityRuntimeReport {
 version:1;source:'organism-system-fabric';problem:MechanismDescription;result:MechanismSerendipityResult;
 experiments:IntrinsicExperiment[];sourceEvidence:Array<{subsystem:string;available:boolean;latencyMs:number;evidenceKeys:string[];error?:string}>;
 diagnostics:{scanCount:number;suppressedDuplicates:number;totalSystems:number;availableSystems:number;unavailableSystems:number;evidenceConfidence01:number;memoryPressure01:number;predictionError01:number;budgetPressure01:number;researchEvidenceDebt01:number};
}
const defaults=():MechanismSerendipityRuntimeState=>({version:1,scans:0,queuedExperiments:0,suppressedDuplicates:0,lastProblemId:null,lastStatus:null,seenDiscoveryIds:[]});
const count=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:0;
const ids=(x:unknown)=>Array.isArray(x)?[...new Set(x.filter((v):v is string=>typeof v==='string'&&v.length>0))].slice(-256):[];
export class MechanismSerendipityRuntime {
 private state=defaults();
 private readonly adapter:MechanismProblemAdapter;
 private readonly engine:MechanismSerendipityEngine;
 private readonly experiments:IntrinsicExperimentGenerator;
 constructor(adapter=new MechanismProblemAdapter(),engine=new MechanismSerendipityEngine(),experiments=new IntrinsicExperimentGenerator()){
  this.adapter=adapter;this.engine=engine;this.experiments=experiments;
 }
 snapshot(){return structuredClone(this.state);}
 restore(raw?:Partial<MechanismSerendipityRuntimeState>|null){
  const x=raw??{},allowed=['matched','no-match','insufficient-structure','invalid-input'];
  this.state={...defaults(),...x,version:1,scans:count(x.scans),queuedExperiments:count(x.queuedExperiments),suppressedDuplicates:count(x.suppressedDuplicates),
   lastProblemId:typeof x.lastProblemId==='string'?x.lastProblemId.slice(0,128):null,
   lastStatus:allowed.includes(String(x.lastStatus))?x.lastStatus as MechanismSerendipityRuntimeState['lastStatus']:null,seenDiscoveryIds:ids(x.seenDiscoveryIds)};
 }
 analyze(input:MechanismProblemInput,options:MechanismSerendipityOptions={}):MechanismSerendipityRuntimeReport{
  const projection=this.adapter.build(input);
  if(!projection){
   const result:MechanismSerendipityResult={problemId:'invalid-organism-snapshot',status:'insufficient-structure',evaluatedN:0,emittedN:0,rejectedN:0,discoveries:[],reasons:['Не удалось построить структурную схему из диагностических данных NK1.']};
   this.state.scans++;this.state.lastProblemId=result.problemId;this.state.lastStatus='invalid-input';
   const problem:MechanismDescription={id:result.problemId,title:'Invalid NK1 subsystem snapshot',domain:'cognitive-runtime',actors:[],flows:[],constraints:[],feedbackLoops:[],resources:[],dynamics:{regimes:[],timescale:'mixed'}};
   return{version:1,source:'organism-system-fabric',problem,result,experiments:[],sourceEvidence:[],diagnostics:{scanCount:this.state.scans,suppressedDuplicates:0,totalSystems:0,availableSystems:0,unavailableSystems:0,evidenceConfidence01:0,memoryPressure01:0,predictionError01:0,budgetPressure01:0,researchEvidenceDebt01:0}};
  }
  const result=this.engine.analyze(projection.problem,options),seen=new Set(this.state.seenDiscoveryIds),experiments:IntrinsicExperiment[]=[];
  let suppressedDuplicates=0;
  for(const discovery of result.discoveries){
   const input:MechanismDiscoveryExperimentInput={
    id:discovery.id,title:discovery.referenceTitle,sourceDomain:discovery.sourceDomain,targetDomain:discovery.targetDomain,
    confidence01:Math.min(discovery.confidence01,projection.evidenceConfidence01),transferability01:discovery.transferability01,
    status:discovery.status,epistemicStatus:discovery.epistemicStatus,hypothesis:discovery.hypothesis,verificationPlan:discovery.verificationPlan,
    correspondences:discovery.correspondences.map(x=>x.aspect+':'+x.structuralFeature),breakpoints:discovery.breakpoints.map(x=>x.kind+':'+x.consequence),
   };
   const task=this.experiments.fromMechanismDiscovery(input,[]);
   if(!task)continue;
   if(seen.has(discovery.id)){suppressedDuplicates++;continue;}
   seen.add(discovery.id);experiments.push(task);
  }
  this.state={...this.state,scans:this.state.scans+1,queuedExperiments:this.state.queuedExperiments+experiments.length,
   suppressedDuplicates:this.state.suppressedDuplicates+suppressedDuplicates,lastProblemId:projection.problem.id,lastStatus:result.status,seenDiscoveryIds:[...seen].slice(-256)};
  return{version:1,source:'organism-system-fabric',problem:projection.problem,result,experiments,sourceEvidence:projection.sourceEvidence,
   diagnostics:{scanCount:this.state.scans,suppressedDuplicates,totalSystems:projection.diagnostics.total,availableSystems:projection.diagnostics.available,
    unavailableSystems:projection.diagnostics.unavailable,evidenceConfidence01:projection.evidenceConfidence01,memoryPressure01:projection.diagnostics.memoryPressure01,
    predictionError01:projection.diagnostics.predictionError01,budgetPressure01:projection.diagnostics.budgetPressure01,researchEvidenceDebt01:projection.diagnostics.researchEvidenceDebt01}};
 }
}
