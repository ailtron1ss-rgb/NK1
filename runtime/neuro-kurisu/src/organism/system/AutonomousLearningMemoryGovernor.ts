/** BIG PASS 226 — self-directed memory/learning governance. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface LearningMemoryItem{
  id:string; value:number; utility01:number; relevance01:number; uncertainty01:number;
  lastAt:number; uses:number; source:string;
}
export interface AutonomousLearningMemoryState{
  version:1; cycles:number; stored:number; retrieved:number; pruned:number;
  consolidated:number; meanUtility01:number; meanRetention01:number;
  learningPressure01:number; items:LearningMemoryItem[];
}
export const defaultAutonomousLearningMemory=():AutonomousLearningMemoryState=>({
  version:1,cycles:0,stored:0,retrieved:0,pruned:0,consolidated:0,
  meanUtility01:.45,meanRetention01:.55,learningPressure01:.32,items:[]
});
export class AutonomousLearningMemoryGovernor {
  private state=defaultAutonomousLearningMemory();
  restore(raw?:Partial<AutonomousLearningMemoryState>|null){
    const d=defaultAutonomousLearningMemory(),r=raw??{};
    this.state={...d,...r,items:Array.isArray(r.items)?structuredClone(r.items).slice(0,128):[],version:1};
  }
  snapshot(){return structuredClone(this.state);}
  cycle(input:{
    tick:number;at:number;predictionError01:number;uncertainty01:number;novelty01:number;
    goalPressure01:number;outcome01:number;identity01:number;memoryPressure01:number;
  }) {
    const pressure=clamp(
      input.predictionError01*.34+input.uncertainty01*.25+input.novelty01*.16+
      input.goalPressure01*.15+input.memoryPressure01*.10
    );
    const shouldStore=pressure>.28 || (input.identity01>.68 && (input.goalPressure01>.22 || input.novelty01>.2));
    this.state.learningPressure01=clamp(this.state.learningPressure01*.9+pressure*.1);
    this.state.cycles++;
    if(shouldStore){
      const item:LearningMemoryItem={
        id:`alm:${input.tick}:${Math.round(pressure*10000)}`,value:input.outcome01,
        utility01:clamp(.35+pressure*.55+input.identity01*.1),
        relevance01:clamp(.35+input.goalPressure01*.3+input.novelty01*.2+input.identity01*.15),
        uncertainty01:input.uncertainty01,lastAt:input.at,uses:0,source:'autonomous-cycle'
      };
      this.state.items=[item,...this.state.items].slice(0,128);this.state.stored++;
    }
    this.consolidate(input.at);
    return{shouldStore,learningPressure01:this.state.learningPressure01,retention01:this.state.meanRetention01};
  }
  retrieve(query01:number){
    const q=clamp(query01);
    const item=[...this.state.items].sort((a,b)=>(b.utility01*b.relevance01)-(a.utility01*a.relevance01))[0]??null;
    if(item&&q>.28){item.uses++;item.lastAt=Date.now();this.state.retrieved++;}
    return item?structuredClone(item):null;
  }
  private consolidate(at:number){
    let retained=0;
    for(const item of this.state.items){
      const age=clamp((at-item.lastAt)/(1000*60*60*24*7));
      item.utility01=clamp(item.utility01*.994+(1-age)*.006);
      if(item.utility01>.62)retained++;
    }
    if(this.state.items.length>96){
      const before=this.state.items.length;
      this.state.items=this.state.items.sort((a,b)=>(b.utility01*b.relevance01+a.uses*.01)-(a.utility01*a.relevance01+b.uses*.01)).slice(0,96);
      this.state.pruned+=before-this.state.items.length;
    }
    this.state.consolidated++;
    this.state.meanRetention01=clamp(this.state.meanRetention01*.95+(retained/Math.max(1,this.state.items.length))*.05);
    const meanUtility=this.state.items.reduce((sum,item)=>sum+item.utility01,0)/Math.max(1,this.state.items.length);
    this.state.meanUtility01=clamp(this.state.meanUtility01*.95+meanUtility*.05);
  }
  summary(){return{
    cycles:this.state.cycles,stored:this.state.stored,retrieved:this.state.retrieved,pruned:this.state.pruned,
    consolidated:this.state.consolidated,meanUtility01:this.state.meanUtility01,
    meanRetention01:this.state.meanRetention01,learningPressure01:this.state.learningPressure01,items:this.state.items.length
  };}
}
