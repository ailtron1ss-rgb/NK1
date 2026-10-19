const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const boundedInt=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number(x)||0)));

type ReplayLane='fast'|'medium'|'slow';

type FeatureKey='surprise'|'decay'|'transfer'|'identity'|'goal'|'novelty'|'stability';

export interface AdaptiveReplayCandidate {
  id:string;
  kind:string;
  ageMs:number;
  lastReplayedAt:number;
  replayCount:number;
  surprise01:number;
  decayNeed01:number;
  transferPotential01:number;
  identity01:number;
  goal01:number;
  novelty01:number;
  stability01:number;
  interference01:number;
  activeGoalMatch:boolean;
  clusterKey:string;
}

export interface AdaptiveReplayDecision {
  id:string;
  lane:ReplayLane;
  priority01:number;
  learningOpportunity01:number;
  retentionPotential01:number;
  interferenceRisk01:number;
  decayNeed01:number;
  cooldown01:number;
  selected:boolean;
  reason:string;
  features:Record<FeatureKey,number>;
}

export interface AdaptiveReplayGovernorState {
  version:1;
  cycles:number;
  schedules:number;
  selected:number;
  suppressed:number;
  cooldownSuppressed:number;
  interferenceAvoided:number;
  redundancyAvoided:number;
  feedbackUpdates:number;
  meanPriority01:number;
  meanLearningOpportunity01:number;
  meanInterferenceRisk01:number;
  policyWeights:Record<FeatureKey,number>;
  laneCounts:{fast:number;medium:number;slow:number};
  recent:AdaptiveReplayDecision[];
  lastTick:number;
  lastLane:'fast'|'medium'|'slow'|'none';
  lastBudget:number;
}

export interface AdaptiveReplayPlan {
  lane:'fast'|'medium'|'slow'|'none';
  budget:number;
  candidates:AdaptiveReplayDecision[];
  due:boolean;
  policyWeights:Record<FeatureKey,number>;
  diagnostics:{pressure01:number;energy01:number;memoryPressure01:number;mobile:boolean;halfLifeDays:number};
}

const DEFAULT_WEIGHTS:Record<FeatureKey,number>={surprise:.22,decay:.20,transfer:.18,identity:.12,goal:.10,novelty:.08,stability:.10};
const MIN_WEIGHTS:Record<FeatureKey,number>={surprise:.04,decay:.05,transfer:.05,identity:.06,goal:.05,novelty:.04,stability:.08};
const NORMALIZE=(w:Record<FeatureKey,number>)=>{
  const keys=Object.keys(DEFAULT_WEIGHTS) as FeatureKey[];
  const bounded=Object.fromEntries(keys.map(k=>[k,Math.max(MIN_WEIGHTS[k],Number(w[k]??0))])) as Record<FeatureKey,number>;
  const sum=keys.reduce((s,k)=>s+bounded[k],0)||1;
  return Object.fromEntries(keys.map(k=>[k,bounded[k]/sum])) as Record<FeatureKey,number>;
};

export const defaultAdaptiveReplayGovernorState=():AdaptiveReplayGovernorState=>({
  version:1,cycles:0,schedules:0,selected:0,suppressed:0,cooldownSuppressed:0,
  interferenceAvoided:0,redundancyAvoided:0,feedbackUpdates:0,meanPriority01:0,
  meanLearningOpportunity01:0,meanInterferenceRisk01:0,policyWeights:{...DEFAULT_WEIGHTS},
  laneCounts:{fast:0,medium:0,slow:0},recent:[],lastTick:0,lastLane:'none',lastBudget:0,
});

/**
 * P2687: adaptive multi-timescale replay governor.
 *
 * This is intentionally a bounded algorithmic controller, not an anatomical claim.
 * It combines surprise-driven memory selection (Titans-inspired), multi-frequency
 * update scheduling (Nested Learning-inspired), forgetting-curve pressure, and a
 * replay-harm guard. Replay remains ungrounded evidence and cannot certify reality.
 */
export class AdaptiveReplayGovernor {
  private state=defaultAdaptiveReplayGovernorState();
  private readonly decisionById=new Map<string,AdaptiveReplayDecision>();

  restore(raw?:Partial<AdaptiveReplayGovernorState>|null){
    const d=defaultAdaptiveReplayGovernorState(),r=raw??{};
    const weights=NORMALIZE({...d.policyWeights,...(r.policyWeights??{})});
    this.state={...d,...r,version:1,policyWeights:weights,
      laneCounts:{...d.laneCounts,...(r.laneCounts??{})},
      recent:Array.isArray(r.recent)?r.recent.slice(-96).map(x=>this.cleanDecision(x)):[]};
    this.rebuildDecisionIndex();
  }

