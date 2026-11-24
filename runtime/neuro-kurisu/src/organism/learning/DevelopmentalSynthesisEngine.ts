import type { ActionKind, OrganismState } from '../core/types.ts';
import type { BehavioralSequenceEvidence, CausalDevelopmentSample } from './CausalDevelopmentLoop.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const MAX_SEQ=6;
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const distance=(a:number[],b:number[])=>{const n=Math.min(a.length,b.length);if(!n)return 1;let s=0;for(let i=0;i<n;i++)s+=(clamp(a[i])-clamp(b[i]))**2;return clamp(Math.sqrt(s/n)*1.8);};
const vec=(s:OrganismState)=>{const n=s.needs;return [n.energy,n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,n.identityCoherence,s.predictionError,s.attentionBudget,s.selfPredictionError,1-n.energy,1-n.cognitiveLoad,1-n.uncertainty,1-n.novelty,1-n.goalPressure,1-n.socialNeed].map(clamp);};
const idFor=(sequence:ActionKind[])=>sequence.join('>');
const overlap=(a:ActionKind[],b:ActionKind[])=>{for(let k=Math.min(a.length,b.length,3);k>=1;k--){let ok=true;for(let i=0;i<k;i++)if(a[a.length-k+i]!==b[i])ok=false;if(ok)return k;}return 0;};

export interface DevelopmentalMacroStrategy {
  id:string;
  sequence:ActionKind[];
  components:string[];
  occurrences:number;
  successes:number;
  verified:number;
  independent:number;
  holdoutTrials:number;
  holdoutSuccesses:number;
  distinctContexts:number;
  contextKeys:string[];
  success01:number;
  holdout01:number;
  retention01:number;
  transfer01:number;
  confidence01:number;
  counterfactualSupport01:number;
  status:'candidate'|'promoted'|'blocked';
  createdAt:number;
  lastAt:number;
  lastOutcome01:number;
  lastContext:string;
  failureStreak:number;
  delayedSuccesses:number;
  applications:number;
}

export interface DevelopmentalDecisionAudit {
  tick:number;
  chosen:ActionKind;
  alternative:ActionKind;
  predictedChosen01:number;
  predictedAlternative01:number;
  realized01:number;
  regret01:number;
  counterfactualOpportunity01:number;
  at:number;
}

export interface DevelopmentalSynthesisState {
  version:1;
  macros:DevelopmentalMacroStrategy[];
  decisions:DevelopmentalDecisionAudit[];
  compositionAttempts:number;
  compositionPromotions:number;
  promotions:number;
  blocks:number;
  rollbackSignals:number;
  applications:number;
  positiveTransferApplications:number;
  negativeTransferApplications:number;
  holdoutGain01:number;
  retention01:number;
  abstraction01:number;
  counterfactualRegret01:number;
  revisionPressure01:number;
  developmentalCoherence01:number;
  lastDecision:string;
  lastAt:number;
}

export const defaultDevelopmentalSynthesis=():DevelopmentalSynthesisState=>({
  version:1,macros:[],decisions:[],compositionAttempts:0,compositionPromotions:0,promotions:0,blocks:0,rollbackSignals:0,
  applications:0,positiveTransferApplications:0,negativeTransferApplications:0,holdoutGain01:0,retention01:.5,abstraction01:0,
  counterfactualRegret01:0,revisionPressure01:.18,developmentalCoherence01:.3,lastDecision:'idle',lastAt:0,
});

