export type B333GoalGenesisEvidence = {
  tick:number;
  candidateId:string;
  externalInput:boolean;
  autonomousAllowed:boolean;
  internalPressure01:number;
  pressureDiversity01:number;
  identityContinuity01:number;
  goalPressure01:number;
  homeostaticPressure01:number;
  predictionError01:number;
  novelty01:number;
  created:boolean;
  actionBefore:string|null;
  actionAfter:string|null;
  actionChanged:boolean;
  outcome01:number|null;
};

export type B333State = {
  version:1;
  decisions:number;
  eligible:number;
  candidateAccepted:number;
  blockedExternal:number;
  blockedWeakPressure:number;
  actionInfluenced:number;
  successfulInfluence:number;
  meanPressure01:number;
  meanDiversity01:number;
  recent:B333GoalGenesisEvidence[];
  seenGoalIds:string[];
  internallySourcedGoals:number;
  externallySourcedGoals:number;
  lesion01:number;
};

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=180):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=180):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const numOrNull=(v:unknown):number|null=>{if(v===null||v===undefined||v==='')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
const sanEvidence=(x:unknown):B333GoalGenesisEvidence|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),candidateId:str(r.candidateId,'candidate'),externalInput:r.externalInput===true,autonomousAllowed:r.autonomousAllowed===true,internalPressure01:clamp01(finN(r.internalPressure01,0)),pressureDiversity01:clamp01(finN(r.pressureDiversity01,0)),identityContinuity01:clamp01(finN(r.identityContinuity01,0)),goalPressure01:clamp01(finN(r.goalPressure01,0)),homeostaticPressure01:clamp01(finN(r.homeostaticPressure01,0)),predictionError01:clamp01(finN(r.predictionError01,0)),novelty01:clamp01(finN(r.novelty01,0)),created:r.created===true,actionBefore:strOrNull(r.actionBefore),actionAfter:strOrNull(r.actionAfter),actionChanged:r.actionChanged===true,outcome01:numOrNull(r.outcome01)};};
export const defaultB333State=():B333State=>({version:1,decisions:0,eligible:0,candidateAccepted:0,blockedExternal:0,blockedWeakPressure:0,actionInfluenced:0,successfulInfluence:0,meanPressure01:0,meanDiversity01:0,recent:[],seenGoalIds:[],internallySourcedGoals:0,externallySourcedGoals:0,lesion01:0});

export class B333AutonomousGoalGenesisGate {
  private state=defaultB333State();
  restore(raw?:Partial<B333State>|null){
    const d=defaultB333State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const rec=read('recent'),sg=read('seenGoalIds');
    this.state={version:1,decisions:cnt(read('decisions'),d.decisions),eligible:cnt(read('eligible'),d.eligible),candidateAccepted:cnt(read('candidateAccepted'),d.candidateAccepted),blockedExternal:cnt(read('blockedExternal'),d.blockedExternal),blockedWeakPressure:cnt(read('blockedWeakPressure'),d.blockedWeakPressure),actionInfluenced:cnt(read('actionInfluenced'),d.actionInfluenced),successfulInfluence:cnt(read('successfulInfluence'),d.successfulInfluence),meanPressure01:clamp01(finN(read('meanPressure01'),d.meanPressure01)),meanDiversity01:clamp01(finN(read('meanDiversity01'),d.meanDiversity01)),recent:Array.isArray(rec)?(rec as unknown[]).slice(-96).map(sanEvidence).filter((x):x is B333GoalGenesisEvidence=>x!==null):[],seenGoalIds:Array.isArray(sg)?(sg as unknown[]).slice(-256).map(v=>str(v,'')).filter(Boolean):[],internallySourcedGoals:cnt(read('internallySourcedGoals'),d.internallySourcedGoals),externallySourcedGoals:cnt(read('externallySourcedGoals'),d.externallySourcedGoals),lesion01:clamp01(finN(read('lesion01'),d.lesion01))};
  }
  snapshot(){return structuredClone(this.state);}
  evaluate(input:{tick:number;candidateId:string;externalInput:boolean;autonomousAllowed:boolean;goalPressure01:number;homeostaticPressure01:number;predictionError01:number;novelty01:number;uncertainty01:number;socialNeed01:number;identityContinuity01:number;energy01:number;actionBefore:string|null}){
    const pressures=[input.goalPressure01,input.homeostaticPressure01,input.predictionError01,input.novelty01,input.uncertainty01,input.socialNeed01,1-input.energy01].map(clamp01);
    const internalPressure01=clamp01(pressures.reduce((s,v)=>s+v,0)/pressures.length);
    const hi=pressures.filter(v=>v>=.45).length;
    const pressureDiversity01=clamp01(hi/Math.max(3,pressures.length));
    const eligible=input.autonomousAllowed&&!input.externalInput&&input.identityContinuity01>=.55;
    const strong=internalPressure01>=.34&&pressureDiversity01>=.28;
    this.state.decisions++;
    if(eligible)this.state.eligible++; else if(input.externalInput)this.state.blockedExternal++;
    if(eligible&&!strong)this.state.blockedWeakPressure++;
    this.state.meanPressure01=this.state.meanPressure01*.94+internalPressure01*.06;
    this.state.meanDiversity01=this.state.meanDiversity01*.94+pressureDiversity01*.06;
    return {allow:eligible&&strong&&this.state.lesion01<.8,internalPressure01,pressureDiversity01,reason:input.externalInput?'external-input':!input.autonomousAllowed?'autonomy-disabled':input.identityContinuity01<.55?'identity-unstable':!strong?'weak-internal-pressure':'internal-autonomous-pressure'};
  }

