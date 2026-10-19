import type { CognitiveFieldState, PressureType } from './CognitiveField.ts';
import type { PredictionDebtState } from '../system/PredictionDebt.ts';

export type CognitivePressureDomain='self'|'world'|'memory'|'agency'|'embodiment'|'research'|'governance';
export type CognitivePressureAction='respond'|'explore'|'verify'|'rest'|'reflect'|'wait'|'defer';

export interface CognitivePressureFieldState {
  version:1;
  total01:number;
  dominantType:PressureType|null;
  informationUrgency01:number;
  domains:Record<CognitivePressureDomain,number>;
  actionBias:Record<CognitivePressureAction,number>;
  sources:{count:number;unresolvedCount:number;agingPredictions:number;groundingUncertainty01:number;groundingConflict01:number;shadowDisagreement01:number;shadowEscalation01:number;externalObservationUnresolved01:number;externalContradiction01:number;externalVerificationRate01:number};
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const DOMAINS:CognitivePressureDomain[]=['self','world','memory','agency','embodiment','research','governance'];
const ACTIONS:CognitivePressureAction[]=['respond','explore','verify','rest','reflect','wait','defer'];
const TYPE_DOMAIN:Record<PressureType,CognitivePressureDomain>={
  'attention-debt':'memory', contradiction:'governance', commitment:'agency', 'prediction-error':'world', social:'agency', goal:'agency', curiosity:'research',
};
const defaultDomains=()=>Object.fromEntries(DOMAINS.map(d=>[d,0])) as Record<CognitivePressureDomain,number>;
const defaultActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<CognitivePressureAction,number>;
export const defaultCognitivePressureField=():CognitivePressureFieldState=>({version:1,total01:0,dominantType:null,informationUrgency01:0,domains:defaultDomains(),actionBias:defaultActions(),sources:{count:0,unresolvedCount:0,agingPredictions:0,groundingUncertainty01:.5,groundingConflict01:0,shadowDisagreement01:0,shadowEscalation01:0,externalObservationUnresolved01:0,externalContradiction01:0,externalVerificationRate01:0}});

export class CognitivePressureField {
  private state=defaultCognitivePressureField();

  compile(input:{field:CognitiveFieldState;predictionDebt:PredictionDebtState;grounding?:{uncertainty01?:number;conflict01?:number;confidence01?:number};externalObservation?:{unresolvedCount?:number;observations?:number;assessments?:number;contradictedCount?:number;verificationRate01?:number};goalPressure01:number;novelty01:number;predictionError01:number;energy01:number;thermal01:number;ramPressure01:number;shadow?:{disagreement01?:number;escalation?:boolean} }):CognitivePressureFieldState{
    const d=defaultDomains();
    const fieldRows=input.field.pressures.filter(p=>p.level>.03).slice(0,96);
    for(const p of fieldRows)d[TYPE_DOMAIN[p.type]]=clamp(d[TYPE_DOMAIN[p.type]] + p.level*.78);
    const extUnresolved01=clamp((input.externalObservation?.unresolvedCount??0)/Math.max(1,input.externalObservation?.observations??0));
    const extContradiction01=clamp((input.externalObservation?.contradictedCount??0)/Math.max(1,input.externalObservation?.assessments??1));
    const extVerificationRate01=clamp(input.externalObservation?.verificationRate01??0);
    d.world=clamp(d.world + input.predictionError01*.52 + (input.grounding?.uncertainty01??.5)*.28 + extUnresolved01*.22);
    d.governance=clamp(d.governance + extContradiction01*.30);
    d.research=clamp(d.research + extUnresolved01*.10);
    d.agency=clamp(d.agency + input.goalPressure01*.56);
    d.research=clamp(d.research + input.novelty01*.38 + (input.predictionDebt.agingCount>0?0.16:0));
    d.embodiment=clamp(d.embodiment + (1-input.energy01)*.34 + input.thermal01*.45 + input.ramPressure01*.22);
    d.memory=clamp(d.memory + input.field.attentionDebt01*.46);
    d.governance=clamp(d.governance + input.field.conflict01*.46 + (input.grounding?.conflict01??0)*.42 + (input.shadow?.disagreement01??0)*.16);
    d.world=clamp(d.world + (input.shadow?.disagreement01??0)*.18);
    d.research=clamp(d.research + (input.shadow?.escalation?0.10:0));
    d.self=clamp(d.self + (input.shadow?.disagreement01??0)*.12);
    const total=clamp(Math.max(...Object.values(d))*.72 + Object.values(d).reduce((s,v)=>s+v,0)/DOMAINS.length*.28);
    const dominantType=fieldRows.sort((a,b)=>b.level-a.level)[0]?.type ?? (input.predictionDebt.agingCount>0?'prediction-error':null);
    const actions=defaultActions();
    actions.verify=clamp(d.world*.42+d.governance*.22+input.predictionDebt.meanPriority01*.28+input.predictionDebt.agingCount*.08+(input.shadow?.disagreement01??0)*.10+extUnresolved01*.22+extContradiction01*.14);
    actions.explore=clamp(d.research*.52+input.novelty01*.20+(1-(input.grounding?.confidence01??.5))*.10);
    actions.reflect=clamp(d.memory*.26+d.self*.30+input.field.attentionDebt01*.28+(input.shadow?.escalation?0.06:0));
    actions.respond=clamp(input.field.socialPressure01*.52+d.agency*.12);
    actions.rest=clamp(d.embodiment*.72+(1-input.energy01)*.14);
    actions.wait=clamp(input.field.conflict01*.26+(input.grounding?.conflict01??0)*.25);
    actions.defer=clamp((input.thermal01*.38+input.ramPressure01*.28+(1-input.energy01)*.18));
    this.state={version:1,total01:total,dominantType,informationUrgency01:clamp(total*.58+input.predictionError01*.22+input.predictionDebt.agingCount*.06+input.goalPressure01*.14),domains:d,actionBias:actions,sources:{count:fieldRows.length,unresolvedCount:input.field.unresolvedCount,agingPredictions:input.predictionDebt.agingCount,groundingUncertainty01:clamp(input.grounding?.uncertainty01??.5),groundingConflict01:clamp(input.grounding?.conflict01??0),shadowDisagreement01:clamp(input.shadow?.disagreement01??0),shadowEscalation01:input.shadow?.escalation?1:0,externalObservationUnresolved01:extUnresolved01,externalContradiction01:extContradiction01,externalVerificationRate01:extVerificationRate01}};
    return this.snapshot();
  }
  snapshot(){return { ...this.state, domains:{...this.state.domains}, actionBias:{...this.state.actionBias}, sources:{...this.state.sources} };}
}
