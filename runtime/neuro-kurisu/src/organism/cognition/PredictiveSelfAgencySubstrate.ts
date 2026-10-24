import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import type { ActionKind, OrganismState } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
function hash(s:string){let h=2166136261>>>0;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function initWeight(i:number,j:number,scale=.03){const x=(hash(`${i}:${j}`)%1000000)/999999;return (x*2-1)*scale;}

export interface SelfAgencyInput {
  self:number[];
  body:number[];
  world:number[];
  memory:number[];
  motivation:number[];
  state:OrganismState;
  externalRequested:boolean;
}

export interface AgencyPrediction {
  action:ActionKind;
  intention01:number;
  predictedOutcome01:number;
  ownershipPrior01:number;
  confidence01:number;
  selfContinuity01:number;
}

export interface PredictiveSelfAgencyState {
  version:1;
  selfLatent:number[];
  previousSelfLatent:number[];
  intention:number[];
  predictions:number[];
  actionRows:number[][];
  actionBias:number[];
  selfWeights:number[][];
  stateWeights:number[][];
  learningSteps:number;
  predictionSamples:number;
  predictionError01:number;
  agencyError01:number;
  ownership01:number;
  authorship01:number;
  selfContinuity01:number;
  lastAction:ActionKind;
  lastPredictedOutcome01:number;
  lastPredictedSelfState:number[];
  lastObservedSelfState:number[];
  lastTick:number;
  lastAt:number;
}

const defaults=():PredictiveSelfAgencyState=>({
  version:1,selfLatent:new Array(24).fill(0),previousSelfLatent:new Array(24).fill(0),intention:new Array(24).fill(0),predictions:new Array(4).fill(0),
  actionRows:ACTIONS.map((_,i)=>new Array(24).fill(0).map((__,j)=>initWeight(i,j,.028))),actionBias:new Array(ACTIONS.length).fill(0),
  selfWeights:Array.from({length:24},(_,i)=>new Array(24).fill(0).map((__,j)=>initWeight(i+31,j,.022))),
  stateWeights:Array.from({length:24},(_,i)=>new Array(24).fill(0).map((__,j)=>initWeight(i+61,j,.024))),
  learningSteps:0,predictionSamples:0,predictionError01:.5,agencyError01:.5,ownership01:.5,authorship01:.5,selfContinuity01:.5,lastAction:'wait',lastPredictedOutcome01:.5,
  lastPredictedSelfState:new Array(24).fill(0),lastObservedSelfState:new Array(24).fill(0),lastTick:0,lastAt:0
});

/** Learned self-prediction and agency attribution substrate. This is a functional model component,
 * not a claim of phenomenal consciousness. It predicts action consequences and the organism's own
 * next latent state, then learns from observed outcomes. */
export class PredictiveSelfAgencySubstrate {
  private state=defaults();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<PredictiveSelfAgencyState>|null){
    const d=defaults();
    let detached: unknown;
    try {
      detached = snapshotPlainData(raw ?? {}, { allowNonFiniteNumbers: true, maxDepth: 12, maxNodes: 4096, maxStringUnits: 64 * 1024 });
    } catch {
      this.state = d;
      return;
    }
    const r=detached&&typeof detached==='object'&&!Array.isArray(detached)?detached as Partial<PredictiveSelfAgencyState>:{};
    if(r.version!==undefined&&r.version!==1)throw new RangeError('unsupported predictive self-agency state version');
    const vector=(value:unknown,fallback:number[],mode:'signed'|'unit'='signed')=>Array.from({length:fallback.length},(_,i)=>{
      const candidate=Array.isArray(value)?value[i]:undefined;
      if(typeof candidate!=='number'||!Number.isFinite(candidate))return fallback[i]??0;
      return mode==='unit'?clamp01(candidate):clamp11(candidate);
    });
    const matrix=(value:unknown,fallback:number[][])=>fallback.map((row,i)=>vector(Array.isArray(value)?value[i]:undefined,row));
    const counter=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
    const unit=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):fallback;
    const timestamp=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
    this.state={
      version:1,
      selfLatent:vector(r.selfLatent,d.selfLatent),
      previousSelfLatent:vector(r.previousSelfLatent,d.previousSelfLatent),
      intention:vector(r.intention,d.intention),
      predictions:vector(r.predictions,d.predictions,'unit'),
      actionRows:matrix(r.actionRows,d.actionRows),
      actionBias:vector(r.actionBias,d.actionBias),
      selfWeights:matrix(r.selfWeights,d.selfWeights),
      stateWeights:matrix(r.stateWeights,d.stateWeights),
      learningSteps:counter(r.learningSteps),
      predictionSamples:counter(r.predictionSamples),
      predictionError01:unit(r.predictionError01,d.predictionError01),
      agencyError01:unit(r.agencyError01,d.agencyError01),
      ownership01:unit(r.ownership01,d.ownership01),
      authorship01:unit(r.authorship01,d.authorship01),
      selfContinuity01:unit(r.selfContinuity01,d.selfContinuity01),
      lastAction:ACTIONS.includes(r.lastAction as ActionKind)?r.lastAction as ActionKind:d.lastAction,
      lastPredictedOutcome01:unit(r.lastPredictedOutcome01,d.lastPredictedOutcome01),
      lastPredictedSelfState:vector(r.lastPredictedSelfState,d.lastPredictedSelfState),
      lastObservedSelfState:vector(r.lastObservedSelfState,d.lastObservedSelfState),
      lastTick:timestamp(r.lastTick,d.lastTick),
      lastAt:timestamp(r.lastAt,d.lastAt),
    };
  }
  private features(i:SelfAgencyInput){
    const base=[...i.self,...i.body,...i.world,...i.memory,...i.motivation];
    base.push(i.state.needs.energy,i.state.needs.cognitiveLoad,i.state.needs.uncertainty,i.state.needs.novelty,i.state.needs.goalPressure,i.state.needs.socialNeed,i.state.needs.identityCoherence,i.externalRequested?1:0);
    const out=new Array(24).fill(0);
    for(let k=0;k<out.length;k++){const x=Number(base[k%Math.max(1,base.length)]??0);const y=Number(base[(k*7+3)%Math.max(1,base.length)]??0);out[k]=clamp11(x*.7+y*.3);} return out;
  }
  private stepSelf(x:number[]){const prev=this.state.selfLatent,next=new Array(24).fill(0);for(let i=0;i<24;i++){let z=0;for(let j=0;j<24;j++)z+=(this.state.selfWeights[i][j]??0)*(prev[j]??0)+(this.state.stateWeights[i][j]??0)*(x[j]??0);next[i]=tanh(z);}return next;}
  observe(rawInput:SelfAgencyInput){
    // Runtime callers may be JavaScript adapters, restored state or plugins;
    // detach descriptors before spreading arrays or reading nested state.
    let detached: unknown;
    try {
      detached=snapshotPlainData<SelfAgencyInput>(rawInput,{
        maxDepth:16,maxNodes:2048,maxStringUnits:32*1024,
      });
    } catch {
      throw new TypeError('predictive-self-agency-input-invalid');
    }
    if(!detached||typeof detached!=='object'||Array.isArray(detached)) {
      throw new TypeError('predictive-self-agency-input-invalid');
    }
    const input=detached as SelfAgencyInput;
    const vectors=[input.self,input.body,input.world,input.memory,input.motivation];
    if(vectors.some(vector=>!Array.isArray(vector)||vector.length>256||
      vector.some(value=>typeof value!=='number'||!Number.isFinite(value)))) {
      throw new TypeError('predictive-self-agency-vectors-invalid');
    }
    if(typeof input.externalRequested!=='boolean'||!input.state||
      typeof input.state!=='object'||!input.state.needs||
      typeof input.state.needs!=='object'||
      !Number.isSafeInteger(input.state.tick)||input.state.tick<0||
      !Number.isFinite(input.state.at)||input.state.at<0||
      !['energy','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed','identityCoherence']
        .every(key=>typeof input.state.needs[key as keyof typeof input.state.needs]==='number'&&
          Number.isFinite(input.state.needs[key as keyof typeof input.state.needs]))) {
      throw new TypeError('predictive-self-agency-state-invalid');
    }
    const x=this.features(input),prev=this.state.selfLatent.slice(),next=this.stepSelf(x);
    if(this.state.learningSteps>0){const prevTarget=this.state.lastObservedSelfState;const err=prevTarget.reduce((s,v,i)=>s+Math.abs(v-(this.state.lastPredictedSelfState[i]??0)),0)/(24*2);this.state.predictionError01=clamp01(this.state.predictionError01*.96+err*.04);this.learnSelf(prevTarget,x);}
    this.state.previousSelfLatent=prev;this.state.selfLatent=next;this.state.intention=next.slice();this.state.lastObservedSelfState=x.slice();this.state.learningSteps++;this.state.predictionSamples++;
    this.state.selfContinuity01=clamp01(this.state.selfContinuity01*.94+(1-this.state.predictionError01)*.06);this.state.lastTick=input.state.tick;this.state.lastAt=input.state.at;
    return {latent:next.slice(),predictionError01:this.state.predictionError01,selfContinuity01:this.state.selfContinuity01,agency:this.agencyDiagnostics()};
  }
  private learnSelf(target:number[],x:number[]){const lr=.015/Math.sqrt(1+this.state.learningSteps/4000),p=this.state.lastPredictedSelfState;for(let i=0;i<24;i++){const e=target[i]-(p[i]??0);for(let j=0;j<24;j++){const local=e*(1-(p[i]??0)**2);this.state.selfWeights[i][j]=clamp11(this.state.selfWeights[i][j]+lr*local*(this.state.previousSelfLatent[j]??0));this.state.stateWeights[i][j]=clamp11(this.state.stateWeights[i][j]+lr*local*(x[j]??0));}}}
  predict(action:ActionKind) {
    // Compile-time ActionKind is not a runtime trust boundary: JS callers must not
    // silently map unknown actions onto ACTIONS[0] and learn against that row.
    if(!ACTIONS.includes(action))throw new TypeError('predictive-self-agency-action-invalid');
    const idx=ACTIONS.indexOf(action);
    const row=this.state.actionRows[idx]??[];
    const z=(this.state.actionBias[idx]??0)+row.reduce(
      (sum,value,j)=>sum+(value??0)*(this.state.selfLatent[j]??0),0,
    );
    const intention01=sigmoid(z);
    const predictedOutcome01=clamp01(
      .5 + .22*intention01 + .20*(1-this.state.predictionError01) - .12,
    );
    const ownershipPrior01=clamp01(
      .56 + .18*(1-this.state.predictionError01) - .08*intention01,
    );
    const confidence01=clamp01(
      .3 + .55*Math.min(1,this.state.predictionSamples/64) + .15*(1-this.state.predictionError01),
    );
    this.state.lastAction=action;
    this.state.lastPredictedOutcome01=predictedOutcome01;
    this.state.lastPredictedSelfState=this.state.selfLatent.map((v,j)=>
      tanh(v*.82+(this.state.intention[(j+idx)%24]??0)*.18),
    );
    this.state.predictions=[intention01,predictedOutcome01,ownershipPrior01,confidence01];
    return {
      action,intention01,predictedOutcome01,ownershipPrior01,confidence01,
      selfContinuity01:this.state.selfContinuity01,
    };
  }

  learnOutcome(
    action:ActionKind,
    outcome01:number,
    observedState:OrganismState,
    externallyRequested:boolean,
    causalMatch01:number,
  ) {
    // Validate every external learning signal before prediction mutates the model.
    // Malformed reward data or hostile state getters must yield zero learning.
    if(!ACTIONS.includes(action))throw new TypeError('predictive-self-agency-action-invalid');
    if(typeof outcome01!=='number'||!Number.isFinite(outcome01)||outcome01<0||outcome01>1) {
      throw new RangeError('predictive-self-agency-outcome-invalid');
    }
    if(typeof externallyRequested!=='boolean')throw new TypeError('predictive-self-agency-request-flag-invalid');
    if(typeof causalMatch01!=='number'||!Number.isFinite(causalMatch01)||causalMatch01<0||causalMatch01>1) {
      throw new RangeError('predictive-self-agency-causal-match-invalid');
    }
    let detachedState:unknown;
    try {
      detachedState=snapshotPlainData<OrganismState>(observedState,{
        maxDepth:16,maxNodes:2048,maxStringUnits:32*1024,
      });
    } catch {
      throw new TypeError('predictive-self-agency-outcome-state-invalid');
    }
    if(!detachedState||typeof detachedState!=='object'||Array.isArray(detachedState)) {
      throw new TypeError('predictive-self-agency-outcome-state-invalid');
    }
    const cleanObservedState=detachedState as OrganismState;
    if(!Number.isSafeInteger(cleanObservedState.tick)||cleanObservedState.tick<0||
       typeof cleanObservedState.at!=='number'||!Number.isFinite(cleanObservedState.at)||cleanObservedState.at<0||
       !cleanObservedState.needs||typeof cleanObservedState.needs!=='object'||
       !['energy','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed','identityCoherence']
         .every(key=>typeof cleanObservedState.needs[key as keyof typeof cleanObservedState.needs]==='number'&&
           Number.isFinite(cleanObservedState.needs[key as keyof typeof cleanObservedState.needs]))) {
      throw new TypeError('predictive-self-agency-outcome-state-invalid');
    }
    const causalMatch=clamp01(causalMatch01);
    const p=this.predict(action);
    const err=outcome01-p.predictedOutcome01;
    // An outcome can be accurate yet unrelated to the chosen action. Causal match is
    // therefore a credit-assignment weight, not merely an ownership diagnostic.
    // At zero match, retain the prediction for inspection but do not train policy,
    // confidence, ownership or authorship from a potentially coincidental outcome.
    if(causalMatch<=0) {
      return {predictionError01:Math.abs(err),agencyError01:this.state.agencyError01,ownership01:this.state.ownership01,authorship01:this.state.authorship01};
    }
    const lr=(.026/Math.sqrt(1+this.state.predictionSamples/2500))*causalMatch;
    const idx=ACTIONS.indexOf(action);
    const d=err*p.predictedOutcome01*(1-p.predictedOutcome01)*causalMatch;
    for(let j=0;j<24;j++) {
      this.state.actionRows[idx][j]=clamp11(
        (this.state.actionRows[idx][j]??0)+lr*d*(this.state.selfLatent[j]??0),
      );
    }
    this.state.actionBias[idx]=clamp11((this.state.actionBias[idx]??0)+lr*d);
    this.state.agencyError01=clamp01(this.state.agencyError01*.94+Math.abs(err)*causalMatch*.06);
    const requestPenalty=externallyRequested?.18:0;
    const ownershipTarget=clamp01(p.ownershipPrior01*.72+causalMatch*.28-requestPenalty);
    const learningWeight=.12*causalMatch;
    this.state.ownership01=clamp01(this.state.ownership01*(1-learningWeight)+ownershipTarget*learningWeight);
    const authorshipTarget=clamp01(p.intention01*.38+(1-this.state.agencyError01)*.3+this.state.ownership01*.32);
    this.state.authorship01=clamp01(this.state.authorship01*(1-learningWeight)+authorshipTarget*learningWeight);
    // Only stronger causal matches count as a new calibrated sample. Weak links may
    // provide a small policy gradient but must not inflate confidence sample counts.
    if(causalMatch>=.5)this.state.predictionSamples++;
    this.state.lastObservedSelfState=this.features({
      self:[],body:[],world:[],memory:[],motivation:[],state:cleanObservedState,
      externalRequested:externallyRequested,
    });
    return {
      predictionError01:Math.abs(err),agencyError01:this.state.agencyError01,
      ownership01:this.state.ownership01,authorship01:this.state.authorship01,
    };
  }
  agencyDiagnostics(){return {ownership01:this.state.ownership01,authorship01:this.state.authorship01,agencyConfidence01:clamp01((1-this.state.agencyError01)*.55+this.state.ownership01*.25+this.state.authorship01*.2),predictionError01:this.state.predictionError01,samples:this.state.predictionSamples};}
}
