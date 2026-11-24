const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ema=(old:number,next:number,alpha:number)=>clamp01(old*(1-alpha)+next*alpha);

export type B380TemporalMode='awake-fast'|'reflective-medium'|'sleep-consolidation'|'protective';

export interface B380BeginInput {
  tick:number; at:number; awake:boolean;
  energy01:number; thermal01:number; capacity01:number; uncertainty01:number;
  predictionError01:number; novelty01:number; goalPressure01:number; identity01:number;
  actionPressure01:number; recoveryDebt01:number; recoveryMode?:string;
}

export interface B380CloseInput {
  tick:number; at:number; action:string; goalId?:string|null;
  reward01:number; success01:number; surprise01:number; predictionError01:number;
  physicalVerified01:number; independent01:number; evidenceQuality01:number;
  recoveryEvent01:number; sleepBoundary01:number; external01:number;
}

export interface B380TemporalSignals {
  temporalRegulation01:number;
  homeostaticPressure01:number;
  consolidationPressure01:number;
  experienceSalience01:number;
  continuity01:number;
  sleepPressure01:number;
  resourceUrgency01:number;
  learningGate01:number;
}

export interface B380ExperienceToken {
  id:string; tick:number; at:number; action:string; goalId:string|null;
  mode:B380TemporalMode; fast:number[]; medium:number[]; slow:number[];
  reward01:number; success01:number; surprise01:number; predictionError01:number;
  physicalVerified01:number; independent01:number; evidenceQuality01:number;
  salience01:number; continuity01:number; consolidationEligible:boolean;
  parentTokenId:string|null;
}

export interface B380State {
  version:2; enabled:boolean; tick:number; mode:B380TemporalMode;
  fast:number[]; medium:number[]; slow:number[];
  lastSignals:B380TemporalSignals;
  activeTokenId:string|null; lastToken:B380ExperienceToken|null;
  tokens:B380ExperienceToken[];
  metrics:{begun:number; completed:number; verified:number; independent:number; rejected:number; consolidations:number; recoveryEvents:number; sleepTransitions:number; influence01:number; meanSalience01:number; meanContinuity01:number; lastTick:number};
}

export const defaultB380State=():B380State=>({
  version:2, enabled:true, tick:0, mode:'awake-fast',
  fast:new Array(8).fill(.5), medium:new Array(8).fill(.5), slow:new Array(8).fill(.5),
  lastSignals:{temporalRegulation01:.5,homeostaticPressure01:.25,consolidationPressure01:.2,experienceSalience01:.2,continuity01:.8,sleepPressure01:.15,resourceUrgency01:.2,learningGate01:.5},
  activeTokenId:null,lastToken:null,tokens:[],
  metrics:{begun:0,completed:0,verified:0,independent:0,rejected:0,consolidations:0,recoveryEvents:0,sleepTransitions:0,influence01:0,meanSalience01:0,meanContinuity01:.8,lastTick:0},
});

const vecFromBegin=(i:B380BeginInput)=>[
  clamp01(i.energy01),clamp01(i.capacity01),clamp01(1-i.thermal01),clamp01(1-i.uncertainty01),clamp01(1-i.predictionError01),clamp01(i.novelty01),clamp01(i.goalPressure01),clamp01(i.identity01)
];

