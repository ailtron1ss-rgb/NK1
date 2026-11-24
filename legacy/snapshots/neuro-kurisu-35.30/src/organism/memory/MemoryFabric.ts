import type { OrganismEvent } from './EventSourcing.ts';
import { EventLog, makeEvent } from './EventSourcing.ts';
import { MemoryOS2, type MemoryItem2, type MemoryOSState2, type MemoryTemporalQueryOptions } from '../developmental/MemoryOS2.ts';
import { MultiTimescaleMemory, type MemoryRecord } from './MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem, type MemoryDevelopmentState } from '../developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric, type P62Frame } from './P62MemoryFabric.ts';
import { SemanticMemoryGraph } from './SemanticMemoryGraph.ts';
import { MemoryPolicyOutcomeLedger, defaultMemoryPolicyOutcomeLedger, type MemoryPolicyDelayedOutcome } from '../system/MemoryPolicyOutcomeLedger.ts';

type EncodeInput = Omit<MemoryItem2,'id'|'createdAt'|'lastAccessAt'|'retrievalCount'|'revisionHistory'|'dormant'|'semanticVector'|'temperature01'> & { id?: string };

export interface MemoryFabricConfig {
  maxHotItems?: number;
  maxRecentEvents?: number;
  compatibilityRefreshEvery?: number;
}

export interface MemoryFabricSnapshot {
  version: 2;
  stats: {
    encodes: number;
    newItems: number;
    reconsolidations: number;
    retrievals: number;
    retrievalHits: number;
    maintenanceRuns: number;
    compatibilityProjections: number;
  };
  hotIds: string[];
  residency?: { counts:{hot:number;warm:number;cold:number}; targetItems:number; materializedVectors:number };
  policyOutcomeLedger?: ReturnType<MemoryPolicyOutcomeLedger['snapshot']>;
}

export interface MemoryFabricRestore {
  stats?: Partial<MemoryFabricSnapshot['stats']>;
  hotIds?: string[];
  policyOutcomeLedger?: ReturnType<MemoryPolicyOutcomeLedger['snapshot']>;
}

const clampInt=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number.isFinite(x)?x:min)));

/**
 * Unified memory coordinator. MemoryOS2 remains the single durable authority.
 * Other memory stores are compatibility/read models and are never promoted to
 * a second source of truth by this class.
 */
export class MemoryFabric {
  private readonly config:Required<MemoryFabricConfig>;
  private readonly hotIds:string[]=[];
  private readonly statsData={encodes:0,newItems:0,reconsolidations:0,retrievals:0,retrievalHits:0,maintenanceRuns:0,compatibilityProjections:0};
  private readonly memoryOS:MemoryOS2;
  private readonly events:EventLog;
  private readonly multiTimescale:MultiTimescaleMemory;
  private readonly substrate:MemorySubstrateCoordinator;
  private readonly unifiedMemory:UnifiedMemorySystem;
  private readonly p62:P62MemoryFabric;
  private readonly semanticMemory:SemanticMemoryGraph;
  private lastMaintenanceTick=-1;
  private readonly policyOutcomeLedger=defaultMemoryPolicyOutcomeLedger();
  private lastPolicyDecisionId:string|undefined;

  constructor(
    memoryOS:MemoryOS2,
    events:EventLog,
    multiTimescale:MultiTimescaleMemory,
    substrate:MemorySubstrateCoordinator,
    unifiedMemory:UnifiedMemorySystem,
    p62:P62MemoryFabric,
    semanticMemory:SemanticMemoryGraph,
    config:MemoryFabricConfig={}
  ) {
    this.memoryOS=memoryOS;
    this.events=events;
    this.multiTimescale=multiTimescale;
    this.substrate=substrate;
    this.unifiedMemory=unifiedMemory;
    this.p62=p62;
    this.semanticMemory=semanticMemory;
    this.config={
      maxHotItems:clampInt(config.maxHotItems??32,8,96),
      maxRecentEvents:clampInt(config.maxRecentEvents??96,32,320),
      compatibilityRefreshEvery:clampInt(config.compatibilityRefreshEvery??8,1,64),
    };
  }

