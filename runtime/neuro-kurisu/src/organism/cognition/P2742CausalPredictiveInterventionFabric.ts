import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const LATENT=8;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const norm=(v:number[])=>Math.sqrt(v.reduce((s,x)=>s+finite(x)*finite(x),0)/Math.max(1,v.length));
const distance=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>{const d=finite(x)-finite(b[i]);return s+d*d;},0)/Math.max(1,a.length));

export interface P2742ActionModel{
  samples:number;
  rewardMean01:number;
  rewardVar01:number;
  rewardConfidence01:number;
  deltaMean:number[];
  deltaVar:number[];
  coefficient:number[];
  transitionConfidence01:number;
  interventionValue01:number;
  informationGain01:number;
  modelError01:number;
}

export interface P2742ContextModel{
  visits:number;
  centroid:number[];
  novelty01:number;
  uncertainty01:number;
  predictionError01:number;
}

export interface P2742State{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  activeContextId:number;
  contextSwitches:number;
  contextPrototype:number[][];
  contextModels:P2742ContextModel[];
  actions:P2742ActionModel[];
  latentPrediction:number[];
  latentUncertainty01:number;
  transitionConfidence01:number;
  interventionValue01:number;
  informationGain01:number;
  epistemicPressure01:number;
  pragmaticValue01:number;
  causalSurprise01:number;
  counterfactualGap01:number;
  modelResidual01:number;
  modelCalibration01:number;
  actionSelectionConfidence01:number;
  selectedActionIndex:number;
  selectedContextId:number;
  probeFraction01:number;
  interventionCount:number;
  highInformationOutcomes:number;
  replayUtility01:number;
  replayNovelty01:number;
  replayProtection01:number;
  mobilePressure01:number;
  skippedPlanning:number;
  planningDepth:number;
  lastReason:string;
}

const freshAction=():P2742ActionModel=>({
  samples:0,rewardMean01:.5,rewardVar01:.25,rewardConfidence01:.08,
  deltaMean:new Array(LATENT).fill(0),deltaVar:new Array(LATENT).fill(.22),
  coefficient:new Array(LATENT).fill(0),transitionConfidence01:.08,
  interventionValue01:.25,informationGain01:.35,modelError01:.5
});
const freshContext=():P2742ContextModel=>({visits:0,centroid:new Array(LATENT).fill(0),novelty01:.5,uncertainty01:.5,predictionError01:.5});

export const defaultP2742CausalPredictiveIntervention=():P2742State=>({
  version:1,enabled:true,tick:0,outcomes:0,activeContextId:0,contextSwitches:0,
  contextPrototype:Array.from({length:6},()=>new Array(LATENT).fill(0)),
  contextModels:Array.from({length:6},()=>freshContext()),
  actions:ACTIONS.map(()=>freshAction()),
  latentPrediction:new Array(LATENT).fill(0),latentUncertainty01:.55,transitionConfidence01:.08,
  interventionValue01:.30,informationGain01:.35,epistemicPressure01:.35,pragmaticValue01:.50,
  causalSurprise01:.45,counterfactualGap01:.12,modelResidual01:.5,modelCalibration01:.45,
  actionSelectionConfidence01:.20,selectedActionIndex:0,selectedContextId:0,probeFraction01:.16,
  interventionCount:0,highInformationOutcomes:0,replayUtility01:.35,replayNovelty01:.35,replayProtection01:.25,
  mobilePressure01:.25,skippedPlanning:0,planningDepth:2,lastReason:'init'
});

