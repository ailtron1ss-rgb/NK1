export interface SourceTrace{id:string;source:'user'|'system'|'world'|'model'|'tool'|'memory';kind:string;confidence:number;epistemicStatus:'input'|'hypothesis'|'observation'|'fact'|'rejected';at:number;}
export interface SourceMonitorState{traces:SourceTrace[];conflicts:number;unattributed:number;}
export const defaultSourceMonitor=():SourceMonitorState=>({traces:[],conflicts:0,unattributed:0});
export class SourceMonitor{
 private state=defaultSourceMonitor();
 restore(s:SourceMonitorState|undefined){this.state={...defaultSourceMonitor(),...(s??{}),traces:Array.isArray(s?.traces)?s!.traces.slice(0,512):[]};}
 record(trace:SourceTrace){if(!trace.id)this.state.unattributed++;else this.state.traces=[trace,...this.state.traces].slice(0,512);}
 add(source:SourceTrace['source'],kind:string,confidence:number,epistemicStatus:SourceTrace['epistemicStatus']='observation'){this.record({id:`src-${Date.now()}-${Math.random().toString(16).slice(2)}`,source,kind,confidence:Math.max(0,Math.min(1,confidence)),epistemicStatus,at:Date.now()});}
 latest(limit=16){return this.state.traces.slice(0,limit).map(x=>({...x}));}
 snapshot(){return structuredClone(this.state);}
}