  encode(input:EncodeInput, context:{tick?:number;emitEvent?:boolean;syncCompatibility?:boolean}={}) {
    this.statsData.encodes++;
    const before=this.memoryOS.size();
    const item=this.memoryOS.encode(input,{clone:false});
    const created=this.memoryOS.size()>before;
    if(created)this.statsData.newItems++; else this.statsData.reconsolidations++;
    this.touchHot(item.id);
    if(context.emitEvent!==false){
      this.events.append(makeEvent('memory-created',context.tick??0,{
        memoryId:item.id,kind:item.kind,source:item.source,created,action:created?'encode':'reconsolidate',
      }));
    }
    if(context.syncCompatibility) this.projectCompatibility(32);
    return item;
  }

  retrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{tick?:number;emitEvent?:boolean;temporalMode?:MemoryTemporalQueryOptions['temporalMode'];asOfAt?:number}={}) {
    const rows=this.memoryOS.retrieve(query,Math.max(1,Math.min(32,Math.floor(limit))),goalRelevance,identityRelevance,{temporalMode:context.temporalMode,asOfAt:context.asOfAt});
    this.statsData.retrievals++;
    this.statsData.retrievalHits+=rows.length;
    const policy=this.memoryOS.adaptivePolicyDiagnostics();
    const decision=this.policyOutcomeLedger.register({policy:policy.lastPolicy,contextKey:policy.lastContextKey,query,memoryIds:rows.map(row=>row.id),at:Date.now(),hit01:rows.length?1:0,computeCost01:this.memoryOS.retrievalDiagnostics().candidateCount/192});
    this.lastPolicyDecisionId=decision.id;
    for(const row of rows)this.touchHot(row.id);
    if(context.emitEvent){
      this.events.append(makeEvent('attention',context.tick??0,{
        source:'memory-fabric',
        query:query.slice(0,160),
        hits:rows.length,
        touchedMemoryIds:rows.slice(0,12).map(row=>row.id),
        evidenceMode:'retrieval-audit',
      }));
    }
    this.unifiedMemory.recordRetrieval(query,rows.length);
    return rows;
  }

  recall(query:string,limit=8):P62Frame {
    const canonical=this.memoryOS.snapshot({clone:false});
    const continuum=this.multiTimescale.retrieve(query,Math.min(16,Math.max(1,limit)));
    const frame=this.p62.recall({
      query,
      memoryOS:canonical.items.slice(0,128).map(m=>({id:m.id,content:m.content,kind:m.kind,confidence01:m.confidence,salience01:m.salience,source:m.source,status:m.epistemicStatus})),
      multiTimescale:continuum.map(m=>({id:m.id,content:m.summary,kind:m.kind,confidence01:m.confidence,salience01:m.salience,source:'multi-timescale'})),
      semanticNodes:this.semanticMemory.retrieve(query,Math.min(8,Math.max(1,limit))).map(x=>({id:x.id,label:x.label,type:x.type,salience:x.salience})),
      beliefs:this.unifiedMemory.snapshot().beliefs,
      maxItems:Math.max(1,Math.min(12,limit)),
    });
    return frame;
  }

  maintain(options:{pressure01?:number;maxItems?:number;tick?:number;force?:boolean;hotBudget?:number;warmBudget?:number;coldBudget?:number;identityTension01?:number}={}) {
    const tick=Number.isFinite(options.tick)?Number(options.tick):-1;
    if(!options.force && tick>=0 && tick===this.lastMaintenanceTick)return {skipped:true,changed:0};
    const before=this.memoryOS.size();
    this.memoryOS.maintain({pressure01:options.pressure01,maxItems:options.maxItems});
    if(options.hotBudget!==undefined||options.warmBudget!==undefined||options.coldBudget!==undefined||options.identityTension01!==undefined) this.memoryOS.applyResidencyPlan({hotBudget:options.hotBudget,warmBudget:options.warmBudget,coldBudget:options.coldBudget,pressure01:options.pressure01,identityTension01:options.identityTension01});
    this.lastMaintenanceTick=tick;
    this.statsData.maintenanceRuns++;
    const changed=Math.max(0,before-this.memoryOS.size());
    if(changed||options.force)this.events.append(makeEvent('memory-lifecycle',tick,{source:'memory-fabric',before,after:this.memoryOS.size(),changed,pressure01:options.pressure01??0} as Record<string,unknown>));
    return {skipped:false,changed};
  }

  projectCompatibility(limit=48) {
    const rows=this.substrate.projectCompatibilityRecords(this.memoryOS.snapshot({clone:false}),limit);
    this.statsData.compatibilityProjections++;
    for(const row of rows)this.multiTimescale.add(row);
    return rows.length;
  }

  ingestCompatibility(row:MemoryRecord, tick=0) {
    const item=this.substrate.ingestCompatibilityRecord(this.memoryOS,row);
    this.touchHot(item.id);
    this.events.append(makeEvent('memory-created',tick,{memoryId:item.id,kind:item.kind,source:'compatibility-projection',compatibility:true}));
    return item;
  }

  compactRecentEvents(max=this.config.maxRecentEvents) {
    const bounded=Math.max(32,Math.min(320,Math.floor(max)));
    const recent=this.events.recent(bounded,false);
    const counts=new Map<string,number>();
    for(const event of recent)counts.set(event.type,(counts.get(event.type)??0)+1);
    return {
      retained:recent.length,
      oldestTick:recent[0]?.tick??0,
      newestTick:recent.at(-1)?.tick??0,
      types:Object.fromEntries(counts),
    };
  }

  hotIdsSnapshot(){return [...this.hotIds];}
  snapshot():MemoryFabricSnapshot {
    return {version:2,stats:{...this.statsData},hotIds:[...this.hotIds],residency:this.memoryOS.residencyDiagnostics(),policyOutcomeLedger:this.policyOutcomeLedger.snapshot()};
  }
  restore(raw:MemoryFabricRestore|undefined){
    if(!raw)return;
    Object.assign(this.statsData,{...this.statsData,...raw.stats});
    this.hotIds.length=0;this.hotIds.push(...(raw.hotIds??[]).slice(0,this.config.maxHotItems));
    this.policyOutcomeLedger.restore(raw.policyOutcomeLedger);
  }


  resolveAdaptivePolicyOutcome(input:{memoryId:string;validationAt:number;retentionScore01:number;transferPotential01:number;interferenceRisk01:number;causalCredit01:number;independentVerified:boolean;decisionId?:string}){
    const outcome=this.policyOutcomeLedger.resolve(input);
    if(!outcome)return null;
    this.memoryOS.observeRetrievalOutcomeV2(outcome,outcome.policy);
    return outcome;
  }
  adaptivePolicyOutcomeDiagnostics(){return {...this.policyOutcomeLedger.diagnostics(),lastPolicyDecisionId:this.lastPolicyDecisionId};}
  lastAdaptivePolicyDecisionId(){return this.lastPolicyDecisionId??null;}
  retrieveWithPolicyDecision(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{tick?:number;emitEvent?:boolean}={}){
    const rows=this.retrieve(query,limit,goalRelevance,identityRelevance,context);
    return {decisionId:this.lastPolicyDecisionId??null,rows};
  }

  revise(id:string,to:MemoryItem2['epistemicStatus'],reason:string){
    return this.memoryOS.revise(id,to,reason);
  }

  reviseContent(id:string,newContent:string,options:Parameters<MemoryOS2['reviseContent']>[2]={}){
    const item=this.memoryOS.reviseContent(id,newContent,options);
    if(item)this.touchHot(item.id);
    return item;
  }

  updateSignals(id:string, patch:Parameters<MemoryOS2['updateSignals']>[1], reason='reconsolidation'){
    return this.memoryOS.updateSignals(id,patch,reason);
  }

  forgetById(id:string,reason='memory-knockout'){
    return this.memoryOS.forgetById(id,reason);
  }

  canonicalSize(){return this.memoryOS.size();}
  canonicalSnapshot(clone=true){return this.memoryOS.snapshot({clone});}

  inspect(){
    const canonical=this.memoryOS.snapshot({clone:false});
    const compatibility=this.multiTimescale.snapshot({clone:false});
    return {
      canonicalAuthority:'memoryOS2' as const,
      canonicalItems:canonical.items.length,
      compatibilityItems:compatibility.length,
      hotItems:this.hotIds.length,
      stats:{...this.statsData},
      eventWindow:this.compactRecentEvents(),
    };
  }

  private touchHot(id:string){
    const i=this.hotIds.indexOf(id);if(i>=0)this.hotIds.splice(i,1);
    this.hotIds.unshift(id);
    if(this.hotIds.length>this.config.maxHotItems)this.hotIds.length=this.config.maxHotItems;
  }
}

export function isMemoryFabricSnapshot(value:unknown):value is MemoryFabricSnapshot {
  const x=value as MemoryFabricSnapshot|undefined;
  return Boolean(x&&x.version===2&&x.stats&&Array.isArray(x.hotIds));
}