  snapshot(){return structuredClone(this.state);}
  diagnostics(){
    return {
      cycles:this.state.cycles,schedules:this.state.schedules,selected:this.state.selected,
      suppressed:this.state.suppressed,cooldownSuppressed:this.state.cooldownSuppressed,
      interferenceAvoided:this.state.interferenceAvoided,redundancyAvoided:this.state.redundancyAvoided,
      feedbackUpdates:this.state.feedbackUpdates,selectionRate01:clamp(this.state.selected/Math.max(1,this.state.selected+this.state.suppressed)),
      suppressionRate01:clamp(this.state.suppressed/Math.max(1,this.state.selected+this.state.suppressed)),
      meanPriority01:this.state.meanPriority01,meanLearningOpportunity01:this.state.meanLearningOpportunity01,
      meanInterferenceRisk01:this.state.meanInterferenceRisk01,policyWeights:{...this.state.policyWeights},
      laneCounts:{...this.state.laneCounts},lastTick:this.state.lastTick,lastLane:this.state.lastLane,lastBudget:this.state.lastBudget
    };
  }

  plan(input:{tick:number;at?:number;pressure01?:number;energy01?:number;memoryPressure01?:number;mobile?:boolean;activeGoalIds?:string[];nodes:AdaptiveReplayCandidate[]}):AdaptiveReplayPlan{
    const tick=boundedInt(input.tick,0,Number.MAX_SAFE_INTEGER);
    const pressure=clamp(input.pressure01??0);
    const energy=clamp(input.energy01??.8);
    const memoryPressure=clamp(input.memoryPressure01??0);
    const mobile=Boolean(input.mobile);
    const activeGoals=new Set((input.activeGoalIds??[]).slice(0,8).map(String));
    const activity01=input.nodes.length?clamp(input.nodes.slice(0,96).reduce((sum,node)=>sum+(.55*clamp(node.surprise01)+.25*clamp(node.novelty01)+.20*clamp(node.transferPotential01)),0)/Math.min(96,input.nodes.length)):0;
    const lane=this.selectLane(tick,pressure,energy,memoryPressure,activity01);
    const due=lane!=='none';
    this.state.cycles++;
    this.state.lastTick=tick;
    this.state.lastLane=lane;
    if(!due){ this.state.lastBudget=0; return {lane,budget:0,candidates:[],due:false,policyWeights:{...this.state.policyWeights},diagnostics:{pressure01:pressure,energy01:energy,memoryPressure01:memoryPressure,mobile,halfLifeDays:this.halfLifeDays(lane)}}; }

    const baseBudget=lane==='fast'?2:lane==='medium'?4:lane==='slow'?6:0;
    const pressureBoost=pressure>.82?2:pressure>.66?1:0;
    const energyCut=energy<.24?Math.min(2,baseBudget):energy<.40?1:0;
    const mobileCap=mobile?6:8;
    const budget=Math.max(1,Math.min(mobileCap,baseBudget+pressureBoost-energyCut));
    this.state.schedules++;
    this.state.laneCounts[lane]++;
    this.state.lastBudget=budget;

    const halfLifeDays=this.halfLifeDays(lane);
    const nodeById=new Map(input.nodes.map(node=>[node.id,node]));
    const scored=input.nodes.map(node=>this.scoreNode(node,{lane,pressure,energy,memoryPressure,mobile,activeGoals,halfLifeDays,activity01,at:Number.isFinite(input.at)?Number(input.at):Date.now()}));
    const chosen:AdaptiveReplayDecision[]=[];
    const clusters=new Set<string>();
    const kinds=new Map<string,number>();
    for(const row of scored.sort((a,b)=>b.priority01-a.priority01)){
      const node=nodeById.get(row.id);
      if(!this.safeToConsider(row,node)) continue;
      const clusterKey=node?.clusterKey??row.id;
      const kind=node?.kind??'unknown';
      const repeatPenalty=(clusters.has(clusterKey)?0.14:0)+Math.min(.16,(kinds.get(kind)??0)*.055);
      const adjusted=clamp(row.priority01-repeatPenalty);
      const decision={...row,priority01:adjusted,selected:adjusted>.36};
      if(decision.selected && chosen.length<budget){
        if(repeatPenalty>.15){this.state.redundancyAvoided++;continue;}
        chosen.push(decision);clusters.add(clusterKey);kinds.set(kind,(kinds.get(kind)??0)+1);
      }
    }

    const chosenIds=new Set(chosen.map(x=>x.id));
    const emitted=scored.map(x=>({...x,selected:chosenIds.has(x.id)}));
    const suppressed=Math.max(0,emitted.length-chosen.length);
    this.state.selected+=chosen.length;
    this.state.suppressed+=Math.min(64,suppressed);
    for(const row of emitted){
      if(row.cooldown01>.78) this.state.cooldownSuppressed++;
      if(row.interferenceRisk01>.76 && !row.selected) this.state.interferenceAvoided++;
      this.decisionById.set(row.id,row);
    }
    const mean=(rows:AdaptiveReplayDecision[],key:keyof AdaptiveReplayDecision)=>rows.length?rows.reduce((s,r)=>s+Number(r[key]??0),0)/rows.length:0;
    this.state.meanPriority01=clamp(this.state.meanPriority01*.92+mean(chosen,'priority01')*.08);
    this.state.meanLearningOpportunity01=clamp(this.state.meanLearningOpportunity01*.92+mean(chosen,'learningOpportunity01')*.08);
    this.state.meanInterferenceRisk01=clamp(this.state.meanInterferenceRisk01*.92+(mean(chosen,'interferenceRisk01')*.08));
    this.state.recent=[...this.state.recent,...chosen].slice(-96);
    this.rebuildDecisionIndex();

    return {lane,budget,candidates:structuredClone(chosen),due:true,policyWeights:{...this.state.policyWeights},diagnostics:{pressure01:pressure,energy01:energy,memoryPressure01:memoryPressure,mobile,halfLifeDays}};
  }

