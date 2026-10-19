/**
 * BIG PASS 209 — organism-level sparse compute governor.
 *
 * This is not a biological copy. It turns surprise, prediction error and
 * resource state into a bounded compute budget suitable for long-running
 * cognition on constrained devices.
 */
export interface ComputeGovernorInput { surprise01:number; predictionError01:number; uncertainty01:number; novelty01:number; salience01:number; bodyEnergy01:number; thermal01:number; cognitiveCapacity01:number; memoryPressure01:number; phoneMode?:boolean; tick:number; }
export interface ComputeGovernorPlan { budget01:number; sparsity01:number; workspaceScale01:number; maxCandidates:number; reason:string[]; estimatedWorkSaved01:number; }
export interface AdaptiveComputeState { version:1; cycles:number; lowBudgetCycles:number; highBudgetCycles:number; estimatedWorkSaved01:number; meanBudget01:number; meanSparsity01:number; lastPlan:ComputeGovernorPlan|null; }

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export const defaultAdaptiveComputeState=():AdaptiveComputeState=>({version:1,cycles:0,lowBudgetCycles:0,highBudgetCycles:0,estimatedWorkSaved01:0,meanBudget01:.72,meanSparsity01:.28,lastPlan:null});

export class AdaptiveComputeGovernor {
  private state=defaultAdaptiveComputeState();
  restore(raw?:Partial<AdaptiveComputeState>|null){ const d=defaultAdaptiveComputeState(),r=raw??{}; this.state={...d,...r,lastPlan:r.lastPlan?structuredClone(r.lastPlan):null,version:1}; }
  snapshot(){return structuredClone(this.state);}

  plan(input:ComputeGovernorInput):ComputeGovernorPlan{
    const surprise=clamp(input.surprise01), pe=clamp(input.predictionError01), u=clamp(input.uncertainty01), n=clamp(input.novelty01), s=clamp(input.salience01);
    const energy=clamp(input.bodyEnergy01), thermal=clamp(input.thermal01), cap=clamp(input.cognitiveCapacity01), mp=clamp(input.memoryPressure01);
    const periodicBoost=(input.tick%17===0)?.03:0;
    const demand=clamp(.22+surprise*.22+pe*.18+u*.14+n*.10+s*.08+periodicBoost);
    const resource=clamp(energy*.34+cap*.36+(1-thermal)*.18+(1-mp)*.12);
    const budget=clamp(.18+demand*.52+resource*.30);
    const scarcity=clamp((1-resource)*.55+thermal*.18+mp*.12);
    const sparsity=clamp(.10+scarcity*.65+(1-demand)*.22-(input.phoneMode?0:.08));
    const workspaceScale=clamp(1-sparsity*.46);
    const maxCandidates=Math.max(2,Math.min(12,Math.round(12-10*sparsity)));
    const reasons:string[]=[];
    if(surprise>.55||pe>.55) reasons.push('prediction-error-priority');
    if(u>.62||n>.62) reasons.push('uncertainty-novelty');
    if(thermal>.65) reasons.push('thermal-protection');
    if(energy<.35) reasons.push('energy-protection');
    if(mp>.70) reasons.push('memory-pressure');
    if(!reasons.length) reasons.push('steady-state-sparse-compute');
    const estimatedWorkSaved=clamp(sparsity*.52);
    const plan={budget01:budget,sparsity01:sparsity,workspaceScale01:workspaceScale,maxCandidates,reason:reasons,estimatedWorkSaved01:estimatedWorkSaved};
    this.state.cycles++; if(budget<.42)this.state.lowBudgetCycles++; if(budget>.76)this.state.highBudgetCycles++;
    this.state.meanBudget01=clamp(this.state.meanBudget01*.95+budget*.05);
    this.state.meanSparsity01=clamp(this.state.meanSparsity01*.95+sparsity*.05);
    this.state.estimatedWorkSaved01=clamp(this.state.estimatedWorkSaved01*.95+estimatedWorkSaved*.05);
    this.state.lastPlan=structuredClone(plan);
    return structuredClone(plan);
  }
  diagnostics(){return structuredClone(this.state);}
}
