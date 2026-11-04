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
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const sanPlan=(x:unknown):ComputeGovernorPlan|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {budget01:clamp(finN(r.budget01,0)),sparsity01:clamp(finN(r.sparsity01,0)),workspaceScale01:clamp(finN(r.workspaceScale01,0)),maxCandidates:Math.max(2,Math.min(12,Math.round(finN(r.maxCandidates,2)))),reason:strArr(r.reason,16),estimatedWorkSaved01:clamp(finN(r.estimatedWorkSaved01,0))};};

export const defaultAdaptiveComputeState=():AdaptiveComputeState=>({version:1,cycles:0,lowBudgetCycles:0,highBudgetCycles:0,estimatedWorkSaved01:0,meanBudget01:.72,meanSparsity01:.28,lastPlan:null});

export class AdaptiveComputeGovernor {
  private state=defaultAdaptiveComputeState();
  restore(raw?:Partial<AdaptiveComputeState>|null){ const d=defaultAdaptiveComputeState(); const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{}; const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}}; this.state={version:1,cycles:cnt(read('cycles'),d.cycles),lowBudgetCycles:cnt(read('lowBudgetCycles'),d.lowBudgetCycles),highBudgetCycles:cnt(read('highBudgetCycles'),d.highBudgetCycles),estimatedWorkSaved01:clamp(finN(read('estimatedWorkSaved01'),d.estimatedWorkSaved01)),meanBudget01:clamp(finN(read('meanBudget01'),d.meanBudget01)),meanSparsity01:clamp(finN(read('meanSparsity01'),d.meanSparsity01)),lastPlan:sanPlan(read('lastPlan'))}; }
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
