import { randomUUID } from 'node:crypto';

export interface SemanticNode { id:string; label:string; type:'concept'|'episode'|'goal'|'self'|'person'|'place'; salience:number; lastSeen:number; /** Non-empty only for source-isolated external/derived namespaces. */ sourceKey?:string; }
export interface SemanticEdge { id:string; from:string; to:string; relation:'supports'|'contradicts'|'causes'|'associated'|'about'|'located'; weight:number; lastSeen:number; }
export interface SemanticGraphState { nodes:SemanticNode[]; edges:SemanticEdge[]; updates:number; }
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().slice(0,96);

export class SemanticMemoryGraph {
  private state: SemanticGraphState={nodes:[],edges:[],updates:0};
  private mutationRevision=0;
  private readonly mutationJournal:Array<{revision:number;ownerToken:string|null;undo?:()=>boolean;undone?:boolean}>=[];
  private recordMutation(ownerToken?:string,undo?:()=>boolean):void {
    const token=typeof ownerToken==='string'&&ownerToken?ownerToken:null;
    this.mutationJournal.push({revision:++this.mutationRevision,ownerToken:token,...(token&&undo?{undo}:{}),undone:false});
    if(this.mutationJournal.length>8192)this.mutationJournal.splice(0,this.mutationJournal.length-8192);
  }
  mutationCheckpoint():number { return this.mutationRevision; }
  private hasForeignMutationSince(checkpoint:number,ownerToken:string):boolean {
    if(!Number.isSafeInteger(checkpoint)||checkpoint<0||checkpoint>this.mutationRevision)return true;
    const earliest=this.mutationJournal[0]?.revision;
    // Missing journal history is ambiguous, so rollback fails closed.
    if(earliest!==undefined&&checkpoint<earliest-1)return true;
    return this.mutationJournal.some(entry=>entry.revision>checkpoint&&entry.ownerToken!==ownerToken);
  }
  rollbackOwnedMutations(checkpoint:number,ownerToken:string):{rolledBack:number;conflicts:number;historyLost:boolean} {
    const earliest=this.mutationJournal[0]?.revision;
    const invalid=!Number.isSafeInteger(checkpoint)||checkpoint<0||checkpoint>this.mutationRevision;
    const historyLost=invalid||(earliest!==undefined&&checkpoint<earliest-1);
    let rolledBack=0,conflicts=historyLost?1:0;
    const owned=this.mutationJournal
      .filter(entry=>Number.isSafeInteger(checkpoint)&&entry.revision>checkpoint&&entry.ownerToken===ownerToken&&!entry.undone)
      .reverse();
    for(const entry of owned){
      entry.undone=true;
      try{
        if(entry.undo&&entry.undo())rolledBack++;
        else conflicts++;
      }catch{conflicts++;}
    }
    return {rolledBack,conflicts,historyLost};
  }
  restoreIfUnchanged(state:SemanticGraphState|undefined,checkpoint:number,ownerToken:string):boolean {
    if(this.hasForeignMutationSince(checkpoint,ownerToken))return false;
    this.restore(state,ownerToken);
    return true;
  }
  restore(state:SemanticGraphState|undefined,ownerToken?:string):void {
    if(state){
      this.state={nodes:Array.isArray(state.nodes)?state.nodes.slice(0,1000):[],edges:Array.isArray(state.edges)?state.edges.slice(0,2200):[],updates:Number(state.updates||0)};
      this.recordMutation(ownerToken);
    }
  }
  upsertNode(label:string,type:SemanticNode['type'],salience:number,sourceKey='',ownerToken?:string):SemanticNode {
    const clean=normalize(label); if(!clean) throw new Error('semantic-node-empty');
    const namespace=String(sourceKey??'').trim().slice(0,160);
    const existing=this.state.nodes.find(n=>n.label===clean&&n.type===type&&String(n.sourceKey??'')===namespace);
    const now=Date.now();
    if(existing){
      const before=structuredClone(existing);
      existing.salience=clamp(existing.salience*.82+salience*.18); existing.lastSeen=now;
      const after=structuredClone(existing);
      this.recordMutation(ownerToken,()=> {
        const current=this.state.nodes.find(node=>node.id===after.id);
        if(!current||JSON.stringify(current)!==JSON.stringify(after))return false;
        const index=this.state.nodes.findIndex(node=>node.id===after.id);
        this.state.nodes[index]=structuredClone(before);
        this.state.nodes.sort((a,b)=>b.salience-a.salience);
        return true;
      });
      return structuredClone(existing);
    }
    const node:SemanticNode={id:randomUUID(),label:clean,type,salience:clamp(salience),lastSeen:now,...(namespace?{sourceKey:namespace}:{})};
    const before=this.state.nodes;
    const next=[node,...before].sort((a,b)=>b.salience-a.salience).slice(0,1000);
    const nextIds=new Set(next.map(item=>item.id));
    const evicted=before.filter(item=>!nextIds.has(item.id)).map(item=>structuredClone(item));
    this.state.nodes=next;
    const after=structuredClone(node);
    this.recordMutation(ownerToken,()=> {
      const current=this.state.nodes.find(item=>item.id===after.id);
      if(!current||JSON.stringify(current)!==JSON.stringify(after))return false;
      const candidate=this.state.nodes.filter(item=>item.id!==after.id);
      for(const prior of evicted){
        if(!candidate.some(item=>item.id===prior.id))candidate.push(structuredClone(prior));
      }
      if(candidate.length>1000)return false;
      this.state.nodes=candidate.sort((a,b)=>b.salience-a.salience);
      return true;
    });
    return structuredClone(node);
  }
  connect(from:string,to:string,relation:SemanticEdge['relation'],weight:number,ownerToken?:string):SemanticEdge {
    const existing=this.state.edges.find(e=>e.from===from&&e.to===to&&e.relation===relation); const now=Date.now();
    if(existing){
      const before=structuredClone(existing);
      existing.weight=clamp(existing.weight*.78+weight*.22); existing.lastSeen=now;
      const after=structuredClone(existing);
      this.recordMutation(ownerToken,()=> {
        const current=this.state.edges.find(edge=>edge.id===after.id);
        if(!current||JSON.stringify(current)!==JSON.stringify(after))return false;
        const index=this.state.edges.findIndex(edge=>edge.id===after.id);
        this.state.edges[index]=structuredClone(before);
        return true;
      });
      return structuredClone(existing);
    }
    const edge={id:randomUUID(),from,to,relation,weight:clamp(weight),lastSeen:now};
    const before=this.state.edges;
    const next=[edge,...before].slice(0,2200);
    const nextIds=new Set(next.map(item=>item.id));
    const evicted=before.filter(item=>!nextIds.has(item.id)).map(item=>structuredClone(item));
    this.state.edges=next;
    const after=structuredClone(edge);
    this.recordMutation(ownerToken,()=> {
      const current=this.state.edges.find(item=>item.id===after.id);
      if(!current||JSON.stringify(current)!==JSON.stringify(after))return false;
      const candidate=this.state.edges.filter(item=>item.id!==after.id);
      for(const prior of evicted){
        if(!candidate.some(item=>item.id===prior.id))candidate.push(structuredClone(prior));
      }
      if(candidate.length>2200)return false;
      this.state.edges=candidate;
      return true;
    });
    return structuredClone(edge);
  }
  /** Remove one source-scoped projection without replacing unrelated graph state. */
  removeSourceProjection(sourceKey:string,ownerToken?:string):number {
    const key=String(sourceKey??'').trim();
    if(!key)return 0;
    const removedNodes=this.state.nodes.filter(node=>String(node.sourceKey??'')===key).map(node=>structuredClone(node));
    const removed=new Set(removedNodes.map(node=>node.id));
    if(!removed.size)return 0;
    const removedEdges=this.state.edges.filter(edge=>removed.has(edge.from)||removed.has(edge.to)).map(edge=>structuredClone(edge));
    this.state.nodes=this.state.nodes.filter(node=>!removed.has(node.id));
    this.state.edges=this.state.edges.filter(edge=>!removed.has(edge.from)&&!removed.has(edge.to));
    this.recordMutation(ownerToken,()=> {
      for(const old of removedNodes){
        const current=this.state.nodes.find(node=>node.id===old.id);
        if(current&&JSON.stringify(current)!==JSON.stringify(old))return false;
        // A concurrent upsert may recreate the same logical node with a fresh UUID.
        // Do not restore the stale row alongside that newer row.
        if(this.state.nodes.some(node=>node.id!==old.id&&node.label===old.label&&node.type===old.type&&String(node.sourceKey??'')===String(old.sourceKey??'')))return false;
      }
      for(const old of removedEdges){
        const current=this.state.edges.find(edge=>edge.id===old.id);
        if(current&&JSON.stringify(current)!==JSON.stringify(old))return false;
        // Likewise, a replacement edge may use a new UUID but the same semantic key.
        if(this.state.edges.some(edge=>edge.id!==old.id&&edge.from===old.from&&edge.to===old.to&&edge.relation===old.relation))return false;
      }
      const candidateNodes=this.state.nodes.slice();
      for(const old of removedNodes){
        if(!candidateNodes.some(node=>node.id===old.id))candidateNodes.push(structuredClone(old));
      }
      if(candidateNodes.length>1000)return false;
      const nodeIds=new Set(candidateNodes.map(node=>node.id));
      const candidateEdges=this.state.edges.slice();
      for(const old of removedEdges){
        if(!candidateEdges.some(edge=>edge.id===old.id)){
          if(!nodeIds.has(old.from)||!nodeIds.has(old.to))return false;
          candidateEdges.push(structuredClone(old));
        }
      }
      if(candidateEdges.length>2200)return false;
      this.state.nodes=candidateNodes.sort((a,b)=>b.salience-a.salience);
      this.state.edges=candidateEdges;
      return true;
    });
    return removed.size;
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
