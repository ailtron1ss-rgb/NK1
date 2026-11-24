export type WalyStatus='candidate'|'verified'|'contested';
export interface WorldAgencyLearningLink{
  id:string; tick:number; at:number; action:string; alternativeAction?:string|null;
  worldOn01:number; worldOff01:number; worldDelta01:number;
  selectedUtility01:number; alternativeUtility01:number; actionMargin01:number;
  outcome01:number; reward01:number; learningDelta01:number;
  counterfactualActionChanged:boolean; counterfactualLearningChanged:boolean;
  status:WalyStatus; provenance:string;
}
export interface WorldAgencyLearningState{
  version:1; applications:number; observedCycles:number; verifiedLinks:number; contestedLinks:number;
  lastVerifiedTick:number; lastWorldDelta01:number; lastActionMargin01:number; lastLearningDelta01:number;
  recent:WorldAgencyLearningLink[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultWorldAgencyLearning=():WorldAgencyLearningState=>({version:1,applications:0,observedCycles:0,verifiedLinks:0,contestedLinks:0,lastVerifiedTick:-1,lastWorldDelta01:0,lastActionMargin01:0,lastLearningDelta01:0,recent:[]});
export class WorldAgencyLearningCausalBridge{
  private state=defaultWorldAgencyLearning();
  private readonly capacity:number;
  constructor(capacity=96){this.capacity=capacity;}
  restore(raw?:Partial<WorldAgencyLearningState>|null){
    const d=defaultWorldAgencyLearning();
    this.state={...d,...(raw??{}),version:1,
      applications:Math.max(0,Number(raw?.applications??0)),observedCycles:Math.max(0,Number(raw?.observedCycles??0)),
      verifiedLinks:Math.max(0,Number(raw?.verifiedLinks??0)),contestedLinks:Math.max(0,Number(raw?.contestedLinks??0)),
      lastVerifiedTick:Number(raw?.lastVerifiedTick??-1),lastWorldDelta01:clamp(Number(raw?.lastWorldDelta01??0)),
      lastActionMargin01:clamp(Number(raw?.lastActionMargin01??0)),lastLearningDelta01:clamp(Number(raw?.lastLearningDelta01??0)),
      recent:Array.isArray(raw?.recent)?raw.recent.slice(0,this.capacity).map((x:any)=>this.clean(x)):[]};
  }
  observeCycle(input:{tick:number;at:number;action:string;worldConfidence01:number;selectedUtility01:number;alternativeAction?:string|null;alternativeUtility01?:number}){
    this.state.observedCycles++;
    return {tick:input.tick,action:input.action,world01:clamp(input.worldConfidence01),utility01:clamp(input.selectedUtility01),alternativeAction:input.alternativeAction??null,alternativeUtility01:clamp(input.alternativeUtility01??.5)};
  }
  recordOutcome(input:{tick:number;at:number;action:string;worldOn01:number;worldOff01:number;selectedUtility01:number;alternativeAction?:string|null;alternativeUtility01?:number;outcome01:number;reward01:number;learningDelta01:number;counterfactualActionChanged?:boolean;counterfactualLearningChanged?:boolean;provenance?:string}):WorldAgencyLearningLink{
    const worldOn=clamp(input.worldOn01),worldOff=clamp(input.worldOff01),worldDelta=Math.abs(worldOn-worldOff);
    const selected=clamp(input.selectedUtility01), alternative=clamp(input.alternativeUtility01??.5), margin=Math.abs(selected-alternative);
    const learning=clamp(Math.abs(input.learningDelta01));
    const actionChanged=Boolean(input.counterfactualActionChanged);
    const learningChanged=Boolean(input.counterfactualLearningChanged);
    const verified=(worldDelta>=.08 && actionChanged && learning>=.01 && learningChanged) || (worldDelta>=.15 && actionChanged);
    const status:WalyStatus=verified?'verified':(worldDelta<.02 && !actionChanged?'candidate':'contested');
    const link:WorldAgencyLearningLink={id:`wal-${input.tick}-${this.state.applications+1}`,tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at),action:String(input.action),alternativeAction:input.alternativeAction??null,worldOn01:worldOn,worldOff01:worldOff,worldDelta01:worldDelta,selectedUtility01:selected,alternativeUtility01:alternative,actionMargin01:margin,outcome01:clamp(input.outcome01),reward01:clamp(input.reward01),learningDelta01:learning,counterfactualActionChanged:actionChanged,counterfactualLearningChanged:learningChanged,status,provenance:String(input.provenance??'world->agency->outcome->learning')};
    this.state.applications++;this.state.lastWorldDelta01=worldDelta;this.state.lastActionMargin01=margin;this.state.lastLearningDelta01=learning;
    if(status==='verified'){this.state.verifiedLinks++;this.state.lastVerifiedTick=link.tick;} else if(status==='contested') this.state.contestedLinks++;
    this.state.recent=[link,...this.state.recent].slice(0,this.capacity);return structuredClone(link);
  }
  snapshot():WorldAgencyLearningState{return structuredClone(this.state);}
  diagnostics(){return {applications:this.state.applications,observedCycles:this.state.observedCycles,verifiedLinks:this.state.verifiedLinks,contestedLinks:this.state.contestedLinks,verificationRate01:clamp(this.state.verifiedLinks/Math.max(1,this.state.applications)),lastWorldDelta01:this.state.lastWorldDelta01,lastActionMargin01:this.state.lastActionMargin01,lastLearningDelta01:this.state.lastLearningDelta01};}
  private clean(x:any):WorldAgencyLearningLink{
    return {
      id:String(x?.id??''),
      tick:Math.max(0,Number(x?.tick??0)),
      at:Number(x?.at??0),
      action:String(x?.action??'wait'),
      alternativeAction:x?.alternativeAction==null?null:String(x.alternativeAction),
      worldOn01:clamp(Number(x?.worldOn01??0)), worldOff01:clamp(Number(x?.worldOff01??0)),
      worldDelta01:clamp(Number(x?.worldDelta01??0)), selectedUtility01:clamp(Number(x?.selectedUtility01??0)),
      alternativeUtility01:clamp(Number(x?.alternativeUtility01??0)), actionMargin01:clamp(Number(x?.actionMargin01??0)),
      outcome01:clamp(Number(x?.outcome01??0)), reward01:clamp(Number(x?.reward01??0)),
      learningDelta01:clamp(Number(x?.learningDelta01??0)),
      counterfactualActionChanged:Boolean(x?.counterfactualActionChanged),
      counterfactualLearningChanged:Boolean(x?.counterfactualLearningChanged),
      status:['candidate','verified','contested'].includes(x?.status)?x.status:'candidate',
      provenance:String(x?.provenance??''),
    };
  }
}
