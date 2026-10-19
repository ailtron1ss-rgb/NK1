/**
 * BIG PASS 207 — state-dependent thalamocortical gain gate.
 *
 * This is a computational analogue of state-dependent routing/gain, not a
 * claim that the implementation reproduces biological thalamic circuitry.
 */
export type ThalamicChannel = 'observation'|'prediction'|'memory'|'social'|'action'|'interoception'|'research';

export interface ThalamicGateInput {
  bodyEnergy01:number;
  thermal01:number;
  cognitiveCapacity01:number;
  memoryPressure01:number;
  uncertainty01:number;
  predictionError01:number;
  grounding01:number;
  causal01:number;
  metacognitive01:number;
  memoryHealth01:number;
  goalPressure01:number;
  socialNeed01:number;
  novelty01:number;
  externalInput:boolean;
  identityDecision:'allow'|'caution'|'veto';
}

export interface ThalamicGateFrame {
  version:1;
  arousal01:number;
  precision01:number;
  broadcast01:number;
  channelGain:Record<ThalamicChannel,number>;
  actionGain:Record<string,number>;
  reason:string[];
  loopGain01:number;
  loopError01:number;
  loopClosed:boolean;
}

export interface ThalamicChannelModel {
  posterior01:number;
  precision01:number;
  meanError01:number;
  samples:number;
  lastTick:number;
}

export interface ThalamicGateState {
  version:1;
  cycles:number;
  meanBroadcast01:number;
  meanPrecision01:number;
  closedLoops:number;
  meanLoopError01:number;
  channelModels:Record<ThalamicChannel,ThalamicChannelModel>;
  last:ThalamicGateFrame|null;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const CHANNELS:ReadonlyArray<ThalamicChannel> = ['observation','prediction','memory','social','action','interoception','research'];
const ACTION_TO_CHANNEL:Record<string,ThalamicChannel> = {respond:'social',explore:'action',verify:'research',rest:'interoception',reflect:'memory',wait:'observation',defer:'prediction'};
const makeChannelModels=():Record<ThalamicChannel,ThalamicChannelModel> => Object.fromEntries(CHANNELS.map(channel=>[channel,{posterior01:.5,precision01:.5,meanError01:.5,samples:0,lastTick:0}])) as Record<ThalamicChannel,ThalamicChannelModel>;

export class ThalamocorticalGate {
  private state:ThalamicGateState={version:1,cycles:0,meanBroadcast01:.55,meanPrecision01:.5,closedLoops:0,meanLoopError01:.2,channelModels:makeChannelModels(),last:null};

  restore(raw?:Partial<ThalamicGateState>|null){
    const d:ThalamicGateState={version:1,cycles:0,meanBroadcast01:.55,meanPrecision01:.5,closedLoops:0,meanLoopError01:.2,channelModels:makeChannelModels(),last:null};
    const r=raw??{};
    const channelModels={...d.channelModels};
    for(const channel of CHANNELS){
      const m=(r.channelModels as any)?.[channel];
      if(m) channelModels[channel]={
        posterior01:clamp(m.posterior01??.5),
        precision01:clamp(m.precision01??.5),
        meanError01:clamp(m.meanError01??.5),
        samples:Math.max(0,Math.floor(m.samples??0)),
        lastTick:Math.max(0,Math.floor(m.lastTick??0)),
      };
    }
    this.state={...d,...r,version:1,closedLoops:Math.max(0,Math.floor((r as any).closedLoops??0)),meanLoopError01:clamp((r as any).meanLoopError01??.2),channelModels,last:r.last?cloneFrame(r.last):null};
  }

  snapshot(){return structuredClone(this.state);}