export class P2742CausalPredictiveInterventionFabric{
  private state:P2742State=defaultP2742CausalPredictiveIntervention();
  private contexts=6;
  snapshot(){return structuredClone(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2742State>|null){
    const d=defaultP2742CausalPredictiveIntervention(),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-(v?.length??0))).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const actionModels=ACTIONS.map((_,i)=>{
      const a={...d.actions[i],...(r.actions?.[i]??{})};
      return {...a,deltaMean:arr(a.deltaMean,LATENT),deltaVar:arr(a.deltaVar,LATENT,.22),coefficient:arr(a.coefficient,LATENT)};
    });
    const contexts=Array.from({length:this.contexts},(_,i)=>{
      const c={...d.contextModels[i],...(r.contextModels?.[i]??{})};
      return {...c,centroid:arr(c.centroid,LATENT)};
    });
    this.state={...d,...structuredClone(r),version:1,
      contextPrototype:Array.from({length:this.contexts},(_,i)=>arr(r.contextPrototype?.[i],LATENT)),
      contextModels:contexts,actions:actionModels,latentPrediction:arr(r.latentPrediction,LATENT)
    };
  }
  private assignContext(latent:number[],novelty01:number,predictionError01:number):{id:number;shift:number}{
    let best=0,bestDistance=Infinity;
    for(let i=0;i<this.contexts;i++){const d=distance(latent,this.state.contextPrototype[i]!);if(d<bestDistance){bestDistance=d;best=i;}}
    const active=this.state.activeContextId;
    const activeDistance=distance(latent,this.state.contextPrototype[active]!);
    const shift=clamp(.54*(activeDistance/1.25)+.26*novelty01+.20*predictionError01);
    const unused=this.state.contextModels.findIndex(x=>x.visits===0);
    if(unused>=0 && (shift>.42 || novelty01>.62 || predictionError01>.58)){best=unused;bestDistance=activeDistance;}
    if(best!==active && (shift>.66 || (unused>=0 && best===unused))){this.state.contextSwitches++;this.state.activeContextId=best;}
    const id=this.state.activeContextId;
    const p=this.state.contextPrototype[id]!;
    const rate=clamp(.015+.06*(1-this.state.mobilePressure01),.01,.075);
    for(let i=0;i<LATENT;i++)p[i]=finite(p[i])+(finite(latent[i])-finite(p[i]))*rate;
    const c=this.state.contextModels[id]!;c.visits++;c.novelty01=clamp(c.novelty01*.94+novelty01*.06);c.predictionError01=clamp(c.predictionError01*.93+predictionError01*.07);c.uncertainty01=clamp(c.uncertainty01*.93+shift*.07);
    return {id,shift};
  }
  private predict(actionIndex:number,latent:number[],contextId:number):{delta:number[];variance:number;reward:number;confidence:number}{
    const m=this.state.actions[actionIndex]!;
    const ctx=this.state.contextModels[contextId]!;
    const centered=latent.map((x,i)=>finite(x)-finite(ctx.centroid[i]));
    const delta=Array.from({length:LATENT},(_,i)=>{
      const base=finite(m.deltaMean[i]);
      const g=clamp(m.coefficient[i],-.9,.9);
      return tanh(base+g*centered[i]);
    });
    const variance=clamp(m.deltaVar.reduce((s,x)=>s+finite(x),0)/LATENT);
    const reward=clamp(m.rewardMean01 + .06*norm(delta) - .04*Math.sqrt(variance));
    const confidence=clamp(m.transitionConfidence01*(1-variance*.55));
    return {delta,variance,reward,confidence};
  }
  beforeDecision(i:{tick:number;latent:number[];baseUtilities:Record<ActionKind,number>;novelty01:number;uncertainty01:number;predictionError01:number;resource01:number;goalPressure01:number;identityGap01:number;existingBias?:Partial<Record<ActionKind,number>>}):{actionBias:Record<ActionKind,number>;contextId:number;selectedAction:ActionKind;informationGain01:number;interventionValue01:number;transitionConfidence01:number;modelCalibration01:number;planningDepth:number;replayUtility01:number;mobilePressure01:number;counterfactualGap01:number}{
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,contextId:0,selectedAction:'respond',informationGain01:0,interventionValue01:0,transitionConfidence01:0,modelCalibration01:0,planningDepth:0,replayUtility01:0,mobilePressure01:0,counterfactualGap01:0};
    this.state.tick=i.tick;
    const latent=i.latent.slice(0,LATENT).concat(new Array(LATENT).fill(0)).slice(0,LATENT).map(x=>finite(x));
    this.state.mobilePressure01=clamp(.58*(1-i.resource01)+.24*i.uncertainty01+.18*this.state.mobilePressure01);
    const ctx=this.assignContext(latent,i.novelty01,i.predictionError01);
    this.state.selectedContextId=ctx.id;
    const depth=this.state.mobilePressure01>.66?1:this.state.mobilePressure01>.42?2:3;
    this.state.planningDepth=depth;
    this.state.skippedPlanning+=depth<2?1:0;
    const scores:number[]=[];
    let totalInfo=0,totalValue=0,totalConf=0;
    for(let a=0;a<ACTIONS.length;a++){
      const p=this.predict(a,latent,ctx.id),m=this.state.actions[a]!;
      const base=clamp(i.baseUtilities[ACTIONS[a]!]??.5);
      const epistemic=clamp(.52*p.variance+.24*(1-p.confidence)+.16*i.novelty01+.08*ctx.shift);
      const counterfactual=(1-p.confidence)*.07;
      const pragmatic=clamp(base + .08*p.reward + .025*i.goalPressure01 - .015*i.identityGap01);
      const penalty=.05*p.variance+.025*this.state.actions[a]!.modelError01;
      scores[a]=pragmatic+.045*epistemic+counterfactual-penalty;
      m.informationGain01=clamp(m.informationGain01*.92+epistemic*.08);
      m.interventionValue01=clamp(m.interventionValue01*.92+(.55*epistemic+.45*pragmatic)*.08);
      totalInfo+=m.informationGain01;totalValue+=pragmatic;totalConf+=p.confidence;
    }
    // Force a bounded epistemic probe when uncertainty is high and the verification action
    // is sufficiently safe. This follows information-seeking principles without replacing
    // ordinary reward-driven action selection.
    const verifyIndex=ACTIONS.indexOf('verify'),exploreIndex=ACTIONS.indexOf('explore');
    const probe=clamp(.48*i.uncertainty01+.32*i.novelty01+.20*ctx.shift);
    this.state.probeFraction01=clamp(this.state.probeFraction01*.9+probe*.1);
    if(probe>.62){scores[verifyIndex]+=probe*.055;scores[exploreIndex]+=probe*.035;this.state.interventionCount++;}
    let best=0;for(let a=1;a<ACTIONS.length;a++)if(scores[a]!>scores[best]!)best=a;
    const ordered=scores.slice().sort((a,b)=>b-a),margin=ordered[0]!-ordered[1]!;
    this.state.selectedActionIndex=best;
    this.state.actionSelectionConfidence01=clamp(.12+margin*3.6+.35*(totalConf/ACTIONS.length));
    this.state.informationGain01=clamp(this.state.informationGain01*.9+(totalInfo/ACTIONS.length)*.1);
    this.state.interventionValue01=clamp(this.state.interventionValue01*.9+(totalValue/ACTIONS.length)*.1);
    this.state.epistemicPressure01=clamp(this.state.epistemicPressure01*.9+probe*.1);
    this.state.pragmaticValue01=clamp(this.state.pragmaticValue01*.9+(totalValue/ACTIONS.length)*.1);
    const actionBias=Object.fromEntries(ACTIONS.map((a,ai)=>{
      const rank=(scores[ai]!-scores[best]!);const existing=finite(i.existingBias?.[a] ?? 0,0);
      return [a,clamp(existing + rank*.026 + (ai===verifyIndex?probe*.018:0)+(ai===exploreIndex?probe*.012:0),-.11,.11)];
    })) as Record<ActionKind,number>;
    const selected=ACTIONS[best]!;
    this.state.lastReason=`ctx=${ctx.id};shift=${ctx.shift.toFixed(2)};probe=${probe.toFixed(2)};selected=${selected};info=${this.state.informationGain01.toFixed(2)};depth=${depth}`;
    return {actionBias,contextId:ctx.id,selectedAction:selected,informationGain01:this.state.informationGain01,interventionValue01:this.state.interventionValue01,transitionConfidence01:this.state.transitionConfidence01,modelCalibration01:this.state.modelCalibration01,planningDepth:depth,replayUtility01:this.replayUtility(latent,i.novelty01,i.predictionError01),mobilePressure01:this.state.mobilePressure01,counterfactualGap01:this.state.counterfactualGap01};
  }
  observeOutcome(i:{tick:number;latentBefore:number[];latentAfter:number[];action:ActionKind;reward01:number;predictionError01:number;novelty01:number;uncertainty01:number;verified01:number;contextId?:number}):void{
    if(!this.state.enabled)return;
    this.state.tick=i.tick;this.state.outcomes++;
    const ai=Math.max(0,ACTIONS.indexOf(i.action)),ctx=Math.max(0,Math.min(this.contexts-1,Math.floor(i.contextId??this.state.activeContextId)));
    const m=this.state.actions[ai]!;
    const before=i.latentBefore.slice(0,LATENT).concat(new Array(LATENT).fill(0)).slice(0,LATENT).map(x=>finite(x));
    const after=i.latentAfter.slice(0,LATENT).concat(new Array(LATENT).fill(0)).slice(0,LATENT).map(x=>finite(x));
    const delta=after.map((x,k)=>x-before[k]!);
    const p=this.predict(ai,before,ctx);
    const modelResidual=distance(delta,p.delta);
    const residualGain=clamp(1-modelResidual);
    const lr=Math.min(.16,1.6/(m.samples+1));
    const rewardError=finite(i.reward01)-m.rewardMean01;
    m.rewardMean01=clamp(m.rewardMean01+rewardError*lr);
    m.rewardVar01=clamp(m.rewardVar01*.94+Math.abs(rewardError)*.06);
    m.rewardConfidence01=clamp(.08+Math.min(.88,(m.samples+1)/36)*(.78+.22*(1-m.rewardVar01)));
    for(let k=0;k<LATENT;k++){
      const err=delta[k]!-finite(m.deltaMean[k]);
      m.deltaMean[k]=finite(m.deltaMean[k])+err*lr;
      m.deltaVar[k]=clamp(finite(m.deltaVar[k],.22)*.94+Math.abs(err)*.06,.001,1);
      const x=before[k]!,den=.04+x*x;
      const coeffErr=delta[k]!-finite(m.deltaMean[k]);
      m.coefficient[k]=clamp(finite(m.coefficient[k])+(.04*coeffErr*x/den),-.9,.9);
    }
    m.samples++;m.transitionConfidence01=clamp(m.transitionConfidence01*.94+residualGain*.06);m.modelError01=clamp(m.modelError01*.92+modelResidual*.08);
    const p2=this.predict(ai,before,ctx);
    const calibration=clamp(1-distance(delta,p2.delta));
    this.state.modelResidual01=clamp(this.state.modelResidual01*.90+modelResidual*.10);
    this.state.causalSurprise01=clamp(this.state.causalSurprise01*.90+(modelResidual*(.6+i.uncertainty01*.4))*.10);
    this.state.transitionConfidence01=clamp(this.state.transitionConfidence01*.92+m.transitionConfidence01*.08);
    this.state.modelCalibration01=clamp(this.state.modelCalibration01*.92+calibration*.08);
    const alternatives=ACTIONS.map((_,a)=>this.predict(a,before,ctx).reward);
    const chosen=alternatives[ai]??i.reward01;
    const alt=Math.max(...alternatives.filter((_,a)=>a!==ai));
    this.state.counterfactualGap01=clamp(this.state.counterfactualGap01*.9+Math.max(0,alt-chosen)*.1);
    this.state.highInformationOutcomes+=(this.state.informationGain01>.48||modelResidual>.45||i.predictionError01>.55)?1:0;
    this.state.latentPrediction=after.slice();
    this.state.latentUncertainty01=clamp(this.state.latentUncertainty01*.92+modelResidual*.08);
    this.state.contextModels[ctx]!.predictionError01=clamp(this.state.contextModels[ctx]!.predictionError01*.92+i.predictionError01*.08);
    this.state.contextModels[ctx]!.uncertainty01=clamp(this.state.contextModels[ctx]!.uncertainty01*.92+modelResidual*.08);
    this.state.replayUtility01=this.replayUtility(before,i.novelty01,i.predictionError01);
    this.state.replayNovelty01=clamp(this.state.replayNovelty01*.92+i.novelty01*.08);
    this.state.replayProtection01=clamp(this.state.replayProtection01*.92+((i.verified01>.75||i.reward01>.8)?1:.25)*.08);
  }
  replayScore(sample:{latent?:number[];priority01:number;predictionError01:number;reward01:number;verified01?:number;contextId?:number}):number{
    const latent=(sample.latent??[]).slice(0,LATENT).concat(new Array(LATENT).fill(0)).slice(0,LATENT);
    const modelNovelty=clamp(norm(latent.map((x,k)=>finite(x)-finite(this.state.latentPrediction[k]))));
    const protectedBoost=sample.verified01??0;
    return clamp(.28*sample.priority01+.24*sample.predictionError01+.20*modelNovelty+.14*sample.reward01+.08*protectedBoost+.06*this.state.replayNovelty01);
  }
  replayUtility(latent:number[],novelty01:number,predictionError01:number){return clamp(.36*novelty01+.34*predictionError01+.20*norm(latent.map((x,k)=>finite(x)-finite(this.state.latentPrediction[k])))+.10*this.state.interventionValue01);}
  metrics(){return structuredClone(this.state);}
}
