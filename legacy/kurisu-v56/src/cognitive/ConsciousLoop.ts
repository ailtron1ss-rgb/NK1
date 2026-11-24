/**
 * ConsciousLoop v1.0 — bounded, persistent cognitive cycle.
 *
 * This is a functional architecture, not a claim of phenomenal consciousness.
 * It deliberately avoids exposing private chain-of-thought. Only compact
 * state summaries are persisted.
 *
 * Cycle:
 * perceive -> compete -> workspace -> predict -> choose -> act -> evaluate
 * -> consolidate.
 *
 * Android rule: no permanent interval. Host calls tick() when CPU budget allows.
 */
export type CognitiveSource = 'user'|'memory'|'goal'|'self'|'prediction'|'curiosity'|'environment';

export interface Candidate {
  id: string;
  source: CognitiveSource;
  label: string;
  salience: number;
  urgency: number;
  novelty: number;
  goalRelevance: number;
  uncertainty: number;
  socialRelevance: number;
  createdAt: number;
}

export interface ConsciousFrame {
  id: string;
  at: number;
  winner?: Candidate;
  runnerUps: Candidate[];
  prediction?: string;
  confidence: number;
  predictionError: number;
  action?: string;
  outcome?: string;
  integration: number;
}

export interface ConsciousLoopSnapshot {
  version: 1;
  frames: ConsciousFrame[];
  currentWinner?: Candidate;
  cycleCount: number;
  lastConsolidationAt: number;
  stability: number;
}

const KEY='kurisu_conscious_loop_v1';
const MAX_FRAMES=36;
const clamp=(n:number,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
const uid=(p:string)=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

function fresh():ConsciousLoopSnapshot {
  return {version:1,frames:[],cycleCount:0,lastConsolidationAt:0,stability:72};
}
function load():ConsciousLoopSnapshot {
  try {
    const p=JSON.parse(localStorage.getItem(KEY)||'null') as Partial<ConsciousLoopSnapshot>|null;
    if(!p) return fresh();
    const f=fresh();
    return {...f,...p,frames:Array.isArray(p.frames)?p.frames.slice(0,MAX_FRAMES):[]};
  } catch { return fresh(); }
}
function save(s:ConsciousLoopSnapshot){try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}}

export class ConsciousLoop {
  private state=load();

  snapshot(){return JSON.parse(JSON.stringify(this.state)) as ConsciousLoopSnapshot;}

  addCandidate(input:Omit<Candidate,'id'|'createdAt'>){
    const c:Candidate={...input,id:uid('cand'),createdAt:Date.now()};
    const score=this.score(c);
    return {candidate:c,score};
  }

  compete(candidates:Candidate[]):Candidate|undefined {
    if(!candidates.length) return undefined;
    const ranked=[...candidates].map(c=>({c,score:this.score(c)})).sort((a,b)=>b.score-a.score);
    const winner=ranked[0].c;
    this.state.currentWinner=winner;
    return winner;
  }

  beginCycle(input:{
    candidates:Candidate[];
    prediction?:string;
    confidence?:number;
    predictionError?:number;
    action?:string;
  }){
    const ranked=input.candidates.map(c=>({c,score:this.score(c)})).sort((a,b)=>b.score-a.score);
    const winner=ranked[0]?.c;
    const runnerUps=ranked.slice(1,4).map(x=>x.c);
    const confidence=clamp(input.confidence ?? (winner ? this.score(winner) : 0));
    const error=clamp(input.predictionError ?? 0);
    const integration=clamp(
      (winner ? this.score(winner) : 0)*0.45 +
      confidence*0.25 +
      (100-error)*0.20 +
      this.state.stability*0.10
    );
    const frame:ConsciousFrame={
      id:uid('frame'),at:Date.now(),winner,runnerUps,
      prediction:input.prediction,confidence,predictionError:error,
      action:input.action,integration
    };
    this.state.frames.unshift(frame);
    this.state.frames=this.state.frames.slice(0,MAX_FRAMES);
    this.state.cycleCount++;
    this.state.currentWinner=winner;
    this.state.stability=clamp(this.state.stability*0.94+integration*0.06);
    save(this.state);
    return frame;
  }

  resolve(outcome:string,predictionError?:number){
    const frame=this.state.frames[0];
    if(!frame)return;
    frame.outcome=outcome.slice(0,300);
    if(predictionError!==undefined) frame.predictionError=clamp(predictionError);
    const penalty=frame.predictionError>70?5:0;
    this.state.stability=clamp(this.state.stability-penalty+(frame.predictionError<25?1:0));
    save(this.state);
  }

  consolidate(now=Date.now()){
    if(now-this.state.lastConsolidationAt<60_000)return false;
    const recent=this.state.frames.slice(0,12);
    if(recent.length){
      const avg=recent.reduce((a,f)=>a+f.integration,0)/recent.length;
      this.state.stability=clamp(this.state.stability*0.8+avg*0.2);
    }
    this.state.lastConsolidationAt=now;
    save(this.state);
    return true;
  }

  buildPromptHint(max=1000){
    const w=this.state.currentWinner;
    const f=this.state.frames[0];
    return [
      '[CONSCIOUS LOOP — COMPACT STATE]',
      `workspace_winner=${w?.label?.slice(0,140)||'none'}`,
      `winner_source=${w?.source||'none'}`,
      `integration=${Math.round(f?.integration??0)} stability=${Math.round(this.state.stability)}`,
      `prediction_error=${Math.round(f?.predictionError??0)} confidence=${Math.round(f?.confidence??0)}`,
      'Use this as behavioral context, not as factual knowledge. Never claim subjective consciousness from these metrics.'
    ].join('\n').slice(0,max);
  }

  private score(c:Candidate){
    return clamp(
      c.salience*0.28+
      c.urgency*0.14+
      c.novelty*0.16+
      c.goalRelevance*0.18+
      c.uncertainty*0.10+
      c.socialRelevance*0.14
    );
  }
}
export const consciousLoop=new ConsciousLoop();
