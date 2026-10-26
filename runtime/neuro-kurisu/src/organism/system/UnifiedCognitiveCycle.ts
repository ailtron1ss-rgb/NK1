/**
 * BIG PASS 162 / WorkPass287 — Unified Cognitive Cycle contract.
 *
 * The cycle is an evidence aggregator, not a consciousness claim. It counts a
 * cycle as complete only when required stages have bounded identities and the
 * causal parent chain is credible. Restored counters are untrusted persistence.
 */
export type UnifiedCycleStage='observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update';

export interface UnifiedCognitiveCycleState {
  version:1;
  cycles:number;
  completeCycles:number;
  incompleteCycles:number;
  brokenLineages:number;
  meanStageCoverage01:number;
  meanCausalContinuity01:number;
  lastTick:number;
  lastComplete:boolean;
  lastMissingStages:UnifiedCycleStage[];
}

export interface UnifiedCognitiveCycleResult {
  tick:number;
  stageCoverage01:number;
  causalContinuity01:number;
  complete:boolean;
  missingStages:UnifiedCycleStage[];
}

const REQUIRED:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
const ALL_STAGES=new Set<UnifiedCycleStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update']);
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const safeCounter=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeMetric=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):0;
const isCounterEvidence=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const isMetricEvidence=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const validStageId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim().length>0&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);

type OwnDataValue={present:boolean;value:unknown};

const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object')return false;
  try {
    if(Array.isArray(value))return false;
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype||prototype===null;
  } catch {
    return false;
  }
};

/** Read one own data property without invoking caller-controlled getters. */
const readOwnDataValue=(record:object,key:string,scope:string):OwnDataValue=>{
  let descriptor:PropertyDescriptor|undefined;
  try { descriptor=Object.getOwnPropertyDescriptor(record,key); }
  catch { throw new TypeError('unreadable-'+scope+'-field:'+key); }
  if(!descriptor)return {present:false,value:undefined};
  if(!Object.hasOwn(descriptor,'value'))throw new TypeError('accessor-not-allowed:'+scope+'-field:'+key);
  return {present:true,value:descriptor.value};
};

const snapshotOwnDataValues=(record:object,keys:readonly string[],scope:string):Record<string,OwnDataValue>=>{
  const values:Record<string,OwnDataValue>=Object.create(null) as Record<string,OwnDataValue>;
  for(const key of keys)values[key]=readOwnDataValue(record,key,scope);
  return values;
};


export const defaultUnifiedCognitiveCycle=():UnifiedCognitiveCycleState=>({version:1,cycles:0,completeCycles:0,incompleteCycles:0,brokenLineages:0,meanStageCoverage01:0,meanCausalContinuity01:0,lastTick:-1,lastComplete:false,lastMissingStages:[...REQUIRED]});

export class UnifiedCognitiveCycle {
  private state=defaultUnifiedCognitiveCycle();

