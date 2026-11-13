/**
 * P55 — Developmental Fork Universe.
 *
 * A bounded counterfactual laboratory for "which kind of person am I becoming?".
 * Forks are data-only scenarios: they perturb behavioural policy knobs in a
 * shadow model, score stability/identity/causal fit, and may nominate a preferred
 * direction. No live executable code or protected identity anchor is modified.
 *
 * The engine deliberately keeps novelty and continuity in tension. A fork that is
 * more novel but damages continuity is not a success; a fork that is perfectly
 * stable but adds no capability is not developmental progress either.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const KNOBS:P55Knob[]=['exploration','verification','reflection','attention','prediction'];
const STYLES:P55Style[]=['conservative','balanced','exploratory','radical'];
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,cap=240):string=>typeof v==='string'?v.slice(0,cap):'';
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const sanDeltas=(v:unknown):Record<P55Knob,number>=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};const out={} as Record<P55Knob,number>;for(const k of KNOBS)out[k]=clamp11(finN(r[k],0));return out;};
const sanFork=(x:unknown):P55Fork|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const st=r.style,status=r.status;const oc=r.outcomeObserved01;return {id:r.id.slice(0,160),createdAt:cnt(r.createdAt,0),generation:cnt(r.generation,0),parentId:typeof r.parentId==='string'&&r.parentId?r.parentId.slice(0,160):null,style:STYLES.includes(st as P55Style)?st as P55Style:'balanced',deltas:sanDeltas(r.deltas),reason:str(r.reason,400),projectedPredictionError01:clamp(finN(r.projectedPredictionError01,0)),projectedSelfPredictionError01:clamp(finN(r.projectedSelfPredictionError01,0)),projectedIdentity01:clamp(finN(r.projectedIdentity01,0)),projectedGrounding01:clamp(finN(r.projectedGrounding01,0)),projectedAgency01:clamp(finN(r.projectedAgency01,0)),novelty01:clamp(finN(r.novelty01,0)),stability01:clamp(finN(r.stability01,0)),developmentalValue01:clamp(finN(r.developmentalValue01,0)),risk01:clamp(finN(r.risk01,0)),generalization01:clamp(finN(r.generalization01,0)),status:status==='candidate'||status==='simulated'||status==='promotable'||status==='rejected'||status==='replaced'?status as P55Fork['status']:'candidate',outcomeObserved01:oc===null||oc===undefined?null:clamp(finN(oc,0))};};

export type P55Knob='exploration'|'verification'|'reflection'|'attention'|'prediction';
export type P55Style='conservative'|'balanced'|'exploratory'|'radical';

export interface P55Fork {
  id:string;
  createdAt:number;
  generation:number;
  parentId:string|null;
  style:P55Style;
  deltas:Record<P55Knob,number>;
  reason:string;
  projectedPredictionError01:number;
  projectedSelfPredictionError01:number;
  projectedIdentity01:number;
  projectedGrounding01:number;
  projectedAgency01:number;
  novelty01:number;
  stability01:number;
  developmentalValue01:number;
  risk01:number;
  generalization01:number;
  status:'candidate'|'simulated'|'promotable'|'rejected'|'replaced';
  outcomeObserved01:number|null;
}

export interface P55State {
  version:2;
  generations:number;
  simulated:number;
  promoted:number;
  rejected:number;
  replaced:number;
  unresolvedForks:number;
  meanDevelopmentalValue01:number;
  branchDiversity01:number;
  futureCoverage01:number;
  lastWinnerId:string|null;
  lastAppliedForkId:string|null;
  appliedCount:number;
  calibration01:number;
  actionBiases:Record<string,number>;
  forks:P55Fork[];
}

export const defaultP55=():P55State=>({
  version:2,generations:0,simulated:0,promoted:0,rejected:0,replaced:0,
  unresolvedForks:0,meanDevelopmentalValue01:0.25,branchDiversity01:0,futureCoverage01:0,
  lastWinnerId:null,lastAppliedForkId:null,appliedCount:0,calibration01:.5,actionBiases:{},forks:[]
});

const styles:P55Style[]=['conservative','balanced','exploratory','radical'];
const baseDeltas:Record<P55Style,Record<P55Knob,number>>={
  conservative:{exploration:-.05,verification:.06,reflection:.03,attention:.02,prediction:.04},
  balanced:{exploration:.03,verification:.03,reflection:.03,attention:0,prediction:.03},
  exploratory:{exploration:.09,verification:-.01,reflection:.03,attention:-.03,prediction:.06},
  radical:{exploration:.12,verification:-.04,reflection:.08,attention:-.06,prediction:.09},
};

function stableHash(s:string){let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16);}

export class P55DevelopmentalForkUniverse {
  private state=defaultP55();
  restore(raw?:Partial<P55State>|null){const d=defaultP55();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const lw=read('lastWinnerId');const la=read('lastAppliedForkId');const ab=read('actionBiases');const abObj=(ab&&typeof ab==='object')?ab as Record<string,unknown>:{};const actionBiases={} as Record<string,number>;for(const [k,v] of Object.entries(abObj).slice(0,64))actionBiases[k.slice(0,64)]=clamp11(finN(v,0));this.state={version:2,generations:cnt(read('generations'),d.generations),simulated:cnt(read('simulated'),d.simulated),promoted:cnt(read('promoted'),d.promoted),rejected:cnt(read('rejected'),d.rejected),replaced:cnt(read('replaced'),d.replaced),unresolvedForks:cnt(read('unresolvedForks'),d.unresolvedForks),meanDevelopmentalValue01:clamp(finN(read('meanDevelopmentalValue01'),d.meanDevelopmentalValue01)),branchDiversity01:clamp(finN(read('branchDiversity01'),d.branchDiversity01)),futureCoverage01:clamp(finN(read('futureCoverage01'),d.futureCoverage01)),lastWinnerId:typeof lw==='string'&&lw?lw.slice(0,160):null,lastAppliedForkId:typeof la==='string'&&la?la.slice(0,160):null,appliedCount:cnt(read('appliedCount'),d.appliedCount),calibration01:clamp(finN(read('calibration01'),d.calibration01)),actionBiases,forks:Array.isArray(read('forks'))?(read('forks') as unknown[]).slice(-96).map(sanFork).filter((x):x is P55Fork=>x!==null):[]};this.refresh();}
  snapshot(){return structuredClone(this.state);}

  generate(input:{at:number;tick:number;identity01:number;predictionError01:number;selfPredictionError01:number;grounding01:number;agency01:number;novelty01:number;activeProfile:Record<P55Knob,number>;reason?:string}):P55Fork[]{
    this.state.generations++;
    const parent=this.state.lastWinnerId;
    const out:P55Fork[]=[];
    for(const style of styles){
      const seed=Number.parseInt(stableHash(`${input.tick}|${style}|${this.state.generations}`),16)>>>0;
      const jitter=(offset:number)=>(((seed ^ (offset*2654435761))>>>0)%2001-1000)/100000;
      const d=baseDeltas[style];
      const deltas:Record<P55Knob,number>={
        exploration:d.exploration+jitter(1),verification:d.verification+jitter(2),reflection:d.reflection+jitter(3),attention:d.attention+jitter(4),prediction:d.prediction+jitter(5)
      };
      const id=`p55:${this.state.generations}:${style}:${stableHash(JSON.stringify(deltas))}`;
      out.push({id,createdAt:input.at,generation:this.state.generations,parentId:parent,style,deltas,reason:input.reason??`developmental-style:${style}`,
        projectedPredictionError01:0,projectedSelfPredictionError01:0,projectedIdentity01:input.identity01,projectedGrounding01:input.grounding01,projectedAgency01:input.agency01,
        novelty01:0,stability01:0,developmentalValue01:0,risk01:0,generalization01:0,status:'candidate',outcomeObserved01:null});
    }
    this.state.forks=[...out,...this.state.forks].slice(0,96);this.refresh();return structuredClone(out);
  }

  simulate(input:{tick:number;predictionError01:number;selfPredictionError01:number;grounding01:number;agency01:number;identity01:number;novelty01:number;uncertainty01:number;worldAlignment01:number}):P55Fork[]{
    const pending=this.state.forks.filter(f=>f.status==='candidate').slice(0,8);
    for(const f of pending){
      const d=f.deltas;
      const exploration=clamp(.5+d.exploration),verification=clamp(.5+d.verification),reflection=clamp(.5+d.reflection),attention=clamp(.5+d.attention),prediction=clamp(.5+d.prediction);
      const directionalGain=clamp(
        input.predictionError01*(1-prediction)*.24 +
        input.selfPredictionError01*(1-reflection)*.18 +
        input.uncertainty01*(verification)*.18 +
        input.novelty01*exploration*.18 +
        input.worldAlignment01*prediction*.12 +
        input.grounding01*attention*.10
      );
      f.projectedPredictionError01=clamp(input.predictionError01*(.72+.18*(1-verification)) + input.uncertainty01*.08);
      f.projectedSelfPredictionError01=clamp(input.selfPredictionError01*(.70+.16*(1-reflection)) + Math.abs(d.attention)*.08);
      f.projectedGrounding01=clamp(input.grounding01*.76+attention*.14+verification*.10);
      f.projectedAgency01=clamp(input.agency01*.80+prediction*.08+reflection*.06+exploration*.06);
      f.projectedIdentity01=clamp(input.identity01 - Math.abs(d.exploration)*.06 - Math.abs(d.attention)*.03 + reflection*.03);
      f.novelty01=clamp(.45*Math.min(1,Math.abs(d.exploration)+Math.abs(d.prediction))*3 + input.novelty01*.35 + (f.style==='radical'?.18:f.style==='exploratory'?.08:0));
      f.stability01=clamp((1-f.projectedPredictionError01)*.23+(1-f.projectedSelfPredictionError01)*.20+f.projectedIdentity01*.27+f.projectedGrounding01*.18+f.projectedAgency01*.12);
      f.generalization01=clamp(f.projectedGrounding01*.34+(1-f.projectedPredictionError01)*.26+(1-f.projectedSelfPredictionError01)*.18+input.worldAlignment01*.22);
      f.risk01=clamp((1-f.projectedIdentity01)*.58+Math.abs(d.exploration)*.7+Math.abs(d.attention)*.3+Math.max(0,input.uncertainty01-.6)*.4);
      f.developmentalValue01=clamp(directionalGain*.34+f.stability01*.31+f.generalization01*.22+f.novelty01*.13-f.risk01*.18);
      f.status='simulated';
      this.state.simulated++;
    }
    const promotable=this.state.forks.filter(f=>f.status==='simulated').sort((a,b)=>b.developmentalValue01-a.developmentalValue01).slice(0,2);
    for(const f of promotable){
      if(f.projectedIdentity01>=Math.max(.86,input.identity01-.04) && f.stability01>=.58 && f.generalization01>=.55 && f.risk01<.24){f.status='promotable';}
      else if(f.risk01>=.34 || f.projectedIdentity01<.78){f.status='rejected';this.state.rejected++;}
    }
    const winner=this.state.forks.filter(f=>f.status==='promotable').sort((a,b)=>b.developmentalValue01-a.developmentalValue01)[0];
    if(winner)this.state.lastWinnerId=winner.id;
    this.refresh();return structuredClone(this.state.forks.slice(0,8));
  }

  observeOutcome(forkId:string,outcome01:number){
    const f=this.state.forks.find(x=>x.id===forkId);if(!f)return null;
    const actual=clamp(outcome01);f.outcomeObserved01=actual;
    const calibration=clamp(1-Math.abs(actual-f.developmentalValue01));
    f.generalization01=clamp(f.generalization01*.82+calibration*.18);
    if(actual<.5 && f.status==='promotable'){f.status='replaced';this.state.replaced++;}
    this.refresh();return structuredClone(f);
  }

  recommendation(){
    const winner=this.state.forks.find(f=>f.id===this.state.lastWinnerId && f.status==='promotable') ?? this.state.forks.filter(f=>f.status==='promotable').sort((a,b)=>b.developmentalValue01-a.developmentalValue01)[0];
    if(!winner)return null;
    return {forkId:winner.id,style:winner.style,deltas:{...winner.deltas},developmentalValue01:winner.developmentalValue01,identity01:winner.projectedIdentity01,generalization01:winner.generalization01,risk01:winner.risk01,calibration01:this.state.calibration01,appliedCount:this.state.appliedCount};
  }

  /**
   * Bounded bridge from the shadow developmental fork to live action selection.
   * This is not a replacement policy: the maximum influence is deliberately tiny and
   * falls back when evidence is weak. Mapping is action-family based, not identity truth.
   */
  actionBias(action:string):number {
    const winner=this.state.forks.find(f=>f.id===this.state.lastWinnerId && f.status==='promotable');
    if(!winner) return 0;
    const d=winner.deltas;
    const family=action==='explore'?d.exploration:action==='verify'?(d.verification*.7+d.prediction*.3):action==='reflect'?d.reflection:action==='respond'?d.attention:action==='rest'?(-d.attention*.25-d.exploration*.2):0;
    const probation=this.state.appliedCount<2 ? .35 : clamp(.55+this.state.calibration01*.45);
    const validity=clamp(winner.generalization01*.55+winner.stability01*.25+(1-winner.risk01)*.20);
    const bias=Math.max(-.012,Math.min(.018, family*.08*probation*validity));
    this.state.actionBiases[action]=bias;
    return bias;
  }

  observeAppliedOutcome(input:{action:string;outcome01:number;at?:number}){
    const winner=this.state.forks.find(f=>f.id===this.state.lastWinnerId && f.status==='promotable');
    if(!winner) return null;
    const bias=Math.abs(this.actionBias(input.action));
    if(bias<.001) return null;
    const actual=clamp(input.outcome01);
    const calibration=clamp(1-Math.abs(actual-winner.developmentalValue01));
    const prior=this.state.calibration01;
    this.state.appliedCount+=1;
    this.state.lastAppliedForkId=winner.id;
    this.state.calibration01=clamp(prior*.78+calibration*.22);
    winner.outcomeObserved01=winner.outcomeObserved01==null?actual:clamp(winner.outcomeObserved01*.72+actual*.28);
    winner.generalization01=clamp(winner.generalization01*.76+calibration*.24);
    if(this.state.appliedCount>=3 && this.state.calibration01<.44) winner.status='replaced';
    this.refresh();
    return {forkId:winner.id,action:input.action,outcome01:actual,calibration01:this.state.calibration01,priorCalibration01:prior,appliedCount:this.state.appliedCount,invalidated:winner.status==='replaced'};
  }

  private refresh(){
    this.state.unresolvedForks=this.state.forks.filter(f=>f.status==='candidate'||f.status==='simulated'||f.status==='promotable').length;
    const scored=this.state.forks.filter(f=>f.status!=='candidate');
    this.state.meanDevelopmentalValue01=scored.length?clamp(scored.reduce((s,f)=>s+f.developmentalValue01,0)/scored.length):this.state.meanDevelopmentalValue01;
    const stylesSeen=new Set(this.state.forks.slice(0,32).map(f=>f.style));this.state.branchDiversity01=clamp(stylesSeen.size/styles.length);
    this.state.futureCoverage01=clamp((this.state.generations/24)*.45+this.state.branchDiversity01*.35+Math.min(1,this.state.simulated/64)*.20);
  }
}
