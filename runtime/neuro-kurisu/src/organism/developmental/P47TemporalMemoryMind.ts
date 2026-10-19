import { createHash } from 'node:crypto';
import type { OrganismEvent } from '../memory/EventSourcing.ts';

export type P47BeliefStatus = 'active' | 'revised' | 'uncertain' | 'retired';
export interface P47MemoryNode { id:string; kind:'event'|'episode'|'belief'; at:number; summary:string; salience:number; confidence:number; sourceIds:string[]; links:string[]; }
export interface P47Belief { id:string; proposition:string; confidence:number; status:P47BeliefStatus; supportIds:string[]; contradictionIds:string[]; updates:number; lastUpdatedAt:number; }
export interface P47State {
  version:1;
  ingestedEvents:number;
  nodes:number;
  beliefs:number;
  contradictionsResolved:number;
  contradictionsOpen:number;
  compressions:number;
  lastCompactionAt:number;
  lastReflectionAt:number;
  memoryPressure01:number;
  identityStability01:number;
  predictionCalibration01:number;
  nodesData:P47MemoryNode[];
  beliefsData:P47Belief[];
}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const norm=(s:string)=>s.toLowerCase().replace(/[^a-zа-яё0-9 ]/gi,' ').replace(/\s+/g,' ').trim();
const tokensOf=(s:string)=>new Set(norm(s).split(' ').filter(Boolean));
export const defaultP47State=():P47State=>({version:1,ingestedEvents:0,nodes:0,beliefs:0,contradictionsResolved:0,contradictionsOpen:0,compressions:0,lastCompactionAt:0,lastReflectionAt:0,memoryPressure01:0,identityStability01:.88,predictionCalibration01:.5,nodesData:[],beliefsData:[]});

