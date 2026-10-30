/**
 * P70 — Memory Lifecycle Governor.
 *
 * Keeps hot operational state bounded while preserving cold historical lineage.
 * The governor returns retention budgets; it does not silently delete meaning.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ownRecord=(value:unknown):Record<string,unknown> => {
  if(value===null||typeof value!=='object'||Array.isArray(value))return Object.create(null) as Record<string,unknown>;
  const result=Object.create(null) as Record<string,unknown>;
  let keys:string[];
  try{keys=Object.keys(value);}catch{return result;}
  for(const key of keys.slice(0,32)){
    try{
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))continue;
      Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
    }catch{/* malformed persisted entry: use the governor's domain default */}
  }
  return result;
};
export interface P70State {version:1;cycles:number;maintenanceRuns:number;prunedRecords:number;compactions:number;meanHotLoad01:number;meanPressure01:number;lastAction:'idle'|'trim'|'compact'|'protect';lastAt:number;}
export const defaultP70=():P70State=>({version:1,cycles:0,maintenanceRuns:0,prunedRecords:0,compactions:0,meanHotLoad01:.18,meanPressure01:.18,lastAction:'idle',lastAt:0});
export class P70MemoryLifecycleGovernor {
 private state=defaultP70();
 restore(raw?:Partial<P70State>|null){
   const d=defaultP70();
   const source=ownRecord(raw);
   if(source.version!==undefined&&source.version!==1)throw new Error('Unsupported P70 memory lifecycle state version');
   const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
   const metric=(value:unknown,fallback:number)=>clamp(typeof value==='number'&&Number.isFinite(value)?value:fallback);
   const action=source.lastAction;
   this.state={
     version:1,
     cycles:count(source.cycles),
     maintenanceRuns:count(source.maintenanceRuns),
     prunedRecords:count(source.prunedRecords),
     compactions:count(source.compactions),
     meanHotLoad01:metric(source.meanHotLoad01,d.meanHotLoad01),
     meanPressure01:metric(source.meanPressure01,d.meanPressure01),
     lastAction:action==='idle'||action==='trim'||action==='compact'||action==='protect'?action:'idle',
     lastAt:typeof source.lastAt==='number'&&Number.isFinite(source.lastAt)&&source.lastAt>=0?source.lastAt:0,
   };
 }
 snapshot(){return structuredClone(this.state);}
 plan(input:{tick:number;at:number;traces:number;events:number;goals:number;memories:number;semanticItems:number;workingSet01:number;energy01:number;pressure01:number;experienceHotCount?:number;experienceWarmCount?:number;experienceColdCount?:number;identityTension01?:number}){
   const pressure=clamp(input.pressure01); const hot=clamp(input.workingSet01); const stressed=input.energy01<.28||pressure>.74;
   const hotCount=Math.max(0,Math.min(96,Math.floor(input.experienceHotCount??0)));
   const warmCount=Math.max(0,Math.min(320,Math.floor(input.experienceWarmCount??0)));
   const coldCount=Math.max(0,Math.min(1024,Math.floor(input.experienceColdCount??0)));
   const identityTension=clamp(input.identityTension01??0);
   const memoryBudget=stressed ? Math.max(320,Math.min(460,280+hotCount*4+identityTension*40)) : Math.min(640,440+hotCount*3+Math.min(80,warmCount*.4));
   const semanticBudget=stressed ? Math.max(900,Math.min(1200,860+hotCount*2+identityTension*35)) : Math.min(1500,1320+Math.min(100,coldCount*.1));
   const budgets={traces:stressed?160:260,events:stressed?256:512,goals:12,memories:Math.floor(memoryBudget),semanticItems:Math.floor(semanticBudget)};
   const action: P70State['lastAction']=stressed?'trim':(input.tick%96===0?'compact':'idle');
   this.state.cycles++;this.state.lastAt=input.at;this.state.lastAction=action;this.state.meanHotLoad01=clamp(this.state.meanHotLoad01*.97+hot*.03);this.state.meanPressure01=clamp(this.state.meanPressure01*.97+pressure*.03);if(action!=='idle')this.state.maintenanceRuns++;if(action==='compact')this.state.compactions++;
   return {budgets,action,pressure01:pressure,hotLoad01:hot};
 }
 recordPrune(count:number){this.state.prunedRecords+=Math.max(0,count);}
}