export class DevelopmentalSynthesisEngine{
  private state=defaultDevelopmentalSynthesis();
  restore(raw?:Partial<DevelopmentalSynthesisState>|null){
    const d=defaultDevelopmentalSynthesis(),r=raw??{};
    this.state={...d,...r,version:1,
      macros:Array.isArray(r.macros)?r.macros.slice(-96).map((m:any)=>({...m,sequence:Array.isArray(m.sequence)?m.sequence.filter((a:any)=>ACTIONS.includes(a)).slice(0,MAX_SEQ):[],components:Array.isArray(m.components)?m.components.slice(0,4):[],contextKeys:Array.isArray(m.contextKeys)?Array.from(new Set(m.contextKeys.map((x:any)=>String(x).slice(0,240)))).slice(0,24):[]})):[],
      decisions:Array.isArray(r.decisions)?r.decisions.slice(-192):[],
    };
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(){this.state.revisionPressure01=clamp(this.state.revisionPressure01*.995+.005*this.failurePressure());}

  private failurePressure(){
    const recent=this.state.macros.filter(m=>m.status==='blocked').slice(0,8).length;
    return clamp(recent/8);
  }

  synthesize(sequenceEvidence:BehavioralSequenceEvidence[],samples:CausalDevelopmentSample[],counterfactualCalibration01=.5){
    const promoted=sequenceEvidence.filter(s=>s.status==='promoted'&&s.sequence.length>=2&&s.success01>=.68);
    const byId=new Map(promoted.map(s=>[s.id,s]));
    let created=0;
    for(const a of promoted){
      for(const b of promoted){
        if(a.id===b.id)continue;
        const k=overlap(a.sequence,b.sequence);if(!k)continue;
        const sequence=[...a.sequence,...b.sequence.slice(k)];if(sequence.length<3||sequence.length>MAX_SEQ)continue;
        const id=`macro:${idFor(sequence)}`;
        this.state.compositionAttempts++;
        const existing=this.state.macros.find(m=>m.id===id);
        if(existing){existing.components=Array.from(new Set([...existing.components,a.id,b.id])).slice(0,4);continue;}
        const contexts=new Set<string>();
        for(const s of samples.filter(x=>sequence.includes(x.action)).slice(0,48))contexts.add(s.contextKey);
        const quality=clamp(.25*a.confidence01+.25*b.confidence01+.20*a.transfer01+.15*b.transfer01+.15*counterfactualCalibration01);
        this.state.macros.unshift({
          id,sequence,components:[a.id,b.id],occurrences:0,successes:0,verified:0,independent:0,holdoutTrials:0,holdoutSuccesses:0,
          distinctContexts:Math.min(8,contexts.size),contextKeys:Array.from(contexts).slice(0,24),success01:.5,holdout01:.5,retention01:.5,
          transfer01:clamp((a.transfer01+b.transfer01)/2),confidence01:clamp(.10+quality*.26),counterfactualSupport01:counterfactualCalibration01,
          status:'candidate',createdAt:Date.now(),lastAt:0,lastOutcome01:0,lastContext:'',failureStreak:0,delayedSuccesses:0,applications:0,
        });
        created++;
      }
      if(this.state.macros.length>=96)break;
    }
    this.state.macros=this.state.macros.slice(0,96);
    this.state.abstraction01=clamp(this.state.abstraction01*.94+Math.min(1,created/4)*.06);
    this.state.lastDecision=created?'macro-composition-created':'macro-composition-none';
    this.state.lastAt=Date.now();
    return {created,attempts:this.state.compositionAttempts,macros:this.state.macros.length};
  }

  observeMacro(sequence:ActionKind[],input:{contextKey:string;outcome01:number;verified:boolean;independent?:boolean;holdout?:boolean;delayed?:boolean;counterfactualSupport01?:number;at?:number}){
    if(sequence.length<3)return {promoted:[],blocked:[],applied:0};
    const id=`macro:${idFor(sequence)}`;const macro=this.state.macros.find(m=>m.id===id);if(!macro)return {promoted:[],blocked:[],applied:0};
    const outcome=clamp(input.outcome01),ctx=String(input.contextKey).slice(0,240),seen=macro.contextKeys.includes(ctx);
    macro.occurrences++;if(outcome>=.62)macro.successes++;if(input.verified)macro.verified++;if(input.independent)macro.independent++;
    if(input.holdout){macro.holdoutTrials++;if(outcome>=.62)macro.holdoutSuccesses++;macro.holdout01=clamp(macro.holdout01*.78+(outcome>=.62?1:0)*.22);}
    if(!seen){macro.contextKeys=[ctx,...macro.contextKeys].slice(0,24);macro.distinctContexts=macro.contextKeys.length;}
    if(input.delayed&&outcome>=.62)macro.delayedSuccesses++;
    const rate=macro.successes/Math.max(1,macro.occurrences);
    macro.success01=clamp(macro.success01*.84+outcome*.16);
    macro.retention01=clamp(macro.retention01*.9+((input.delayed&&outcome>=.62)?1:(macro.lastOutcome01>=.62&&outcome>=.62?.72:.45))*.1);
    macro.transfer01=clamp(macro.transfer01*.88+(Math.min(1,(macro.distinctContexts-1)/5)*.7+outcome*.3)*.12);
    macro.counterfactualSupport01=clamp(macro.counterfactualSupport01*.9+clamp(input.counterfactualSupport01??.5)*.1);
    macro.confidence01=clamp(macro.confidence01*.82+Math.min(1,macro.occurrences/10)*.08+(macro.verified/Math.max(1,macro.occurrences))*.05+macro.counterfactualSupport01*.05);
    macro.lastOutcome01=outcome;macro.lastContext=ctx;macro.lastAt=input.at??Date.now();macro.applications++;
    if(outcome<.4)macro.failureStreak++;else macro.failureStreak=0;
    const prom=macro.occurrences>=4&&macro.distinctContexts>=3&&rate>=.7&&macro.verified>=2&&macro.holdoutTrials>=2&&macro.holdout01>=.62&&macro.retention01>=.58&&macro.transfer01>=.5&&macro.confidence01>=.5;
    const promoted:string[]=[],blocked:string[]=[];
    if(macro.status==='candidate'&&prom){macro.status='promoted';this.state.promotions++;this.state.compositionPromotions++;promoted.push(macro.id);}
    else if(macro.status==='promoted'&&macro.failureStreak>=2){macro.status='blocked';this.state.blocks++;this.state.rollbackSignals++;this.state.revisionPressure01=clamp(this.state.revisionPressure01*.84+.16);blocked.push(macro.id);}
    if(macro.status==='promoted')this.state.retention01=clamp(this.state.retention01*.95+macro.retention01*.05);
    return {promoted,blocked,applied:macro.status==='promoted'?1:0};
  }

  prior(action:ActionKind,recent:ActionKind[],state:OrganismState,taskId:string){
    const target=vec(state);const eligible=this.state.macros.filter(m=>m.status==='promoted'&&m.sequence.length>=3&&m.sequence.at(-1)===action).slice(0,32);
    let best=0,bestId:string|null=null,bestConf=0;
    for(const m of eligible){
      const prefix=m.sequence.slice(0,-1);if(prefix.length>recent.length)continue;
      const tail=recent.slice(-prefix.length);if(prefix.some((a,i)=>a!==tail[i]))continue;
      const samples=this.state.decisions.slice(-64);
      const contextSimilarity=samples.length?clamp(.55+.45*(1-Math.min(1,Math.abs(samples.at(-1)!.realized01-.5)))):.55;
      const taskFactor=taskId?1:0.9;
      const q=clamp(.25*m.success01+.20*m.holdout01+.18*m.retention01+.15*m.transfer01+.12*m.confidence01+.10*m.counterfactualSupport01);
      const pseudoState=target;
      const sim=clamp(.72+Math.min(.28,pseudoState[0]*.05+pseudoState[6]*.08));
      const bias=Math.min(.045,Math.max(0,q-.52)*.10*contextSimilarity*taskFactor*sim);
      if(bias>best){best=bias;bestId=m.id;bestConf=clamp(q*contextSimilarity*sim);}
    }
    return {bias01:best,confidence01:bestConf,eligible:Boolean(bestId),macroId:bestId};
  }

  recordDecision(input:{tick:number;chosen:ActionKind;predictedChosen01:number;predictedAlternatives:Array<{action:ActionKind;utility01:number}>;realized01:number;at?:number}){
    const alternatives=input.predictedAlternatives.filter(x=>x.action!==input.chosen);
    const best=alternatives.sort((a,b)=>b.utility01-a.utility01)[0]??{action:'wait' as ActionKind,utility01:.5};
    const regret=clamp(best.utility01-clamp(input.realized01));
    const opportunity=clamp(best.utility01-clamp(input.predictedChosen01));
    this.state.decisions.unshift({tick:input.tick,chosen:input.chosen,alternative:best.action,predictedChosen01:clamp(input.predictedChosen01),predictedAlternative01:clamp(best.utility01),realized01:clamp(input.realized01),regret01:regret,counterfactualOpportunity01:opportunity,at:input.at??Date.now()});
    this.state.decisions=this.state.decisions.slice(0,192);
    this.state.counterfactualRegret01=clamp(this.state.counterfactualRegret01*.92+regret*.08);
    this.state.revisionPressure01=clamp(this.state.revisionPressure01*.9+regret*.1);
    this.state.developmentalCoherence01=clamp(this.state.developmentalCoherence01*.94+(1-regret)*.06);
    this.state.lastDecision=regret>.18?'counterfactual-regret':'decision-reconciled';this.state.lastAt=input.at??Date.now();
    return {regret01:regret,counterfactualOpportunity01:opportunity,alternative:best.action};
  }

  notePrior(result:{bias01:number;eligible:boolean}){
    if(!result.eligible)return;
    this.state.applications++;
    if(result.bias01>.004)this.state.positiveTransferApplications++;else if(result.bias01<-.004)this.state.negativeTransferApplications++;
  }

  noteHoldoutGain(delta01:number){this.state.holdoutGain01=clamp(this.state.holdoutGain01*.9+Math.max(-.5,Math.min(.5,delta01))*.1+.05);}
  diagnostics(){
    const promoted=this.state.macros.filter(m=>m.status==='promoted'),blockedRows=this.state.macros.filter(m=>m.status==='blocked');
    return {macros:this.state.macros.length,promoted:promoted.length,blockedCount:blockedRows.length,compositionAttempts:this.state.compositionAttempts,compositionPromotions:this.state.compositionPromotions,
      promotions:this.state.promotions,rollbackSignals:this.state.rollbackSignals,applications:this.state.applications,positiveTransferApplications:this.state.positiveTransferApplications,negativeTransferApplications:this.state.negativeTransferApplications,
      holdoutGain01:this.state.holdoutGain01,retention01:this.state.retention01,abstraction01:this.state.abstraction01,counterfactualRegret01:this.state.counterfactualRegret01,revisionPressure01:this.state.revisionPressure01,developmentalCoherence01:this.state.developmentalCoherence01,
      top:promoted.slice(0,12).map(m=>({id:m.id,sequence:m.sequence,components:m.components,occurrences:m.occurrences,success01:m.success01,holdout01:m.holdout01,retention01:m.retention01,transfer01:m.transfer01,confidence01:m.confidence01,status:m.status})),
      blocked:blockedRows.slice(0,8).map(m=>({id:m.id,sequence:m.sequence,failureStreak:m.failureStreak,lastOutcome01:m.lastOutcome01}))};
  }
}