  restore(raw?:Partial<UnifiedCognitiveCycleState>|null):void {
    // Decode into local state first. Persisted input is untrusted, and a
    // failed descriptor check must leave the active history unchanged.
    if(raw!==undefined&&raw!==null&&!isPlainRecord(raw))throw new TypeError('cognitive-cycle-state-must-be-a-plain-object');
    const source:object=raw??Object.create(null) as object;
    const fields=snapshotOwnDataValues(source,[
      'version','cycles','completeCycles','incompleteCycles','brokenLineages',
      'meanStageCoverage01','meanCausalContinuity01','lastTick','lastComplete','lastMissingStages',
    ],'cognitive-cycle-state');
    const read=(key:string):unknown=>fields[key]?.value;
    const cycles=safeCounter(read('cycles'));
    const version=read('version');
    if(version!==undefined&&version!==1)throw new RangeError('unsupported cognitive-cycle state version');
    const completeCycles=Math.min(cycles,safeCounter(read('completeCycles')));
    // Every recorded cycle must belong to exactly one outcome bucket. Any
    // unaccounted persisted cycle is conservatively treated as incomplete.
    const incompleteCycles=cycles-completeCycles;
    const rawIncomplete=read('incompleteCycles');
    const rawBroken=read('brokenLineages');
    const persistedLastTick=read('lastTick');
    const malformedCounterEvidence=(['cycles','completeCycles','incompleteCycles','brokenLineages'] as const)
      .some(key=>fields[key].present&&!isCounterEvidence(read(key)));
    const malformedMetricEvidence=(['meanStageCoverage01','meanCausalContinuity01'] as const)
      .some(key=>fields[key].present&&!isMetricEvidence(read(key)));
    const malformedLastTickEvidence=fields.lastTick.present&&!(typeof persistedLastTick==='number'&&Number.isSafeInteger(persistedLastTick)&&persistedLastTick>=-1);
    const malformedScalarState=malformedCounterEvidence||malformedMetricEvidence||malformedLastTickEvidence;
    const inconsistentCounters=fields.incompleteCycles.present&&(!isCounterEvidence(rawIncomplete)||safeCounter(rawIncomplete)!==incompleteCycles);
    const inconsistentBrokenLineages=fields.brokenLineages.present&&(!isCounterEvidence(rawBroken)||safeCounter(rawBroken)>incompleteCycles);

    const missingInput=read('lastMissingStages');
    let malformedMissing=false;
    let rawMissing:unknown[]=[...REQUIRED];
    if(missingInput!==undefined) {
      let isArray=false;
      try { isArray=Array.isArray(missingInput); } catch { throw new TypeError('unreadable-cognitive-cycle-missing-stages'); }
      if(!isArray) {
        malformedMissing=true;
      } else {
        const array=missingInput as object;
        const lengthField=readOwnDataValue(array,'length','cognitive-cycle-missing-stages');
        const length=lengthField.value;
        if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0)throw new TypeError('invalid-cognitive-cycle-missing-stages-length');
        if(length>ALL_STAGES.size) {
          malformedMissing=true;
        } else {
          rawMissing=[];
          for(let index=0;index<length;index+=1) {
            const slot=readOwnDataValue(array,String(index),'cognitive-cycle-missing-stages');
            if(!slot.present) {
              malformedMissing=true;
              rawMissing.push(undefined);
            } else {
              rawMissing.push(slot.value);
            }
          }
        }
      }
    }
    const filteredMissing:UnifiedCycleStage[]=[];
    const seenMissing=new Set<UnifiedCycleStage>();
    for(const stage of rawMissing) {
      if(typeof stage!=='string'||!ALL_STAGES.has(stage as UnifiedCycleStage)) {
        malformedMissing=true;
        continue;
      }
      const normalized=stage as UnifiedCycleStage;
      if(seenMissing.has(normalized)) {
        malformedMissing=true;
        continue;
      }
      seenMissing.add(normalized);
      filteredMissing.push(normalized);
    }
    const normalizedMissing=malformedMissing&&filteredMissing.length===0?[...REQUIRED]:filteredMissing;
    const lastTickValue=read('lastTick');
    const lastTick=typeof lastTickValue==='number'&&Number.isSafeInteger(lastTickValue)&&lastTickValue>=-1?lastTickValue:-1;
    const missing=cycles===0&&normalizedMissing.length===0?[...REQUIRED]:normalizedMissing;
    const lastCompleteValue=read('lastComplete');
    this.state={
      version:1,
      cycles,
      completeCycles,
      incompleteCycles,
      brokenLineages:Math.min(incompleteCycles,safeCounter(rawBroken)),
      meanStageCoverage01:safeMetric(read('meanStageCoverage01') as number),
      meanCausalContinuity01:safeMetric(read('meanCausalContinuity01') as number),
      lastTick,
      lastComplete:!malformedMissing&&!malformedScalarState&&!inconsistentCounters&&!inconsistentBrokenLineages&&cycles>0&&completeCycles>0&&lastTick>=0&&lastCompleteValue===true&&missing.length===0,
      lastMissingStages:missing,
    };
  }

  evaluate(input:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult {
    if(!isPlainRecord(input))throw new TypeError('cognitive cycle input must be an object');
    const fields=snapshotOwnDataValues(input,['tick','stageIds','parentIntegrity01'],'cognitive-cycle-input');
    const tick=fields.tick.value;
    const stageIdsValue=fields.stageIds.value;
    const parentIntegrity01=fields.parentIntegrity01.value;
    if(stageIdsValue===null||typeof stageIdsValue!=='object')throw new TypeError('stageIds must be an object');
    let stageIdsIsArray=false;
    try { stageIdsIsArray=Array.isArray(stageIdsValue); } catch { throw new TypeError('stageIds must be an object'); }
    if(stageIdsIsArray)throw new TypeError('stageIds must be an object');
    if(typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    if(typeof parentIntegrity01!=='number'||!Number.isFinite(parentIntegrity01)||parentIntegrity01<0||parentIntegrity01>1) {
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    }
    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
    const validIds:Partial<Record<UnifiedCycleStage,string>>={};
    for(const stage of ALL_STAGES) {
      const field=readOwnDataValue(stageIdsValue,stage,'cognitive-cycle-stage-ids');
      const id=field.present?field.value:undefined;
      if(validStageId(id))validIds[stage]=id;
    }
    const idCounts=new Map<string,number>();
    for(const stage of REQUIRED) {
      const id=validIds[stage];
      if(id!==undefined)idCounts.set(id,(idCounts.get(id)??0)+1);
    }
    const present=REQUIRED.filter(stage=>validIds[stage]!==undefined&&idCounts.get(validIds[stage]!)===1);
    const missing=REQUIRED.filter(stage=>validIds[stage]===undefined||idCounts.get(validIds[stage]!)!==1);
    const coverage=present.length/REQUIRED.length;
    const causal=parentIntegrity01;
    const complete=missing.length===0&&causal>=0.5;
    const cycles=this.state.cycles+1;
    this.state={
      ...this.state,
      cycles,
      completeCycles:this.state.completeCycles+(complete?1:0),
      incompleteCycles:this.state.incompleteCycles+(complete?0:1),
      brokenLineages:this.state.brokenLineages+(causal<0.5?1:0),
      meanStageCoverage01:(this.state.meanStageCoverage01*(cycles-1)+coverage)/cycles,
      meanCausalContinuity01:(this.state.meanCausalContinuity01*(cycles-1)+causal)/cycles,
      lastTick:tick,
      lastComplete:complete,
      lastMissingStages:missing,
    };
    return {tick,stageCoverage01:coverage,causalContinuity01:causal,complete,missingStages:[...missing]};
  }

  snapshot():UnifiedCognitiveCycleState {
    return structuredClone({...this.state,lastMissingStages:[...this.state.lastMissingStages]});
  }
}