  observeGoalPopulation(input:{tick:number;goals:Array<{id:string;source?:string;status?:string}>;externalInput:boolean;autonomousAllowed:boolean;actionBefore:string|null}){
    const seen=new Set(this.state.seenGoalIds);
    const created=input.goals.filter(g=>g?.id&&!seen.has(g.id));
    let internal=0, external=0;
    for(const g of created){
      const source=String(g.source??'');
      const isInternal=['intrinsic','homeostatic','learned','self-generated','revised','recovery'].includes(source);
      if(isInternal&&!input.externalInput&&input.autonomousAllowed) internal++; else external++;
      seen.add(g.id);
    }
    this.state.seenGoalIds=[...seen].slice(-256);
    this.state.internallySourcedGoals+=internal; this.state.externallySourcedGoals+=external;
    return {created:created.length,internal,external,ids:created.map(g=>g.id)};
  }

  recordCandidate(input:{tick:number;candidateId:string;externalInput:boolean;autonomousAllowed:boolean;internalPressure01:number;pressureDiversity01:number;identityContinuity01:number;goalPressure01:number;homeostaticPressure01:number;predictionError01:number;novelty01:number;created:boolean;actionBefore:string|null;actionAfter:string|null}){
    const changed=Boolean(input.created&&input.actionBefore&&input.actionAfter&&input.actionBefore!==input.actionAfter&&!input.externalInput);
    if(input.created)this.state.candidateAccepted++;
    if(changed)this.state.actionInfluenced++;
    this.state.recent=[...this.state.recent,{...input,actionChanged:changed,outcome01:null}].slice(-96);
    return {actionChanged:changed};
  }
  observeOutcome(outcome01:number){
    const q=clamp01(outcome01),last=this.state.recent[this.state.recent.length-1]; if(!last)return;
    last.outcome01=q;if(last.actionChanged&&q>=.65)this.state.successfulInfluence++;
  }
  lesion(fraction01=.5){this.state.lesion01=clamp01(fraction01);return this.state.lesion01;}
  clearLesion(){this.state.lesion01=0;}
  diagnostics(){const eligible=this.state.eligible;return {...this.snapshot(),autonomousGoalRate01:this.state.internallySourcedGoals/Math.max(1,eligible),internalGoalShare01:this.state.internallySourcedGoals/Math.max(1,this.state.internallySourcedGoals+this.state.externallySourcedGoals),actionInfluenceRate01:this.state.actionInfluenced/Math.max(1,this.state.candidateAccepted),successfulInfluenceRate01:this.state.actionInfluenced?this.state.successfulInfluence/this.state.actionInfluenced:0};}
}
