/**
 * BIG PASS 218 — distributed motor-learning loop.
 *
 * Engineering goal: fuse fast cerebellar forward prediction with basal-ganglia
 * outcome/reinforcement signals into a persistent, low-cost skill trace.
 * This is a computational abstraction, not an anatomical equivalence claim.
 */
export interface MotorLoopInput {
  action:string;
  predictedUtility01:number;
  cerebellarForwardError01:number;
  cerebellarCorrection01:number;
  basalGangliaGate01:number;
  reward01:number;
  surprise01:number;
  energy01:number;
  cognitiveCapacity01:number;
  tick:number;
}
export interface MotorLoopActionState {
  skill01:number;
  meanError01:number;
  rewardEMA01:number;
  correctionEMA01:number;
  credit01:number;
  samples:number;
  lastTick:number;
}
export interface MotorLoopFrame {
  version:1;
  tick:number;
  action:string;
  motorGain01:number;
  predictedUtility01:number;
  error01:number;
  reinforcement01:number;
  learningCredit01:number;
  sparseUpdate:boolean;
}
export interface MotorLoopState {
  version:1;
  cycles:number;
  outcomeUpdates:number;
  sparseSkips:number;
  meanError01:number;
  meanSkill01:number;
  actionModels:Record<string,MotorLoopActionState>;
  lastFrame:MotorLoopFrame|null;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
export const defaultMotorLoopState=():MotorLoopState=>({version:1,cycles:0,outcomeUpdates:0,sparseSkips:0,meanError01:.5,meanSkill01:.5,actionModels:{},lastFrame:null});

export class CerebellarBasalGangliaMotorLoop {
  private state=defaultMotorLoopState();
  private lesion=false;
  setLesion(enabled:boolean){this.lesion=Boolean(enabled);}
  lesionActive(){return this.lesion;}
  restore(raw?:Partial<MotorLoopState>|null){
    const d=defaultMotorLoopState(),r=raw??{};
    const models=Object.fromEntries(Object.entries(r.actionModels??{}).map(([k,v]:any)=>[k,{
      skill01:clamp(v?.skill01??.5),meanError01:clamp(v?.meanError01??.5),rewardEMA01:clamp(v?.rewardEMA01??.5),
      correctionEMA01:signed(v?.correctionEMA01??0),credit01:clamp(v?.credit01??0),samples:Math.max(0,Math.floor(v?.samples??0)),lastTick:Math.max(0,Math.floor(v?.lastTick??0))
    }]));
    this.state={...d,...r,version:1,actionModels:models,lastFrame:r.lastFrame?structuredClone(r.lastFrame):null};
    this.lesion=false;
  }
  snapshot(){return structuredClone(this.state);}
  modulate(action:string,baseline01:number){
    const model=this.state.actionModels[String(action)];
    if(this.lesion||!model)return clamp(baseline01);
    const gain=.96 + model.skill01*.06 + model.rewardEMA01*.03 - model.meanError01*.05;
    return clamp(baseline01*gain + model.correctionEMA01*.035);
  }
  observe(input:MotorLoopInput):MotorLoopFrame{
    const action=String(input.action), error=clamp(input.cerebellarForwardError01), reward=clamp(input.reward01);
    const surprise=clamp(input.surprise01), bg=clamp(input.basalGangliaGate01), energy=clamp(input.energy01), capacity=clamp(input.cognitiveCapacity01);
    const expected=clamp(input.predictedUtility01), correction=signed(input.cerebellarCorrection01);
    const updatePressure=clamp(.14 + error*.30 + surprise*.24 + (1-bg)*.10 + (1-energy)*.06 + (1-capacity)*.05);
    const sparseThreshold=.18;
    const sparseUpdate=!this.lesion && updatePressure>=sparseThreshold;
    if(!sparseUpdate)this.state.sparseSkips++;
    const old=this.state.actionModels[action]??{skill01:.5,meanError01:.5,rewardEMA01:.5,correctionEMA01:0,credit01:0,samples:0,lastTick:input.tick};
    if(sparseUpdate){
      const lr=.025 + updatePressure*.10;
      const targetSkill=clamp((1-error)*.55 + reward*.35 + bg*.10);
      const signedCorrection=signed(correction);
      this.state.actionModels[action]={
        skill01:clamp(old.skill01*(1-lr)+targetSkill*lr),
        meanError01:clamp(old.meanError01*(1-lr)+error*lr),
        rewardEMA01:clamp(old.rewardEMA01*.92+reward*.08),
        correctionEMA01:signed(old.correctionEMA01*(1-lr*.6)+signedCorrection*(lr*.6)),
        credit01:clamp(old.credit01*.86+updatePressure*.14),samples:old.samples+1,lastTick:Math.max(0,Math.floor(input.tick))
      };
      this.state.outcomeUpdates++;
    }
    this.state.cycles++;
    const model=this.state.actionModels[action]??old;
    const motorGain=this.modulate(action,clamp(.86 + (1-error)*.10 + bg*.04));
    this.state.meanError01=clamp(this.state.meanError01*.94+error*.06);
    this.state.meanSkill01=clamp(this.state.meanSkill01*.94+model.skill01*.06);
    const frame:MotorLoopFrame={version:1,tick:Math.max(0,Math.floor(input.tick)),action,motorGain01:motorGain,predictedUtility01:expected,error01:error,reinforcement01:clamp(reward*.58+bg*.32+surprise*.10),learningCredit01:model.credit01,sparseUpdate};
    this.state.lastFrame=structuredClone(frame);
    return structuredClone(frame);
  }
  diagnostics(){
    const entries=Object.entries(this.state.actionModels);
    const best=entries.sort((a,b)=>b[1].skill01-a[1].skill01)[0];
    return {cycles:this.state.cycles,outcomeUpdates:this.state.outcomeUpdates,sparseSkips:this.state.sparseSkips,meanError01:this.state.meanError01,meanSkill01:this.state.meanSkill01,bestAction:best?.[0]??null,bestSkill01:best?.[1].skill01??null,actionCount:entries.length};
  }
}
