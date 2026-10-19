export type CausalAccountabilityNodeKind =
  | 'goal' | 'decision' | 'prediction' | 'action' | 'observation'
  | 'verification' | 'outcome' | 'prediction-error' | 'learning' | 'evidence-revision';

export interface CausalAccountabilityNode {
  id: string;
  kind: CausalAccountabilityNodeKind;
  at: number;
  tick: number;
  summary: string;
  confidence01?: number;
  evidenceRef?: string;
  data?: Record<string, unknown>;
}

export interface CausalAccountabilityEdge {
  from: string;
  to: string;
  relation: 'caused' | 'predicted' | 'observed' | 'verified-by' | 'contradicted' | 'learned-from' | 'supersedes';
  confidence01: number;
}

export interface CausalAccountabilityState {
  version: 1;
  nodes: CausalAccountabilityNode[];
  edges: CausalAccountabilityEdge[];
  activeChains: string[];
  lastAt: number;
  updatedAt: number;
  /** Bounded stable receipt directory permits late evidence to relink after node compaction. */
  outcomeIndex?: Array<{executionId:string;outcomeId:string;tool:string;tick:number;at:number;ok:boolean;expectedPostcondition?:string;observedPostcondition?:string;observationId?:string;confidence01:number}>;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export class CausalAccountabilityGraph {
  private nodes:CausalAccountabilityNode[]=[];
  private edges:CausalAccountabilityEdge[]=[];
  private activeChains:string[]=[];
  private outcomeIndex=new Map<string,{executionId:string;outcomeId:string;tool:string;tick:number;at:number;ok:boolean;expectedPostcondition?:string;observedPostcondition?:string;observationId?:string;confidence01:number}>();
  private updatedAt=0;
  private readonly maxNodes:number;
  private readonly maxEdges:number;
  private readonly maxChains:number;
  private readonly maxOutcomeIndex=1024;

  constructor(maxNodes=192,maxEdges=384,maxChains=32){
    this.maxNodes=Math.max(64,maxNodes);
    this.maxEdges=Math.max(128,maxEdges);
    this.maxChains=Math.max(8,maxChains);
  }

  private addNode(node:CausalAccountabilityNode){
    const normalized={...node,summary:String(node.summary??'').slice(0,240),confidence01:node.confidence01==null?undefined:clamp(node.confidence01)};
    this.nodes.push(normalized);
    if(this.nodes.length>this.maxNodes)this.nodes.splice(0,this.nodes.length-this.maxNodes);
    this.activeChains=[...new Set([normalized.id,...this.activeChains])].slice(0,this.maxChains);
    this.updatedAt=Math.max(this.updatedAt,normalized.at);
    return normalized;
  }

  private addEdge(edge:CausalAccountabilityEdge){
    if(edge.from===edge.to)return;
    this.edges.push({...edge,confidence01:clamp(edge.confidence01)});
    if(this.edges.length>this.maxEdges)this.edges.splice(0,this.edges.length-this.maxEdges);
  }

  add(kind:CausalAccountabilityNodeKind,tick:number,summary:string,data?:Record<string,unknown>,confidence01?:number,evidenceRef?:string){
    const node=this.addNode({id:`${kind}-${tick}-${Date.now()}-${Math.random().toString(16).slice(2)}`,kind,tick,at:Date.now(),summary,data,confidence01,evidenceRef});
    return node.id;
  }

  link(from:string,to:string,relation:CausalAccountabilityEdge['relation'],confidence01=1){this.addEdge({from,to,relation,confidence01});}

  recordActionChain(input:{tick:number;tool:string;ok:boolean;verified:boolean;observationId?:string;confidence01:number;expectedPostcondition?:string;observedPostcondition?:string;externalObservation?:boolean;contradicted?:boolean;executionId?:string;predictionId?:string;decisionId?:string;goalId?:string;data?:Record<string,unknown>}){
    const action=this.add('action',input.tick,`tool:${input.tool}`,{tool:input.tool,ok:input.ok,...(input.data??{})});
    if(input.goalId)this.link(input.goalId,action,'caused',.7);
    if(input.decisionId)this.link(input.decisionId,action,'caused',.85);
    if(input.predictionId)this.link(input.predictionId,action,'predicted',.9);
    const outcome=this.add('outcome',input.tick,`tool:${input.tool}:${input.ok?'ok':'failed'}`,{tool:input.tool,executionId:input.executionId,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition,externalObservation:Boolean(input.externalObservation),observationId:input.observationId},input.confidence01,input.observationId);
    if(input.executionId){
      this.outcomeIndex.delete(input.executionId);
      this.outcomeIndex.set(input.executionId,{executionId:input.executionId,outcomeId:outcome,tool:input.tool,tick:input.tick,at:Date.now(),ok:input.ok,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition,observationId:input.observationId,confidence01:clamp(input.confidence01)});
      while(this.outcomeIndex.size>this.maxOutcomeIndex){const oldest=this.outcomeIndex.keys().next().value as string|undefined;if(!oldest)break;this.outcomeIndex.delete(oldest);}
    }
    this.link(action,outcome,'caused',input.ok?.8:.35);
    if(input.verified){
      const verification=this.add('verification',input.tick,`verified:${input.tool}`,{basis:input.externalObservation?'external-postcondition':'tool-contract',observationId:input.observationId,executionId:input.executionId},input.confidence01,input.observationId);
      this.link(outcome,verification,'verified-by',input.confidence01);
      if(input.observationId){
        const observation=this.add('observation',input.tick,`observation:${input.observationId}`,{tool:input.tool,executionId:input.executionId,observedPostcondition:input.observedPostcondition},input.confidence01,input.observationId);
        this.link(verification,observation,'observed',input.confidence01);
      }
    } else if(input.contradicted === true) {
      // A negative learning signal requires explicit contradictory evidence. A missing
      // verification is unknown, not proof that the predicted postcondition was false.
      const error=this.add('prediction-error',input.tick,`outcome-contradicted:${input.tool}`,{tool:input.tool,executionId:input.executionId,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition},input.confidence01);
      this.link(outcome,error,'contradicted',input.confidence01);
    }
    return {actionId:action,outcomeId:outcome};
  }

  resolveExternalVerification(input:{tick:number;tool:string;observationId:string;verified:boolean;contradicted?:boolean;eligibleForLearning?:boolean;independentContradictionSources?:number;sourceId?:string;sourceClass?:string;independenceKey?:string;confidence01:number;expectedPostcondition?:string;observedPostcondition?:string;executionId?:string;reason?:string}):
    {resolved:true;verificationId:string;learningId?:string;replayed?:false}|{resolved:true;verificationId:string;learningId?:string;replayed:true}|{resolved:false;reason:'execution-id-required'|'no-matching-outcome'|'ambiguous-execution-receipt'} {
    const executionId=String(input.executionId??'').trim();
    if(!executionId) return {resolved:false,reason:'execution-id-required'};
    let matches=this.nodes.filter(n=>n.kind==='outcome'&&n.data&&n.data.tool===input.tool&&n.data.executionId===executionId);
    if(matches.length===0){
      const receipt=this.outcomeIndex.get(executionId);
      if(receipt&&receipt.tool===input.tool){
        const rehydrated=this.addNode({id:receipt.outcomeId,kind:'outcome',tick:receipt.tick,at:Date.now(),summary:`tool:${receipt.tool}:${receipt.ok?'ok':'failed'}:receipt-rehydrated`,confidence01:receipt.confidence01,evidenceRef:receipt.observationId,data:{tool:receipt.tool,executionId:receipt.executionId,expectedPostcondition:receipt.expectedPostcondition,observedPostcondition:receipt.observedPostcondition,externalObservation:Boolean(receipt.observationId),observationId:receipt.observationId,receiptRehydrated:true,originalAt:receipt.at}});
        matches=[rehydrated];
      }
    }
    if(matches.length!==1) return {resolved:false,reason:matches.length?'ambiguous-execution-receipt':'no-matching-outcome'};
    const outcome=matches[0];
    const prior=this.nodes.find(n=>n.kind==='verification'&&n.data&&n.data.executionId===executionId&&n.data.observationId===input.observationId&&n.data.basis==='external-postcondition');
    if(prior){
      const observation=this.nodes.find(n=>n.kind==='observation'&&n.data&&n.data.executionId===executionId&&n.data.observationId===input.observationId);
      const learning=this.nodes.find(n=>n.kind==='learning'&&n.data&&n.data.executionId===executionId&&n.data.observationId===input.observationId);
      const shouldLearn=prior.data?.eligibleForLearning===true;
      if(!observation||Boolean(prior.data?.verified)!==Boolean(input.verified)||Boolean(prior.data?.contradicted)!==(input.contradicted===true)||(shouldLearn&&!learning)||(!shouldLearn&&learning)) return {resolved:false,reason:'ambiguous-execution-receipt'};
      return {resolved:true,verificationId:prior.id,...(learning?{learningId:learning.id}:{}),replayed:true};
    }
    const contradicted=input.contradicted===true&&!input.verified;
    const eligibleForLearning=input.eligibleForLearning===true&&input.confidence01>=.72;
    const verification=this.add('verification',input.tick,`${input.verified?'verified':contradicted?'contradicted':'unresolved'}:${input.tool}`,{basis:'external-postcondition',observationId:input.observationId,executionId,verified:Boolean(input.verified),contradicted,eligibleForLearning,independentContradictionSources:Math.max(0,Math.floor(input.independentContradictionSources??0)),sourceId:String(input.sourceId??'').slice(0,180)||undefined,sourceClass:String(input.sourceClass??'').slice(0,40)||undefined,independenceKey:String(input.independenceKey??'').slice(0,120)||undefined,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition,reason:input.reason},input.confidence01,input.observationId);
    this.link(outcome.id,verification,input.verified?'verified-by':contradicted?'contradicted':'observed',input.confidence01);
    const observation=this.add('observation',input.tick,`external-observation:${input.observationId}`,{tool:input.tool,executionId,observationId:input.observationId,observedPostcondition:input.observedPostcondition},input.confidence01,input.observationId);
    this.link(verification,observation,'observed',input.confidence01);
    // Verification/contradiction is evidence for accountability. It becomes a
    // learning assignment only after the upstream evidence policy has checked
    // source class, independence, confidence and (for a contradiction) two distinct
    // independent lineages. Unknown or single-source negative evidence is not credit.
    if(contradicted){
      const error=this.add('prediction-error',input.tick,`external-outcome-contradicted:${input.tool}`,{tool:input.tool,executionId,observationId:input.observationId,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition,independenceKey:input.independenceKey},input.confidence01);
      this.link(outcome.id,error,'contradicted',input.confidence01);
    }
    if(eligibleForLearning){
      const learning=this.add('learning',input.tick,input.verified?`external-observation-confirmed:${input.tool}`:`external-observation-contradicted:${input.tool}`,{tool:input.tool,executionId,observationId:input.observationId,expectedPostcondition:input.expectedPostcondition,observedPostcondition:input.observedPostcondition,sourceId:input.sourceId,sourceClass:input.sourceClass,independenceKey:input.independenceKey,independentContradictionSources:Math.max(0,Math.floor(input.independentContradictionSources??0)),evidenceThresholdMet:true},input.confidence01);
      this.link(verification,learning,'learned-from',input.confidence01);
      return {resolved:true,verificationId:verification,learningId:learning};
    }
    return {resolved:true,verificationId:verification};
  }

  /**
   * Append an immutable authoritative-receipt evidence revision to an existing
   * action outcome. The base action/outcome node is never edited or duplicated.
   */
  recordEvidenceRevision(input:{revisionId:string;executionId:string;tool:string;tick:number;at:number;revisionNumber:number;providerReceiptHash:string;baseFingerprint:string;revisionFingerprint:string;supersedesRevisionId?:string;ok:boolean;verified:boolean;outcomeClass:string;basis:string;confidence01:number;observationId?:string;status:'verified'|'contradicted'|'unverified'}):
    {resolved:true;nodeId:string;replayed:boolean;causal:CausalAccountabilityState}|{resolved:false;reason:'execution-id-required'|'no-matching-outcome'|'ambiguous-execution-receipt'|'evidence-revision-conflict'} {
    const executionId=String(input.executionId??'').trim();
    const revisionId=String(input.revisionId??'').trim();
    if(!executionId||!revisionId)return {resolved:false,reason:'execution-id-required'};
    if(!/^[a-f0-9]{64}$/i.test(input.providerReceiptHash)||!/^[a-f0-9]{64}$/i.test(input.baseFingerprint)||!/^[a-f0-9]{64}$/i.test(input.revisionFingerprint))return {resolved:false,reason:'evidence-revision-conflict'};
    const nodeId=`causal:evidence-revision:${revisionId.replace(/[^a-zA-Z0-9:_-]/g,'').slice(-48)}`;
    const existing=this.nodes.find(node=>node.id===nodeId);
    if(existing){
      if(existing.kind!=='evidence-revision'||existing.data?.executionId!==executionId||existing.data?.revisionFingerprint!==input.revisionFingerprint||existing.data?.providerReceiptHash!==input.providerReceiptHash)
        return {resolved:false,reason:'evidence-revision-conflict'};
      return {resolved:true,nodeId,replayed:true,causal:this.snapshot()};
    }
    let matches=this.nodes.filter(node=>node.kind==='outcome'&&node.data?.executionId===executionId&&node.data?.tool===input.tool);
    if(matches.length===0){
      const receipt=this.outcomeIndex.get(executionId);
      if(receipt&&receipt.tool===input.tool){
        const rehydrated=this.addNode({id:receipt.outcomeId,kind:'outcome',tick:receipt.tick,at:Math.max(0,receipt.at),summary:`tool:${receipt.tool}:${receipt.ok?'ok':'failed'}:receipt-rehydrated`,confidence01:receipt.confidence01,evidenceRef:receipt.observationId,data:{tool:receipt.tool,executionId:receipt.executionId,expectedPostcondition:receipt.expectedPostcondition,observedPostcondition:receipt.observedPostcondition,externalObservation:Boolean(receipt.observationId),observationId:receipt.observationId,receiptRehydrated:true,originalAt:receipt.at}});
        matches=[rehydrated];
      }
    }
    if(matches.length!==1)return {resolved:false,reason:matches.length?'ambiguous-execution-receipt':'no-matching-outcome'};
    const outcome=matches[0];
    const priorRevision=this.nodes.filter(node=>node.kind==='evidence-revision'&&node.data?.executionId===executionId).sort((a,b)=>Number(a.data?.revisionNumber??0)-Number(b.data?.revisionNumber??0)).at(-1);
    if(input.supersedesRevisionId && priorRevision && priorRevision.data?.revisionId!==input.supersedesRevisionId)
      return {resolved:false,reason:'evidence-revision-conflict'};
    const node=this.addNode({id:nodeId,kind:'evidence-revision',tick:Math.max(0,Math.floor(input.tick)),at:Math.max(0,Number(input.at)||Date.now()),summary:`authoritative-provider-receipt:${input.tool}:revision-${Math.max(1,Math.floor(input.revisionNumber))}`,confidence01:clamp(input.confidence01),evidenceRef:input.observationId,data:{
      revisionId,executionId,tool:input.tool,revisionNumber:Math.max(1,Math.floor(input.revisionNumber)),providerReceiptHash:input.providerReceiptHash,
      baseFingerprint:input.baseFingerprint,revisionFingerprint:input.revisionFingerprint,supersedesRevisionId:input.supersedesRevisionId,
      ok:Boolean(input.ok),verified:Boolean(input.verified),outcomeClass:String(input.outcomeClass).slice(0,64),basis:String(input.basis).slice(0,48),confidence01:clamp(input.confidence01),observationId:input.observationId,status:input.status,
    }});
    this.link(outcome.id,node.id,input.verified?'verified-by':'observed',input.confidence01);
    if(priorRevision && input.supersedesRevisionId===priorRevision.data?.revisionId)this.link(node.id,priorRevision.id,'supersedes',input.confidence01);
    return {resolved:true,nodeId:node.id,replayed:false,causal:this.snapshot()};
  }

  recordLearning(tick:number,summary:string,sourceNodeId?:string,confidence01=.5){
    const id=this.add('learning',tick,summary,undefined,confidence01);
    if(sourceNodeId)this.link(sourceNodeId,id,'learned-from',confidence01);
    return id;
  }

  compact(){
    const live=new Set(this.activeChains);
    const keepNodes=this.nodes.filter(n=>live.has(n.id)||n.kind==='verification'||n.kind==='prediction-error').slice(-this.maxNodes);
    const ids=new Set(keepNodes.map(n=>n.id));
    this.nodes=keepNodes;
    this.edges=this.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).slice(-this.maxEdges);
  }

