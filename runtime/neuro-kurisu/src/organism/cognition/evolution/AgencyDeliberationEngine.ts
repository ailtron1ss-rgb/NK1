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
const boundedText=(value:unknown,max:number,fallback='')=>typeof value==='string'?value.trim().slice(0,max):fallback;
const safeTime=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;

function normalizeRecord(value:unknown):AgencyDecisionRecord|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const item=value as Record<string,unknown>;
  const id=boundedText(item.id,128);
  const chosenAction=boundedText(item.chosenAction,96);
  const at=safeTime(item.at);
  if(!id||!chosenAction||at===0||typeof item.autonomous!=='boolean')return null;
  const requestedAction=item.requestedAction===null?null:boundedText(item.requestedAction,96);
  return {
    id,at,requestedAction,
    chosenAction,
    autonomous:item.autonomous,
    overrideStrength:clamp(typeof item.overrideStrength==='number'?item.overrideStrength:0),
    externalPressure:clamp(typeof item.externalPressure==='number'?item.externalPressure:0),
    intrinsicPressure:clamp(typeof item.intrinsicPressure==='number'?item.intrinsicPressure:0),
    reason:boundedText(item.reason,240,'restored decision'),
    counterfactual:boundedText(item.counterfactual,320,'Counterfactual unavailable.'),
  };
}

export function defaultAgencyDeliberation():AgencyDeliberationState {
  return {version:1,records:[],overrideRate:0,autonomousChoiceRate:0,lastDecisionAt:0};
}

/**
 * Decision history is evidence, not authority: restored aggregate rates are
 * recomputed from validated records and never trusted as persisted counters.
 * An injectable clock makes ordering and identity reproducible in tests.
 */
export class AgencyDeliberationEngine {
  private state=defaultAgencyDeliberation();
  private sequence=0;
  private readonly now:()=>number;

  constructor(now:()=>number=Date.now){this.now=now;}

  restore(value:AgencyDeliberationState|undefined):void {
    if(!value||value.version!==1||!Array.isArray(value.records)) {
      this.state=defaultAgencyDeliberation();
      this.sequence=0;
      return;
    }
    const byId=new Map<string,AgencyDecisionRecord>();
    for(const raw of value.records) {
      const record=normalizeRecord(raw);
      if(record&&!byId.has(record.id))byId.set(record.id,record);
    }
    const records=[...byId.values()].sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id)).slice(0,512);
    const count=records.length;
    this.state={
      version:1,
      records,
      overrideRate:clamp(records.filter(record=>record.overrideStrength>0.05).length/Math.max(1,count)),
      autonomousChoiceRate:clamp(records.filter(record=>record.autonomous).length/Math.max(1,count)),
      lastDecisionAt:records[0]?.at??0,
    };
    this.sequence=records.reduce((max,record)=>{
      const match=/^agency-\d+-(\d+)$/.exec(record.id);
      return match?Math.max(max,Number(match[1])||0):max;
    },records.length);
  }

  snapshot():AgencyDeliberationState{return structuredClone(this.state);}

  record(input:{
    requestedAction:string|null;
    chosenAction:string;
    externalPressure:number;
    intrinsicPressure:number;
    reason:string;
    autonomous:boolean;
  }):AgencyDecisionRecord {
    const chosenAction=boundedText(input?.chosenAction,96);
    if(!chosenAction)throw new TypeError('chosenAction must be a non-empty string');
    if(typeof input.autonomous!=='boolean')throw new TypeError('autonomous must be boolean');
    const requestedAction=input.requestedAction===null?null:boundedText(input.requestedAction,96);
    const external=clamp(input.externalPressure);
    const intrinsic=clamp(input.intrinsicPressure);
    const override=requestedAction&&chosenAction!==requestedAction
      ?clamp(0.45+intrinsic*0.4-external*0.15):0;
    const clockValue=this.now();
    const at=Number.isSafeInteger(clockValue)&&clockValue>0
      ?Math.max(clockValue,this.state.lastDecisionAt)
      :Math.max(1,this.state.lastDecisionAt+1);
    const existingIds=new Set(this.state.records.map(record=>record.id));
    let id:string;
    do { this.sequence+=1; id=`agency-${at}-${this.sequence}`; } while(existingIds.has(id));
    const record:AgencyDecisionRecord={
      id,at,requestedAction,chosenAction,autonomous:input.autonomous,
      overrideStrength:Number(override.toFixed(3)),
      externalPressure:external,
      intrinsicPressure:intrinsic,
      reason:boundedText(input.reason,240,'unspecified decision'),
      counterfactual:requestedAction
        ?`Если внешний запрос был бы единственным сигналом, действие было бы ${requestedAction}.`
        :'Внешнего запроса не было; действие возникло из внутреннего состояния.',
    };
    this.state.records=[record,...this.state.records].slice(0,512);
    const n=this.state.records.length;
    this.state.overrideRate=clamp(this.state.records.filter(item=>item.overrideStrength>0.05).length/Math.max(1,n));
    this.state.autonomousChoiceRate=clamp(this.state.records.filter(item=>item.autonomous).length/Math.max(1,n));
    this.state.lastDecisionAt=record.at;
    return structuredClone(record);
  }
}
