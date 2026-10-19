export type CognitiveMode='reflex'|'shallow'|'retrieve'|'deep'|'simulate'|'defer'|'sleep';
export type CognitiveOperation='sensor'|'memory'|'reflection'|'planning'|'simulation'|'llm-fast'|'llm-deep'|'research'|'persistence'|'other';
export interface CognitiveBudgetState{mode:CognitiveMode;available01:number;estimatedCost01:number;expectedInformationGain01:number;rationale:string;updatedAt:number;spent01:number;remaining01:number;operationCount:number;informationGainRealized01:number;lastOperation?:CognitiveOperation;}
export interface CognitiveBudgetLedgerEntry{at:number;tick:number;operation:CognitiveOperation;estimatedCost01:number;spent01:number;informationGain01:number;accepted:boolean;mode:CognitiveMode;reason:string;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultCognitiveBudget=():CognitiveBudgetState=>({mode:'shallow',available01:.78,estimatedCost01:.2,expectedInformationGain01:.2,rationale:'default',updatedAt:0,spent01:0,remaining01:.78,operationCount:0,informationGainRealized01:0});

export class CognitiveBudgetManager{
 private state=defaultCognitiveBudget();
 private ledger:CognitiveBudgetLedgerEntry[]=[];
 restore(s:(CognitiveBudgetState&{ledger?:CognitiveBudgetLedgerEntry[]})|undefined){this.state={...defaultCognitiveBudget(),...(s??{})}; this.state.remaining01=clamp(this.state.remaining01 ?? (this.state.available01-this.state.spent01)); this.ledger=Array.isArray(s?.ledger)?s!.ledger.slice(-128):[];}
 decide(input:{battery01:number;thermal01:number;ramPressure01:number;cpuLoad01:number;attention01:number;expectedInformationGain01:number;complexity01:number;sleepPressure01:number}):CognitiveBudgetState{
  const available=clamp(input.battery01*.35+input.attention01*.25+(1-input.thermal01)*.18+(1-input.ramPressure01)*.12+(1-input.cpuLoad01)*.10);
  const cost=clamp(input.complexity01*.55+input.expectedInformationGain01*.18+input.thermal01*.14+input.ramPressure01*.13);
  let mode:CognitiveMode='shallow'; let rationale='balanced cognitive budget';
  if(input.sleepPressure01>.84||available<.18){mode='sleep';rationale='resource preservation';}
  else if(cost<.22&&input.expectedInformationGain01<.28){mode='reflex';rationale='cheap response sufficient';}
  else if(input.expectedInformationGain01>.76&&available>.52&&cost<.72){mode='simulate';rationale='high expected information gain justifies simulation';}
  else if(input.complexity01>.62&&available>.48&&input.thermal01<.7){mode='deep';rationale='complexity justifies deeper reasoning';}
  else if(input.expectedInformationGain01>.42){mode='retrieve';rationale='retrieval likely cheaper than new reasoning';}
  else if(available<.36||cost>.78){mode='defer';rationale='resource pressure exceeds immediate value';}
  this.state={...this.state,mode,available01:available,estimatedCost01:cost,expectedInformationGain01:clamp(input.expectedInformationGain01),rationale,updatedAt:Date.now(),spent01:0,remaining01:available,operationCount:0,informationGainRealized01:0,lastOperation:undefined};
  return this.snapshot();
 }
 estimateCost(operation:CognitiveOperation,context:{complexity01?:number;thermal01?:number;ramPressure01?:number;network01?:number}={}):number{
  const base:Record<CognitiveOperation,number>={sensor:.015,memory:.025,reflection:.07,planning:.10,simulation:.18,'llm-fast':.22,'llm-deep':.48,research:.65,persistence:.045,other:.08};
  const complexity=clamp(context.complexity01??0.35), thermal=clamp(context.thermal01??0.2), ram=clamp(context.ramPressure01??0.2), network=clamp(context.network01??0.2);
  return clamp((base[operation]??.08)*(0.75+complexity*.45)*(1+thermal*.35+ram*.25)*(operation.startsWith('llm')&&network<.5?1.12:1));
 }
 spend(operation:CognitiveOperation,estimatedCost01?:number,informationGain01=0,meta:{tick?:number;reason?:string}={}):{accepted:boolean;spent01:number;remaining01:number;reason:string}{
  const cost=clamp(estimatedCost01 ?? this.estimateCost(operation));
  const reserve=this.state.mode==='sleep'?0.06:this.state.mode==='defer'?0.03:0;
  const accepted=this.state.remaining01 >= cost+reserve;
  const spent=accepted?cost:0;
  const reason=accepted?'budget-accepted':`budget-rejected:${this.state.mode}`;
  if(accepted){this.state.spent01=clamp(this.state.spent01+spent);this.state.remaining01=clamp(this.state.remaining01-spent);this.state.operationCount+=1;this.state.informationGainRealized01=clamp(this.state.informationGainRealized01*(this.state.operationCount-1)/Math.max(1,this.state.operationCount)+clamp(informationGain01)/Math.max(1,this.state.operationCount));this.state.lastOperation=operation;}
  this.ledger.unshift({at:Date.now(),tick:Math.max(0,Math.floor(meta.tick??0)),operation,estimatedCost01:cost,spent01:spent,informationGain01:clamp(informationGain01),accepted,mode:this.state.mode,reason:meta.reason??reason});
  this.ledger=this.ledger.slice(0,128);
  return {accepted,spent01:spent,remaining01:this.state.remaining01,reason};
 }
 canSpend(operation:CognitiveOperation,estimatedCost01?:number):boolean{const cost=clamp(estimatedCost01 ?? this.estimateCost(operation));const reserve=this.state.mode==='sleep'?0.06:this.state.mode==='defer'?0.03:0;return this.state.remaining01>=cost+reserve;}
 snapshot(){return {...this.state,ledger:this.ledger.map(x=>({...x}))};}
 ledgerSnapshot(){return this.ledger.map(x=>({...x}));}
}