  gate(input:ThalamicGateInput):ThalamicGateFrame{
    const energy=clamp(input.bodyEnergy01), thermal=clamp(input.thermal01), cap=clamp(input.cognitiveCapacity01), mp=clamp(input.memoryPressure01);
    const uncertainty=clamp(input.uncertainty01), pe=clamp(input.predictionError01), grounding=clamp(input.grounding01), causal=clamp(input.causal01), mc=clamp(input.metacognitive01), mh=clamp(input.memoryHealth01);
    const goal=clamp(input.goalPressure01), social=clamp(input.socialNeed01), novelty=clamp(input.novelty01);
    const arousal=clamp(energy*.36+(1-thermal)*.24+cap*.22+(input.externalInput?.1:0)+(1-mp)*.08);
    const precision=clamp(grounding*.24+causal*.2+mc*.16+mh*.16+(1-uncertainty)*.1+(1-pe)*.14);
    const broadcast=clamp(arousal*.34+precision*.28+(input.externalInput?.08:0)+goal*.1+novelty*.08+(1-mp)*.12-social*.02);

    const channelGain:Record<ThalamicChannel,number>={
      observation:clamp(broadcast*.56+arousal*.22+(input.externalInput?.12:0)+novelty*.1),
      prediction:clamp(broadcast*.45+precision*.3+pe*.14+novelty*.11),
      memory:clamp(broadcast*.42+precision*.32+mh*.14+pe*.08),
      social:clamp(broadcast*.34+social*.38+(input.externalInput?.08:0)+mc*.1),
      action:clamp(broadcast*.38+goal*.24+precision*.18+arousal*.12),
      interoception:clamp(.34+arousal*.2+(1-energy)*.2+thermal*.16+goal*.06),
      research:clamp(broadcast*.3+uncertainty*.28+pe*.16+causal*.14+novelty*.08),
    };

    if(input.identityDecision==='veto'){
      channelGain.action*=.72;
      channelGain.research=clamp(channelGain.research+.05);
      channelGain.interoception=clamp(channelGain.interoception+.08);
    } else if(input.identityDecision==='caution') {
      channelGain.action*=.88;
      channelGain.research=clamp(channelGain.research+.03);
    }
    if(thermal>.78 || cap<.3){
      channelGain.research*=.68;
      channelGain.prediction*=.84;
      channelGain.action*=.9;
      channelGain.interoception=clamp(channelGain.interoception+.06);
    }

    const actionGain:Record<string,number>={
      respond:channelGain.social*.65+channelGain.observation*.35,
      explore:channelGain.action*.55+channelGain.prediction*.25+channelGain.research*.2,
      verify:channelGain.research*.55+channelGain.prediction*.2+channelGain.memory*.25,
      rest:channelGain.interoception*.8+(1-channelGain.action)*.2,
      reflect:channelGain.memory*.45+channelGain.prediction*.3+channelGain.research*.25,
      wait:1-(channelGain.action*.35+channelGain.observation*.25),
      defer:1-(channelGain.action*.28+channelGain.research*.22),
    };
    for(const key of Object.keys(actionGain)) actionGain[key]=clamp(.55+actionGain[key]*.45);

    const reason:string[]=[];
    if(input.externalInput)reason.push('external-input');
    if(pe>.5)reason.push('prediction-error');
    if(uncertainty>.58)reason.push('uncertainty');
    if(thermal>.72)reason.push('thermal-pressure');
    if(cap<.38)reason.push('capacity-pressure');
    if(mp>.7)reason.push('memory-pressure');
    if(goal>.6)reason.push('goal-pressure');
    if(social>.62)reason.push('social-pressure');
    if(!reason.length)reason.push('stable-gain');

    const frame:ThalamicGateFrame={version:1,arousal01:arousal,precision01:precision,broadcast01:broadcast,channelGain,actionGain,reason,loopGain01:1,loopError01:0,loopClosed:false};
    this.state.cycles+=1;
    this.state.meanBroadcast01=clamp(this.state.meanBroadcast01*.97+broadcast*.03);
    this.state.meanPrecision01=clamp(this.state.meanPrecision01*.97+precision*.03);
    this.state.last=cloneFrame(frame);
    return frame;
  }

