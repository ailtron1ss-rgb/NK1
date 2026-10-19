import type { OrganismGoal, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=120)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);

export type PortfolioDomain='self'|'world'|'social'|'skills'|'research'|'embodiment';
export interface DevelopmentalPortfolioThread {
  domain:PortfolioDomain;
  pressure01:number;
  uncertainty01:number;
  progress01:number;
  stability01:number;
  socialImportance01:number;
  identityFit01:number;
  novelty01:number;
  evidence01:number;
  resourceCost01:number;
  opportunity01:number;
  priority01:number;
  observations:number;
  lastAt:number;
}
export interface DevelopmentalPortfolioState {
  version:1;
  cycles:number;
  threads:DevelopmentalPortfolioThread[];
  selectedDomain:PortfolioDomain|'none';
  selectedGoalId:string|null;
  allocation01:number;
  competition01:number;
  coherence01:number;
  historyDriven01:number;
  socialDriven01:number;
  embodimentDriven01:number;
  lastReason:string;
  lastAt:number;
}

const domains:PortfolioDomain[]=['self','world','social','skills','research','embodiment'];
export const defaultDevelopmentalPortfolio=():DevelopmentalPortfolioState=>({
  version:1,cycles:0,threads:domains.map(domain=>({domain,pressure01:.24,uncertainty01:.3,progress01:.2,stability01:.55,socialImportance01:.2,identityFit01:.45,novelty01:.2,evidence01:.3,resourceCost01:.35,opportunity01:.3,priority01:.24,observations:0,lastAt:0})),selectedDomain:'none',selectedGoalId:null,allocation01:.3,competition01:.18,coherence01:.42,historyDriven01:.2,socialDriven01:.2,embodimentDriven01:.15,lastReason:'initial',lastAt:0
});