export class P47TemporalMemoryMind {
  private state=defaultP47State();
  restore(raw:P47State|undefined){this.state={...defaultP47State(),...(raw??{}),nodesData:Array.isArray(raw?.nodesData)?raw!.nodesData.slice(0,320):[],beliefsData:Array.isArray(raw?.beliefsData)?raw!.beliefsData.slice(0,128):[]};}
  snapshot(){return structuredClone(this.state);}
  ingest(events:OrganismEvent[]):void{
    for(const e of events){
      if(this.state.nodesData.some(n=>n.sourceIds.includes(e.id))) continue;
      const payload=e.payload ?? {};
      const text=JSON.stringify(payload);
      const summary=`${e.type} @${e.tick} ${text.slice(0,260)}`;
      const salience=c(Number((payload as any).importance ?? (payload as any).surprise ?? .2));
      const id=createHash('sha1').update(`${e.id}|${summary}`).digest('hex').slice(0,20);
      const prior=this.state.nodesData.filter(n=>Math.abs(n.at-e.at)<=30*60_000).slice(0,8);
      const links=prior.filter(n=>this.semanticOverlap(n.summary,summary)>.18).slice(0,4).map(n=>n.id);
      const node:P47MemoryNode={id,kind:'event',at:e.at,summary,salience,confidence:c(1-Number((payload as any).uncertainty ?? .2)),sourceIds:[e.id],links};
      this.state.nodesData=[node,...this.state.nodesData].slice(0,320); this.state.ingestedEvents++; this.updateBeliefsFromEvent(e,node);
    }
    this.state.nodes=this.state.nodesData.length; this.state.beliefs=this.state.beliefsData.length; this.state.memoryPressure01=c(this.state.nodes/320);
  }
  private semanticOverlap(a:string,b:string){const A=tokensOf(a),B=tokensOf(b);let o=0;for(const t of A)if(B.has(t))o++;return o/Math.max(1,Math.min(A.size,B.size));}
  private updateBeliefsFromEvent(e:OrganismEvent,node:P47MemoryNode){
    const candidate=typeof (e.payload as any)?.claim==='string'?String((e.payload as any).claim):typeof (e.payload as any)?.summary==='string'?String((e.payload as any).summary):'';
    if(!candidate) return;
    const prop=norm(candidate).slice(0,180); if(prop.length<8)return;
    const tokens=tokensOf(prop); let best:P47Belief|undefined; let bestScore=0;
    for(const b of this.state.beliefsData){const bt=tokensOf(b.proposition);let overlap=0;for(const t of tokens)if(bt.has(t))overlap++;const score=overlap/Math.max(1,Math.min(tokens.size,bt.size));if(score>bestScore){bestScore=score;best=b;}}
    const neg=/\b(not|no|false|failed|contrad|wrong|не|нет|ложн|ошиб)/i.test(prop);
    if(best&&bestScore>.55){
      best.supportIds=[node.id,...best.supportIds].slice(0,24); best.confidence=c(best.confidence*.82+node.confidence*.18); best.updates++; best.lastUpdatedAt=e.at;
      if(neg&&!/\b(not|no|false|failed|contrad|wrong|не|нет|ложн|ошиб)/i.test(norm(best.proposition))){best.status='uncertain';best.contradictionIds=[node.id,...best.contradictionIds].slice(0,24);}
      else if(!neg&&best.status==='uncertain'){best.status='revised';}
      return;
    }
    const belief:P47Belief={id:createHash('sha1').update(`${prop}|${e.id}`).digest('hex').slice(0,16),proposition:candidate.trim().slice(0,240),confidence:node.confidence,status:'active',supportIds:[node.id],contradictionIds:[],updates:1,lastUpdatedAt:e.at};
    this.state.beliefsData=[belief,...this.state.beliefsData].slice(0,128);
  }
  reflect(now=Date.now()):{compacted:number;openContradictions:number;identityStability01:number;predictionCalibration01:number}{
    const before=this.state.nodesData.length;
    const ranked=this.state.nodesData.slice().sort((a,b)=>(b.salience*b.confidence)-(a.salience*a.confidence));
    const keep=ranked.slice(0,180);
    const grouped=new Map<string,P47MemoryNode>();
    for(const n of keep){
      const k=norm(n.summary).split(' ').slice(0,7).join(' ');
      const existing=grouped.get(k);
      if(existing){existing.sourceIds=[...existing.sourceIds,...n.sourceIds].slice(-24); existing.links=[...new Set([...existing.links,...n.links])].slice(0,8); existing.confidence=c(Math.max(existing.confidence,n.confidence)); existing.salience=c(Math.max(existing.salience,n.salience));}
      else grouped.set(k,structuredClone(n));
    }
    this.state.nodesData=[...grouped.values()].sort((a,b)=>b.at-a.at).slice(0,220);
    this.state.compressions+=Math.max(0,before-this.state.nodesData.length); this.state.lastCompactionAt=now; this.state.lastReflectionAt=now; this.state.nodes=this.state.nodesData.length;
    let open=0,resolved=0;
    for(const b of this.state.beliefsData){
      if(!b.contradictionIds.length)continue;
      const evidence=this.state.nodesData.filter(n=>b.contradictionIds.includes(n.id));
      const mean=evidence.length?evidence.reduce((s,n)=>s+n.confidence,0)/evidence.length:0;
      if(mean<.35){b.status='revised';b.confidence=c(b.confidence*.7+.3);resolved++;}
      else{b.status='uncertain';open++;}
    }
    this.state.contradictionsOpen=open;this.state.contradictionsResolved+=resolved;
    const stable=this.state.beliefsData.filter(b=>b.status==='active'&&b.confidence>.72).length;
    this.state.identityStability01=c(.80+(stable/Math.max(1,this.state.beliefsData.length))*.18-open*.003);
    const calibrated=this.state.beliefsData.filter(b=>b.status!=='retired').map(b=>1-Math.abs(b.confidence-.65));
    this.state.predictionCalibration01=c(calibrated.length?calibrated.reduce((a,x)=>a+x,0)/calibrated.length:.5);
    this.state.beliefs=this.state.beliefsData.length;this.state.memoryPressure01=c(this.state.nodes/320);
    return {compacted:Math.max(0,before-this.state.nodesData.length),openContradictions:open,identityStability01:this.state.identityStability01,predictionCalibration01:this.state.predictionCalibration01};
  }
  remember(summary:string,salience=.6,confidence=.7,sourceIds:string[]=[]){const at=Date.now();const id=createHash('sha1').update(`${at}|${summary}`).digest('hex').slice(0,20);const recent=this.state.nodesData.slice(0,6).filter(n=>this.semanticOverlap(n.summary,summary)>.2).map(n=>n.id);this.state.nodesData=[{id,kind:'episode' as const,at,summary:summary.slice(0,320),salience:c(salience),confidence:c(confidence),sourceIds:sourceIds.slice(-24),links:recent},...this.state.nodesData].slice(0,320);this.state.nodes=this.state.nodesData.length;}
}
