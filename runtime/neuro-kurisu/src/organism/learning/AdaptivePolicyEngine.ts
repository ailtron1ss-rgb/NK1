import type { ActionKind, OrganismNeeds, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const actions:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface AdaptiveActionValue {
  value:number;
  verifiedValue:number;
  updates:number;
  verifiedUpdates:number;
  rewardMean:number;
  rewardVariance:number;
  confidence01:number;
  lastUpdatedAt:number;
  eligibility01:number;
}
export interface RecoveryStrategyEpisode {
  id:string;
  bootId:string;
  at:number;
  contextKey:string;
  action:ActionKind;
  reward01:number;
  causalConfidence01:number;
  counterfactualMargin01:number;
  counterfactualSupport01:number;
  counterfactualSource:'model'|'matched-simulated'|'external';
  matchedTrials:number;
  independent:boolean;
  autonomous:boolean;
  direction:-1|0|1;
}
export interface RecoveryStrategyPromotion {
  id:string;
  at:number;
  sourceEpisodeIds:string[];
  contextKey:string;
  action:ActionKind;
  effect01:number;
  evidence01:number;
  episodes:number;
  transferCount:number;
  status:'active'|'reversed'|'uncertain';
  reversalCount:number;
  contradictionCount:number;
  meanCausalConfidence01:number;
  meanCounterfactualSupport01:number;
  meanMatchedTrials:number;
  matchedCounterfactuals:number;
}
export interface RecoveryStrategyState {
  version:4;
  episodes:RecoveryStrategyEpisode[];
  promotions:RecoveryStrategyPromotion[];
  lastBootId:string;
  totalEpisodes:number;
  totalPromotions:number;
  transferObservations:number;
  causalBlockedEpisodes:number;
  totalCausalEvaluations:number;
  matchedCounterfactuals:number;
  matchedCalibrationTrials:number;
  matchedCalibrationMae01:number;
  matchedCalibrationBias01:number;
  matchedCalibrationScore01:number;
  matchedCalibrationByKey:Record<string,{trials:number;mae01:number;bias01:number;score01:number}>;
}

export interface AdaptivePolicyState {
  version:1;
  values:Record<string,Partial<Record<ActionKind,AdaptiveActionValue>>>;
  updates:number;
  rewardedUpdates:number;
  penalizedUpdates:number;
  explorationRate01:number;
  lastContextKey:string;
  lastAction:ActionKind|'none';
  lastUpdateAt:number;
  temporalCreditUpdates:number;
  verifiedTemporalUpdates:number;
  temporalPriorContextKey:string;
  temporalPriorAction:ActionKind|'none';
  recoveryStrategy:RecoveryStrategyState;
}

export const defaultAdaptivePolicy=():AdaptivePolicyState=>({
  version:1, values:{}, updates:0, rewardedUpdates:0, penalizedUpdates:0,
  explorationRate01:.18, lastContextKey:'', lastAction:'none', lastUpdateAt:0, temporalCreditUpdates:0, verifiedTemporalUpdates:0, temporalPriorContextKey:'', temporalPriorAction:'none',
  recoveryStrategy:{version:4,episodes:[],promotions:[],lastBootId:'',totalEpisodes:0,totalPromotions:0,transferObservations:0,causalBlockedEpisodes:0,totalCausalEvaluations:0,matchedCounterfactuals:0,matchedCalibrationTrials:0,matchedCalibrationMae01:0,matchedCalibrationBias01:0,matchedCalibrationScore01:0,matchedCalibrationByKey:{}},
});

function bucket(x:number, size:number=4){return Math.max(0,Math.min(size-1,Math.round(clamp(x)*(size-1))));}

export class AdaptivePolicyEngine {
  private state=defaultAdaptivePolicy();
  restore(value:AdaptivePolicyState|undefined){
    const raw=value??defaultAdaptivePolicy();
    const values:AdaptivePolicyState['values']={};
    for(const [context,table] of Object.entries(raw.values??{})){
      const normalized:Partial<Record<ActionKind,AdaptiveActionValue>>={};
      for(const action of actions){
        const row=(table as any)?.[action];
        if(row) normalized[action]={
          value:clamp(Number(row.value??.5)),
          verifiedValue:clamp(Number(row.verifiedValue??row.value??.5)),
          updates:Math.max(0,Math.floor(Number(row.updates??0))),
          verifiedUpdates:Math.max(0,Math.floor(Number(row.verifiedUpdates??0))),
          rewardMean:clamp(Number(row.rewardMean??.5)),
          rewardVariance:clamp(Number(row.rewardVariance??.25)),
          confidence01:clamp(Number(row.confidence01??0)),
          lastUpdatedAt:Math.max(0,Number(row.lastUpdatedAt??0)),
          eligibility01:clamp(Number(row.eligibility01??0)),
        };
      }
      values[context]=normalized;
    }
    const recoveryRaw=(raw as any).recoveryStrategy??{};
    const recoveryDefault=defaultAdaptivePolicy().recoveryStrategy;
    const recoveryStrategy:RecoveryStrategyState={
      ...recoveryDefault,
      ...recoveryRaw,
      version:4,
      episodes:Array.isArray(recoveryRaw.episodes)?recoveryRaw.episodes.slice(-48).map((e:any)=>({
        id:String(e?.id??''),bootId:String(e?.bootId??''),at:Math.max(0,Number(e?.at??0)),contextKey:String(e?.contextKey??''),
        action:actions.includes(e?.action)?e.action:'wait',reward01:clamp(Number(e?.reward01??.5)),
        causalConfidence01:clamp(Number(e?.causalConfidence01??.5)),counterfactualMargin01:clampSigned(Number(e?.counterfactualMargin01??0)),counterfactualSupport01:clamp(Number(e?.counterfactualSupport01??.5)),counterfactualSource:(e?.counterfactualSource==='external'||e?.counterfactualSource==='matched-simulated')?e.counterfactualSource:'model',matchedTrials:Math.max(0,Math.floor(Number(e?.matchedTrials??0))),independent:Boolean(e?.independent),autonomous:Boolean(e?.autonomous),
        direction:(Number(e?.direction??0)>0?1:Number(e?.direction??0)<0?-1:0) as -1|0|1,
      })) : [],
      promotions:Array.isArray(recoveryRaw.promotions)?recoveryRaw.promotions.slice(-24).map((e:any)=>({
        id:String(e?.id??''),at:Math.max(0,Number(e?.at??0)),sourceEpisodeIds:Array.isArray(e?.sourceEpisodeIds)?e.sourceEpisodeIds.slice(-8).map(String):[],
        contextKey:String(e?.contextKey??''),action:actions.includes(e?.action)?e.action:'wait',effect01:clampSigned(Number(e?.effect01??0)),
        evidence01:clamp(Number(e?.evidence01??0)),episodes:Math.max(0,Math.floor(Number(e?.episodes??0))),transferCount:Math.max(0,Math.floor(Number(e?.transferCount??0))),
        status:(e?.status==='reversed'||e?.status==='uncertain')?e.status:'active',
        meanCausalConfidence01:clamp(Number(e?.meanCausalConfidence01??.5)),
        meanCounterfactualSupport01:clamp(Number(e?.meanCounterfactualSupport01??.5)),meanMatchedTrials:Math.max(0,Number(e?.meanMatchedTrials??0)),matchedCounterfactuals:Math.max(0,Math.floor(Number(e?.matchedCounterfactuals??0))),
        reversalCount:Math.max(0,Math.floor(Number(e?.reversalCount??0))),
        contradictionCount:Math.max(0,Math.floor(Number(e?.contradictionCount??0))),
      })) : [],
      lastBootId:String(recoveryRaw.lastBootId??''),
      totalEpisodes:Math.max(0,Math.floor(Number(recoveryRaw.totalEpisodes??0))),
      totalPromotions:Math.max(0,Math.floor(Number(recoveryRaw.totalPromotions??0))),
      transferObservations:Math.max(0,Math.floor(Number(recoveryRaw.transferObservations??0))),
      causalBlockedEpisodes:Math.max(0,Math.floor(Number(recoveryRaw.causalBlockedEpisodes??0))),
      totalCausalEvaluations:Math.max(0,Math.floor(Number(recoveryRaw.totalCausalEvaluations??0))),matchedCounterfactuals:Math.max(0,Math.floor(Number(recoveryRaw.matchedCounterfactuals??0))),matchedCalibrationTrials:Math.max(0,Math.floor(Number(recoveryRaw.matchedCalibrationTrials??0))),matchedCalibrationMae01:clamp(Number(recoveryRaw.matchedCalibrationMae01??0)),matchedCalibrationBias01:clampSigned(Number(recoveryRaw.matchedCalibrationBias01??0)),matchedCalibrationScore01:clamp(Number(recoveryRaw.matchedCalibrationScore01??0)),matchedCalibrationByKey:Object.fromEntries(Object.entries(recoveryRaw.matchedCalibrationByKey??{}).map(([k,v]:any)=>[String(k),{trials:Math.max(0,Math.floor(Number(v?.trials??0))),mae01:clamp(Number(v?.mae01??0)),bias01:clampSigned(Number(v?.bias01??0)),
      score01:clamp(Number(v?.score01??0))}])),
    };
    this.state={...defaultAdaptivePolicy(),...raw,values,recoveryStrategy};
  }
  snapshot(){return structuredClone(this.state);}
  contextKey(state:Pick<OrganismState,'needs'>|OrganismState, goalPressure?:number){
    const n=state.needs;
    return [
      `e${bucket(n.energy)}`,
      `c${bucket(n.cognitiveLoad)}`,
      `u${bucket(n.uncertainty)}`,
      `n${bucket(n.novelty)}`,
      `g${bucket(goalPressure??n.goalPressure)}`,
      `s${bucket(n.socialNeed)}`,
    ].join('|');
  }
  estimate(contextKey:string,action:ActionKind,prior:number):AdaptiveActionValue{
    const row=this.state.values[contextKey]?.[action];
    if(row){
      return {
        value:clamp(Number(row.value ?? prior)),
        verifiedValue:clamp(Number(row.verifiedValue ?? row.value ?? prior)),
        updates:Math.max(0,Math.floor(Number(row.updates ?? 0))),
        verifiedUpdates:Math.max(0,Math.floor(Number(row.verifiedUpdates ?? 0))),
        rewardMean:clamp(Number(row.rewardMean ?? .5)),
        rewardVariance:clamp(Number(row.rewardVariance ?? .25)),
        confidence01:clamp(Number(row.confidence01 ?? 0)),
        lastUpdatedAt:Math.max(0,Number(row.lastUpdatedAt ?? 0)),
        eligibility01:clamp(Number(row.eligibility01 ?? 0)),
      };
    }
    return {value:clamp(prior),verifiedValue:clamp(prior),updates:0,verifiedUpdates:0,rewardMean:.5,rewardVariance:.25,confidence01:0,lastUpdatedAt:0,eligibility01:0};
  }

  private contextParts(contextKey:string){
    const matches=[...contextKey.matchAll(/([a-z])(\d+)/g)];
    if(matches.length!==6)return null;
    const order=['e','c','u','n','g','s'];
    const map=Object.fromEntries(matches.map(m=>[m[1],Number(m[2])])) as Record<string,number>;
    return order.map(k=>map[k]);
  }
  private generalizedRows(contextKey:string,action:ActionKind){
    const target=this.contextParts(contextKey);
    if(!target)return [] as Array<{row:AdaptiveActionValue;weight:number;distance:number}>;
    const out:Array<{row:AdaptiveActionValue;weight:number;distance:number}> = [];
    for(const [key,table] of Object.entries(this.state.values)){
      const parts=this.contextParts(key);
      if(!parts)continue;
      const distance=parts.reduce((sum,v,i)=>sum+(v===target[i]?0:1),0);
      if(distance>2)continue;
      const row=(table as any)?.[action] as AdaptiveActionValue|undefined;
      if(!row || row.verifiedUpdates<1)continue;
      const weight=distance===0?1:distance===1?.55:.18;
      out.push({row,weight,distance});
    }
    return out.sort((a,b)=>b.weight-a.weight).slice(0,8);
  }

  bias(contextKey:string,action:ActionKind,prior:number){
    const row=this.state.values[contextKey]?.[action];
    const localBias = row && (row.updates>=2 || row.verifiedUpdates>=1)
      ? ((row.value-prior) * (0.045 + row.confidence01*0.075)
        + (row.verifiedUpdates >= 1 ? clampSigned(row.verifiedValue-prior) * (0.040 + Math.min(.70,row.verifiedUpdates/12)*.035) : 0)
        + (row.verifiedUpdates >= 1 ? (row.verifiedValue-.5)*Math.min(.12,row.verifiedUpdates/20*.12) : 0))
      : 0;
    const neighbors=this.generalizedRows(contextKey,action);
    const transfer=neighbors.filter(x=>x.distance>0).reduce((sum,x)=>sum + clampSigned(x.row.verifiedValue-prior) * (0.032 + Math.min(.70,x.row.verifiedUpdates/12)*.028) * x.weight,0);
    return clampSigned(localBias + transfer);
  }
  update(contextKey:string,action:ActionKind,reward:number,nextContextKey?:string,nextActions:ActionKind[]=actions,learningRateBase=.16,discount=.72, surprise=.2){
    const r=clamp(reward);
    const table=this.state.values[contextKey]??{};
    const current=this.estimate(contextKey,action,.5);
    const nextValues=nextActions.map(a=>this.estimate(nextContextKey??contextKey,a,.5).value);
    const target=clamp(r+discount*Math.max(...nextValues,0));
    const alpha=Math.min(.34,learningRateBase+clamp(surprise)*.12)/(1+Math.min(8,current.updates)*.08);
    const previousContext=this.state.lastContextKey;
    const previousAction=this.state.lastAction;
    if(previousContext && previousAction && previousAction!=='none'){
      const prevTable=this.state.values[previousContext]??{};
      const prev=this.estimate(previousContext,previousAction,.5);
      if(prev.eligibility01>0){
        prevTable[previousAction]={...prev,eligibility01:clamp(prev.eligibility01*.72)};
        this.state.values[previousContext]=prevTable;
      }
    }
    const updated={
      value:clamp(current.value+(target-current.value)*alpha),
      verifiedValue:clamp(current.verifiedValue),
      updates:current.updates+1,
      verifiedUpdates:current.verifiedUpdates,
      rewardMean:clamp(current.rewardMean+(r-current.rewardMean)*Math.min(.25,2/(current.updates+1))),
      rewardVariance:clamp(current.rewardVariance*.9+Math.abs(r-current.rewardMean)*.1),
      confidence01:clamp(.12+Math.min(.78,(current.updates+1)/24*.78)*(1-clamp(current.rewardVariance))),
      lastUpdatedAt:Date.now(),
      eligibility01:1,
    };
    table[action]=updated; this.state.values[contextKey]=table;
    this.state.temporalCreditUpdates++;
    this.state.updates++;
    if(r>=.6)this.state.rewardedUpdates++; if(r<=.4)this.state.penalizedUpdates++;
    this.state.explorationRate01=clamp(.18-(this.state.updates/800)*.1+Math.min(.06,surprise*.04));
    this.state.temporalPriorContextKey=previousContext || '';
    this.state.temporalPriorAction=previousAction || 'none';
    this.state.lastContextKey=contextKey; this.state.lastAction=action; this.state.lastUpdateAt=Date.now();
  }

  observeVerifiedOutcome(contextKey:string,action:ActionKind,reward:number,causalConfidence01=.5,independent=false,autonomous=false){
    const r=clamp(reward);
    const table=this.state.values[contextKey]??{};
    const current=this.estimate(contextKey,action,.5);
    const trust=clamp(.35+causalConfidence01*.40+(independent?.15:0)+(autonomous?.10:0));
    const alpha=Math.min(.22,.07+trust*.09)/(1+Math.min(10,current.verifiedUpdates)*.06);
    const target=clamp(.5+(r-.5)*trust);
    const updated={
      ...current,
      verifiedValue:clamp(current.verifiedValue+(target-current.verifiedValue)*alpha),
      verifiedUpdates:current.verifiedUpdates+1,
      lastUpdatedAt:Date.now(),
      eligibility01:clamp(current.eligibility01*.58),
    };
    table[action]=updated;
    this.state.values[contextKey]=table;
    const previousContext=this.state.temporalPriorContextKey;
    const previousAction=this.state.temporalPriorAction;
    if(previousContext && previousAction && previousAction!=='none' && (previousContext!==contextKey || previousAction!==action)){
      const prevTable=this.state.values[previousContext]??{};
      const prev=this.estimate(previousContext,previousAction,.5);
      const trace=clamp(prev.eligibility01);
      if(trace>.05){
        const temporalTrust=trust*trace*.42;
        const temporalTarget=clamp(.5+(r-.5)*temporalTrust);
        const temporalAlpha=Math.min(.12,.035+temporalTrust*.09)/(1+Math.min(10,prev.verifiedUpdates)*.06);
        prevTable[previousAction]={
          ...prev,
          verifiedValue:clamp(prev.verifiedValue+(temporalTarget-prev.verifiedValue)*temporalAlpha),
          verifiedUpdates:prev.verifiedUpdates+1,
          eligibility01:clamp(trace*.58),
          lastUpdatedAt:Date.now(),
        };
        this.state.values[previousContext]=prevTable;
        this.state.verifiedTemporalUpdates++;
      }
    }
    this.state.lastContextKey=contextKey;
    this.state.lastAction=action;
    this.state.lastUpdateAt=Date.now();
  }
  generalizedBiasDiagnostics(contextKey:string,action:ActionKind,prior=.5){
    const neighbors=this.generalizedRows(contextKey,action);
    return {contextKey,action,neighbors:neighbors.map(x=>({weight:x.weight,distance:x.distance,verifiedUpdates:x.row.verifiedUpdates,verifiedValue:x.row.verifiedValue})),bias:this.bias(contextKey,action,prior)};
  }

  temporalCredit(contextKey:string,action:ActionKind,prior=.5){
    const row=this.estimate(contextKey,action,prior);
    return row.verifiedUpdates>0 ? clampSigned((row.verifiedValue-prior) * Math.min(.08,.02+row.eligibility01*.06)) : 0;
  }
  verifiedClosure(contextKey:string,action:ActionKind,prior=.5){
    const row=this.estimate(contextKey,action,prior);
    return row.verifiedUpdates>0 ? clampSigned((row.verifiedValue-prior) * (0.040 + Math.min(.70,row.verifiedUpdates/12)*.035)) : 0;
  }
  applyGeneValues(values: Record<string, Partial<Record<ActionKind, {value:number}>>>): number {
    let changed = 0;
    for (const [key, table] of Object.entries(values)) {
      const current = this.state.values[key] ?? {};
      for (const [action, gene] of Object.entries(table)) {
        const a = action as ActionKind;
        const prior = this.estimate(key, a, .5);
        current[a] = { ...prior, value: clamp(Number(gene?.value ?? prior.value)), confidence01: Math.max(prior.confidence01, .35), lastUpdatedAt: Date.now() };
        changed++;
      }
      this.state.values[key] = current;
    }
    this.state.lastUpdateAt = Date.now();
    return changed;
  }
  /**
   * B326: self-model-conditioned recovery influence. This is deliberately
   * derived from persisted continuity state rather than a permanent action rule.
   * The influence decays as integration rises, and is zero in the absence of a
   * recovery shock. It is therefore both inspectable and reversible.
   */
  recoveryBias(action:ActionKind, continuityShock01:number, postRecoveryIntegration01:number):number {
    const shock=clamp(continuityShock01);
    const integration=clamp(postRecoveryIntegration01);
    const active=shock*(1-integration);
    if(active<=0) return 0;
    const weights:Record<ActionKind,number>={
      respond:-0.010, explore:-0.055, verify:0.045, rest:0.050, reflect:0.038, wait:0.012, defer:0.022
    };
    return clampSigned(weights[action]*active);
  }


  recoveryStrategyBias(contextKey:string,action:ActionKind,prior=.5){
    const target=this.contextParts(contextKey);
    if(!target) return 0;
    let total=0;
    for(const promotion of this.state.recoveryStrategy.promotions){
      if(promotion.action!==action || !promotion.contextKey) continue;
      const parts=this.contextParts(promotion.contextKey); if(!parts) continue;
      const distance=parts.reduce((sum,v,i)=>sum+(v===target[i]?0:1),0);
      if(distance>2) continue;
      const weight=distance===0?1:distance===1?.60:.22;
      total += clampSigned(promotion.effect01)*weight*(.70+clamp(promotion.evidence01)*.30);
    }
    return clampSigned(total*.10);
  }

  observeMatchedCounterfactualCalibration(input:{contextKey:string;action:ActionKind;selectedExpected01:number;actualSelectedReward01:number}){
    const rs=this.state.recoveryStrategy;
    const key=`${input.contextKey}::${input.action}`;
    const previous=rs.matchedCalibrationByKey[key]??{trials:0,mae01:0,bias01:0,score01:0};
    const selectedExpected01=clamp(input.selectedExpected01);
    const actualSelectedReward01=clamp(input.actualSelectedReward01);
    const error=Math.abs(actualSelectedReward01-selectedExpected01);
    const signedBias=actualSelectedReward01-selectedExpected01;
    const trials=previous.trials+1;
    const mae01=clamp((previous.mae01*previous.trials+error)/trials);
    const bias01=clampSigned((previous.bias01*previous.trials+signedBias)/trials);
    const score01=clamp(1-mae01);
    rs.matchedCalibrationByKey[key]={trials,mae01,bias01,score01};
    rs.matchedCalibrationTrials++;
    const n=rs.matchedCalibrationTrials;
    rs.matchedCalibrationMae01=clamp((rs.matchedCalibrationMae01*(n-1)+error)/n);
    rs.matchedCalibrationBias01=clampSigned((rs.matchedCalibrationBias01*(n-1)+signedBias)/n);
    rs.matchedCalibrationScore01=clamp(1-rs.matchedCalibrationMae01);
    return {key,trials,mae01,bias01,score01,totalTrials:n,totalScore01:rs.matchedCalibrationScore01};
  }


  observeRecoveryOutcome(input:{bootId:string;contextKey:string;action:ActionKind;reward:number;causalConfidence01?:number;selectedExpected01?:number;alternativeExpected01?:number;counterfactualSource?:'model'|'matched-simulated'|'external';matchedTrials?:number;independent?:boolean;autonomous?:boolean}){
    const bootId=String(input.bootId||'');
    if(!bootId) return {recorded:false,promoted:false,reason:'missing-boot-id'};
    const rs=this.state.recoveryStrategy;
    const existing=rs.lastBootId===bootId?rs.episodes.slice().reverse().find(e=>e.bootId===bootId):undefined;
    if(existing && (existing.contextKey!==input.contextKey || existing.action!==input.action)){
      return {recorded:false,promoted:false,reason:'already-recorded-different-context'};
    }
    const reward=clamp(input.reward); const causal=clamp(input.causalConfidence01??.5);
    const independent=Boolean(input.independent); const autonomous=Boolean(input.autonomous);
    const direction:RecoveryStrategyEpisode['direction']=reward>.58?1:reward<.42?-1:0;
    const selectedExpected01=clamp(input.selectedExpected01??.5);
    const alternativeExpected01=clamp(input.alternativeExpected01??.5);
    const counterfactualMargin01=clampSigned(selectedExpected01-alternativeExpected01);
    const counterfactualSupport01=clamp(.5+counterfactualMargin01*.5);
    const counterfactualSource=input.counterfactualSource??'model';
    const matchedTrials=Math.max(0,Math.floor(Number(input.matchedTrials??0)));
    const episode:RecoveryStrategyEpisode=existing
      ? {...existing,matchedTrials:Math.max(existing.matchedTrials,matchedTrials),causalConfidence01:Math.max(existing.causalConfidence01,causal),counterfactualSupport01:Math.max(existing.counterfactualSupport01,counterfactualSupport01),counterfactualSource:existing.counterfactualSource==='external'||counterfactualSource==='external'?'external':existing.counterfactualSource,independent:existing.independent||independent,autonomous:existing.autonomous||autonomous}
      : {id:`recovery-strategy-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,bootId,at:Date.now(),contextKey:input.contextKey,action:input.action,reward01:reward,causalConfidence01:causal,counterfactualMargin01,counterfactualSupport01,independent,autonomous,direction,counterfactualSource,matchedTrials};
    if(existing){
      rs.episodes=rs.episodes.map(e=>e.id===existing.id?episode:e);
    } else {
      rs.episodes=[...rs.episodes,episode].slice(-48); rs.lastBootId=bootId; rs.totalEpisodes++;
    }
    let promoted=false;
    rs.totalCausalEvaluations++;
    if(counterfactualSource!=='model' && matchedTrials>0) rs.matchedCounterfactuals++;
    const calibrationKey=`${input.contextKey}::${input.action}`;
    const calibration=rs.matchedCalibrationByKey[calibrationKey]??{trials:0,mae01:1,bias01:0,score01:0};
    const matchedGatePass=counterfactualSource!=='model' && matchedTrials>=3 && calibration.trials>=3 && calibration.score01>=.70;
    const causalGatePass=independent && causal>=.65 && counterfactualSupport01>=.60 && matchedGatePass;
    if(direction!==0 && independent && !causalGatePass) rs.causalBlockedEpisodes++;
    if(direction!==0 && causalGatePass){
      const targetParts=this.contextParts(input.contextKey);
      const candidate=rs.episodes.filter(e=>{
        if(!e.independent || e.direction!==direction || e.action!==input.action) return false;
        if(e.counterfactualSource==='model' || e.matchedTrials<3) return false;
        const parts=this.contextParts(e.contextKey);
        if(!targetParts || !parts) return false;
        const distance=parts.reduce((sum,v,i)=>sum+(v===targetParts[i]?0:1),0);
        return distance<=1 && e.causalConfidence01>=.65 && e.counterfactualSupport01>=.60;
      }).slice(-8);
      const distinctBoots=new Set(candidate.map(e=>e.bootId));
      const positives=candidate.filter(e=>e.direction===direction).length;
      const consistency=candidate.length?positives/candidate.length:0;
      if(distinctBoots.size>=3 && candidate.length>=3 && consistency>=.67){
        const meanDelta=candidate.reduce((sum,e)=>sum+(e.reward01-.5),0)/candidate.length;
        const effect=clampSigned(meanDelta*1.35);
        const already=rs.promotions.find(p=>p.contextKey===input.contextKey&&p.action===input.action);
        if(Math.abs(effect)>=.025){
          if(already){
            const previousEffect=already.effect01;
            const nextEffect=clampSigned(previousEffect*.72+effect*.28);
            already.effect01=nextEffect; already.evidence01=clamp(already.evidence01*.72+consistency*.28); already.episodes=candidate.length; already.at=Date.now(); already.sourceEpisodeIds=candidate.map(e=>e.id).slice(-8); already.meanCausalConfidence01=clamp(already.meanCausalConfidence01*.72+candidate.reduce((sum,e)=>sum+e.causalConfidence01,0)/Math.max(1,candidate.length)*.28); already.meanCounterfactualSupport01=clamp(already.meanCounterfactualSupport01*.72+candidate.reduce((sum,e)=>sum+e.counterfactualSupport01,
            0)/Math.max(1,candidate.length)*.28); already.meanMatchedTrials=already.meanMatchedTrials*.72+candidate.reduce((sum,e)=>sum+e.matchedTrials,0)/Math.max(1,candidate.length)*.28; already.matchedCounterfactuals+=candidate.filter(e=>e.counterfactualSource!=='model'&&e.matchedTrials>=3).length;
            if(Math.sign(previousEffect)!==0 && Math.sign(previousEffect)!==Math.sign(nextEffect)){
              already.reversalCount++;
              already.status='reversed';
            } else if(Math.abs(nextEffect)<.0125){
              already.status='uncertain';
            } else if(already.status==='reversed'){
              already.status='reversed';
            } else {
              already.status='active';
            }
            if(Math.sign(previousEffect)!==0 && Math.sign(effect)!==Math.sign(previousEffect)) already.contradictionCount++;
          } else {
            rs.promotions=[...rs.promotions,{id:`rsp-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,at:Date.now(),sourceEpisodeIds:candidate.map(e=>e.id).slice(-8),contextKey:input.contextKey,action:input.action,effect01:effect,evidence01:consistency,episodes:candidate.length,transferCount:0,status:'active' as const,reversalCount:0,contradictionCount:0,meanCausalConfidence01:candidate.reduce((sum,e)=>sum+e.causalConfidence01,0)/candidate.length,meanCounterfactualSupport01:candidate.reduce((sum,e)=>sum+e.counterfactualSupport01,0)/candidate.length,meanMatchedTrials:candidate.reduce((sum,e)=>sum+e.matchedTrials,0)/candidate.length,matchedCounterfactuals:candidate.filter(e=>e.counterfactualSource!=='model'&&e.matchedTrials>=3).length}].slice(-24);
            rs.totalPromotions++;
          }
          promoted=true;
        }
      }
    }
    return {recorded:true,promoted,episode,diagnostics:this.recoveryStrategyDiagnostics(input.contextKey)};
  }

  recoveryStrategyDiagnostics(contextKey:string){
    const target=this.contextParts(contextKey);
    const transfers=this.state.recoveryStrategy.promotions.map(p=>{
      const parts=this.contextParts(p.contextKey); const distance=target&&parts?parts.reduce((sum,v,i)=>sum+(v===target[i]?0:1),0):99;
      return {id:p.id,action:p.action,contextKey:p.contextKey,effect01:p.effect01,evidence01:p.evidence01,episodes:p.episodes,distance,transferCount:p.transferCount,status:p.status,reversalCount:p.reversalCount,contradictionCount:p.contradictionCount,meanCausalConfidence01:p.meanCausalConfidence01,meanCounterfactualSupport01:p.meanCounterfactualSupport01};
    }).filter(x=>x.distance<=2).sort((a,b)=>a.distance-b.distance);
    return structuredClone({version:this.state.recoveryStrategy.version,totalEpisodes:this.state.recoveryStrategy.totalEpisodes,totalPromotions:this.state.recoveryStrategy.totalPromotions,causalBlockedEpisodes:this.state.recoveryStrategy.causalBlockedEpisodes,totalCausalEvaluations:this.state.recoveryStrategy.totalCausalEvaluations,matchedCounterfactuals:this.state.recoveryStrategy.matchedCounterfactuals,matchedCalibrationTrials:this.state.recoveryStrategy.matchedCalibrationTrials,matchedCalibrationMae01:this.state.recoveryStrategy.matchedCalibrationMae01,matchedCalibrationBias01:this.state.recoveryStrategy.matchedCalibrationBias01,matchedCalibrationScore01:this.state.recoveryStrategy.matchedCalibrationScore01,matchedCalibrationByKey:this.state.recoveryStrategy.matchedCalibrationByKey,
    episodes:this.state.recoveryStrategy.episodes.slice(-8),transfers});
  }

  effectiveScore(contextKey:string,action:ActionKind,prior=.5){
    return clampSigned(clamp(prior)+this.bias(contextKey,action,prior)+this.recoveryStrategyBias(contextKey,action,prior));
  }
  topEffectiveActions(contextKey:string,prior=.5):Array<{action:ActionKind;score:number;bias:number}> {
    return actions.map(action=>({action,score:this.effectiveScore(contextKey,action,prior),bias:this.bias(contextKey,action,prior)})).sort((a,b)=>b.score-a.score);
  }
  topActions(contextKey:string):Array<{action:ActionKind;value:number;confidence01:number}> {
    return actions.map(action=>({action,...this.estimate(contextKey,action,.5)})).sort((a,b)=>b.value-a.value).map(x=>({action:x.action,value:x.value,confidence01:x.confidence01}));
  }
}
