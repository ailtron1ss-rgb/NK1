import type { ActionKind } from '../core/types.ts';
import { types } from 'node:util';

const ACTION_SET = new Set<string>(['respond','explore','verify','rest','reflect','wait','defer']);
const DEVELOPMENT_STAGES = new Set<B299State['developmentalStage']>([
  'nascent','learning','calibrating','consolidating','generalizing',
]);

type RestoreRecord = Record<string, unknown>;

function ownDataRecord(value: unknown): RestoreRecord | null {
  if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const record: RestoreRecord = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      if (descriptor.enumerable) record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

function ownDataArray(value: unknown, limit: number): unknown[] {
  if (types.isProxy(value) || !Array.isArray(value)) return [];
  try {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : 0;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return [];
    const rows: unknown[] = [];
    for (let index = Math.max(0, length - limit); index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor && 'value' in descriptor) rows.push(descriptor.value);
    }
    return rows;
  } catch {
    return [];
  }
}

function restoredUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback;
}

function restoredSigned(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp11(value) : fallback;
}

function restoredCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function restoredTime(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function restoredAction(value: unknown): ActionKind | null {
  return typeof value === 'string' && ACTION_SET.has(value) ? value as ActionKind : null;
}

function restoredHistory(value: unknown): B299State['history'] {
  const result: B299State['history'] = [];
  for (const item of ownDataArray(value, 192)) {
    const row = ownDataRecord(item);
    if (!row) continue;
    const tick = restoredCount(row.tick, -1);
    const action = restoredAction(row.action);
    if (tick < 0 || !action ||
        typeof row.verified !== 'boolean' ||
        typeof row.independent !== 'boolean' ||
        typeof row.autonomous !== 'boolean' ||
        typeof row.reward01 !== 'number' || !Number.isFinite(row.reward01) ||
        typeof row.predictionError01 !== 'number' || !Number.isFinite(row.predictionError01) ||
        typeof row.bias11 !== 'number' || !Number.isFinite(row.bias11) ||
        typeof row.learningRate01 !== 'number' || !Number.isFinite(row.learningRate01)) continue;
    result.push({
      tick,
      action,
      reward01: clamp01(row.reward01),
      predictionError01: clamp01(row.predictionError01),
      verified: row.verified,
      independent: row.independent,
      autonomous: row.autonomous,
      bias11: clamp11(row.bias11),
      learningRate01: clamp01(row.learningRate01),
    });
  }
  return result;
}

function restoredTraitVector(
  value: unknown,
  fallback: Record<B299TraitName, number>,
  min: number,
  max: number,
): Record<B299TraitName, number> {
  const source = ownDataRecord(value);
  return Object.fromEntries(TRAITS.map((trait) => {
    const raw = source?.[trait];
    const valid = typeof raw === 'number' && Number.isFinite(raw);
    const normalized = valid ? Math.max(min, Math.min(max, raw)) : fallback[trait];
    return [trait, normalized];
  })) as Record<B299TraitName, number>;
}


const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();
const CONTEXTS=['social','epistemic','autonomy','maintenance'] as const;
const TRAITS=['curiosity','truth-seeking','self-reflection','care','self-preservation','persistence','caution','autonomy'] as const;
type B299TraitName=typeof TRAITS[number];
const traitByAction:Record<ActionKind,B299TraitName>={respond:'care',explore:'curiosity',verify:'truth-seeking',rest:'self-preservation',reflect:'self-reflection',wait:'persistence',defer:'caution'};
const traitAffinity:Record<ActionKind,Partial<Record<B299TraitName,number>>>= {
  respond:{care:.86,caution:.18,persistence:.12,autonomy:.05},
  explore:{curiosity:.82,autonomy:.64,persistence:.18,'self-reflection':.15},
  verify:{'truth-seeking':.88,curiosity:.28,caution:.42,'self-reflection':.16},
  rest:{'self-preservation':.84,caution:.24,'self-reflection':.12,persistence:.18},
  reflect:{'self-reflection':.86,autonomy:.44,caution:.28,curiosity:.22},
  wait:{persistence:.82,caution:.40,'self-preservation':.20,autonomy:.24},
  defer:{caution:.84,'truth-seeking':.28,persistence:.30,'self-reflection':.18},
};
type B299ContextName=typeof CONTEXTS[number];
type B299ContextVector=Record<B299ContextName,number>;
const defaultContextVector=():B299ContextVector=>({social:0,epistemic:0,autonomy:0,maintenance:0});
const actionContextAffinity:Record<ActionKind,B299ContextVector>={
  respond:{social:.78,epistemic:.10,autonomy:.04,maintenance:.08},
  explore:{social:.08,epistemic:.42,autonomy:.44,maintenance:.06},
  verify:{social:.08,epistemic:.78,autonomy:.10,maintenance:.04},
  rest:{social:.03,epistemic:.05,autonomy:.22,maintenance:.70},
  reflect:{social:.12,epistemic:.24,autonomy:.46,maintenance:.18},
  wait:{social:.10,epistemic:.10,autonomy:.48,maintenance:.32},
  defer:{social:.10,epistemic:.36,autonomy:.34,maintenance:.20},
};
const normalizeContext=(raw?:Partial<B299ContextVector>|null):B299ContextVector=>({
  social:clamp01(raw?.social??0), epistemic:clamp01(raw?.epistemic??0),
  autonomy:clamp01(raw?.autonomy??0), maintenance:clamp01(raw?.maintenance??0),
});
const normalizeContext11=(raw?:Partial<B299ContextVector>|null):B299ContextVector=>({
  social:clamp11(raw?.social??0), epistemic:clamp11(raw?.epistemic??0),
  autonomy:clamp11(raw?.autonomy??0), maintenance:clamp11(raw?.maintenance??0),
});

export interface B299ActionPhenotype {
  action:ActionKind;
  value01:number;
  preference11:number;
  consolidatedPreference11:number;
  consolidationEvidence01:number;
  evidence01:number;
  causalConfidence01:number;
  stability01:number;
  samples:number;
  verifiedSamples:number;
  predictionErrorEMA01:number;
  lastPredictedReward01:number;
  calibrationErrorEMA01:number;
  calibrationBias11:number;
  calibrationCount:number;
  lastReward01:number;
  lastAt:number;
  contextPreference11:B299ContextVector;
  contextEvidence01:B299ContextVector;
}

export interface B299State {
  version:1;
  cycles:number;
  learningUpdates:number;
  verifiedUpdates:number;
  independentUpdates:number;
  autonomousUpdates:number;
  lastAction:ActionKind|null;
  lastPredictionError01:number;
  lastLearningRate01:number;
  personalityInfluence01:number;
  personalityStability01:number;
  selfAuthoredDevelopment01:number;
  causalIntegrity01:number;
  actionPhenotypes:B299ActionPhenotype[];
  history:Array<{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified:boolean;independent:boolean;autonomous:boolean;bias11:number;learningRate01:number}>;
  lesion01:number;
  currentContext:B299ContextVector;
  currentContextLabel:B299ContextName|'mixed';
  contextCreditAssignments:number;
  traitFast11:Record<B299TraitName,number>;
  traitSlow11:Record<B299TraitName,number>;
  traitEvidence01:Record<B299TraitName,number>;
  maturity01:number;
  developmentalStage:'nascent'|'learning'|'calibrating'|'consolidating'|'generalizing';
  developmentalEvidence01:number;
  developmentalDiversity01:number;
}

export interface B299OutcomeInput {
  tick:number;
  action:ActionKind;
  reward01:number;
  predictionError01:number;
  causalConfidence01:number;
  identityContinuity01:number;
  externalEvidence01:number;
  worldTransition:boolean;
  independent:boolean;
  autonomous:boolean;
  predictedUtility01:number;
  neuralPlasticity01?:number;
  selfModelAlignment01?:number;
  goalLearningQuality01?:number;
  context?:Partial<B299ContextVector>;
}

export const defaultB299State=():B299State=>({
  version:1,cycles:0,learningUpdates:0,verifiedUpdates:0,independentUpdates:0,autonomousUpdates:0,
  lastAction:null,lastPredictionError01:.3,lastLearningRate01:0,personalityInfluence01:0,personalityStability01:.45,
  selfAuthoredDevelopment01:0,causalIntegrity01:.45,
  actionPhenotypes:ACTIONS.map(action=>({action,value01:.5,preference11:0,consolidatedPreference11:0,consolidationEvidence01:0,evidence01:0,causalConfidence01:.45,stability01:.45,samples:0,verifiedSamples:0,predictionErrorEMA01:.3,lastPredictedReward01:.5,calibrationErrorEMA01:.25,calibrationBias11:0,calibrationCount:0,lastReward01:.5,lastAt:0,contextPreference11:{social:0,epistemic:0,autonomy:0,maintenance:0},contextEvidence01:{social:0,epistemic:0,autonomy:0,maintenance:0}})),
  history:[],lesion01:0,currentContext:defaultContextVector(),currentContextLabel:'mixed',contextCreditAssignments:0,
  traitFast11:Object.fromEntries(TRAITS.map(t=>[t,0])) as Record<B299TraitName,number>,
  traitSlow11:Object.fromEntries(TRAITS.map(t=>[t,0])) as Record<B299TraitName,number>,
  traitEvidence01:Object.fromEntries(TRAITS.map(t=>[t,0])) as Record<B299TraitName,number>,
  maturity01:0, developmentalStage:'nascent', developmentalEvidence01:0, developmentalDiversity01:0,
});

export class B299CausalPersonalityDevelopmentLoop {
  private state=B299CausalPersonalityDevelopmentLoop.normalize(defaultB299State());

  private static normalize(raw?:unknown):B299State{
    const defaults=defaultB299State();
    const source=ownDataRecord(raw);
    if(!source) return defaults;

    const phenotypeRows=ownDataArray(source.actionPhenotypes,ACTIONS.length*4)
      .map(ownDataRecord)
      .filter((row):row is RestoreRecord=>row!==null);
    const phenotypeByAction=new Map<ActionKind,RestoreRecord>();
    for(const row of phenotypeRows){
      const action=restoredAction(row.action);
      if(action && !phenotypeByAction.has(action)) phenotypeByAction.set(action,row);
    }
    const actionPhenotypes=defaults.actionPhenotypes.map((base)=>{
      const row=phenotypeByAction.get(base.action);
      if(!row) return base;
      return {
        action:base.action,
        value01:restoredUnit(row.value01,base.value01),
        preference11:restoredSigned(row.preference11,base.preference11),
        consolidatedPreference11:restoredSigned(row.consolidatedPreference11,base.consolidatedPreference11),
        consolidationEvidence01:restoredUnit(row.consolidationEvidence01,base.consolidationEvidence01),
        evidence01:restoredUnit(row.evidence01,base.evidence01),
        causalConfidence01:restoredUnit(row.causalConfidence01,base.causalConfidence01),
        stability01:restoredUnit(row.stability01,base.stability01),
        samples:restoredCount(row.samples,base.samples),
        verifiedSamples:restoredCount(row.verifiedSamples,base.verifiedSamples),
        predictionErrorEMA01:restoredUnit(row.predictionErrorEMA01,base.predictionErrorEMA01),
        lastPredictedReward01:restoredUnit(row.lastPredictedReward01,base.lastPredictedReward01),
        calibrationErrorEMA01:restoredUnit(row.calibrationErrorEMA01,base.calibrationErrorEMA01),
        calibrationBias11:restoredSigned(row.calibrationBias11,base.calibrationBias11),
        calibrationCount:restoredCount(row.calibrationCount,base.calibrationCount),
        lastReward01:restoredUnit(row.lastReward01,base.lastReward01),
        lastAt:restoredTime(row.lastAt,base.lastAt),
        contextPreference11:normalizeContext11(
          ownDataRecord(row.contextPreference11) as Partial<B299ContextVector>|null,
        ) as B299ContextVector,
        contextEvidence01:normalizeContext(
          ownDataRecord(row.contextEvidence01) as Partial<B299ContextVector>|null,
        ) as B299ContextVector,
      };
    });

    const context=ownDataRecord(source.currentContext) as Partial<B299ContextVector>|null;
    const contextLabel=typeof source.currentContextLabel==='string' &&
      (CONTEXTS as readonly string[]).includes(source.currentContextLabel)
      ? source.currentContextLabel as B299ContextName|'mixed'
      : 'mixed';
    const stage=typeof source.developmentalStage==='string' &&
      DEVELOPMENT_STAGES.has(source.developmentalStage as B299State['developmentalStage'])
      ? source.developmentalStage as B299State['developmentalStage']
      : defaults.developmentalStage;

    return {
      version:1,
      cycles:restoredCount(source.cycles,defaults.cycles),
      learningUpdates:restoredCount(source.learningUpdates,defaults.learningUpdates),
      verifiedUpdates:restoredCount(source.verifiedUpdates,defaults.verifiedUpdates),
      independentUpdates:restoredCount(source.independentUpdates,defaults.independentUpdates),
      autonomousUpdates:restoredCount(source.autonomousUpdates,defaults.autonomousUpdates),
      lastAction:restoredAction(source.lastAction),
      lastPredictionError01:restoredUnit(source.lastPredictionError01,defaults.lastPredictionError01),
      lastLearningRate01:restoredUnit(source.lastLearningRate01,defaults.lastLearningRate01),
      personalityInfluence01:restoredUnit(source.personalityInfluence01,defaults.personalityInfluence01),
      personalityStability01:restoredUnit(source.personalityStability01,defaults.personalityStability01),
      selfAuthoredDevelopment01:restoredUnit(source.selfAuthoredDevelopment01,defaults.selfAuthoredDevelopment01),
      causalIntegrity01:restoredUnit(source.causalIntegrity01,defaults.causalIntegrity01),
      actionPhenotypes,
      history:restoredHistory(source.history),
      lesion01:restoredUnit(source.lesion01,defaults.lesion01),
      currentContext:normalizeContext(context),
      currentContextLabel:contextLabel,
      contextCreditAssignments:restoredCount(source.contextCreditAssignments,defaults.contextCreditAssignments),
      traitFast11:restoredTraitVector(source.traitFast11,defaults.traitFast11,-1,1),
      traitSlow11:restoredTraitVector(source.traitSlow11,defaults.traitSlow11,-1,1),
      traitEvidence01:restoredTraitVector(source.traitEvidence01,defaults.traitEvidence01,0,1),
      maturity01:restoredUnit(source.maturity01,defaults.maturity01),
      developmentalStage:stage,
      developmentalEvidence01:restoredUnit(source.developmentalEvidence01,defaults.developmentalEvidence01),
      developmentalDiversity01:restoredUnit(source.developmentalDiversity01,defaults.developmentalDiversity01),
    };
  }

  restore(raw?:Partial<B299State>|null){this.state=B299CausalPersonalityDevelopmentLoop.normalize(raw);}
  snapshot(){return structuredClone(this.state);}

  setContext(context?:Partial<B299ContextVector>|null){
    const normalized=normalizeContext(context);
    const strongest=CONTEXTS.slice().sort((a,b)=>normalized[b]-normalized[a])[0];
    const strength=normalized[strongest] ?? 0;
    this.state.currentContext=normalized;
    this.state.currentContextLabel=strength>=.58?strongest:'mixed';
    return {context:{...normalized},label:this.state.currentContextLabel};
  }

  private phenotype(action:ActionKind){return this.state.actionPhenotypes.find(x=>x.action===action) ?? this.state.actionPhenotypes[0];}

  private traitFor(action:ActionKind){
    const map:Record<ActionKind,string>={explore:'curiosity',verify:'truth-seeking',reflect:'self-reflection',respond:'care',rest:'self-preservation',wait:'persistence',defer:'caution'};
    return map[action];
  }

  actionBias(action:ActionKind){
    const p=this.phenotype(action);
    const evidenceGate=clamp01(.35+.65*p.evidence01);
    const confidenceGate=clamp01(.35+.65*p.causalConfidence01);
    const stabilityGate=clamp01(.30+.70*p.stability01);
    const fastSignal=clamp11(p.preference11);
    const slowSignal=clamp11(p.consolidatedPreference11);
    const plasticSignal=clamp11(fastSignal*.52+slowSignal*.48);
    const affinity=actionContextAffinity[action];
    let contextMass=0; let contextSignal=0;
    for(const context of CONTEXTS){
      const weight=(this.state.currentContext[context]??0)*(affinity[context]??0);
      contextMass+=weight; contextSignal+=weight*clamp11(p.contextPreference11[context]??0);
    }
    const normalizedContext=contextMass>1e-6?contextSignal/contextMass:0;
    const blended=clamp11(plasticSignal*.30+normalizedContext*.70);
    let traitSignal=0; let traitMass=0;
    const affinities=traitAffinity[action]??{};
    for(const trait of TRAITS){
      const weight=Number(affinities[trait]??0);
      if(weight<=0) continue;
      const fast=clamp11(this.state.traitFast11[trait]??0);
      const slow=clamp11(this.state.traitSlow11[trait]??0);
      traitSignal += weight*clamp11(fast*.35+slow*.65);
      traitMass += weight;
    }
    const normalizedTrait=traitMass>1e-6?traitSignal/traitMass:0;
    const generalized=clamp11(blended*.76+normalizedTrait*.24);
    return clamp11(generalized*.22*evidenceGate*confidenceGate*stabilityGate*(1-this.state.lesion01));
  }

  predictOutcome(action:ActionKind, context?:Partial<B299ContextVector>|null){
    const p=this.phenotype(action);
    const ctx=normalizeContext(context ?? this.state.currentContext);
    let mass=0, signal=0;
    const affinity=actionContextAffinity[action];
    for(const name of CONTEXTS){
      const w=(ctx[name]??0)*(affinity[name]??0);
      mass+=w; signal+=w*clamp11(p.contextPreference11[name]??0);
    }
    const contextSignal=mass>1e-6?signal/mass:0;
    const lesionScale=clamp01(1-this.state.lesion01);
    const historySignalRaw=clamp11(p.value01*2-1)*.55 + clamp11(p.consolidatedPreference11)*.25 + contextSignal*.20;
    const historySignal=historySignalRaw*lesionScale;
    const evidence=clamp01(.15 + .55*p.evidence01 + .30*p.causalConfidence01);
    const calibrationQuality=p.calibrationCount>=3 ? clamp01(1-p.calibrationErrorEMA01) : .5;
    const calibratedConfidenceRaw=clamp01(evidence*(.50+.50*calibrationQuality));
    const calibratedConfidence=clamp01(.45 + (calibratedConfidenceRaw-.45)*lesionScale);
    const expectedReward=clamp01(.5 + historySignal*.5 + p.calibrationBias11*.10*lesionScale);
    p.lastPredictedReward01=expectedReward;
    return { expectedReward01:expectedReward, confidence01:calibratedConfidence, samples:p.samples, verifiedSamples:p.verifiedSamples, calibrationErrorEMA01:clamp01(p.calibrationErrorEMA01), calibrationBias11:clamp11(p.calibrationBias11), calibrationCount:Math.max(0,p.calibrationCount) };
  }

  traitSignals(){
    const out:Record<string,number>={};
    for(const p of this.state.actionPhenotypes) out[this.traitFor(p.action)]=this.actionBias(p.action);
    return out;
  }

  private updateDevelopmentalMaturity(verified:boolean, independent:boolean, autonomous:boolean, calibrationQuality:number, novelty:number){
    const actionCoverage=this.state.actionPhenotypes.filter(p=>p.samples>0).length/Math.max(1,ACTIONS.length);
    const evidence=this.state.actionPhenotypes.reduce((sum,p)=>sum+clamp01(p.evidence01),0)/ACTIONS.length;
    const calibration=this.state.actionPhenotypes.reduce((sum,p)=>sum+(p.calibrationCount>0?1-p.calibrationErrorEMA01:.5),0)/ACTIONS.length;
    const autonomy=this.state.cycles>0?this.state.autonomousUpdates/this.state.cycles:0;
    const verifiedRate=this.state.cycles>0?this.state.verifiedUpdates/this.state.cycles:0;
    const diversity=clamp01(actionCoverage*.55+this.state.developmentalDiversity01*.45);
    this.state.developmentalDiversity01=clamp01(this.state.developmentalDiversity01*.94+diversity*.06);
    const target=clamp01(evidence*.30+calibration*.22+verifiedRate*.16+autonomy*.12+diversity*.12+(independent?.05:0)+(verified?.03:0));
    const rate=clamp01(.012 + novelty*.008 + (verified?.008:0));
    this.state.developmentalEvidence01=clamp01(this.state.developmentalEvidence01*.94+target*.06);
    this.state.maturity01=clamp01(this.state.maturity01*(1-rate)+target*rate);
    const m=this.state.maturity01;
    this.state.developmentalStage=m<.18?'nascent':m<.38?'learning':m<.58?'calibrating':m<.78?'consolidating':'generalizing';
    return {maturity01:this.state.maturity01,stage:this.state.developmentalStage,evidence01:this.state.developmentalEvidence01,diversity01:this.state.developmentalDiversity01};
  }

  observeOutcome(input:B299OutcomeInput){
    const p=this.phenotype(input.action);
    const reward=clamp01(input.reward01);
    const error=clamp01(input.predictionError01);
    const causal=clamp01(input.causalConfidence01);
    const preActionPrediction=clamp01(p.lastPredictedReward01??.5);
    const calibrationError=clamp01(Math.abs(reward-preActionPrediction));
    const calibrationBias=clamp11(reward-preActionPrediction);
    p.calibrationErrorEMA01=clamp01((p.calibrationErrorEMA01??.25)*.86 + calibrationError*.14);
    p.calibrationBias11=clamp11((p.calibrationBias11??0)*.86 + calibrationBias*.14);
    p.calibrationCount=Math.max(0,Math.floor(Number(p.calibrationCount??0)))+1;
    const identity=clamp01(input.identityContinuity01);
    const external=clamp01(input.externalEvidence01);
    const neuralPlasticity=clamp01(input.neuralPlasticity01??.5);
    const selfModelAlignment=clamp01(input.selfModelAlignment01??.5);
    const goalLearningQuality=clamp01(input.goalLearningQuality01??.5);
    const context=normalizeContext(input.context ?? this.state.currentContext);
    this.setContext(context);
    const verified=Boolean(input.worldTransition||external>0);
    const independent=Boolean(input.independent);
    const novelty=Math.abs(reward-.5)*2;
    const maturityLearningFactor=this.state.maturity01<.38?1.12:this.state.maturity01<.78?1.0:.88;
    const lr=clamp01((.012 + .024*error + .020*novelty + .020*causal + .012*external + .012*neuralPlasticity + .010*Math.abs(selfModelAlignment-.5) + .008*Math.abs(goalLearningQuality-.5))*maturityLearningFactor);
    const selfConsistencyEvidence=.08*selfModelAlignment + .08*(1-selfModelAlignment);
    const calibrationQuality=clamp01(1-calibrationError);
    const effectiveEvidence=clamp01((verified?.58:.30) + causal*.20 + identity*.12 + (independent?.10:0) + neuralPlasticity*.08 + selfConsistencyEvidence + goalLearningQuality*.06 + calibrationQuality*.08);
    const direction=reward-.5;
    const predictionAlignment=1-error;

    p.value01=clamp01(p.value01*(1-lr*.65) + reward*(lr*.65));
    const target=clamp11((p.value01-.5)*2);
    const directTarget=clamp11(direction*2);
    const creditQuality=clamp01(.30 + causal*.30 + identity*.12 + (independent?.10:0) + neuralPlasticity*.08 + Math.abs(predictionAlignment-.5)*.20 + selfModelAlignment*.10 + goalLearningQuality*.08);
    p.preference11=clamp11(p.preference11*(1-lr*.26) + target*(lr*.12) + directTarget*lr*(.28+.22*effectiveEvidence));
    const consolidationGate=clamp01(.10 + p.evidence01*.35 + p.causalConfidence01*.20 + p.stability01*.20 + selfModelAlignment*.075 + goalLearningQuality*.075);
    const consolidationRate=clamp01(.004 + .012*consolidationGate + .006*novelty*consolidationGate);
    p.consolidatedPreference11=clamp11(p.consolidatedPreference11*(1-consolidationRate) + p.preference11*consolidationRate);
    p.consolidationEvidence01=clamp01(p.consolidationEvidence01*.985 + consolidationGate*.015);

    // B342: extract a context-independent trait trace from action outcomes.
    // This is deliberately slower than the fast action/context weights so repeated
    // evidence can generalize to an unseen context without letting one event rewrite identity.
    const observedTrait=traitByAction[input.action];
    const traitTarget=clamp11(directTarget*(.55+.45*creditQuality));
    const traitFastOld=clamp11(this.state.traitFast11[observedTrait]??0);
    const traitSlowOld=clamp11(this.state.traitSlow11[observedTrait]??0);
    const traitRate=clamp01(.010+.018*effectiveEvidence+.010*novelty);
    this.state.traitFast11[observedTrait]=clamp11(traitFastOld*(1-traitRate*.70)+traitTarget*(traitRate*.70));
    this.state.traitSlow11[observedTrait]=clamp11(traitSlowOld*(1-traitRate*.18)+this.state.traitFast11[observedTrait]*(traitRate*.18));
    this.state.traitEvidence01[observedTrait]=clamp01((this.state.traitEvidence01[observedTrait]??0)*.985+effectiveEvidence*.015);
    for(const contextName of CONTEXTS){
      const mass=clamp01(context[contextName]);
      const contextTarget=clamp11(directTarget*(.55+.45*creditQuality));
      const contextEvidence=clamp01(effectiveEvidence*mass*creditQuality);
      const oldPref=clamp11(p.contextPreference11[contextName]??0);
      p.contextPreference11[contextName]=clamp11(oldPref*(1-lr*.30*mass)+contextTarget*(lr*.54*mass));
      p.contextEvidence01[contextName]=clamp01((p.contextEvidence01[contextName]??0)*.92+contextEvidence*.08);
    }
    this.state.contextCreditAssignments+=1;
    p.predictionErrorEMA01=clamp01(p.predictionErrorEMA01*.88+error*.12);
    p.evidence01=clamp01(p.evidence01*.92+effectiveEvidence*.08);
    p.causalConfidence01=clamp01(p.causalConfidence01*.90+causal*.07+calibrationQuality*.03);
    p.stability01=clamp01(p.stability01*.95 + (1-error)*.02 + calibrationQuality*.03 + effectiveEvidence*.02);
    p.samples++; if(verified)p.verifiedSamples++; p.lastReward01=reward; p.lastAt=now();

    this.state.cycles++;
    this.state.learningUpdates++;
    if(verified)this.state.verifiedUpdates++;
    if(independent)this.state.independentUpdates++;
    if(input.autonomous)this.state.autonomousUpdates++;
    this.state.lastAction=input.action;
    this.state.lastPredictionError01=error;
    this.state.lastLearningRate01=lr;
    this.state.personalityInfluence01=clamp01(this.state.personalityInfluence01*.94+Math.min(1,Math.abs(this.actionBias(input.action))*10)*.06);
    const developmental=this.updateDevelopmentalMaturity(verified,independent,Boolean(input.autonomous),calibrationQuality,novelty);
    this.state.personalityStability01=clamp01(this.state.personalityStability01*.96 + (verified?.025:.008) + (1-error)*.015);
    this.state.selfAuthoredDevelopment01=clamp01(this.state.selfAuthoredDevelopment01*.97 + (input.autonomous?(.015+novelty*.018):0));
    this.state.causalIntegrity01=clamp01(this.state.causalIntegrity01*.93 + causal*.04 + predictionAlignment*.02 - error*.025 + selfModelAlignment*.008 + goalLearningQuality*.006);
    this.state.history=[...this.state.history,{tick:Math.max(0,Math.floor(input.tick)),action:input.action,reward01:reward,predictionError01:error,verified,independent,autonomous:Boolean(input.autonomous),bias11:this.actionBias(input.action),learningRate01:lr}].slice(-192);
    return {
      updated:true,action:input.action,trait:this.traitFor(input.action),
      learningRate01:lr,preference11:p.preference11,evidence01:p.evidence01,causalConfidence01:p.causalConfidence01,
      personalityInfluence01:this.state.personalityInfluence01,personalityStability01:this.state.personalityStability01,
      selfAuthoredDevelopment01:this.state.selfAuthoredDevelopment01,causalIntegrity01:this.state.causalIntegrity01,selfModelAlignment01:selfModelAlignment,goalLearningQuality01:goalLearningQuality,preActionPrediction01:preActionPrediction,calibrationError01:calibrationError,calibrationBias11:p.calibrationBias11,calibrationCount:p.calibrationCount,developmentalMaturity01:developmental.maturity01,developmentalStage:developmental.stage,developmentalEvidence01:developmental.evidence01,developmentalDiversity01:developmental.diversity01,
    };
  }

  lesion(fraction01=.5){this.state.lesion01=clamp01(fraction01);return {lesion01:this.state.lesion01};}
  clearLesion(){this.state.lesion01=0;}

  diagnostics(){
    const totalSamples=this.state.actionPhenotypes.reduce((s,p)=>s+p.samples,0);
    const maxBias=this.state.actionPhenotypes.reduce((m,p)=>Math.max(m,Math.abs(this.actionBias(p.action))),0);
    const dominant=this.state.actionPhenotypes
      .slice()
      .sort((a,b)=>Math.abs(b.preference11)-Math.abs(a.preference11))[0]??null;
    const dominantPhenotype=dominant?{
      action:dominant.action,
      value01:dominant.value01,
      preference11:dominant.preference11,
      consolidatedPreference11:dominant.consolidatedPreference11,
      consolidationEvidence01:dominant.consolidationEvidence01,
      evidence01:dominant.evidence01,
      stability01:dominant.stability01,
      samples:dominant.samples,
      calibrationErrorEMA01:clamp01(dominant.calibrationErrorEMA01??.25),
      calibrationBias11:clamp11(dominant.calibrationBias11??0),
      calibrationCount:Math.max(0,Math.floor(Number(dominant.calibrationCount??0))),
      lastPredictedReward01:clamp01(dominant.lastPredictedReward01??.5),
    }:null;
    return {
      version:1,
      cycles:this.state.cycles,
      learningUpdates:this.state.learningUpdates,
      verifiedUpdates:this.state.verifiedUpdates,
      independentUpdates:this.state.independentUpdates,
      autonomousUpdates:this.state.autonomousUpdates,
      totalSamples,
      personalityInfluence01:this.state.personalityInfluence01,
      personalityStability01:this.state.personalityStability01,
      selfAuthoredDevelopment01:this.state.selfAuthoredDevelopment01,
      causalIntegrity01:this.state.causalIntegrity01,
      lastAction:this.state.lastAction,
      lastLearningRate01:this.state.lastLearningRate01,
      lastPredictionError01:this.state.lastPredictionError01,
      maxActionBias01:maxBias,
      currentContext:{...this.state.currentContext},
      currentContextLabel:this.state.currentContextLabel,
      contextCreditAssignments:this.state.contextCreditAssignments,
      contextDiagnostics:this.state.actionPhenotypes.map(p=>({action:p.action,contextPreference11:{...p.contextPreference11},contextEvidence01:{...p.contextEvidence01}})),
      dominantPhenotype,
      lesion01:this.state.lesion01,
      historyDepth:this.state.history.length,
      generalizedTraitEvidence01:Object.values(this.state.traitEvidence01).reduce((sum,v)=>sum+v,0)/TRAITS.length,
      generalizedTraitActivity01:Object.values(this.state.traitFast11).reduce((sum,v)=>sum+Math.abs(v),0)/TRAITS.length,
      generalizedTraitConsolidation01:Object.values(this.state.traitSlow11).reduce((sum,v)=>sum+Math.abs(v),0)/TRAITS.length,
      developmentalMaturity01:this.state.maturity01, developmentalStage:this.state.developmentalStage, developmentalEvidence01:this.state.developmentalEvidence01, developmentalDiversity01:this.state.developmentalDiversity01,
    };
  }
}
