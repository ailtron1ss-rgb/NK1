import type { ActionKind } from '../core/types.ts';
import { PhoneBodyWorldModel, defaultPhoneBodyWorld, type PhoneBodyWorldState } from '../world/PhoneBodyWorldModel.ts';
import { MultimodalSituationModel, defaultMultimodalSituation, type MultimodalSituationState } from '../body/MultimodalSituationModel.ts';
import { TemporalMemoryCompressor, defaultTemporalMemoryCompression, type TemporalMemoryCompressionState } from './TemporalMemoryCompressor.ts';
import { BehavioralGenome, defaultBehavioralGenome, type BehavioralGenomeState } from '../learning/BehavioralGenome.ts';
import { BoredomExplorer, defaultBoredom, type BoredomState } from '../cognition/BoredomExplorer.ts';
import { ModelSwitchBenchmark, defaultModelSwitchBenchmark, type ModelSwitchBenchmarkState } from '../system/ModelSwitchBenchmark.ts';

export interface IdentityAnchor{key:string;value:string;strength01:number;sources:number;lastConfirmedAt:number;}
export interface IdentityState{version:1;stability01:number;selfConsistency01:number;anchors:IdentityAnchor[];memoryCapsules:number;lastSituationHash:string;}
export interface P24WorldIdentityState{
  version:1;
  bodyWorld:PhoneBodyWorldState;
  multimodalSituation:MultimodalSituationState;
  memoryCompression:TemporalMemoryCompressionState;
  behavioralGenome:BehavioralGenomeState;
  boredom:BoredomState;
  modelSwitchBenchmark:ModelSwitchBenchmarkState;
  identity:IdentityState;
  cycleCount:number;
}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultP24WorldIdentity=():P24WorldIdentityState=>({version:1,bodyWorld:defaultPhoneBodyWorld(),multimodalSituation:defaultMultimodalSituation(),memoryCompression:defaultTemporalMemoryCompression(),behavioralGenome:defaultBehavioralGenome(),boredom:defaultBoredom(),modelSwitchBenchmark:defaultModelSwitchBenchmark(),identity:{version:1,stability01:.82,selfConsistency01:.78,anchors:[],memoryCapsules:0,lastSituationHash:''},cycleCount:0});

function situationHash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}

export class P24WorldIdentityEngine{
 private state=defaultP24WorldIdentity();
 readonly bodyWorld=new PhoneBodyWorldModel();
 readonly multimodalSituation=new MultimodalSituationModel();
 readonly memoryCompression=new TemporalMemoryCompressor();
 readonly behavioralGenome=new BehavioralGenome();
 readonly boredom=new BoredomExplorer();
 readonly modelSwitchBenchmark=new ModelSwitchBenchmark();
 restore(s:P24WorldIdentityState|undefined){
  this.state={...defaultP24WorldIdentity(),...(s??{}),identity:{...defaultP24WorldIdentity().identity,...(s?.identity??{}),anchors:Array.isArray(s?.identity?.anchors)?s!.identity.anchors.slice(0,64):[]}};
  this.bodyWorld.restore(this.state.bodyWorld);this.multimodalSituation.restore(this.state.multimodalSituation);this.memoryCompression.restore(this.state.memoryCompression);this.behavioralGenome.restore(this.state.behavioralGenome);this.boredom.restore(this.state.boredom);this.modelSwitchBenchmark.restore(this.state.modelSwitchBenchmark);
 }
 snapshot():P24WorldIdentityState{this.sync();return structuredClone(this.state);}
 observeBody(body:any,at=Date.now()){this.bodyWorld.observe(body,at);}
 fuseSituation(events:any[]){const out=this.multimodalSituation.fuse(events);this.state.identity.lastSituationHash=situationHash(out.summary);return out;}
 observeBoredom(input:{novelty01:number;predictionError01:number;informationGain01:number;externalStimulus:boolean}){return this.boredom.observe(input);}
 selectBehavior(input:{novelty01:number;uncertainty01:number;socialNeed01:number;energy01:number;thermal01:number;predictionError01:number;informationDeficit01:number}){return this.behavioralGenome.select(input);}
 behaviorBias(action:ActionKind){return this.behavioralGenome.bias(action)+this.boredom.bias(action);}
 observeOutcome(success01:number){this.behavioralGenome.observeOutcome(success01);}
 identityObserve(input:{action:ActionKind;goal?:string|null;summary?:string;confidence01:number}){
   const key=input.action==='respond'?'social-expression':input.action==='verify'?'truth-verification':input.action==='explore'?'curiosity-exploration':input.action==='rest'?'resource-preservation':'deliberative-control';
   let anchor=this.state.identity.anchors.find(x=>x.key===key);
   if(!anchor){anchor={key,value:input.goal||key,strength01:.42,sources:0,lastConfirmedAt:0};this.state.identity.anchors.unshift(anchor);}
   anchor.sources++;anchor.strength01=c(anchor.strength01*.94+input.confidence01*.06);anchor.lastConfirmedAt=Date.now();
   this.state.identity.stability01=c(this.state.identity.stability01*.985+anchor.strength01*.015);
   this.state.identity.selfConsistency01=c(this.state.identity.selfConsistency01*.99+Math.abs(anchor.strength01-this.state.identity.stability01)*-.015+.015);
 }
 compressMemory(events:Array<{at:number;action?:string;summary:string;predictionError?:number;id?:string;provenanceClass?:string;correctionOfId?:string|null;evidenceHash?:string;epistemicStatus?:string}>,tier:'daily'|'weekly'|'monthly'='daily'){
   const capsule=this.memoryCompression.compress(events,tier);if(capsule)this.state.identity.memoryCapsules=this.memoryCompression.snapshot().capsules.length;return capsule;
 }
 beginCycle(){this.state.cycleCount+=1;}
 sync(){this.state.bodyWorld=this.bodyWorld.snapshot();this.state.multimodalSituation=this.multimodalSituation.snapshot();this.state.memoryCompression=this.memoryCompression.snapshot();this.state.behavioralGenome=this.behavioralGenome.snapshot();this.state.boredom=this.boredom.snapshot();this.state.modelSwitchBenchmark=this.modelSwitchBenchmark.snapshot();}
}
