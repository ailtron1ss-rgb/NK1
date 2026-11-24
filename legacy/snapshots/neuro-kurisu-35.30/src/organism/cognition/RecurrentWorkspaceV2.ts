export interface OrganismWorkspaceItem { id:string; source:string; content:Record<string,unknown>; salience:number; createdAt:number; }
export interface WorkspaceStateV2 {
  capacity:number;
  items:OrganismWorkspaceItem[];
  broadcastId:string;
  recurrence:number;
  lastCompetition:number;
  ignition01:number;
  sourceDiversity01:number;
  coalitionStability01:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
function stableHash(text:string){let h=2166136261>>>0;for(const c of text){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}return h.toString(16);}
function overlapIds(a:OrganismWorkspaceItem[],b:OrganismWorkspaceItem[]){if(!a.length||!b.length)return 0;const set=new Set(a.map(x=>x.id));let n=0;for(const x of b)if(set.has(x.id))n++;return n/Math.max(a.length,b.length);}
export class RecurrentWorkspaceV2 {
  private state:WorkspaceStateV2={capacity:5,items:[],broadcastId:'',recurrence:0,lastCompetition:0,ignition01:0,sourceDiversity01:0,coalitionStability01:0};
  restore(s:Partial<WorkspaceStateV2>|undefined){const d=this.state;const raw=s??{};this.state={...d,...raw,items:Array.isArray(raw.items)?raw.items.slice(0,d.capacity):[],ignition01:clamp(raw.ignition01??0),sourceDiversity01:clamp(raw.sourceDiversity01??0),coalitionStability01:clamp(raw.coalitionStability01??0)};}
  compete(items:OrganismWorkspaceItem[],tickHint=0){
    const previous=this.state.items; const ranked=[...items].sort((a,b)=>b.salience-a.salience); const coalition=ranked.slice(0,this.state.capacity).map(x=>structuredClone(x));
    const overlap=overlapIds(previous,coalition); const diversity=new Set(coalition.map(x=>x.source)).size/Math.max(1,coalition.length); const meanSalience=coalition.reduce((s,x)=>s+x.salience,0)/Math.max(1,coalition.length); const competition=clamp(ranked.length/Math.max(1,this.state.capacity*2));
    const ignition=clamp(meanSalience*.52+competition*.18+diversity*.12+overlap*.12+(coalition.length>=2?.06:0));
    const recurrent=Math.abs(ignition-this.state.ignition01)<.08||overlap>.5 ? Math.min(8,this.state.recurrence+.55) : Math.max(0,this.state.recurrence*.7+.18);
    const stable=clamp(this.state.coalitionStability01*.76+overlap*.24);
    const signature=coalition.map(x=>`${x.id}:${Math.round(x.salience*1000)}`).join('|');
    this.state.items=coalition; this.state.recurrence=recurrent; this.state.lastCompetition=ranked.length; this.state.ignition01=ignition; this.state.sourceDiversity01=diversity; this.state.coalitionStability01=stable; this.state.broadcastId=`gws-${tickHint||coalition[0]?.createdAt||Date.now()}-${stableHash(signature)}`;
    return this.snapshot();
  }
  broadcast(){return {broadcastId:this.state.broadcastId,items:this.state.items.map(x=>structuredClone(x)),recurrence:this.state.recurrence,ignition01:this.state.ignition01,sourceDiversity01:this.state.sourceDiversity01,coalitionStability01:this.state.coalitionStability01};}
  snapshot(){return structuredClone(this.state);}
}
