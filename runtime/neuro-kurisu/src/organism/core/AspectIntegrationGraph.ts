export type AspectFabricSystem = 'self'|'governance'|'memory'|'world'|'embodiment'|'agency'|'research';

export interface AspectBranchProvenance {
  total:number; open:number; merged:number; closed:number; noPr:number;
  topBranches:Array<{ branch:string; head:string; pr:number|null; state:string; changed:number; confidence:string }>;
  openPrs:Array<{ number:number|null; branch:string; changed:number; behind:number|null }>;
}

export interface AspectFabricAspect {
  n:number; id:string; titleRu:string; titleEn:string; group:string; wave:string;
  system:AspectFabricSystem; owner:string; ownerStatus:string; ownerExists:boolean;
  dependsOn:number[]; dependsOnIds?:string[]; verificationGate:string; status:string;
  branches:AspectBranchProvenance;
}

export interface AspectFabricManifest {
  schemaVersion:1; name:string; generatedFrom:string; trunk:string|null;
  organism:{ id:string; titleRu:string; systems:AspectFabricSystem[] };
  systems:Array<{ id:AspectFabricSystem; titleRu:string; aspects:number[]; domains:string[] }>;
  domains:Array<{ id:string; titleRu:string; system:AspectFabricSystem|null; aspects:number[] }>;
  aspects:AspectFabricAspect[];
  edges:Array<{ from:string|number; to:string|number; kind:string }>;
  coverage:{
    aspects:number; domains:number; systems:number; mapped:number; ownerExists:number;
    missingOwners:Array<{ n:number; id:string; owner:string }>; systemsCovered:number; domainsCovered:number;
    connected?:boolean; reachable?:number; nodes?:number;
  };
  branchProvenance:null|{
    totalBranches:number; prStates:Record<string,number>;
    groupOnly:{ total:number; byGroup:Record<string,number> };
    legacy:{ total:number; examples:string[] };
  };
  validation?:{ ok:boolean; errors:string[]; warnings:string[] };
}

export interface AspectFabricValidation {
  ok:boolean; errors:string[]; warnings:string[]; connected:boolean; reachable:number; nodes:number; cycles:number;
}

export interface AspectFabricSnapshot {
  version:1; trunk:string|null;
  organism:{ id:string; titleRu:string; systems:AspectFabricSystem[] };
  nodes:Array<{ n:number; id:string; titleRu:string; group:string; system:AspectFabricSystem; owner:string; ownerExists:boolean; status:string; wave:string; dependsOn:number[]; branches:Pick<AspectBranchProvenance,'total'|'open'|'merged'|'closed'|'noPr'> }>;
  edges:Array<{ from:string|number; to:string|number; kind:string }>;
  systems:Array<{ id:AspectFabricSystem; titleRu:string; aspects:number[]; domains:string[] }>;
  domains:Array<{ id:string; titleRu:string; system:AspectFabricSystem|null; aspects:number[] }>;
  coverage:AspectFabricManifest['coverage'];
  health:ReturnType<AspectIntegrationGraph['health']>;
  capturedAt:number;
}

/** Read-only graph over the 75-aspect registry. It does not import owners or mutate runtime state. */
export class AspectIntegrationGraph {
  readonly manifest:AspectFabricManifest;
  constructor(manifest:AspectFabricManifest){ this.manifest=manifest; }

  validate():AspectFabricValidation {
    const errors:string[]=[]; const warnings:string[]=[];
    const m=this.manifest;
    if(m?.schemaVersion!==1) errors.push('schemaVersion must equal 1');
    if(!Array.isArray(m?.aspects)||m.aspects.length!==75) errors.push(`aspects must contain 75 entries, found ${m?.aspects?.length ?? 0}`);
    if(!Array.isArray(m?.domains)||m.domains.length!==10) errors.push(`domains must contain 10 entries, found ${m?.domains?.length ?? 0}`);
    if(!Array.isArray(m?.systems)||m.systems.length!==7) errors.push(`systems must contain 7 entries, found ${m?.systems?.length ?? 0}`);
    const systemIds=new Set((m?.systems??[]).map(s=>s.id));
    const byN=new Map<number,AspectFabricAspect>(); const seenId=new Set<string>();
    for(const a of m?.aspects??[]){
      if(!Number.isInteger(a.n)) errors.push('aspect n must be an integer');
      if(byN.has(a.n)) errors.push(`duplicate aspect n ${a.n}`);
      if(seenId.has(a.id)) errors.push(`duplicate aspect id ${a.id}`);
      byN.set(a.n,a); seenId.add(a.id);
      if(!systemIds.has(a.system)) errors.push(`aspect ${a.n} has invalid system ${a.system}`);
      if(typeof a.owner!=='string'||!a.owner.length) errors.push(`aspect ${a.n} has empty owner`);
      if(!Array.isArray(a.dependsOn)) errors.push(`aspect ${a.n} dependsOn must be an array`);
    }
    for(const a of m?.aspects??[]){
      for(const dep of a.dependsOn??[]){
        if(dep===a.n) errors.push(`aspect ${a.n} depends on itself`);
        else if(!byN.has(dep)) errors.push(`aspect ${a.n} depends on unknown aspect ${dep}`);
      }
    }
    for(const s of m?.systems??[]) if(!s.aspects?.length) errors.push(`system ${s.id} has no aspects`);
    for(const d of m?.domains??[]) if(!d.aspects?.length) errors.push(`domain ${d.id} has no aspects`);
    const weak=this.weakConnectivity();
    if(!weak.connected) errors.push(`fabric graph is disconnected: ${weak.reachable}/${weak.nodes}`);
    const cycles=this.detectCycles();
    if(cycles>0) errors.push(`dependency graph has ${cycles} cycle(s)`);
    const provenance=m?.branchProvenance;
    if(provenance){
      const aspectTotal=(m.aspects??[]).reduce((sum,a)=>sum+(a.branches?.total??0),0);
      if(provenance.totalBranches!==aspectTotal+provenance.groupOnly.total+provenance.legacy.total){
        warnings.push(`branch provenance totals: ${aspectTotal}+${provenance.groupOnly.total}+${provenance.legacy.total} != ${provenance.totalBranches}`);
      }
    }
    return { ok:errors.length===0, errors, warnings, connected:weak.connected, reachable:weak.reachable, nodes:weak.nodes, cycles };
  }

