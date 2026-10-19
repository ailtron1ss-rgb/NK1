export type B306AutonomousDecisionEvidence = {
  tick:number;
  externalInput:boolean;
  autonomousAllowed:boolean;
  initiative01:number;
  agendaCreated:boolean;
  selectedAction:string|null;
  selectedKernelBias01:number;
  counterfactualSelectedScore01:number;
  counterfactualBestAlternativeScore01:number;
  counterfactualChanged:boolean;
  outcome01:number|null;
};

export type B306AutonomousInitiativeState = {
  version:1;
  decisions:number;
  eligibleAutonomousDecisions:number;
  causallyInfluencedDecisions:number;
  agendaCreations:number;
  outcomes:number;
  successfulCausalOutcomes:number;
  meanKernelBias01:number;
  meanInitiative01:number;
  meanCounterfactualMargin01:number;
  lesion01:number;
  recent:B306AutonomousDecisionEvidence[];
};

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));

export const defaultB306AutonomousInitiativeState=():B306AutonomousInitiativeState=>({
  version:1,
  decisions:0,
  eligibleAutonomousDecisions:0,
  causallyInfluencedDecisions:0,
  agendaCreations:0,
  outcomes:0,
  successfulCausalOutcomes:0,
  meanKernelBias01:0,
  meanInitiative01:0,
  meanCounterfactualMargin01:0,
  lesion01:0,
  recent:[],
});

export class B306AutonomousInitiativeVerificationLedger {
  private state=B306AutonomousInitiativeStateDefault();

  restore(raw?:Partial<B306AutonomousInitiativeState>|null){
    const d=B306AutonomousInitiativeStateDefault();
    const r=raw??{};
    this.state={
      ...d,
      ...r,
      version:1,
      lesion01:clamp01(Number(r.lesion01??d.lesion01)),
      recent:Array.isArray(r.recent)?r.recent.slice(-64).map((e:any)=>({
        ...e,
        initiative01:clamp01(Number(e?.initiative01??0)),
        selectedKernelBias01:clamp11(Number(e?.selectedKernelBias01??0)),
        counterfactualSelectedScore01:clamp11(Number(e?.counterfactualSelectedScore01??0)),
        counterfactualBestAlternativeScore01:clamp11(Number(e?.counterfactualBestAlternativeScore01??0)),
        outcome01:e?.outcome01==null?null:clamp01(Number(e.outcome01)),
      })):[],
    };
  }

  snapshot(){return structuredClone(this.state);}

  observeDecision(input:{
    tick:number; externalInput:boolean; autonomousAllowed:boolean; initiative01:number;
    agendaCreated:boolean; selectedAction:string|null; selectedKernelBias01:number;
    counterfactualSelectedScore01:number; counterfactualBestAlternativeScore01:number;
  }){
    const selected=clamp11(input.counterfactualSelectedScore01);
    const alternative=clamp11(input.counterfactualBestAlternativeScore01);
    const changed=Boolean(input.selectedAction)&&input.autonomousAllowed&&!input.externalInput&&(alternative>selected+.0005);
    const margin=clamp11(selected-alternative);
    this.state.decisions++;
    if(input.autonomousAllowed&&!input.externalInput) this.state.eligibleAutonomousDecisions++;
    if(changed) this.state.causallyInfluencedDecisions++;
    if(input.agendaCreated) this.state.agendaCreations++;
    this.state.meanKernelBias01=this.state.meanKernelBias01*.94+Math.abs(clamp11(input.selectedKernelBias01))*.06;
    this.state.meanInitiative01=this.state.meanInitiative01*.94+clamp01(input.initiative01)*.06;
    this.state.meanCounterfactualMargin01=this.state.meanCounterfactualMargin01*.94+margin*.06;
    this.state.recent=[...this.state.recent,{
      tick:input.tick,
      externalInput:Boolean(input.externalInput),
      autonomousAllowed:Boolean(input.autonomousAllowed),
      initiative01:clamp01(input.initiative01),
      agendaCreated:Boolean(input.agendaCreated),
      selectedAction:input.selectedAction??null,
      selectedKernelBias01:clamp11(input.selectedKernelBias01),
      counterfactualSelectedScore01:selected,
      counterfactualBestAlternativeScore01:alternative,
      counterfactualChanged:changed,
      outcome01:null,
    }].slice(-64);
    return {changed,margin01:margin,eligible:Boolean(input.autonomousAllowed&&!input.externalInput)};
  }

  observeOutcome(outcome01:number){
    const q=clamp01(outcome01);
    this.state.outcomes++;
    const last=this.state.recent[this.state.recent.length-1];
    if(last){
      last.outcome01=q;
      if(last.counterfactualChanged&&q>=.65) this.state.successfulCausalOutcomes++;
    }
  }

  lesion(fraction01=.5){this.state.lesion01=clamp01(fraction01);return this.state.lesion01;}
  clearLesion(){this.state.lesion01=0;}

  diagnostics(){
    const eligible=this.state.eligibleAutonomousDecisions;
    return {
      ...this.snapshot(),
      causalInfluenceRate01:eligible?this.state.causallyInfluencedDecisions/eligible:0,
      causalSuccessRate01:this.state.causallyInfluencedDecisions?this.state.successfulCausalOutcomes/this.state.causallyInfluencedDecisions:0,
      agendaCreationRate01:this.state.eligibleAutonomousDecisions?this.state.agendaCreations/this.state.eligibleAutonomousDecisions:0,
      autonomousDecisionRate01:this.state.decisions?this.state.eligibleAutonomousDecisions/this.state.decisions:0,
    };
  }
}

function B306AutonomousInitiativeStateDefault(){return defaultB306AutonomousInitiativeState();}
