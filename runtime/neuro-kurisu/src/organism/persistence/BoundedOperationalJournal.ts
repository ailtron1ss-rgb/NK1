export type OperationalLevel = 'info'|'warn'|'error';
export interface RecordedOperationalEvent { at:number; level:OperationalLevel; event:string; data?:Record<string, unknown>; }

/** Bounded in-memory operational journal for ephemeral or test runtimes. */
export class BoundedOperationalJournal {
  private readonly maxRecords:number;
  private readonly records:RecordedOperationalEvent[]=[];

  constructor(maxRecords=256){
    this.maxRecords=Math.max(16,Math.floor(maxRecords));
  }

  async write(level:OperationalLevel,event:string,data?:Record<string, unknown>):Promise<void>{
    this.records.unshift({
      at:Date.now(),level,event,
      ...(data?{data:structuredClone(data)}:{}),
    });
    if(this.records.length>this.maxRecords)this.records.length=this.maxRecords;
  }

  snapshot():RecordedOperationalEvent[]{return structuredClone(this.records);}
  metrics(){
    let errors=0,warnings=0;
    for(const r of this.records){if(r.level==='error')errors++;else if(r.level==='warn')warnings++;}
    return {records:this.records.length,errors,warnings,maxRecords:this.maxRecords};
  }
  clear(){this.records.length=0;}
}
