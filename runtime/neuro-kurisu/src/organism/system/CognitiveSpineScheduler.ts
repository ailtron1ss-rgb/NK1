/**
 * Event/budget-aware cadence controller for the cognitive spine.
 *
 * The goal is not to remove cognition, but to stop expensive secondary loops
 * from executing at full frequency when the world is quiet and the phone is
 * resource constrained. Core safety/governance loops remain outside this gate.
 */
export type SpineMode = 'reflex'|'balanced'|'deep'|'protect';
export type SpineOperation = 'research'|'world-rollout'|'shadow'|'project';

export interface CognitiveSpineScheduleState {
  version: 1;
  mode: SpineMode;
  lastTick: number;
  lastDecisionAt: number;
  runs: Record<SpineOperation, number>;
  skips: Record<SpineOperation, number>;
  opportunities: Record<SpineOperation, number>;
  savings01: number;
  lastReason: string;
}

export interface CognitiveSpineDecision {
  mode: SpineMode;
  run: Record<SpineOperation, boolean>;
  cadence: Record<SpineOperation, number>;
  reason: string;
}

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const plainOwnRecord=(value:unknown):Record<string,unknown>|null=>{
  if(value===null||typeof value!=='object')return null;
  try{
    if(Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype||prototype===null?value as Record<string,unknown>:null;
  }catch{return null;}
};
/** Read persisted fields from own data descriptors; never execute accessors. */
const ownData=(record:Record<string,unknown>,key:string):unknown=>{
  try{
    const descriptor=Object.getOwnPropertyDescriptor(record,key);
    return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
  }catch{return undefined;}
};
const readCounter=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const readMetric=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const readBoundedText=(value:unknown,fallback:string,max:number):string=>typeof value==='string'?value.trim().slice(0,max):fallback;
const readCounterMap=(value:unknown,fallback:Record<SpineOperation,number>):Record<SpineOperation,number>=>{
  const source=plainOwnRecord(value),result={...fallback};
  if(source)for(const operation of Object.keys(fallback) as SpineOperation[])result[operation]=readCounter(ownData(source,operation),fallback[operation]);
  return result;
};
const DEFAULT_CADENCE:Record<SpineOperation,number> = { research:4, 'world-rollout':3, shadow:2, project:2 };

export const defaultCognitiveSpineSchedule = ():CognitiveSpineScheduleState => ({
  version:1,
  mode:'balanced',
  lastTick:0,
  lastDecisionAt:0,
  runs:{research:0,'world-rollout':0,shadow:0,project:0},
  skips:{research:0,'world-rollout':0,shadow:0,project:0},
  opportunities:{research:0,'world-rollout':0,shadow:0,project:0},
  savings01:0,
  lastReason:'initial',
});

export class CognitiveSpineScheduler {
  private state = defaultCognitiveSpineSchedule();

  restore(raw?:Partial<CognitiveSpineScheduleState>|null){
    const d=defaultCognitiveSpineSchedule();
    const root=plainOwnRecord(raw);
    if(!root){this.state=d;return;}
    const version=ownData(root,'version');
    if(version!==undefined&&version!==1){this.state=d;return;}
    const mode=ownData(root,'mode');
    this.state={
      version:1,
      mode:mode==='reflex'||mode==='balanced'||mode==='deep'||mode==='protect'?mode:d.mode,
      lastTick:readCounter(ownData(root,'lastTick'),d.lastTick),
      lastDecisionAt:readCounter(ownData(root,'lastDecisionAt'),d.lastDecisionAt),
      runs:readCounterMap(ownData(root,'runs'),d.runs),
      skips:readCounterMap(ownData(root,'skips'),d.skips),
      opportunities:readCounterMap(ownData(root,'opportunities'),d.opportunities),
      savings01:readMetric(ownData(root,'savings01'),d.savings01),
      lastReason:readBoundedText(ownData(root,'lastReason'),d.lastReason,180),
    };
  }

  snapshot(){ return structuredClone(this.state); }

  decide(input:{tick:number;surprise01:number;predictionError01:number;novelty01:number;goalPressure01:number;budgetMode:string;remainingBudget01:number;externalInput:boolean;awake:boolean}):CognitiveSpineDecision{
    const urgency=clamp(input.surprise01*.26+input.predictionError01*.24+input.novelty01*.14+input.goalPressure01*.20+(input.externalInput?0.12:0)+(input.awake?0.04:0));
    const constrained=clamp((1-input.remainingBudget01)*.55 + (input.budgetMode==='defer'?0.35:0) + (input.budgetMode==='sleep'?0.55:0));
    const mode:SpineMode = input.budgetMode==='sleep' || constrained>.78 ? 'protect' : input.budgetMode==='reflex' ? 'reflex' : urgency>.66 || input.budgetMode==='deep' || input.budgetMode==='simulate' ? 'deep' : 'balanced';
    const cadence={...DEFAULT_CADENCE};
    if(mode==='deep'){ cadence.research=1; cadence['world-rollout']=1; cadence.shadow=1; cadence.project=1; }
    else if(mode==='reflex'){ cadence.research=8; cadence['world-rollout']=5; cadence.shadow=4; cadence.project=4; }
    else if(mode==='protect'){ cadence.research=12; cadence['world-rollout']=8; cadence.shadow=6; cadence.project=6; }

    const runFor=(op:SpineOperation,force:boolean)=>{
      this.state.opportunities[op] += 1;
      // Protect is a hard budget boundary, not merely a slower cadence.
      // External events remain available to core/reflex handling outside these
      // optional secondary loops; they must not force research, rollout, shadow
      // simulation or project work while the organism is resource-constrained.
      const run=mode !== 'protect' && (force || input.tick % cadence[op] === 0);
      if(run) this.state.runs[op] += 1; else this.state.skips[op] += 1;
      return run;
    };
    const force = urgency>.78 || (input.externalInput && (input.surprise01>.50 || input.predictionError01>.50 || input.goalPressure01>.60 || input.novelty01>.72));
    const run={
      research:runFor('research',force && mode!=='protect'),
      'world-rollout':runFor('world-rollout',force || mode==='deep'),
      shadow:runFor('shadow',force || mode==='deep'),
      project:runFor('project',force || mode==='deep'),
    };
    const total=this.state.opportunities.research+this.state.opportunities['world-rollout']+this.state.opportunities.shadow+this.state.opportunities.project;
    const saved=this.state.skips.research+this.state.skips['world-rollout']+this.state.skips.shadow+this.state.skips.project;
    this.state.savings01=clamp(saved/Math.max(1,total));
    this.state.mode=mode;
    this.state.lastTick=input.tick;
    this.state.lastDecisionAt=Date.now();
    this.state.lastReason=`mode=${mode};urgency=${urgency.toFixed(2)};constraint=${constrained.toFixed(2)}`;
    return {mode,run,cadence,reason:this.state.lastReason};
  }
}
