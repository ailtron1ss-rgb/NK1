import type { ActorRole,ConstraintKind,DynamicRegime,FlowKind,MechanismDescription,MechanismResource,ResourceKind } from './MechanismSerendipityEngine.ts';
export interface MechanismProblemInput {
 graph:{nodes:Array<{name:string;phase?:string;cost01?:number;cadence?:number;executionRank?:number}>;edges:Array<{from:string;to:string}>;dependencyCycles?:string[]};
 health:Array<{systemName:string;available:boolean;snapshotMs?:number;probeMs?:number;snapshotKeys?:number;error?:string}>;
 systems:Record<string,unknown>;
}
export interface MechanismProblemProjection {
 problem:MechanismDescription;evidenceConfidence01:number;
 sourceEvidence:Array<{subsystem:string;available:boolean;latencyMs:number;evidenceKeys:string[];error?:string}>;
 diagnostics:{total:number;available:number;unavailable:number;memoryEntries:number;memoryPressure01:number;predictionError01:number;budgetPressure01:number;researchEvidenceDebt01:number;maxSnapshotMs:number;evidenceCoverage01:number};
}
const roles:Record<string,ActorRole>={self:'regulator',governance:'gate',memory:'memory',world:'environment',embodiment:'sensor',agency:'selector',research:'controller'};
const clamp=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;
const rec=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const arr=(x:unknown,n=128)=>Array.isArray(x)?x.slice(0,n):[];
const num=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:null;
const avg=(xs:unknown[])=>{const a=xs.map(num).filter((x):x is number=>x!==null);return a.length?clamp(a.reduce((s,x)=>s+x,0)/a.length):null;};
const round=(x:number)=>Number(x.toFixed(3));
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');};
function metric(root:unknown,keys:string[],depthMax=4){
 const wanted=new Set(keys),queue=[{v:root,d:0}],seen=new Set<object>();let visited=0;
 while(queue.length&&visited<256){const {v,d}=queue.shift()!;if(!v||typeof v!=='object'||seen.has(v as object)||d>depthMax)continue;seen.add(v as object);visited++;
  if(Array.isArray(v)){for(const x of v.slice(0,24))if(x&&typeof x==='object')queue.push({v:x,d:d+1});continue;}
  for(const [k,x] of Object.entries(v as Record<string,unknown>).slice(0,64)){if(wanted.has(k)){const n=num(x);if(n!==null)return clamp(n);}if(x&&typeof x==='object')queue.push({v:x,d:d+1});}
 }return null;
}
const addResource=(out:MechanismResource[],seen:Set<ResourceKind>,kind:ResourceKind)=>{if(!seen.has(kind)){seen.add(kind);out.push({id:'resource-'+kind,kind});}};
const toFlow=(from:ActorRole,to:ActorRole):FlowKind=>from==='environment'||from==='sensor'?'signal':to==='memory'?'resource':to==='gate'||to==='regulator'||from==='controller'||from==='selector'?'control':to==='selector'?'request':'result';
const constraint=(id:string,kind:ConstraintKind,onRole:ActorRole,severity01:number)=>({id,kind,onRole,severity01:clamp(severity01)});
/** Compact read-only projection: snapshots are inspected for scalar diagnostics only; memory contents are never copied. */
export class MechanismProblemAdapter {
 build(input:MechanismProblemInput):MechanismProblemProjection|null {
  if(!input?.graph||!Array.isArray(input.graph.nodes)||!Array.isArray(input.graph.edges)||!Array.isArray(input.health))return null;
  const nodes=input.graph.nodes.slice(0,16).filter(x=>x&&roles[x.name]),names=new Set(nodes.map(x=>x.name));
  if(nodes.length<2)return null;
  const actors=nodes.map(x=>({id:'system-'+x.name,role:roles[x.name]!,label:x.name}));
  const roleByName=new Map(nodes.map(x=>[x.name,roles[x.name]]));
  const edges=input.graph.edges.slice(0,48).filter(x=>names.has(x.from)&&names.has(x.to));
  if(!edges.length)return null;
  const flows=edges.map((x,i)=>({id:'dependency-'+i+'-'+x.from+'-'+x.to,fromRole:roleByName.get(x.from)!,toRole:roleByName.get(x.to)!,kind:toFlow(roleByName.get(x.from)!,roleByName.get(x.to)!)}));
  const health=input.health.slice(0,16),available=health.filter(x=>x.available&&names.has(x.systemName)).length,unavailable=health.filter(x=>!x.available&&names.has(x.systemName));
  const maxSnapshotMs=Math.max(0,...health.filter(x=>names.has(x.systemName)).map(x=>Math.max(0,num(x.snapshotMs)??num(x.probeMs)??0)));
  const systems=rec(input.systems),memory=rec(systems.memory),world=rec(systems.world),worldModel=rec(world.worldModel2);
  const memoryKnown=Array.isArray(memory.memories),memoryEntries=memoryKnown?Math.min(10000,(memory.memories as unknown[]).length):0,memoryPressure01=clamp(memoryEntries/2048);
  const predictions=arr(worldModel.predictionErrors,64),predictionError01=avg(predictions)??metric(world,['predictionError01','meanPredictionError01','lastActionError01'])??0;
  const agency=rec(systems.agency),remaining=metric(agency,['remaining01','available01','budgetRemaining01']),budgetPressure01=remaining===null?0:clamp(1-remaining);
  const research=rec(systems.research),researchEvidenceDebt01=metric(research,['evidenceDebt01','predictionDebt01','debtPressure01'])??0;
  const constraints:MechanismDescription['constraints']=[];
  if(memoryKnown&&memoryEntries>0)constraints.push(constraint('memory-capacity','capacity','memory',Math.max(.12,memoryPressure01)));
  if(maxSnapshotMs>=8)constraints.push(constraint('subsystem-latency','latency','controller',maxSnapshotMs/80));
  if(predictionError01>=.2)constraints.push(constraint('world-model-noise','noise','environment',predictionError01));
  if(budgetPressure01>=.2)constraints.push(constraint('agency-budget','scarcity','selector',budgetPressure01));
  if(researchEvidenceDebt01>=.2)constraints.push(constraint('research-evidence-debt','trust','controller',researchEvidenceDebt01));
  if(unavailable.length)constraints.push(constraint('subsystem-availability','safety','gate',unavailable.length/nodes.length));
  if(!constraints.length)constraints.push(constraint('bounded-organism-resources','capacity','memory',.15));
  const resources:MechanismResource[]=[],resourceSet=new Set<ResourceKind>();
  for(const node of nodes){const role=roles[node.name];if(role==='memory')addResource(resources,resourceSet,'memory');if(role==='sensor')addResource(resources,resourceSet,'energy');if(role==='environment')addResource(resources,resourceSet,'time');if(role==='selector'){addResource(resources,resourceSet,'compute');addResource(resources,resourceSet,'attention');}if(role==='gate')addResource(resources,resourceSet,'trust');if(role==='regulator')addResource(resources,resourceSet,'attention');if(role==='controller')addResource(resources,resourceSet,'compute');}
  const regimes:DynamicRegime[]=[];
  if(memoryPressure01>=.65||budgetPressure01>=.72||maxSnapshotMs>=40)regimes.push('saturation');
  if(unavailable.length>=2)regimes.push('cascade');
  if(predictionError01>=.58)regimes.push('oscillation');
  if(unavailable.length===1)regimes.push('recovery');
  if(predictionError01>=.2&&unavailable.length===0)regimes.push('adaptation');
  if(!regimes.length)regimes.push('equilibrium');
  const cadence=nodes.map(x=>num(x.cadence)??4),timescale:MechanismDescription['dynamics']['timescale']=Math.max(...cadence)<=2?'fast':Math.min(...cadence)>=8?'slow':'mixed';
  const evidenceCoverage01=clamp(.55*available/nodes.length+.25*(memoryKnown?1:0)+.20*(predictions.length?1:0));
  const fingerprint=[nodes.map(x=>x.name).sort().join(','),edges.map(x=>x.from+'>'+x.to).sort().join(','),'m'+round(memoryPressure01),'p'+round(predictionError01),'b'+round(budgetPressure01),'d'+round(researchEvidenceDebt01),unavailable.map(x=>x.systemName).sort().join(',')].join('|');
  const problem:MechanismDescription={id:'nk1-system-'+hash(fingerprint),title:'NK1 physical subsystem dependency and pressure graph',domain:'cognitive-runtime',actors,flows,constraints,feedbackLoops:[],resources,dynamics:{regimes,timescale}};
  const sourceEvidence=health.filter(x=>names.has(x.systemName)).map(x=>({subsystem:x.systemName,available:x.available,latencyMs:round(Math.max(0,num(x.snapshotMs)??num(x.probeMs)??0)),evidenceKeys:[...(x.snapshotKeys?['snapshot-shape']:[]),...(x.available?['health-probe']:['health-failure'])],error:x.error?.slice(0,160)}));
  return{problem,evidenceConfidence01:evidenceCoverage01,sourceEvidence,diagnostics:{total:nodes.length,available,unavailable:unavailable.length,memoryEntries,memoryPressure01:round(memoryPressure01),predictionError01:round(predictionError01),budgetPressure01:round(budgetPressure01),researchEvidenceDebt01:round(researchEvidenceDebt01),maxSnapshotMs:round(maxSnapshotMs),evidenceCoverage01:round(evidenceCoverage01)}};
 }
}
