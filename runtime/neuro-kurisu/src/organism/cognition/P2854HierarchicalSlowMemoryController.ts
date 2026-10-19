export type P2854SlowMemoryPhase='wake'|'quiet'|'sleepRecent'|'sleepPrior'|'transfer';

export interface P2854HierarchicalSlowMemoryState {
  version:1;
  enabled:boolean;
  contextSlots:number;
  schemaSlots:number;
  dimension:number;
  contextPrototypes:number[][];
  schemaPrototypes:number[][];
  contextVisits:number[];
  schemaVisits:number[];
  contextSchemaAffinity:number[][];
  contextActionValues:number[][];
  schemaActionValues:number[][];
  actionUpdates:number;
  retrievals:number;
  updates:number;
  schemaUpdates:number;
  transferAccepted:number;
  transferRejected:number;
  consolidationCycles:number;
  agreement01:number;
  hierarchyAgreement01:number;
  stability01:number;
  memoryBudget01:number;
  compactedWrites:number;
  lastContextId:number;
  lastSchemaId:number;
  lastPhase:P2854SlowMemoryPhase;
}

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const contextId=(x:number)=>Math.max(0,Math.min(7,Math.floor(Number.isFinite(x)?x:0)));
const schemaId=(x:number)=>Math.max(0,Math.min(3,Math.floor(Number.isFinite(x)?x:0)));
const cosine=(a:number[],b:number[])=>{
  let dot=0,a2=0,b2=0;
  for(let i=0;i<16;i++){
    const av=a[i]??0,bv=b[i]??0;
    dot+=av*bv;a2+=av*av;b2+=bv*bv;
  }
  return a2&&b2?clamp((dot/Math.sqrt(a2*b2)+1)/2):.5;
};
const nearestSchema=(affinity:number[])=>{
  let best=0,bestValue=-Infinity;
  for(let i=0;i<affinity.length;i++)if((affinity[i]??0)>bestValue){best=i;bestValue=affinity[i]??0;}
  return best;
};

export const defaultP2854HierarchicalSlowMemory=():P2854HierarchicalSlowMemoryState=>({
  version:1,
  enabled:true,
  contextSlots:8,
  schemaSlots:4,
  dimension:16,
  contextPrototypes:Array.from({length:8},()=>new Array(16).fill(0)),
  schemaPrototypes:Array.from({length:4},()=>new Array(16).fill(0)),
  contextVisits:new Array(8).fill(0),
  schemaVisits:new Array(4).fill(0),
  contextSchemaAffinity:Array.from({length:8},()=>new Array(4).fill(.25)),
  contextActionValues:Array.from({length:8},()=>new Array(7).fill(0)),
  schemaActionValues:Array.from({length:4},()=>new Array(7).fill(0)),
  actionUpdates:0,
  retrievals:0,
  updates:0,
  schemaUpdates:0,
  transferAccepted:0,
  transferRejected:0,
  consolidationCycles:0,
  agreement01:.5,
  hierarchyAgreement01:.5,
  stability01:.5,
  memoryBudget01:1,
  compactedWrites:0,
  lastContextId:0,
  lastSchemaId:0,
  lastPhase:'wake',
});

export class P2854HierarchicalSlowMemoryController{
  private state=defaultP2854HierarchicalSlowMemory();

  private contextFor(vector:number[],context:number){
    const slot=contextId(context);
    const energy=vector.slice(0,16).reduce((sum,v)=>sum+Math.abs(Number(v)||0),0)/16;
    const signature=(Number(vector[0]??0)*.73+Number(vector[1]??0)*.51+Number(vector[2]??0)*.37+Number(vector[3]??0)*.19+energy*2.7+slot*.31+2.0)*1.17;
    const schema=schemaId(Math.floor(Math.abs(signature)));
    return {slot,schema};
  }

  private nearestContextSlot(cue:number[],fallback:number){
    const cue16=cue.slice(0,16);
    let best=fallback,bestScore=-1;
    for(let slot=0;slot<this.state.contextSlots;slot++){
      const visits=this.state.contextVisits[slot]??0;
      if(visits<=0)continue;
      const score=cosine(cue16,this.state.contextPrototypes[slot]!)*(.55+.45*Math.min(1,visits/12));
      if(score>bestScore){bestScore=score;best=slot;}
    }
    return {slot:best,similarity:bestScore};
  }

