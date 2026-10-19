export type ResourceDomain = 'perception'|'memory'|'world'|'planning'|'language'|'learning'|'reflection'|'research';
export interface ResourceAllocationState {
  version:1; cycles:number; battery01:number; thermal01:number; ramPressure01:number; computeCapacity01:number;
  allocations:Record<ResourceDomain,number>;
  actionBias:Record<'respond'|'explore'|'verify'|'rest'|'reflect'|'wait'|'defer',number>;
  dominantDomain:ResourceDomain; scarcity01:number; efficiency01:number; lastReason:string; lastAt:number;
}
const DOMAINS:ResourceDomain[]=['perception','memory','world','planning','language','learning','reflection','research'];
const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'] as const;
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const zeroDomains=()=>Object.fromEntries(DOMAINS.map(d=>[d,0])) as Record<ResourceDomain,number>;
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<typeof ACTIONS[number],number>;
export const defaultOrganismResourceAllocation=():ResourceAllocationState=>({
  version:1,cycles:0,battery01:.82,thermal01:.18,ramPressure01:.18,computeCapacity01:.82,
  allocations:zeroDomains(),actionBias:zeroActions(),dominantDomain:'planning',scarcity01:.18,efficiency01:.82,lastReason:'initial',lastAt:0,
});
/** Central scarce-compute allocator. It schedules existing cognition; it does not invent cognition. */
export class OrganismResourceAllocator {
  private state=defaultOrganismResourceAllocation();
  restore(raw?:Partial<ResourceAllocationState>|null){
    const d=defaultOrganismResourceAllocation(); const r=raw??{};
    this.state={...d,...r,allocations:{...d.allocations,...(r.allocations??{})},actionBias:{...d.actionBias,...(r.actionBias??{})}};
  }
  snapshot(){return structuredClone(this.state);}
  decide(input:{battery01:number;thermal01:number;ramPressure01:number;uncertainty01:number;predictionError01:number;goalPressure01:number;novelty01:number;socialNeed01:number;grounding01:number;learningOpportunity01:number;languageDemand01:number;externalInput:boolean}){
    const scarcity=clamp((1-input.battery01)*.34+input.thermal01*.28+input.ramPressure01*.24+(1-Math.max(.05,input.battery01,input.grounding01))*.14);
    const capacity=clamp(1-scarcity);
    const raw:Record<ResourceDomain,number>={
      perception:clamp((input.externalInput?1:0)*.22+input.uncertainty01*.30+input.novelty01*.16+input.grounding01*.08),
      memory:clamp(input.predictionError01*.20+input.uncertainty01*.16+input.goalPressure01*.12),
      world:clamp(input.predictionError01*.32+(1-input.grounding01)*.28+input.novelty01*.12),
      planning:clamp(input.goalPressure01*.36+input.predictionError01*.18+input.uncertainty01*.14),
      language:clamp((input.externalInput?.46:0)+input.socialNeed01*.30+input.languageDemand01*.40),
      learning:clamp(input.learningOpportunity01*.56+input.predictionError01*.16+input.novelty01*.12),
      reflection:clamp(input.predictionError01*.18+input.uncertainty01*.16+(1-input.grounding01)*.10),
      research:clamp(input.learningOpportunity01*.44+input.novelty01*.30+(1-input.grounding01)*.12),
    };
    const scarcityCut=clamp(.45+capacity*.65);
    const total=Object.values(raw).reduce((sum,value)=>sum+value,0)||1;
    const allocations=Object.fromEntries(DOMAINS.map(d=>[d,clamp((raw[d]/total)*scarcityCut)])) as Record<ResourceDomain,number>;
    const dominantDomain=[...DOMAINS].sort((a,b)=>allocations[b]-allocations[a])[0]??'planning';
    const bias=zeroActions();
    bias.respond=clamp(input.socialNeed01*.18+(input.externalInput?.12:0));
    bias.explore=clamp(allocations.world*.18+allocations.perception*.10);
    bias.verify=clamp(allocations.world*.12+allocations.memory*.10+(1-input.grounding01)*.12);
    bias.rest=clamp((1-input.battery01)*.22+input.thermal01*.22+input.ramPressure01*.14);
    bias.reflect=clamp(allocations.reflection*.12+input.predictionError01*.08);
    bias.wait=clamp((1-capacity)*.16);
    bias.defer=clamp((1-capacity)*.25+input.thermal01*.12);
    const efficiency=clamp(capacity*(.72+input.grounding01*.28));
    this.state={version:1,cycles:this.state.cycles+1,battery01:clamp(input.battery01),thermal01:clamp(input.thermal01),ramPressure01:clamp(input.ramPressure01),computeCapacity01:capacity,allocations,actionBias:bias,dominantDomain,scarcity01:scarcity,efficiency01:efficiency,lastReason:`domain=${dominantDomain};scarcity=${scarcity.toFixed(2)};capacity=${capacity.toFixed(2)}`,lastAt:Date.now()};
    return this.snapshot();
  }
  actionBias(action:keyof ResourceAllocationState['actionBias']){return clamp(this.state.actionBias[action]??0);}
}
