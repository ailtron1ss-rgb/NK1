export interface NeuromodulationInput {
  rewardPredictionError: number;
  novelty: number;
  uncertainty: number;
  cognitiveLoad: number;
  socialNeed: number;
  sleepPressure: number;
  bodyEnergy: number;
}

export interface NeuromodulationState {
  dopamine01: number;
  norepinephrine01: number;
  acetylcholine01: number;
  serotonin01: number;
  explorationBias01: number;
  exploitationBias01: number;
  attentionGain01: number;
  updateRate01: number;
}

const clamp=(v:number)=>Math.max(0,Math.min(1,v));

/** Functional control signals inspired by neuromodulatory roles; not a biological simulation. */
export class NeuromodulationSystem {
  private state: NeuromodulationState = { dopamine01:.5,norepinephrine01:.42,acetylcholine01:.55,serotonin01:.58,explorationBias01:.5,exploitationBias01:.5,attentionGain01:.65,updateRate01:.35 };
  update(input: NeuromodulationInput): NeuromodulationState {
    const rpe=clamp(input.rewardPredictionError), nov=clamp(input.novelty), unc=clamp(input.uncertainty), load=clamp(input.cognitiveLoad), social=clamp(input.socialNeed), sleep=clamp(input.sleepPressure), energy=clamp(input.bodyEnergy);
    this.state.dopamine01=clamp(this.state.dopamine01*.78 + (0.5 + (rpe-.5)*.9 + nov*.25)*.22);
    this.state.norepinephrine01=clamp(this.state.norepinephrine01*.78 + (unc*.7 + load*.35 + .12)*.22);
    this.state.acetylcholine01=clamp(this.state.acetylcholine01*.8 + ((1-load)*.5 + nov*.4 + energy*.15)*.2);
    this.state.serotonin01=clamp(this.state.serotonin01*.84 + ((1-social)*.35 + energy*.25 + (1-sleep)*.2)*.16);
    this.state.explorationBias01=clamp(.25 + nov*.42 + unc*.28 + (1-this.state.dopamine01)*.08);
    this.state.exploitationBias01=clamp(1-this.state.explorationBias01);
    this.state.attentionGain01=clamp(.4 + this.state.norepinephrine01*.32 + this.state.acetylcholine01*.28 - load*.2);
    this.state.updateRate01=clamp(.12 + this.state.dopamine01*.24 + this.state.acetylcholine01*.22 + nov*.16);
    return this.snapshot();
  }
  restore(state: NeuromodulationState | undefined): void { if (state) this.state={...this.state,...state}; }
  snapshot(): NeuromodulationState { return structuredClone(this.state); }
}
