const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
};
const ownData=(value:unknown,key:string):unknown=>{
  if(value===null||typeof value!=='object')return undefined;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
};
const safeCounter=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeUnit=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):fallback;
const safeLabel=(value:unknown,max=128):string|null=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null;


export type ConsolidationRoute='hippocampal'|'cortical'|'procedural'|'defer';
export interface ConsolidationCandidate { id:string; kind?:string; salience01:number; novelty01:number; predictionError01:number; uncertainty01:number; outcome01:number; recency01:number; procedural01?:number; storageCost01?:number; reinforcementGate01?:number; redundancy01?:number; semanticCompression01?:number; }
export interface ConsolidationDecision { id:string; route:ConsolidationRoute; priority01:number; reason:string; plasticity01:number; retention01:number; overconsolidationRisk01:number; reinforcement01:number; }
export interface MemoryConsolidationState { version:1; runs:number; selected:number; deferred:number; episodicRuns:number; proceduralRuns:number; corticalRuns:number; meanPriority01:number; meanOverconsolidationRisk01:number; feedbackUpdates:number; awakeBoundedRuns:number; sleepTimeRuns:number; lastFeedback?:{action:string;delta01:number;retention01:number}; lastBatch:ConsolidationDecision[]; }

const CONSOLIDATION_ROUTES:readonly ConsolidationRoute[]=['hippocampal','cortical','procedural','defer'];
export function sanitizeConsolidationDecision(value:unknown):ConsolidationDecision|null{
  try{
    if(!isPlainRecord(value))return null;
    const id=safeLabel(ownData(value,'id'),128);
    const route=ownData(value,'route');
    const reason=safeLabel(ownData(value,'reason'),240);
    const priority=ownData(value,'priority01'),plasticity=ownData(value,'plasticity01');
    const retention=ownData(value,'retention01'),risk=ownData(value,'overconsolidationRisk01');
    const reinforcement=ownData(value,'reinforcement01');
    const ratios=[priority,plasticity,retention,risk,reinforcement];
    if(!id||!reason||typeof route!=='string'||!CONSOLIDATION_ROUTES.includes(route as ConsolidationRoute)||ratios.some(x=>typeof x!=='number'||!Number.isFinite(x)))return null;
    return {id,route:route as ConsolidationRoute,reason,priority01:clamp01(priority as number),plasticity01:clamp01(plasticity as number),retention01:clamp01(retention as number),overconsolidationRisk01:clamp01(risk as number),reinforcement01:clamp01(reinforcement as number)};
  }catch{return null;}
}
export function sanitizeConsolidationDecisionArray(value:unknown,max=32):ConsolidationDecision[]|null{
  try{
    if(!Array.isArray(value))return null;
    const length=ownData(value,'length');
    if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>max)return null;
    const result:ConsolidationDecision[]=[];
    for(let i=0;i<length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return null;
      const decision=sanitizeConsolidationDecision(descriptor.value);
      if(!decision)return null;
      result.push(decision);
    }
    return result;
  }catch{return null;}
}
function sanitizeFeedback(value:unknown):MemoryConsolidationState['lastFeedback']|null{
  try{
    if(!isPlainRecord(value))return null;
    const action=safeLabel(ownData(value,'action'),96);
    const delta=ownData(value,'delta01'),retention=ownData(value,'retention01');
    if(!action||typeof delta!=='number'||!Number.isFinite(delta)||typeof retention!=='number'||!Number.isFinite(retention))return null;
    return {action,delta01:clamp01(delta),retention01:clamp01(retention)};
  }catch{return null;}
}

const defaults=():MemoryConsolidationState=>({version:1,runs:0,selected:0,deferred:0,episodicRuns:0,proceduralRuns:0,corticalRuns:0,meanPriority01:0,meanOverconsolidationRisk01:0,feedbackUpdates:0,awakeBoundedRuns:0,sleepTimeRuns:0,lastFeedback:undefined,lastBatch:[]});