export class B380TemporalLifeIntegrator {
  private state=B380_DEFAULT_FACTORY();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B380State>|null){
    const d=defaultB380State(); const r=raw??{};
    const arr=(v:unknown,n:number,fill=.5)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-(v as unknown[]).length)).fill(fill)).slice(0,n).map(Number):new Array(n).fill(fill);
    this.state={...d,...r,version:2,enabled:r.enabled!==false,tick:Number(r.tick??0),mode:(r.mode as B380TemporalMode)??d.mode,fast:arr(r.fast,8),medium:arr(r.medium,8),slow:arr(r.slow,8),lastSignals:{...d.lastSignals,...(r.lastSignals??{})},tokens:Array.isArray(r.tokens)?r.tokens.slice(-256):[],lastToken:r.lastToken??null,metrics:{...d.metrics,...(r.metrics??{})}};
  }
  setEnabled(enabled:boolean){this.state.enabled=Boolean(enabled);}
  diagnostics(){return structuredClone({state:this.state,tail:this.state.tokens.slice(-12)});}
  begin(i:B380BeginInput):B380TemporalSignals{
    const v=vecFromBegin(i);
    if(!this.state.enabled) return {...this.state.lastSignals,learningGate01:0};
    this.state.tick=i.tick; this.state.metrics.begun+=1;
    const resourceUrgency=clamp01((1-i.energy01)*.42+i.thermal01*.28+(1-i.capacity01)*.18+i.recoveryDebt01*.12);
    const homeo=clamp01(.38*(1-i.energy01)+.22*i.thermal01+.18*i.uncertainty01+.14*i.predictionError01+.08*(1-i.capacity01));
    const sleep=clamp01((i.awake?0:.72)+homeo*.32+(1-i.energy01)*.18);
    const mode:B380TemporalMode=!i.awake?'sleep-consolidation':resourceUrgency>.72?'protective':(i.uncertainty01+i.predictionError01)>.98?'reflective-medium':'awake-fast';
    const fa=mode==='awake-fast'?.28:mode==='reflective-medium'?.18:mode==='protective'?.12:.06;
    const ma=mode==='sleep-consolidation'?.12:.06;
    const sa=mode==='sleep-consolidation'?.025:.012;
    this.state.fast=this.state.fast.map((x,k)=>ema(x,v[k]??.5,fa));
    this.state.medium=this.state.medium.map((x,k)=>ema(x,this.state.fast[k]??.5,ma));
    this.state.slow=this.state.slow.map((x,k)=>ema(x,this.state.medium[k]??.5,sa));
    const temporalReg=clamp01(.34+Math.abs(this.state.fast[0]!-(this.state.slow[0]??.5))*.46+(1-homeo)*.20);
    const consolidation=clamp01((mode==='sleep-consolidation'?.62:.12)+this.state.slow.reduce((a,x)=>a+Math.abs(x-.5),0)/8*.32+homeo*.22);
    const continuity=clamp01(i.identity01*.62+(1-Math.abs((this.state.fast[7]??.5)-(this.state.slow[7]??.5)))*.38);
    const experienceSalience=clamp01(i.predictionError01*.34+i.novelty01*.24+i.goalPressure01*.18+i.recoveryDebt01*.14+resourceUrgency*.10);
    const learningGate=clamp01((1-homeo*.35)*(0.40+experienceSalience*.45+temporalReg*.15));
    this.state.mode=mode;
    this.state.lastSignals={temporalRegulation01:temporalReg,homeostaticPressure01:homeo,consolidationPressure01:consolidation,experienceSalience01:experienceSalience,continuity01:continuity,sleepPressure01:sleep,resourceUrgency01:resourceUrgency,learningGate01:learningGate};
    if(mode==='sleep-consolidation') this.state.metrics.sleepTransitions+=1;
    return structuredClone(this.state.lastSignals);
  }
  close(i:B380CloseInput){
    if(!this.state.enabled){this.state.metrics.rejected+=1;return null;}
    const s=this.state.lastSignals; const verified=clamp01(i.physicalVerified01); const independent=clamp01(i.independent01); const evidence=clamp01(i.evidenceQuality01);
    const salience=clamp01(.34*i.surprise01+.24*i.predictionError01+.16*i.success01+.10*i.reward01+.10*s.experienceSalience01+.06*i.recoveryEvent01);
    const continuity=clamp01(s.continuity01*.68+(1-i.predictionError01)*.17+i.success01*.10+independent*.05);
    const eligible=Boolean(verified>.65 && independent>.65 && evidence>.55 && s.learningGate01>.30) || (i.sleepBoundary01>.7 && salience>.52);
    const token:B380ExperienceToken={id:`b380:${i.tick}:${this.state.metrics.completed+1}`,tick:i.tick,at:i.at,action:i.action,goalId:i.goalId??null,mode:this.state.mode,fast:this.state.fast.slice(),medium:this.state.medium.slice(),slow:this.state.slow.slice(),reward01:clamp01(i.reward01),success01:clamp01(i.success01),surprise01:clamp01(i.surprise01),predictionError01:clamp01(i.predictionError01),physicalVerified01:verified,independent01:independent,evidenceQuality01:evidence,salience01:salience,continuity01:continuity,consolidationEligible:eligible,parentTokenId:this.state.activeTokenId};
    this.state.activeTokenId=token.id; this.state.lastToken=token; this.state.tokens.push(token); if(this.state.tokens.length>256)this.state.tokens=this.state.tokens.slice(-256);
    this.state.metrics.completed+=1; if(verified>.65)this.state.metrics.verified+=1; if(independent>.65)this.state.metrics.independent+=1; if(i.recoveryEvent01>.5)this.state.metrics.recoveryEvents+=1; if(eligible)this.state.metrics.consolidations+=1;
    this.state.metrics.influence01=ema(this.state.metrics.influence01,clamp01(.45*s.learningGate01+.25*salience+.20*continuity+.10*verified),.08);
    this.state.metrics.meanSalience01=ema(this.state.metrics.meanSalience01,salience,.08); this.state.metrics.meanContinuity01=ema(this.state.metrics.meanContinuity01,continuity,.08); this.state.metrics.lastTick=i.tick;
    return structuredClone(token);
  }
}
function B380_DEFAULT_FACTORY(){return defaultB380State();}
