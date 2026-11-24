const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NeuralMorphConstraintState{version:1;cycles:number;feasible01:number;growth01:number;prune01:number;rewire01:number;resourceDebt01:number;violations:number;}
export const defaultNeuralMorphConstraint=():NeuralMorphConstraintState=>({version:1,cycles:0,feasible01:.8,growth01:.25,prune01:.15,rewire01:.12,resourceDebt01:.08,violations:0});
export class NeuralMorphogeneticConstraintSolver{
 private state=defaultNeuralMorphConstraint();
 restore(raw?:Partial<NeuralMorphConstraintState>|null){const d=defaultNeuralMorphConstraint(),r=raw??{};this.state={...d,...r,version:1};}
 snapshot(){return structuredClone(this.state);}
 solve(input:{demand01:number;energy01:number;stability01:number;plasticity01:number;uncertainty01:number}){
  const s=this.state,d=clamp(input.demand01),e=clamp(input.energy01),st=clamp(input.stability01),p=clamp(input.plasticity01),u=clamp(input.uncertainty01);
  const feasible=clamp(e*.45+st*.3+p*.15+(1-u)*.1);const growth=clamp(d*.58+p*.28+u*.14)*feasible;const prune=clamp((1-d)*.48+(1-e)*.35+(1-st)*.17);const rewire=clamp(u*.45+d*.3+p*.25)*feasible;const debt=clamp((growth*.45+rewire*.3-prune*.12)-e*.25);
  if(feasible<.25)s.violations++;s.cycles++;s.feasible01=feasible;s.growth01=growth;s.prune01=prune;s.rewire01=rewire;s.resourceDebt01=debt;
  return {feasible01:feasible,growth01:growth,prune01:prune,rewire01:rewire,resourceDebt01:debt,allowed:feasible>.4};
 }
 summary(){return structuredClone(this.state);}
}
