/**
 * BIG PASS 208 — computational basal-ganglia analogue.
 *
 * This is intentionally an implementation-facing control circuit, not a claim
 * of anatomical equivalence. It exposes explicit direct / indirect /
 * hyperdirect-like contributions, dopamine-gated plasticity and a reversible
 * lesion mode so the causal contribution of the circuit can be tested.
 */

export interface BasalGangliaCandidate {
  action:string;
  corticalValue01:number;
  predictedUtility01?:number;
  confidence01?:number;
  effort01?:number;
  conflict01?:number;
  goalFit01?:number;
  novelty01?:number;
}

export interface BasalGangliaRouteInput {
  candidates:BasalGangliaCandidate[];
  dopamine01:number;
  uncertainty01:number;
  conflict01:number;
  goalPressure01:number;
  cognitiveCapacity01:number;
  novelty01:number;
  tick:number;
}

export interface BasalGangliaActionFrame {
  action:string;
  direct01:number;
  indirect01:number;
  hyperdirect01:number;
  netSelection01:number;
  gate01:number;
  learnedBias01:number;
  confidence01:number;
}

export interface BasalGangliaFrame {
  version:1;
  tick:number;
  dopamine01:number;
  selectedAction:string|null;
  selectionMargin01:number;
  conflict01:number;
  directPopulation01:number;
  indirectPopulation01:number;
  hyperdirectBrake01:number;
  lesionApplied:boolean;
  actions:BasalGangliaActionFrame[];
}

export interface BasalGangliaState {
  version:1;
  cycles:number;
  selections:number;
  outcomeUpdates:number;
  blockedSelections:number;
  lesionCycles:number;
  dopamineMean01:number;
  conflictMean01:number;
  actionValues:Record<string,number>;
  actionVisits:Record<string,number>;
  eligibility:Record<string,number>;
  lastFrame:BasalGangliaFrame|null;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));

export const defaultBasalGangliaState=():BasalGangliaState=>({
  version:1,cycles:0,selections:0,outcomeUpdates:0,blockedSelections:0,lesionCycles:0,
  dopamineMean01:.5,conflictMean01:.2,actionValues:{},actionVisits:{},eligibility:{},lastFrame:null,
});

export class BasalGangliaSelectionCircuit {
  private state=defaultBasalGangliaState();
  private lesion=false;

  setLesion(enabled:boolean){ this.lesion=Boolean(enabled); }
  lesionActive(){ return this.lesion; }

  restore(raw?:Partial<BasalGangliaState>|null){
    const d=defaultBasalGangliaState(),r=raw??{};
    this.state={
      ...d,...r,version:1,
      actionValues:{...(r.actionValues??{})},
      actionVisits:{...(r.actionVisits??{})},
      eligibility:{...(r.eligibility??{})},
      lastFrame:r.lastFrame?structuredClone(r.lastFrame):null,
    };
    this.lesion=false;
  }

  snapshot():BasalGangliaState{return structuredClone(this.state);}

