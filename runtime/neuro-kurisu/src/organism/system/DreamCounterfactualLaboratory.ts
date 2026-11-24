/** BIG PASS 237 — sleep/recovery counterfactual rehearsal and promotion. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface DreamCandidate{id:string;domain:string;baseline01:number;counterfactual01:number;robustness01:number;promoted:boolean;at:number;}
export interface DreamCounterfactualState{version:1;cycles:number;rehearsals:number;promoted:number;meanRobustness01:number;candidates:DreamCandidate[];}
export const defaultDreamCounterfactual=():DreamCounterfactualState=>({version:1,cycles:0,rehearsals:0,promoted:0,meanRobustness01:.45,candidates:[]});
export class DreamCounterfactualLaboratory{
 private state=defaultDreamCounterfactual();restore(raw?:Partial<DreamCounterfactualState>|null){const d=defaultDreamCounterfactual(),r=raw??{};this.state={...d,...r,candidates:Array.isArray(r.candidates)?structuredClone(r.candidates).slice(0,96):[],version:1};}snapshot(){return structuredClone(this.state);}
 rehearse(input:{at:number;domain:string;prediction01:number;alternative01:number;uncertainty01:number;resource01:number}){const p=clamp(input.prediction01),a=clamp(input.alternative01),u=clamp(input.uncertainty01),r=clamp(input.resource01);const robustness=clamp(1-Math.abs(a-p)*.9-u*.38+r*.18);const promoted=robustness>.62&&r>.3;this.state.cycles++;this.state.rehearsals++;if(promoted)this.state.promoted++;this.state.meanRobustness01=clamp(this.state.meanRobustness01*.9+robustness*.1);const c:DreamCandidate={id:`dream:${this.state.cycles}:${input.domain}`,domain:input.domain,baseline01:p,counterfactual01:a,robustness01:robustness,promoted,at:input.at};this.state.candidates=[c,...this.state.candidates].slice(0,96);return c;}
 summary(){return{cycles:this.state.cycles,rehearsals:this.state.rehearsals,promoted:this.state.promoted,meanRobustness01:this.state.meanRobustness01,last:this.state.candidates[0]??null};}
}