  private nearestLearnedSchema(cue:number[],fallback:number){
    const cue16=cue.slice(0,16);
    let best=fallback,bestScore=-1;
    for(let schema=0;schema<this.state.schemaSlots;schema++){
      const visits=this.state.schemaVisits[schema]??0;
      if(visits<=0)continue;
      const score=cosine(cue16,this.state.schemaPrototypes[schema]!)*(.55+.45*Math.min(1,visits/18));
      if(score>bestScore){bestScore=score;best=schema;}
    }
    return {schema:best,similarity:bestScore};
  }

  private retrievalSlots(context:number,cue:number[]){
    const base=this.contextFor(cue,context);
    const nearest=this.nearestContextSlot(cue,base.slot);
    const slot=nearest.similarity>=.28?nearest.slot:base.slot;
    const schemaBase=slot===base.slot?base.schema:this.nearestLearnedSchema(cue,base.schema).schema;
    const schemaNearest=this.nearestLearnedSchema(cue,schemaBase);
    const schema=schemaNearest.similarity>=.25?schemaNearest.schema:schemaBase;
    return {slot,schema};
  }

  retrieve(context:number,cue:number[],budget01:number,phase:P2854SlowMemoryPhase){
    if(!this.state.enabled)return {vector:new Array(16).fill(0),strength01:0,contextSimilarity01:.5,schemaSimilarity01:.5,hierarchyAgreement01:.5,schemaId:0};
    const {slot,schema:preferredSchema}=this.retrievalSlots(context,cue);
    const cue16=cue.slice(0,16);
    const contextProto=this.state.contextPrototypes[slot]!;
    const affinity=this.state.contextSchemaAffinity[slot]!;
    const schema=preferredSchema;
    const schemaProto=this.state.schemaPrototypes[schema]!;
    const contextSimilarity=cosine(cue16,contextProto);
    const schemaSimilarity=cosine(cue16,schemaProto);
    const protoAgreement=cosine(contextProto,schemaProto);
    const visits=this.state.contextVisits[slot]??0;
    const schemaVisits=this.state.schemaVisits[schema]??0;
    const phaseGain=phase==='sleepPrior'?1:phase==='sleepRecent'?.86:phase==='transfer'?.78:phase==='quiet'?.52:.38;
    const gate=clamp((Math.max(contextSimilarity,schemaSimilarity)-.50)*2.7);
    const strength=clamp((.045+.11*Math.min(1,visits/10)+.07*Math.min(1,schemaVisits/18))*gate*phaseGain*(.55+.45*clamp(budget01)),0,.42);
    const vector=new Array(16).fill(0);
    for(let i=0;i<16;i++)vector[i]=clamp((contextProto[i]??0)*.64+(schemaProto[i]??0)*.36,-1,1);
    this.state.retrievals++;
    this.state.agreement01=clamp(this.state.agreement01*.96+Math.max(contextSimilarity,schemaSimilarity)*.04);
    this.state.hierarchyAgreement01=clamp(this.state.hierarchyAgreement01*.94+protoAgreement*.06);
    this.state.memoryBudget01=clamp(budget01);
    this.state.lastContextId=slot;
    this.state.lastSchemaId=schema;
    this.state.lastPhase=phase;
    return {vector,strength01:strength,contextSimilarity01:contextSimilarity,schemaSimilarity01:schemaSimilarity,hierarchyAgreement01:protoAgreement,schemaId:schema};
  }

  actionBias(context:number,actionCount:number,budget01:number,phase:P2854SlowMemoryPhase,cue:number[]=[]){
    if(!this.state.enabled)return new Array(actionCount).fill(0);
    const fallback=contextId(context);
    const resolved=cue.length?this.retrievalSlots(context,cue):{slot:this.state.lastContextId??fallback,schema:this.state.lastSchemaId??nearestSchema(this.state.contextSchemaAffinity[fallback]!)};
    const slot=resolved.slot,schema=resolved.schema;
    const affinity=this.state.contextSchemaAffinity[slot]!,affinitySchema=nearestSchema(affinity);
    const finalSchema=(this.state.schemaVisits[schema]??0)>0?schema:affinitySchema;
    const phaseGain=phase==='sleepPrior'?1:phase==='sleepRecent'?.86:phase==='transfer'?.78:phase==='quiet'?.62:.50;
    const retrievalGate=cue.length?clamp(.45+.55*Math.max(0,cosine(cue.slice(0,16),this.state.contextPrototypes[slot]!))):1;
    const strength=(.55+.45*Math.min(1,(this.state.contextVisits[slot]??0)/12))*retrievalGate;
    return Array.from({length:actionCount},(_,a)=>clamp(((this.state.contextActionValues[slot]?.[a]??0)*.70+(this.state.schemaActionValues[finalSchema]?.[a]??0)*.30)*phaseGain*(.60+.40*clamp(budget01))*strength,-.16,.16));
  }