  /**
   * BIG PASS 214 — closed-loop thalamo-cortical feedback.
   * Functional routing analogue only; not an anatomical equivalence claim.
   */
  closeLoop(frame:ThalamicGateFrame, rows:Array<{id:string;precision01:number;contradiction01:number;informationGain01:number;predictivePosterior01:number;predictionError01:number}>, tick:number){
    const buckets:Record<ThalamicChannel,{count:number;precision:number;contradiction:number;informationGain:number;posterior:number;error:number}> = Object.fromEntries(CHANNELS.map(channel=>[channel,{count:0,precision:0,contradiction:0,informationGain:0,posterior:0,error:0}])) as any;
    for(const row of rows??[]){
      const channel=ACTION_TO_CHANNEL[row.id]??'prediction';
      const bucket=buckets[channel];
      bucket.count++;
      bucket.precision+=clamp(row.precision01);
      bucket.contradiction+=clamp(row.contradiction01);
      bucket.informationGain+=clamp(row.informationGain01);
      bucket.posterior+=clamp(row.predictivePosterior01);
      bucket.error+=clamp(row.predictionError01);
    }
    const channelGain={...frame.channelGain};
    let weightedError=0,totalWeight=0,gainSum=0;
    for(const channel of CHANNELS){
      const bucket=buckets[channel];
      const model=this.state.channelModels[channel];
      const count=Math.max(1,bucket.count);
      const precision=bucket.precision/count;
      const contradiction=bucket.contradiction/count;
      const informationGain=bucket.informationGain/count;
      const posterior=bucket.posterior/count;
      const error=bucket.error/count;
      const learnedWeight=clamp(Math.min(.55,model.samples/20*.55)*(.65+.35*model.precision01));
      const blendedPosterior=clamp(model.posterior01*(1-learnedWeight)+posterior*learnedWeight);
      const reciprocal=clamp(.93+precision*.10+informationGain*.05-contradiction*.14-(1-model.precision01)*.06);
      const boundedDelta=Math.max(-.18,Math.min(.12,reciprocal-1));
      channelGain[channel]=clamp(frame.channelGain[channel]*(1+boundedDelta));
      weightedError+=error*count;
      totalWeight+=count;
      gainSum+=channelGain[channel];
      model.posterior01=clamp(model.posterior01*.94+blendedPosterior*.06);
      model.precision01=clamp(model.precision01*.94+precision*.06);
      model.meanError01=clamp(model.meanError01*.94+error*.06);
      model.lastTick=Math.max(0,Math.floor(tick));
    }
    const loopError=totalWeight?clamp(weightedError/totalWeight):0;
    const loopGain=clamp(gainSum/CHANNELS.length);
    const actionGain={...frame.actionGain};
    for(const [action,channel] of Object.entries(ACTION_TO_CHANNEL)){
      const ratio=channelGain[channel]/Math.max(.001,frame.channelGain[channel]);
      actionGain[action]=clamp(frame.actionGain[action]*(.96+ratio*.04));
    }
    const closed:ThalamicGateFrame={...frame,channelGain,actionGain,reason:[...frame.reason,'cortical-feedback'],loopGain01:loopGain,loopError01:loopError,loopClosed:true};
    this.state.closedLoops++;
    this.state.meanLoopError01=clamp(this.state.meanLoopError01*.94+loopError*.06);
    this.state.last=cloneFrame(closed);
    return closed;
  }

  recordOutcome(action:string,predicted01:number,actual01:number,surprise01:number,tick:number){
    const channel=ACTION_TO_CHANNEL[action]??'prediction';
    const model=this.state.channelModels[channel];
    const predicted=clamp(predicted01),actual=clamp(actual01),surprise=clamp(surprise01);
    const error=Math.abs(actual-predicted);
    const lr=.025+.06*surprise+.05*error;
    model.posterior01=clamp(model.posterior01*(1-lr)+actual*lr);
    model.precision01=clamp(model.precision01*(1-lr*.8)+(1-error)*(lr*.8));
    model.meanError01=clamp(model.meanError01*(1-lr)+error*lr);
    model.samples++;
    model.lastTick=Math.max(0,Math.floor(tick));
    return {action,channel,error01:error,posterior01:model.posterior01,precision01:model.precision01,samples:model.samples};
  }
}

function cloneFrame(frame:ThalamicGateFrame):ThalamicGateFrame{return {...frame,channelGain:{...frame.channelGain},actionGain:{...frame.actionGain},reason:[...frame.reason]};}
