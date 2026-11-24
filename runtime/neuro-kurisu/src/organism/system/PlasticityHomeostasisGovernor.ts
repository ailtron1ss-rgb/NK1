/** BIG PASS 235 — stability/plasticity governor for the hybrid neural substrate. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface PlasticityHomeostasisState{
 version:1; cycles:number; plasticity01:number; stability01:number; freeze01:number; decay01:number;
 targetActivity01:number; lastPressure01:number;
}
export const defaultPlasticityHomeostasis=():PlasticityHomeostasisState=>({version:1,cycles:0,plasticity01:.58,stability01:.72,freeze01:.08,decay01:.04,targetActivity01:.18,lastPressure01:0});
export class PlasticityHomeostasisGovernor{
 private state=defaultPlasticityHomeostasis();
 restore(raw?:Partial<PlasticityHomeostasisState>|null){
  const d=defaultPlasticityHomeostasis(),r=raw??{}; this.state={...d,...r,version:1};
 }
 snapshot(){return structuredClone(this.state);}
 regulate(input:{surprise01:number;energy01:number;thermal01:number;memoryLoad01:number;goalPressure01:number}){
  const p=clamp(input.surprise01*.38+(1-input.energy01)*.18+clamp(input.thermal01)*.22+clamp(input.memoryLoad01)*.12+clamp(input.goalPressure01)*.1);
  const desired=clamp(.78-p*.6);
  const plasticity=clamp(.18+clamp(input.surprise01)*.5+clamp(input.energy01)*.2-clamp(input.thermal01)*.32);
  this.state.cycles++;
  this.state.lastPressure01=p;
  this.state.plasticity01=clamp(this.state.plasticity01*.82+plasticity*.18);
  this.state.stability01=clamp(this.state.stability01*.84+desired*.16);
  this.state.freeze01=clamp((p-.58)*1.8);
  this.state.decay01=clamp(.02+(1-this.state.stability01)*.12);
  this.state.targetActivity01=clamp(.12+this.state.plasticity01*.12);
  return{plasticity01:this.state.plasticity01,stability01:this.state.stability01,freeze01:this.state.freeze01,decay01:this.state.decay01,targetActivity01:this.state.targetActivity01,pressure01:p};
 }
 summary(){return structuredClone(this.state);}
}