export class DevelopmentalPortfolioEngine {
  private state=defaultDevelopmentalPortfolio();
  restore(raw?:Partial<DevelopmentalPortfolioState>|null){
    const d=defaultDevelopmentalPortfolio(),r=raw??{};
    const incoming=Array.isArray(r.threads)?r.threads:[];
    const by=new Map(incoming.map((x:any)=>[x.domain,x]));
    this.state={...d,...r,version:1,
      threads:domains.map(domain=>{const x=by.get(domain)??{};return {...d.threads.find(t=>t.domain===domain)!,...x,domain,observations:Math.max(0,Number(x.observations??0)),priority01:clamp(Number(x.priority01??.24))};}),
      selectedDomain:domains.includes(r.selectedDomain as PortfolioDomain)?r.selectedDomain as PortfolioDomain:'none'
    };
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(){
    this.state.cycles++;
    this.state.threads=this.state.threads.map(t=>({...t,pressure01:clamp(t.pressure01*.997),opportunity01:clamp(t.opportunity01*.999)}));
    this.state.lastAt=Date.now();
  }

  private update(domain:PortfolioDomain,input:{pressure01?:number;uncertainty01?:number;progress01?:number;stability01?:number;socialImportance01?:number;identityFit01?:number;novelty01?:number;evidence01?:number;resourceCost01?:number;opportunity01?:number;at?:number}){
    const t=this.state.threads.find(x=>x.domain===domain)!;
    const blend=(key:keyof typeof t,v:number,rate=.1)=>clamp((Number(t[key])||0)*(1-rate)+clamp(v)*rate);
    for(const key of ['pressure01','uncertainty01','progress01','stability01','socialImportance01','identityFit01','novelty01','evidence01','resourceCost01','opportunity01'] as const){
      if(input[key]!==undefined)(t as any)[key]=blend(key,input[key]!,key==='progress01'?.08:.12);
    }
    t.observations++; t.lastAt=input.at??Date.now();
  }

  observe(input:{state:OrganismState;socialError01:number;socialTrust01:number;identity01:number;identityLearning01:number;curriculumPressure01:number;historyUnresolved01:number;transfer01:number;worldUncertainty01:number;worldPredictionError01:number;skillNeed01:number;researchNeed01:number;embodimentCapacity01:number;embodimentStrain01:number;goalProgress01:number;at?:number}){
    const at=input.at??Date.now(); const s=input.state;
    this.update('self',{pressure01:clamp(input.historyUnresolved01*.55+input.identityLearning01*.45),uncertainty01:clamp(1-input.identity01),progress01:clamp(1-input.historyUnresolved01),stability01:input.identity01,identityFit01:input.identity01,evidence01:1-input.worldPredictionError01,resourceCost01:clamp(s.needs.cognitiveLoad),opportunity01:input.curriculumPressure01,at});
    this.update('world',{pressure01:clamp(input.worldPredictionError01*.65+input.worldUncertainty01*.35),uncertainty01:input.worldUncertainty01,progress01:1-input.worldUncertainty01,stability01:clamp(1-input.worldPredictionError01),novelty01:s.needs.novelty,evidence01:clamp(1-input.worldPredictionError01),resourceCost01:s.needs.cognitiveLoad,opportunity01:clamp(input.worldPredictionError01*.7+input.curriculumPressure01*.3),at});
    this.update('social',{pressure01:clamp(input.socialError01*.6+(1-input.socialTrust01)*.4),uncertainty01:input.socialError01,progress01:clamp(input.socialTrust01),stability01:clamp(input.socialTrust01),socialImportance01:clamp(s.needs.socialNeed),identityFit01:clamp(input.identity01*.55+s.needs.socialNeed*.45),evidence01:clamp(1-input.socialError01),resourceCost01:s.needs.cognitiveLoad,opportunity01:clamp(input.socialError01*.5+s.needs.socialNeed*.5),at});
    this.update('skills',{pressure01:input.skillNeed01,uncertainty01:clamp(1-input.transfer01),progress01:input.goalProgress01,stability01:input.transfer01,identityFit01:input.identity01,evidence01:input.transfer01,resourceCost01:s.needs.cognitiveLoad,opportunity01:clamp(input.skillNeed01*.65+input.transfer01*.35),at});
    this.update('research',{pressure01:input.researchNeed01,uncertainty01:input.worldUncertainty01,progress01:clamp(1-input.worldPredictionError01),stability01:clamp(1-input.worldPredictionError01),identityFit01:clamp(input.identity01*.6+input.researchNeed01*.4),evidence01:clamp(1-input.worldPredictionError01),resourceCost01:clamp(s.needs.cognitiveLoad*.75),opportunity01:clamp(input.researchNeed01*.65+input.worldUncertainty01*.35),at});
    this.update('embodiment',{pressure01:clamp(input.embodimentStrain01*.72+(1-input.embodimentCapacity01)*.28),uncertainty01:clamp(input.embodimentStrain01),progress01:input.embodimentCapacity01,stability01:clamp(1-input.embodimentStrain01),evidence01:input.embodimentCapacity01,resourceCost01:clamp(1-input.embodimentCapacity01),opportunity01:clamp(input.embodimentStrain01*.65+(1-input.embodimentCapacity01)*.35),at});
    this.recalculate(at);
  }

  rankGoals(goals:OrganismGoal[],signals?:{socialNeed01?:number;novelty01?:number;uncertainty01?:number}){
    const active=goals.filter(g=>g.status==='active');
    const rows=active.map(g=>{
      const domain=this.inferDomain(g); const t=this.state.threads.find(x=>x.domain===domain)!;
      const urgency=clamp(g.urgency),importance=clamp(g.importance);
      const score=clamp(t.priority01*.48+urgency*.18+importance*.16+t.identityFit01*.08+t.socialImportance01*.05+(signals?.novelty01??0)*.025+(signals?.uncertainty01??0)*.025);
      return {goalId:g.id,domain,score01:score,priority01:t.priority01,reason:`portfolio:${domain}; pressure=${t.pressure01.toFixed(2)}; opportunity=${t.opportunity01.toFixed(2)}`};
    }).sort((a,b)=>b.score01-a.score01);
    const top=rows[0];
    this.state.selectedGoalId=top?.goalId??null;
    this.state.selectedDomain=top?.domain??'none';
    this.state.lastReason=top?.reason??'no-active-goal';
    return rows;
  }

  private inferDomain(g:OrganismGoal):PortfolioDomain{
    const text=String(`${g.title} ${g.reason} ${g.source}`).toLowerCase();
    if(/social|user|person|friend|relationship|dialog|communicat/.test(text))return 'social';
    if(/research|scient|evidence|unknown|verify/.test(text))return 'research';
    if(/skill|practice|learn|habit/.test(text))return 'skills';
    if(/body|energy|thermal|rest|sensor|embod/.test(text))return 'embodiment';
    if(/self|identity|autonomy|development|reflect/.test(text))return 'self';
    return 'world';
  }

  actionBias(action:string):number{
    const d=this.state.selectedDomain;
    const wants=(d==='social'&&action==='respond')||(d==='research'&&action==='verify')||(d==='skills'&&action==='explore')||(d==='self'&&action==='reflect')||(d==='world'&&action==='explore')||(d==='embodiment'&&action==='rest');
    return wants?clamp((this.state.allocation01*.028)+(this.state.threads.find(t=>t.domain===d)?.priority01??0)*.012):0;
  }

  recalibrateAfterOutcome(input:{success01:number;verified01:number;social01:number;identity01:number;transfer01:number;surprise01:number;at?:number}){
    const d=this.state.selectedDomain;
    if(d==='none')return;
    const t=this.state.threads.find(x=>x.domain===d)!;
    const gain=clamp(input.success01*.38+input.verified01*.22+input.transfer01*.16+input.identity01*.12+input.social01*.07+(1-input.surprise01)*.05);
    t.progress01=clamp(t.progress01*.92+gain*.08);
    t.evidence01=clamp(t.evidence01*.9+input.verified01*.1);
    t.stability01=clamp(t.stability01*.9+(1-input.surprise01)*.1);
    t.pressure01=clamp(t.pressure01*.94+(1-gain)*.06);
    t.opportunity01=clamp(t.opportunity01*.94+(1-t.progress01)*.06);
    t.priority01=clamp(t.pressure01*.24+t.uncertainty01*.18+t.identityFit01*.13+t.socialImportance01*.12+t.opportunity01*.18+t.novelty01*.07+(1-t.stability01)*.08);
    this.state.lastAt=input.at??Date.now();this.recalculate(this.state.lastAt);
  }

  private recalculate(at:number){
    const rows=this.state.threads.map(t=>{t.priority01=clamp(t.pressure01*.24+t.uncertainty01*.18+t.identityFit01*.14+t.socialImportance01*.10+t.opportunity01*.19+t.novelty01*.07+(1-t.stability01)*.04+(1-t.evidence01)*.04);return t;}).sort((a,b)=>b.priority01-a.priority01);
    const total=rows.reduce((s,t)=>s+t.priority01,0); const top=rows[0]?.priority01??0;
    this.state.allocation01=clamp(.22+top*.55);
    this.state.competition01=clamp(total>0?1-top/total:0);
    this.state.coherence01=clamp(rows.reduce((s,t)=>s+t.identityFit01*.45+t.evidence01*.3+(1-t.stability01)*.25,0)/Math.max(1,rows.length));
    this.state.historyDriven01=clamp((this.state.threads.find(t=>t.domain==='self')?.pressure01??0)*.7+(this.state.threads.find(t=>t.domain==='skills')?.pressure01??0)*.3);
    this.state.socialDriven01=clamp((this.state.threads.find(t=>t.domain==='social')?.pressure01??0)*.7+(this.state.threads.find(t=>t.domain==='self')?.socialImportance01??0)*.3);
    this.state.embodimentDriven01=clamp((this.state.threads.find(t=>t.domain==='embodiment')?.pressure01??0)*.8+(this.state.threads.find(t=>t.domain==='world')?.resourceCost01??0)*.2);
    this.state.lastAt=at;
  }

  diagnostics(){
    const top=[...this.state.threads].sort((a,b)=>b.priority01-a.priority01).slice(0,3).map(t=>({domain:t.domain,priority01:t.priority01,pressure01:t.pressure01,progress01:t.progress01,opportunity01:t.opportunity01,evidence01:t.evidence01,observations:t.observations}));
    return {version:1,cycles:this.state.cycles,selectedDomain:this.state.selectedDomain,selectedGoalId:this.state.selectedGoalId,allocation01:this.state.allocation01,competition01:this.state.competition01,coherence01:this.state.coherence01,historyDriven01:this.state.historyDriven01,socialDriven01:this.state.socialDriven01,embodimentDriven01:this.state.embodimentDriven01,topDomains:top,lastReason:clean(this.state.lastReason,220)};
  }
}
