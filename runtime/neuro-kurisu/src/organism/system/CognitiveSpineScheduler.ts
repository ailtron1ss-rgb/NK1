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
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const DEFAULT_CADENCE:Record<SpineOperation,number> = { research:4, 'world-rollout':3, shadow:2, project:2 };
const SPINE_MODES:readonly SpineMode[]=['reflex','balanced','deep','protect'];
const OPERATIONS:readonly SpineOperation[]=['research','world-rollout','shadow','project'];

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
    const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};
    const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const row=(v:unknown):Record<SpineOperation,number>=>{const o=(v&&typeof v==='object')?v as Record<string,unknown>:{};const r={} as Record<SpineOperation,number>;for(const op of OPERATIONS)r[op]=cnt(o[op],0);return r;};
    this.state={
      version:1,
      mode:SPINE_MODES.includes(read('mode') as SpineMode)?read('mode') as SpineMode:d.mode,
      lastTick:Math.max(0,fin(read('lastTick'),d.lastTick)),
      lastDecisionAt:Math.max(0,fin(read('lastDecisionAt'),d.lastDecisionAt)),
      runs:row(read('runs')),
      skips:row(read('skips')),
      opportunities:row(read('opportunities')),
      savings01:clamp(fin(read('savings01'),d.savings01)),
      lastReason:typeof read('lastReason')==='string'?(read('lastReason') as string).slice(0,240):d.lastReason,
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