  compatibility(context:number,cue:number[]){
    if(!this.state.enabled)return {context01:0,schema01:0,hierarchy01:0,schemaId:0,accepted:false};
    const {slot,schema:preferredSchema}=this.contextFor(cue,context);
    const cue16=cue.slice(0,16),affinity=this.state.contextSchemaAffinity[slot]!;
    const schema=preferredSchema;
    const context01=cosine(cue16,this.state.contextPrototypes[slot]!);
    const schema01=cosine(cue16,this.state.schemaPrototypes[schema]!);
    const hierarchy01=cosine(this.state.contextPrototypes[slot]!,this.state.schemaPrototypes[schema]!);
    const seen=(this.state.contextVisits[slot]??0)>0;
    const accepted=!seen||clamp(.62*context01+.38*schema01+.10*hierarchy01-.10)>=.52;
    if(accepted)this.state.transferAccepted++; else this.state.transferRejected++;
    return {context01,schema01,hierarchy01,schemaId:schema,accepted};
  }

  observe(context:number,vector:number[],reward01:number,error01:number,verified01:number,novelty01:number,phase:P2854SlowMemoryPhase,budget01:number,actionIndex=-1){
    if(!this.state.enabled)return {eta:0,contextId:contextId(context),schemaId:0,agreement01:.5,hierarchyAgreement01:.5};
    const {slot,targetSchema}=(()=>{const c=this.contextFor(vector,context);return {slot:c.slot,targetSchema:c.schema};})();
    const v=vector.slice(0,16);
    const contextPrototype=this.state.contextPrototypes[slot]!;
    const affinity=this.state.contextSchemaAffinity[slot]!;
    const currentSchema=targetSchema;
    const schemaPrototype=this.state.schemaPrototypes[currentSchema]!;
    const stability=clamp(.55+.45*(1-clamp(error01)));
    const evidence=clamp(.48*clamp(verified01)+.18*(1-clamp(novelty01))+.20*stability+.14*clamp(reward01));
    const resource=clamp(budget01);
    const phaseScale=phase==='sleepPrior'?1.55:phase==='sleepRecent'?1.18:phase==='transfer'?.92:phase==='quiet'?.62:.40;
    const etaContext=clamp((.0055+.012*evidence)*phaseScale*(.50+.50*resource),.002,.032);
    const etaSchema=clamp(etaContext*(phase==='sleepPrior'?0.58:phase==='sleepRecent'?.46:.34),.001,.018);
    const beforeContext=contextPrototype.slice();
    const beforeSchema=schemaPrototype.slice();
    for(let i=0;i<16;i++){
      const source=clamp(Number(v[i]??0),-1,1);
      contextPrototype[i]=clamp((contextPrototype[i]??0)+(source-(contextPrototype[i]??0))*etaContext,-1,1);
      schemaPrototype[i]=clamp((schemaPrototype[i]??0)+(source-(schemaPrototype[i]??0))*etaSchema,-1,1);
    }
    affinity[targetSchema]=clamp((affinity[targetSchema]??.25)*.96+.04*(.55+.45*evidence),.02,.98);
    const sum=affinity.reduce((a,b)=>a+b,0);
    if(sum>0)for(let i=0;i<affinity.length;i++)affinity[i]=affinity[i]!/sum;
    this.state.contextVisits[slot]=Math.min(65535,(this.state.contextVisits[slot]??0)+1);
    this.state.schemaVisits[targetSchema]=Math.min(65535,(this.state.schemaVisits[targetSchema]??0)+1);
    this.state.updates++;
    this.state.schemaUpdates++;
    this.state.consolidationCycles++;
    const contextAgreement=cosine(contextPrototype,beforeContext);
    const schemaAgreement=cosine(schemaPrototype,beforeSchema);
    const hierarchyAgreement=cosine(contextPrototype,schemaPrototype);
    this.state.agreement01=clamp(this.state.agreement01*.94+contextAgreement*.06);
    this.state.hierarchyAgreement01=clamp(this.state.hierarchyAgreement01*.94+hierarchyAgreement*.06);
    this.state.stability01=clamp(this.state.stability01*.985+(1-clamp(error01))*.015);
    this.state.memoryBudget01=resource;
    this.state.lastContextId=slot;
    this.state.lastSchemaId=targetSchema;
    this.state.lastPhase=phase;
    if(actionIndex>=0&&actionIndex<7){
      const advantage=clamp(reward01-.5,-.5,.5);
      const etaAction=clamp((.006+.010*evidence)*phaseScale*(.55+.45*resource),.002,.022);
      const contextValues=this.state.contextActionValues[slot]!;
      const schemaValues=this.state.schemaActionValues[targetSchema]!;
      for(let a=0;a<7;a++){
        const selected=a===actionIndex?1:-.18;
        contextValues[a]=clamp((contextValues[a]??0)+advantage*selected*etaAction,-.12,.12);
        schemaValues[a]=clamp((schemaValues[a]??0)+advantage*selected*etaAction*.58,-.12,.12);
      }
      this.state.actionUpdates++;
    }
    if(resource<.28)this.state.compactedWrites++;
    return {eta:etaContext,contextId:slot,schemaId:targetSchema,agreement01:contextAgreement,hierarchyAgreement01:.5*(hierarchyAgreement+schemaAgreement)};
  }

