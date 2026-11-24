import { AspectIntegrationGraph, type AspectFabricAspect, type AspectFabricSystem } from './AspectIntegrationGraph.ts';
import type { OrganismSystemFabric, OrganismSystemName } from './OrganismSystemFabric.ts';
import type { CognitiveSubsystemRegistry } from './CognitiveSubsystemRegistry.ts';

type SystemHealth = ReturnType<OrganismSystemFabric['health']>;
type SubsystemHealth = ReturnType<CognitiveSubsystemRegistry['health']>;
type GraphHealth = ReturnType<AspectIntegrationGraph['health']>;
type SystemCoverage = Array<{ id:AspectFabricSystem; titleRu:string; aspects:number; present:boolean }>;

export interface OrganismAspectFabricSnapshot {
  version:1; tick:number; connected:boolean;
  graph:ReturnType<AspectIntegrationGraph['snapshot']>;
  systems:SystemHealth; subsystems:SubsystemHealth;
  coverage:SystemCoverage;
  branchProvenance:Array<{ n:number; id:string; system:AspectFabricSystem; branches:AspectFabricAspect['branches'] }>;
  capturedAt:number;
}

/** Composition adapter: one organism root -> seven physical systems -> 75 aspects. */
export class OrganismAspectFabric {
  private readonly graph:AspectIntegrationGraph;
  private readonly systems:OrganismSystemFabric;
  private readonly subsystems?:CognitiveSubsystemRegistry;
  private ticks=0;
  constructor(graph:AspectIntegrationGraph, systems:OrganismSystemFabric, subsystems?:CognitiveSubsystemRegistry) {
    const validation=graph.validate();
    if(!validation.ok) throw new Error(`invalid-aspect-fabric:${validation.errors.slice(0,4).join('; ')}`);
    this.graph=graph; this.systems=systems; this.subsystems=subsystems;
  }
  tick(){ this.ticks+=1; return this.snapshot(); }
  systemCoverage():SystemCoverage {
    const present=new Set<OrganismSystemName>(this.systems.names());
    return this.graph.manifest.systems.map(s=>({ id:s.id, titleRu:s.titleRu, aspects:s.aspects.length, present:present.has(s.id as OrganismSystemName) }));
  }
  branchProvenance() {
    return this.graph.manifest.aspects.map(a=>({ n:a.n, id:a.id, system:a.system, branches:a.branches }));
  }
  health():{ ok:boolean; graph:GraphHealth; systems:SystemHealth; subsystems:SubsystemHealth; missingSystems:AspectFabricSystem[]; coverage:SystemCoverage } {
    const graph=this.graph.health();
    const systems=this.systems.health();
    const subsystems=this.subsystems?.health()??[];
    const present=new Set(systems.filter(s=>s.available).map(s=>s.systemName));
    const missingSystems=this.graph.manifest.systems.filter(s=>!present.has(s.id)).map(s=>s.id);
    return { ok:graph.ok&&missingSystems.length===0, graph, systems, subsystems, missingSystems, coverage:this.systemCoverage() };
  }
  assertConnected() {
    const health=this.health();
    if(!health.ok) throw new Error(`aspect-fabric-not-connected:${health.missingSystems.join(',')||health.graph.errors.join('; ')}`);
    return health;
  }
  snapshot():OrganismAspectFabricSnapshot {
    const health=this.health();
    return { version:1, tick:this.ticks, connected:health.ok, graph:this.graph.snapshot(), systems:health.systems, subsystems:health.subsystems, coverage:health.coverage, branchProvenance:this.branchProvenance(), capturedAt:Date.now() };
  }
}
