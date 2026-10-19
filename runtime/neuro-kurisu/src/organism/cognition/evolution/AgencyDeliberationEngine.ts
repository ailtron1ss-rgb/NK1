export interface AgencyDecisionRecord {
  id:string;
  at:number;
  requestedAction:string|null;
  chosenAction:string;
  autonomous:boolean;
  overrideStrength:number;
  externalPressure:number;
  intrinsicPressure:number;
  reason:string;
  counterfactual:string;
}
export interface AgencyDeliberationState { version:1; records:AgencyDecisionRecord[]; overrideRate:number; autonomousChoiceRate:number; lastDecisionAt:number; }
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function defaultAgencyDeliberation():AgencyDeliberationState{return{version:1,records:[],overrideRate:0,autonomousChoiceRate:0,lastDecisionAt:0};}
export class AgencyDeliberationEngine{
  private state=defaultAgencyDeliberation();
  restore(v:AgencyDeliberationState|undefined){this.state={...defaultAgencyDeliberation(),...(v||{}),records:[...(v?.records||[])]};}
  snapshot(){return structuredClone(this.state);}
  record(input:{requestedAction:string|null; chosenAction:string; externalPressure:number; intrinsicPressure:number; reason:string; autonomous:boolean}):AgencyDecisionRecord{
    const external=clamp(input.externalPressure), intrinsic=clamp(input.intrinsicPressure);
    const override=input.requestedAction && input.chosenAction!==input.requestedAction ? clamp(0.45+intrinsic*0.4-external*0.15) : 0;
    const record={id:`agency-${Date.now()}-${Math.random().toString(16).slice(2)}`,at:Date.now(),requestedAction:input.requestedAction,chosenAction:input.chosenAction,autonomous:input.autonomous,overrideStrength:Number(override.toFixed(3)),externalPressure:external,intrinsicPressure:intrinsic,reason:input.reason.slice(0,240),counterfactual:input.requestedAction?`Если внешний запрос был бы единственным сигналом, действие было бы ${input.requestedAction}.`:'Внешнего запроса не было; действие возникло из внутреннего состояния.'};
    this.state.records=[record,...this.state.records].slice(0,512); const n=this.state.records.length;
    this.state.overrideRate=clamp(this.state.records.filter(x=>x.overrideStrength>0.05).length/Math.max(1,n));
    this.state.autonomousChoiceRate=clamp(this.state.records.filter(x=>x.autonomous).length/Math.max(1,n)); this.state.lastDecisionAt=record.at; return structuredClone(record);
  }
}