  snapshot():CausalAccountabilityState{
    return {version:1,nodes:this.nodes.map(n=>structuredClone(n)),edges:this.edges.map(e=>structuredClone(e)),activeChains:[...this.activeChains],lastAt:this.nodes.at(-1)?.at??0,updatedAt:this.updatedAt,outcomeIndex:[...this.outcomeIndex.values()].map(row=>structuredClone(row))};
  }

  restore(snapshot?:Partial<CausalAccountabilityState>){
    this.nodes=Array.isArray(snapshot?.nodes)?snapshot!.nodes!.slice(-this.maxNodes).map(n=>structuredClone(n)):[];
    this.updatedAt=Number.isFinite(snapshot?.updatedAt)?Number(snapshot!.updatedAt):(this.nodes.at(-1)?.at??0);
    this.edges=Array.isArray(snapshot?.edges)?snapshot!.edges!.slice(-this.maxEdges).map(e=>structuredClone(e)):[];
    this.activeChains=Array.isArray(snapshot?.activeChains)?snapshot!.activeChains!.slice(0,this.maxChains):[];
    this.outcomeIndex.clear();
    if(Array.isArray(snapshot?.outcomeIndex))for(const value of snapshot.outcomeIndex.slice(-this.maxOutcomeIndex)){
      if(!value||typeof value.executionId!=='string'||!value.executionId.trim()||value.executionId.length>180||typeof value.outcomeId!=='string'||!value.outcomeId.trim()||typeof value.tool!=='string'||!value.tool.trim()||value.tool.length>180||!Number.isFinite(Number(value.tick))||!Number.isFinite(Number(value.at))||typeof value.ok!=='boolean')continue;
      this.outcomeIndex.set(value.executionId,{...structuredClone(value),confidence01:clamp(Number(value.confidence01))});
    }
    // Old snapshots do not have the directory; seed it from retained outcome nodes.
    for(const node of this.nodes){
      if(node.kind!=='outcome'||!node.data||typeof node.data.executionId!=='string'||typeof node.data.tool!=='string'||this.outcomeIndex.has(node.data.executionId))continue;
      this.outcomeIndex.set(node.data.executionId,{executionId:node.data.executionId,outcomeId:node.id,tool:node.data.tool,tick:node.tick,at:node.at,ok:String(node.summary).endsWith(':ok'),expectedPostcondition:typeof node.data.expectedPostcondition==='string'?node.data.expectedPostcondition:undefined,observedPostcondition:typeof node.data.observedPostcondition==='string'?node.data.observedPostcondition:undefined,observationId:typeof node.data.observationId==='string'?node.data.observationId:undefined,confidence01:clamp(Number(node.confidence01??0))});
    }
    while(this.outcomeIndex.size>this.maxOutcomeIndex){const oldest=this.outcomeIndex.keys().next().value as string|undefined;if(!oldest)break;this.outcomeIndex.delete(oldest);}
  }

  summary(){return {version:1,nodes:this.nodes.length,edges:this.edges.length,activeChains:this.activeChains.length,lastAt:this.nodes.at(-1)?.at??0,updatedAt:this.updatedAt,verificationNodes:this.nodes.filter(n=>n.kind==='verification').length,predictionErrors:this.nodes.filter(n=>n.kind==='prediction-error').length};}
}