  feedback(input:{memoryId:string;retentionGain01:number;transferPotential01:number;interferenceRisk01:number;independentVerified?:boolean;delayMs?:number}){
    const gain=clamp(input.retentionGain01),transfer=clamp(input.transferPotential01),risk=clamp(input.interferenceRisk01);
    if(!input.independentVerified) return {updated:false,utility01:clamp(.45*gain+.30*transfer-.25*risk),policyWeights:{...this.state.policyWeights}};
    const row=this.decisionById.get(String(input.memoryId));
    if(!row) return {updated:false,utility01:clamp(.45*gain+.30*transfer-.25*risk),policyWeights:{...this.state.policyWeights}};
    const utility=Math.max(-1,Math.min(1,(gain-.5)*.9+(transfer-.5)*.55-(risk-.5)*.65));
    const lr=0.012+Math.min(.008,(Math.max(0,Number(input.delayMs??0))/86400000)*.0015);
    const next={...this.state.policyWeights};
    for(const key of Object.keys(DEFAULT_WEIGHTS) as FeatureKey[]){
      const feature=row.features[key];
      next[key]=Math.max(.001,next[key]+lr*utility*(feature-.5));
    }
    this.state.policyWeights=NORMALIZE(next);
    this.state.feedbackUpdates++;
    return {updated:true,utility01:utility,policyWeights:{...this.state.policyWeights}};
  }

  private selectLane(tick:number,pressure:number,energy:number,memoryPressure:number,activity01=0):'fast'|'medium'|'slow'|'none'{
    if(tick<=0)return 'none';
    if(energy<.16 && pressure<.78)return 'none';
    if(tick%64===0 || memoryPressure>.86)return 'slow';
    if(tick%16===0 || pressure>.72 || (activity01>.78 && memoryPressure>.46))return 'medium';
    if(tick%4===0 || pressure>.48 || (activity01>.84 && energy>.30))return 'fast';
    return 'none';
  }

  private halfLifeDays(lane:'fast'|'medium'|'slow'|'none'){
    return lane==='fast'?1.5:lane==='medium'?6:lane==='slow'?21:6;
  }

