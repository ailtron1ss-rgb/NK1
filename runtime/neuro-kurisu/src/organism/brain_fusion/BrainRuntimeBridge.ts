export type BrainRuntimeEvent = {
  tick:number;
  source:string;
  predictionError:number;
  novelty:number;
  importance:number;
  payload?:unknown;
};

export type BrainRuntimeAssessment = {
  learningPriority:number;
  consolidationPriority:number;
  requiresExploration:boolean;
};

/**
 * Integration layer between the organism runtime and brain-fusion modules.
 * It intentionally does not replace existing cognition modules; it provides
 * a controlled signal bus so future runtime wiring can be verified.
 */
export class BrainRuntimeBridge {
  private readonly events:BrainRuntimeEvent[]=[];
  private readonly maxEvents:number;
  constructor(maxEvents=2048){this.maxEvents=maxEvents;}

  ingest(event:BrainRuntimeEvent):BrainRuntimeAssessment{
    const normalized={...event,
      importance:Math.max(0,Math.min(1,event.importance)),
      novelty:Math.max(0,Math.min(1,event.novelty)),
      predictionError:Math.max(0,Math.min(1,event.predictionError))
    };
    this.events.push(normalized);
    if(this.events.length>this.maxEvents)this.events.shift();
    const learningPriority=(normalized.predictionError*0.45)+(normalized.novelty*0.35)+(normalized.importance*0.2);
    return {
      learningPriority,
      consolidationPriority:normalized.importance*0.6+normalized.predictionError*0.4,
      requiresExploration:learningPriority>0.65
    };
  }

  snapshot(){return {events:this.events.slice()};}
  restore(snapshot:{events?:BrainRuntimeEvent[]}){
    this.events.length=0;
    for(const e of snapshot.events??[])this.events.push(e);
  }
}