  route(input:BasalGangliaRouteInput):BasalGangliaFrame{
    const dopamine=clamp(input.dopamine01), uncertainty=clamp(input.uncertainty01), conflict=clamp(input.conflict01);
    const goalPressure=clamp(input.goalPressure01), capacity=clamp(input.cognitiveCapacity01), novelty=clamp(input.novelty01);
    const rows=(input.candidates??[]).slice(0,16).map(candidate=>{
      const value=clamp(candidate.corticalValue01);
      const utility=clamp(candidate.predictedUtility01??value);
      const confidence=clamp(candidate.confidence01??.5);
      const effort=clamp(candidate.effort01??.3);
      const localConflict=clamp(candidate.conflict01??conflict);
      const goalFit=clamp(candidate.goalFit01??goalPressure);
      const localNovelty=clamp(candidate.novelty01??novelty);
      const learned=signed(this.state.actionValues[candidate.action]??0);

      // Direct-pathway-like go signal: favours cortical value, goal fit,
      // confidence and positive dopaminergic gain.
      const direct=clamp(.46*value + .18*utility + .14*goalFit + .08*confidence + .10*dopamine + .04*(1-effort) + .05*learned);
      // Indirect-pathway-like suppression: conflict, effort and uncertainty
      // oppose commitment; lower dopamine increases the brake.
      const indirect=clamp(.28*(1-value) + .24*localConflict + .16*effort + .14*uncertainty + .10*(1-dopamine) + .05*(1-capacity) + .04*(1-confidence));
      // Hyperdirect-like rapid brake: a separate conflict-sensitive stop
      // signal that can dominate when commitment would be premature.
      const hyperdirect=clamp(.48*localConflict + .22*uncertainty + .12*(1-confidence) + .10*(1-capacity) + .08*(1-dopamine));
      const net=clamp(.5 + (direct-indirect-hyperdirect)*.82 + localNovelty*.03);
      const gate=this.lesion ? clamp(.49 + (value-.5)*.04) : net;
      return {action:String(candidate.action),direct01:direct,indirect01:indirect,hyperdirect01:hyperdirect,netSelection01:net,gate01:gate,learnedBias01:learned,confidence01:confidence};
    });

    rows.sort((a,b)=>b.gate01-a.gate01);
    const selected=rows[0]??null, second=rows[1]??null;
    const margin=selected?clamp(selected.gate01-(second?.gate01??0)):0;
    const directMean=rows.length?rows.reduce((s,r)=>s+r.direct01,0)/rows.length:0;
    const indirectMean=rows.length?rows.reduce((s,r)=>s+r.indirect01,0)/rows.length:0;
    const hyperdirectMean=rows.length?rows.reduce((s,r)=>s+r.hyperdirect01,0)/rows.length:0;

    this.state.cycles++;
    if(this.lesion)this.state.lesionCycles++;
    if(selected)this.state.selections++; else this.state.blockedSelections++;
    this.state.dopamineMean01=clamp(this.state.dopamineMean01*.97+dopamine*.03);
    this.state.conflictMean01=clamp(this.state.conflictMean01*.97+conflict*.03);
    if(selected && !this.lesion){
      this.state.eligibility[selected.action]=clamp((this.state.eligibility[selected.action]??0)*.78+.32*selected.confidence01);
    }
    const frame:BasalGangliaFrame={
      version:1,tick:Math.max(0,Math.floor(input.tick)),dopamine01:dopamine,selectedAction:selected?.action??null,
      selectionMargin01:margin,conflict01:conflict,directPopulation01:directMean,indirectPopulation01:indirectMean,
      hyperdirectBrake01:hyperdirectMean,lesionApplied:this.lesion,actions:rows,
    };
    this.state.lastFrame=structuredClone(frame);
    return structuredClone(frame);
  }

  recordOutcome(action:string,reward01:number,surprise01:number,tick:number,dopamine01:number){
    const key=String(action), reward=signed(clamp(reward01)-.5)*2, surprise=clamp(surprise01), dopamine=clamp(dopamine01);
    const eligibility=clamp(this.state.eligibility[key]??0);
    const learningRate=.012+.028*dopamine+.016*surprise;
    const delta=reward*eligibility*learningRate;
    this.state.actionValues[key]=Math.max(-1,Math.min(1,(this.state.actionValues[key]??0)+delta));
    this.state.actionVisits[key]=(this.state.actionVisits[key]??0)+1;
    this.state.eligibility[key]=clamp(eligibility*.58);
    this.state.outcomeUpdates++;
    return {action:key,delta,actionValue:this.state.actionValues[key],eligibility};
  }

  actionBias(action:string){ return signed(this.state.actionValues[action]??0)*.08; }
  diagnostics(){
    const values=Object.entries(this.state.actionValues).sort((a,b)=>b[1]-a[1]);
    return {cycles:this.state.cycles,selections:this.state.selections,outcomeUpdates:this.state.outcomeUpdates,blockedSelections:this.state.blockedSelections,
      lesionCycles:this.state.lesionCycles,dopamineMean01:this.state.dopamineMean01,conflictMean01:this.state.conflictMean01,
      learnedAction:values[0]?.[0]??null,learnedBias01:values[0]?.[1]??0,actionCount:values.length,lastSelection:this.state.lastFrame?.selectedAction??null};
  }
}