  private scoreNode(node:AdaptiveReplayCandidate,ctx:{lane:ReplayLane;pressure:number;energy:number;memoryPressure:number;mobile:boolean;activeGoals:Set<string>;halfLifeDays:number;activity01:number;at:number}):AdaptiveReplayDecision{
    const activeGoal=Boolean(node.activeGoalMatch || node.goal01>.62 || node.transferPotential01>.72 && ctx.activeGoals.size>0);
    const ageDays=Math.max(0,node.ageMs)/86400000;
    const forgetting=clamp(1-Math.exp(-Math.log(2)*ageDays/Math.max(.25,ctx.halfLifeDays)));
    const decayNeed=clamp(.70*forgetting+.30*(1-node.stability01));
    const surprise=clamp(node.surprise01);
    const transfer=clamp(node.transferPotential01);
    const identity=clamp(node.identity01);
    const goal=clamp(activeGoal?Math.max(node.goal01,.74):node.goal01);
    const novelty=clamp(node.novelty01);
    const stability=clamp(node.stability01);
    const replayLoad=clamp(node.replayCount/6);
    const cooldownMs=ctx.lane==='fast'?4*60*60*1000:ctx.lane==='medium'?16*60*60*1000:64*60*60*1000;
    const sinceReplay=node.lastReplayedAt>0?Math.max(0,ctx.at-node.lastReplayedAt):Number.POSITIVE_INFINITY;
    const cooldown01=Number.isFinite(sinceReplay)?clamp(1-sinceReplay/cooldownMs):0;
    const interference=clamp(.42*(1-stability)+.22*replayLoad+.20*ctx.pressure+.16*ctx.memoryPressure);
    const harmGuard=clamp(interference*.68+cooldown01*.18+(1-transfer)*.14);
    const weights=this.contextualWeights(ctx.activity01,ctx.pressure,ctx.memoryPressure,ctx.energy);
    const base=clamp(weights.surprise*surprise+weights.decay*decayNeed+weights.transfer*transfer+weights.identity*identity+weights.goal*goal+weights.novelty*novelty+weights.stability*stability);
    const laneMult=ctx.lane==='fast'?1.03:ctx.lane==='medium'?1.00:.96;
    const energyMult=ctx.energy<.30?.76:ctx.energy<.5?.9:1;
    const mobilePenalty=ctx.mobile?.025:0;
    const priority=clamp(base*laneMult*energyMult-mobilePenalty-harmGuard*.31);
    const learningOpportunity=clamp(.34*surprise+.22*decayNeed+.18*transfer+.11*identity+.08*goal+.07*novelty);
    const retentionPotential=clamp(.42*stability+.24*identity+.18*transfer+.10*goal+.06*(1-interference));
    return {
      id:String(node.id),lane:ctx.lane,priority01:priority,learningOpportunity01:learningOpportunity,
      retentionPotential01:retentionPotential,interferenceRisk01:interference,decayNeed01:decayNeed,cooldown01:cooldown01,
      selected:false,reason:`lane=${ctx.lane} decay=${decayNeed.toFixed(3)} surprise=${surprise.toFixed(3)} transfer=${transfer.toFixed(3)} interference=${interference.toFixed(3)}`,
      features:{surprise,decay:decayNeed,transfer,identity,goal,novelty,stability}
    };
  }


  private contextualWeights(activity01:number,pressure:number,memoryPressure:number,energy:number){
    const next={...this.state.policyWeights};
    if(activity01>.72){ next.surprise+=.035; next.novelty+=.015; next.transfer+=.01; }
    if(memoryPressure>.62){ next.decay+=.04; next.stability+=.03; next.novelty-=.015; }
    if(pressure>.72){ next.stability+=.025; next.identity+=.015; }
    if(energy<.42){ next.stability+=.03; next.goal+=.01; next.surprise-=.02; }
    return NORMALIZE(next);
  }

  private safeToConsider(row:AdaptiveReplayDecision,node?:AdaptiveReplayCandidate){
    if(!node)return false;
    if(row.cooldown01>.92)return false;
    if(row.interferenceRisk01>.86 && row.learningOpportunity01<.66)return false;
    if(row.retentionPotential01<.24 && row.learningOpportunity01<.44)return false;
    if(row.decayNeed01<.07 && row.features.surprise<.12 && node.replayCount>=4)return false;
    return true;
  }

  private rebuildDecisionIndex(){this.decisionById.clear();for(const row of this.state.recent)this.decisionById.set(row.id,row);}
  private cleanDecision(raw:any):AdaptiveReplayDecision{
    const f=raw?.features??{};
    return {id:String(raw?.id??''),lane:['fast','medium','slow'].includes(raw?.lane)?raw.lane:'fast',priority01:clamp(Number(raw?.priority01??0)),learningOpportunity01:clamp(Number(raw?.learningOpportunity01??0)),retentionPotential01:clamp(Number(raw?.retentionPotential01??0)),interferenceRisk01:clamp(Number(raw?.interferenceRisk01??0)),decayNeed01:clamp(Number(raw?.decayNeed01??0)),cooldown01:clamp(Number(raw?.cooldown01??0)),selected:Boolean(raw?.selected),reason:String(raw?.reason??'').slice(0,220),features:{surprise:clamp(Number(f.surprise??0)),decay:clamp(Number(f.decay??0)),transfer:clamp(Number(f.transfer??0)),identity:clamp(Number(f.identity??0)),goal:clamp(Number(f.goal??0)),novelty:clamp(Number(f.novelty??0)),stability:clamp(Number(f.stability??0))}};
  }
}

