import { randomUUID } from 'node:crypto';

export interface SemanticNode { id:string; label:string; type:'concept'|'episode'|'goal'|'self'|'person'|'place'; salience:number; lastSeen:number; /** Non-empty only for source-isolated external/derived namespaces. */ sourceKey?:string; }
export interface SemanticEdge { id:string; from:string; to:string; relation:'supports'|'contradicts'|'causes'|'associated'|'about'|'located'; weight:number; lastSeen:number; }
export interface SemanticGraphState { nodes:SemanticNode[]; edges:SemanticEdge[]; updates:number; }
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().slice(0,96);

export class SemanticMemoryGraph {
  private state: SemanticGraphState={nodes:[],edges:[],updates:0};
  restore(state:SemanticGraphState|undefined):void { if(state) this.state={nodes:Array.isArray(state.nodes)?state.nodes.slice(0,1000):[],edges:Array.isArray(state.edges)?state.edges.slice(0,2200):[],updates:Number(state.updates||0)}; }
  upsertNode(label:string,type:SemanticNode['type'],salience:number,sourceKey=''):SemanticNode {
    const clean=normalize(label); if(!clean) throw new Error('semantic-node-empty');
    const namespace=String(sourceKey??'').trim().slice(0,160);
    const existing=this.state.nodes.find(n=>n.label===clean&&n.type===type&&String(n.sourceKey??'')===namespace);
    const now=Date.now();
    if(existing){ existing.salience=clamp(existing.salience*.82+salience*.18); existing.lastSeen=now; return structuredClone(existing); }
    const node:SemanticNode={id:randomUUID(),label:clean,type,salience:clamp(salience),lastSeen:now,...(namespace?{sourceKey:namespace}:{})};
    this.state.nodes=[node,...this.state.nodes].sort((a,b)=>b.salience-a.salience).slice(0,1000); return structuredClone(node);
  }
  connect(from:string,to:string,relation:SemanticEdge['relation'],weight:number):SemanticEdge {
    const existing=this.state.edges.find(e=>e.from===from&&e.to===to&&e.relation===relation); const now=Date.now();
    if(existing){ existing.weight=clamp(existing.weight*.78+weight*.22); existing.lastSeen=now; return structuredClone(existing); }
    const edge={id:randomUUID(),from,to,relation,weight:clamp(weight),lastSeen:now}; this.state.edges=[edge,...this.state.edges].slice(0,2200); return structuredClone(edge);
  }
  ingestEpisode(summary:string, goalTitle?:string, location?:string):void {
    const episode=this.upsertNode(summary,'episode',.62);
    const self=this.upsertNode('kurisu-self','self',.88); this.connect(episode.id,self.id,'about',.55);
    if(goalTitle){ const goal=this.upsertNode(goalTitle,'goal',.66); this.connect(episode.id,goal.id,'supports',.62); }
    if(location){ const place=this.upsertNode(location,'place',.42); this.connect(episode.id,place.id,'located',.48); }
    this.state.updates+=1;
  }
  retrieve(query:string,limit=6,clone=true):SemanticNode[] { const q=normalize(query); return this.state.nodes.map(n=>({n,score:n.label.includes(q)?1:n.label.split(' ').filter(x=>q.includes(x)||x.includes(q)).length*.25+n.salience*.2})).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>clone?structuredClone(x.n):x.n); }
  snapshot():SemanticGraphState { return structuredClone(this.state); }
}