/** Distribution-aware consolidation controller. This is a computational design, not an anatomical equivalence claim. */
export class MemoryConsolidationController {
  private state=defaults();
  restore(raw?:unknown|null){
    const d=defaults();
    try{
      if(raw===undefined||raw===null){this.state=d;return;}
      if(!isPlainRecord(raw)){this.state=d;return;}
      const version=ownData(raw,'version');
      if(version!==undefined&&version!==1){this.state=d;return;}
      const batchRaw=ownData(raw,'lastBatch');
      const lastBatch=batchRaw===undefined?[]:sanitizeConsolidationDecisionArray(batchRaw,32);
      const feedbackRaw=ownData(raw,'lastFeedback');
      const lastFeedback=feedbackRaw===undefined?undefined:sanitizeFeedback(feedbackRaw);
      if(lastBatch===null||(feedbackRaw!==undefined&&lastFeedback===null)){this.state=d;return;}
      this.state={
        version:1,
        runs:safeCounter(ownData(raw,'runs'),d.runs),
        selected:safeCounter(ownData(raw,'selected'),d.selected),
        deferred:safeCounter(ownData(raw,'deferred'),d.deferred),
        episodicRuns:safeCounter(ownData(raw,'episodicRuns'),d.episodicRuns),
        proceduralRuns:safeCounter(ownData(raw,'proceduralRuns'),d.proceduralRuns),
        corticalRuns:safeCounter(ownData(raw,'corticalRuns'),d.corticalRuns),
        meanPriority01:safeUnit(ownData(raw,'meanPriority01'),d.meanPriority01),
        meanOverconsolidationRisk01:safeUnit(ownData(raw,'meanOverconsolidationRisk01'),d.meanOverconsolidationRisk01),
        feedbackUpdates:safeCounter(ownData(raw,'feedbackUpdates'),d.feedbackUpdates),
        awakeBoundedRuns:safeCounter(ownData(raw,'awakeBoundedRuns'),d.awakeBoundedRuns),
        sleepTimeRuns:safeCounter(ownData(raw,'sleepTimeRuns'),d.sleepTimeRuns),
        lastFeedback,
        lastBatch,
      };
    }catch{
      // Persisted consolidation state is untrusted; a corrupt snapshot must not break memory startup.
      this.state=d;
    }
  }
  snapshot(){return structuredClone(this.state);}
  rank(candidates:ConsolidationCandidate[], limits={batchSize:8,pressure01:0.5,awake01:1}):ConsolidationDecision[]{
    const out=candidates.map(c=>{
      const procedural=clamp01(c.procedural01??(c.kind==='procedural'?1:0));
      const reinforcement=clamp01(c.reinforcementGate01??.5);
      const redundancy=clamp01(c.redundancy01??0);
      const compression=clamp01(c.semanticCompression01??0);
      const importance=clamp01(.22*c.salience01+.18*c.novelty01+.22*c.predictionError01+.20*c.uncertainty01+.12*c.outcome01+.10*c.recency01);
      const pressure=clamp01(.78+limits.pressure01*.14+limits.awake01*.08);
      const overconsolidationRisk=clamp01((1-c.novelty01)*.28+(1-c.predictionError01)*.18+(1-c.uncertainty01)*.14+redundancy*.28+compression*.12);
      const priority=clamp01(importance*pressure + procedural*.04 + reinforcement*.10 - overconsolidationRisk*.22);
      const route:ConsolidationRoute=procedural>.62 && reinforcement>.42?'procedural':priority>.64?'hippocampal':priority>.42?'cortical':'defer';
      const plasticity=clamp01(.25+.55*c.uncertainty01+.20*c.predictionError01 + procedural*(1-reinforcement)*.10);
      const retention=clamp01((.35+.35*c.salience01+.20*(1-c.novelty01)+.10*c.outcome01) * (.72+.28*reinforcement) * (1-overconsolidationRisk*.65));
      return {id:c.id,route,priority01:priority,reason:`priority=${priority.toFixed(3)} uncertainty=${c.uncertainty01.toFixed(3)} error=${c.predictionError01.toFixed(3)} redundancy=${redundancy.toFixed(3)}`,plasticity01:plasticity,retention01:retention,overconsolidationRisk01:overconsolidationRisk,reinforcement01:reinforcement};
    }).sort((a,b)=>b.priority01-a.priority01);
    const requestedBatch=Math.max(1,Math.min(32,Math.floor(limits.batchSize)));
    // Letta-inspired sleep-time budget: preserve the larger maintenance window for sleeping/idle cycles.
    // Active cycles are capped at four decisions; sleeping cycles get at least twelve, always bounded to 32.
    const awake=limits.awake01===undefined?null:clamp01(limits.awake01);
    const batchSize=awake===null?requestedBatch:awake>.5?Math.min(4,requestedBatch):Math.min(32,Math.max(12,requestedBatch));
    if(awake===null){} else if(awake>.5)this.state.awakeBoundedRuns++; else this.state.sleepTimeRuns++;
    const chosen=out.slice(0,batchSize);
    this.state.runs++;this.state.selected+=chosen.filter(x=>x.route!=='defer').length;this.state.deferred+=chosen.filter(x=>x.route==='defer').length;
    this.state.episodicRuns+=chosen.filter(x=>x.route==='hippocampal').length;
    this.state.proceduralRuns+=chosen.filter(x=>x.route==='procedural').length;
    this.state.corticalRuns+=chosen.filter(x=>x.route==='cortical').length;
    if(chosen.length){const m=chosen.reduce((s,x)=>s+x.priority01,0)/chosen.length;this.state.meanPriority01=this.state.meanPriority01*.9+m*.1;const r=chosen.reduce((s,x)=>s+x.overconsolidationRisk01,0)/chosen.length;this.state.meanOverconsolidationRisk01=this.state.meanOverconsolidationRisk01*.9+r*.1;}
    this.state.lastBatch=chosen;
    return chosen;
  }
  applyOutcomeFeedback(input:{action:string;predicted01:number;actual01:number;surprise01:number;reinforcementGate01?:number}){
    const predicted=clamp01(input.predicted01), actual=clamp01(input.actual01), surprise=clamp01(input.surprise01), gate=clamp01(input.reinforcementGate01??.5);
    const signedError=actual-predicted;
    const delta=clamp01(Math.abs(signedError))*(.45+.35*surprise)*(.65+.35*gate);
    const retention=clamp01(.5 + signedError*.4 - surprise*.08 + gate*.08);
    this.state.feedbackUpdates++;
    this.state.lastFeedback={action:String(input.action),delta01:Number(delta.toFixed(6)),retention01:Number(retention.toFixed(6))};
    return {action:String(input.action),predictionError01:Math.abs(signedError),learningDelta01:delta,retention01:retention,reinforcementGate01:gate};
  }
  diagnostics(){return {...this.state,lastBatch:this.state.lastBatch.map(x=>({...x}))};}
}