  setEnabled(enabled:boolean){this.state.enabled=Boolean(enabled);}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2854HierarchicalSlowMemoryState>|null){
    const d=defaultP2854HierarchicalSlowMemory(),r:any=raw??{};
    const matrix=(v:any,rows:number)=>Array.from({length:rows},(_,i)=>Array.isArray(v?.[i])?v[i].slice(0,16).concat(new Array(Math.max(0,16-v[i].length)).fill(0)).slice(0,16):new Array(16).fill(0));
    const affinity=Array.from({length:8},(_,i)=>Array.isArray(r.contextSchemaAffinity?.[i])?r.contextSchemaAffinity[i].slice(0,4).concat(new Array(Math.max(0,4-r.contextSchemaAffinity[i].length)).fill(.25)).slice(0,4):new Array(4).fill(.25));
    const actionMatrix=(v:any,rows:number)=>Array.from({length:rows},(_,i)=>Array.isArray(v?.[i])?v[i].slice(0,7).concat(new Array(Math.max(0,7-v[i].length)).fill(0)).slice(0,7):new Array(7).fill(0));
    for(const row of affinity){const s=row.reduce((a:number,b:number)=>a+(Number(b)||0),0);if(s>0)for(let i=0;i<row.length;i++)row[i]=clamp((Number(row[i])||0)/s,.02,.98);}
    this.state={
      ...d,
      ...structuredClone(r),
      version:1,
      enabled:r.enabled!==false,
      contextSlots:8,
      schemaSlots:4,
      dimension:16,
      contextPrototypes:matrix(r.contextPrototypes,8),
      schemaPrototypes:matrix(r.schemaPrototypes,4),
      contextVisits:Array.from({length:8},(_,i)=>Math.max(0,Math.floor(Number(r.contextVisits?.[i]??0)))),
      schemaVisits:Array.from({length:4},(_,i)=>Math.max(0,Math.floor(Number(r.schemaVisits?.[i]??0)))),
      contextSchemaAffinity:affinity,
      contextActionValues:actionMatrix(r.contextActionValues,8),
      schemaActionValues:actionMatrix(r.schemaActionValues,4),
      actionUpdates:Math.max(0,Math.floor(Number(r.actionUpdates??0))),
      retrievals:Math.max(0,Math.floor(Number(r.retrievals??0))),
      updates:Math.max(0,Math.floor(Number(r.updates??0))),
      schemaUpdates:Math.max(0,Math.floor(Number(r.schemaUpdates??0))),
      transferAccepted:Math.max(0,Math.floor(Number(r.transferAccepted??0))),
      transferRejected:Math.max(0,Math.floor(Number(r.transferRejected??0))),
      consolidationCycles:Math.max(0,Math.floor(Number(r.consolidationCycles??0))),
      agreement01:clamp(Number(r.agreement01??d.agreement01)),
      hierarchyAgreement01:clamp(Number(r.hierarchyAgreement01??d.hierarchyAgreement01)),
      stability01:clamp(Number(r.stability01??d.stability01)),
      memoryBudget01:clamp(Number(r.memoryBudget01??1)),
      compactedWrites:Math.max(0,Math.floor(Number(r.compactedWrites??0))),
      lastContextId:contextId(Number(r.lastContextId??0)),
      lastSchemaId:schemaId(Number(r.lastSchemaId??0)),
      lastPhase:(['wake','quiet','sleepRecent','sleepPrior','transfer'] as const).includes(r.lastPhase)?r.lastPhase:d.lastPhase,
    };
  }
  metrics(){
    const estimatedBytes=(8*16+4*16+8*4+8*7+4*7+8+4)*8;
    return {...this.snapshot(),estimatedBytes,estimatedKB:estimatedBytes/1024};
  }
}