  health(){
    const v=this.validate();
    const systems=this.manifest.systems.map(s=>({ id:s.id, titleRu:s.titleRu, aspects:s.aspects.length, available:s.aspects.length>0 }));
    const orphans=this.manifest.aspects.filter(a=>!systems.some(s=>s.id===a.system&&s.available)).map(a=>a.n);
    const missingOwners=this.manifest.aspects.filter(a=>!a.ownerExists).map(a=>({ n:a.n, id:a.id, owner:a.owner }));
    return { ok:v.ok&&orphans.length===0, connected:v.connected, systems, orphans, missingOwners, cycles:v.cycles, errors:v.errors, warnings:v.warnings };
  }

  snapshot():AspectFabricSnapshot {
    return {
      version:1, trunk:this.manifest.trunk, organism:{ ...this.manifest.organism, systems:[...this.manifest.organism.systems] },
      nodes:this.manifest.aspects.map(a=>({ n:a.n, id:a.id, titleRu:a.titleRu, group:a.group, system:a.system, owner:a.owner, ownerExists:a.ownerExists, status:a.status, wave:a.wave, dependsOn:[...a.dependsOn], branches:{ total:a.branches.total, open:a.branches.open, merged:a.branches.merged, closed:a.branches.closed, noPr:a.branches.noPr } })),
      edges:this.manifest.edges.map(e=>({ ...e })),
      systems:this.manifest.systems.map(s=>({ ...s, aspects:[...s.aspects], domains:[...s.domains] })),
      domains:this.manifest.domains.map(d=>({ ...d, aspects:[...d.aspects] })),
      coverage:{ ...this.manifest.coverage, missingOwners:[...this.manifest.coverage.missingOwners] },
      health:this.health(), capturedAt:Date.now(),
    };
  }

  neighbors(n:number):number[] {
    const out=new Set<number>();
    for(const a of this.manifest.aspects){ if(a.n===n) for(const d of a.dependsOn) out.add(d); if(a.dependsOn.includes(n)) out.add(a.n); }
    return [...out].sort((a,b)=>a-b);
  }

  topologicalOrder():number[] {
    const indegree=new Map<number,number>(); const adj=new Map<number,number[]>();
    for(const a of this.manifest.aspects){ indegree.set(a.n,0); adj.set(a.n,[]); }
    for(const a of this.manifest.aspects) for(const d of a.dependsOn){ adj.get(d)?.push(a.n); indegree.set(a.n,(indegree.get(a.n)??0)+1); }
    const queue=[...indegree.entries()].filter(([,v])=>v===0).map(([k])=>k).sort((a,b)=>a-b);
    const order:number[]=[];
    while(queue.length){ const n=queue.shift()!; order.push(n); for(const m of adj.get(n)??[]){ const next=(indegree.get(m)??0)-1; indegree.set(m,next); if(next===0){ queue.push(m); queue.sort((a,b)=>a-b); } } }
    return order.length===this.manifest.aspects.length?order:[];
  }

  path(from:number,to:number):number[]|null {
    if(from===to) return [from];
    const adj=new Map<number,number[]>(); for(const a of this.manifest.aspects) adj.set(a.n,[...a.dependsOn]);
    const queue:number[][]=[[from]]; const seen=new Set<number>([from]);
    while(queue.length){ const p=queue.shift()!; const last=p[p.length-1]; for(const n of adj.get(last)??[]){ if(seen.has(n)) continue; const next=[...p,n]; if(n===to) return next; seen.add(n); queue.push(next); } }
    return null;
  }

  toJSON():AspectFabricManifest { return this.manifest; }

  private weakConnectivity():{ connected:boolean; reachable:number; nodes:number } {
    const nodes=new Set<string>(['organism']); for(const s of this.manifest.systems) nodes.add(`system:${s.id}`); for(const a of this.manifest.aspects) nodes.add(String(a.n));
    const adj=new Map<string,Set<string>>([...nodes].map(n=>[n,new Set<string>()]));
    for(const e of this.manifest.edges){ const a=String(e.from),b=String(e.to); if(!adj.has(a)||!adj.has(b)) continue; adj.get(a)!.add(b); adj.get(b)!.add(a); }
    const start=nodes.values().next().value as string; const seen=new Set<string>([start]); const stack=[start];
    while(stack.length){ const n=stack.pop()!; for(const m of adj.get(n)??[]) if(!seen.has(m)){ seen.add(m); stack.push(m); } }
    return { connected:seen.size===nodes.size, reachable:seen.size, nodes:nodes.size };
  }

  private detectCycles():number {
    const byN=new Map(this.manifest.aspects.map(a=>[a.n,a])); const color=new Map<number,number>(); let cycles=0;
    const visit=(n:number)=>{ color.set(n,1); for(const d of byN.get(n)?.dependsOn??[]){ if(!byN.has(d)) continue; if(color.get(d)===1){ cycles++; continue; } if((color.get(d)??0)===0) visit(d); } color.set(n,2); };
    for(const a of this.manifest.aspects) if((color.get(a.n)??0)===0) visit(a.n);
    return cycles;
  }
}
