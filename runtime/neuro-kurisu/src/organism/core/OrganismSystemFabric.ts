import { SelfSubsystemRuntime } from './SelfSubsystemRuntime.ts';
import { GovernanceSubsystemRuntime } from './GovernanceSubsystemRuntime.ts';
import { MemorySubsystemRuntime } from './MemorySubsystemRuntime.ts';
import { WorldSubsystemRuntime } from './WorldSubsystemRuntime.ts';
import { EmbodimentSubsystemRuntime } from './EmbodimentSubsystemRuntime.ts';
import { AgencySubsystemRuntime } from './AgencySubsystemRuntime.ts';
import { EvidenceResearchSubsystemRuntime } from './EvidenceResearchSubsystemRuntime.ts';
import type { ExternalObserverSourceRegistrationAuthorizer } from '../system/ExternalObserverFabric.ts';
import { organismSystemContract, organismSystemContracts, type OrganismSystemContract, type ResolvedOrganismSystemContract, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { WillIntegrationBridge } from '../integration/will/WillIntegrationBridge.ts';
import { LuminaAdaptationFabric } from '../integration/lumina/LuminaAdaptationFabric.ts';
import { HexisAdaptationFabric } from '../integration/hexis/HexisAdaptationFabric.ts';
import { LettaGovernanceAdaptationFabric } from '../integration/letta/LettaGovernanceAdaptationFabric.ts';
import { ConscioAdaptationFabric } from '../integration/conscio/ConscioAdaptationFabric.ts';
import { buildCognitiveArchitectureSnapshot } from './CognitiveArchitectureMap.ts';

export type OrganismSystemName = 'self'|'governance'|'memory'|'world'|'embodiment'|'agency'|'research';

export interface OrganismSystemFabricSnapshot {
  version: 1;
  systems: Record<OrganismSystemName, unknown> & { willIntegration: unknown; luminaAdaptation: unknown; hexisAdaptation: unknown; lettaGovernanceAdaptation: unknown; conscioAdaptation: unknown };
  capturedAt: number;
}


function runtimeHealth(runtime: { systemName:string; snapshot(): unknown }): OrganismSystemHealthSnapshot {
  const started=Date.now();
  try { const value=runtime.snapshot(); const snapshotKeys=value && typeof value==='object' && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>).length : 1; return {systemName:runtime.systemName, available:true, snapshotKeys, snapshotMs:Date.now()-started, checkedAt:Date.now()}; }
  catch(error) { return {systemName:runtime.systemName, available:false, snapshotKeys:0, snapshotMs:Date.now()-started, checkedAt:Date.now(), error:String((error as any)?.message ?? error).slice(0,160)}; }
}

/**
 * BIG PASS 56: composition root for the seven physical organism systems.
 * The Fabric owns the references and their lifecycle contracts; OrganismCore
 * coordinates cognition but no longer has to know how each organ restores itself.
 * Diagnostic snapshots are deliberately explicit and are not canonical identity state.
 */
export class OrganismSystemFabric {
  readonly self: SelfSubsystemRuntime;
  readonly governance: GovernanceSubsystemRuntime;
  readonly memory: MemorySubsystemRuntime;
  readonly world: WorldSubsystemRuntime;
  readonly embodiment: EmbodimentSubsystemRuntime;
  readonly agency: AgencySubsystemRuntime;
  readonly research: EvidenceResearchSubsystemRuntime;
  /** Cross-cutting adapter integrations are owned by the composition fabric, not by the cognitive orchestration spine. */
  readonly willIntegration: WillIntegrationBridge;
  readonly luminaAdaptation: LuminaAdaptationFabric;
  /** Hexis-derived epistemic, temporal-memory, review, HMX, outbox and connector governance adapter. */
  readonly hexisAdaptation: HexisAdaptationFabric;
  /** Letta-derived source-boundary, telemetry and artifact-review governance adapter. */
  readonly lettaGovernanceAdaptation: LettaGovernanceAdaptationFabric;
  /** Conscio-derived retrieval, federated-skill, liaison, calibration and metabolic adapters. */
  readonly conscioAdaptation: ConscioAdaptationFabric;
  private readonly resolvedContracts: ResolvedOrganismSystemContract[];

  constructor(input: Partial<{
    self: SelfSubsystemRuntime;
    governance: GovernanceSubsystemRuntime;
    memory: MemorySubsystemRuntime;
    world: WorldSubsystemRuntime;
    embodiment: EmbodimentSubsystemRuntime;
    agency: AgencySubsystemRuntime;
    research: EvidenceResearchSubsystemRuntime;
    authorizeSourceRegistration: ExternalObserverSourceRegistrationAuthorizer;
    willIntegration: WillIntegrationBridge;
    luminaAdaptation: LuminaAdaptationFabric;
    hexisAdaptation: HexisAdaptationFabric;
    lettaGovernanceAdaptation: LettaGovernanceAdaptationFabric;
    conscioAdaptation: ConscioAdaptationFabric;
  }> = {}) {
    this.self=input.self ?? new SelfSubsystemRuntime();
    this.governance=input.governance ?? new GovernanceSubsystemRuntime();
    this.memory=input.memory ?? new MemorySubsystemRuntime();
    this.world=input.world ?? new WorldSubsystemRuntime();
    this.embodiment=input.embodiment ?? new EmbodimentSubsystemRuntime();
    this.agency=input.agency ?? new AgencySubsystemRuntime();
    this.research=input.research ?? new EvidenceResearchSubsystemRuntime({
      authorizeSourceRegistration:input.authorizeSourceRegistration,
      // External observer and governance write through the same canonical ledger owner.
      realityEvidenceLedger:this.governance.realityEvidenceLedger,
    });
    this.willIntegration=input.willIntegration ?? new WillIntegrationBridge();
    this.luminaAdaptation=input.luminaAdaptation ?? new LuminaAdaptationFabric();
    this.hexisAdaptation=input.hexisAdaptation ?? new HexisAdaptationFabric();
    this.lettaGovernanceAdaptation=input.lettaGovernanceAdaptation ?? new LettaGovernanceAdaptationFabric();
    this.conscioAdaptation=input.conscioAdaptation ?? new ConscioAdaptationFabric();
    this.resolvedContracts = organismSystemContracts().map(contract => {
      const runtime = this[contract.name!];
      return { ...contract, systemName: runtime.systemName, dependencies:[...runtime.dependencies], capabilityNames:[...contract.capabilityNames], capabilities:[...contract.capabilityNames], snapshot:()=>runtime.snapshot(), health:()=>runtimeHealth(runtime) };
    });
  }

  names(): OrganismSystemName[] { return ['self','governance','memory','world','embodiment','agency','research']; }

  get(name: OrganismSystemName) { return this[name]; }

  snapshot(): OrganismSystemFabricSnapshot {
    return {
      version:1,
      systems:{
        self:this.self.snapshot(),
        governance:this.governance.snapshot(),
        memory:this.memory.snapshot(),
        world:this.world.snapshot(),
        embodiment:this.embodiment.snapshot(),
        agency:this.agency.snapshot(),
        research:this.research.snapshot(),
        willIntegration:this.willIntegration.snapshot(),
        luminaAdaptation:this.luminaAdaptation.snapshot(),
        hexisAdaptation:this.hexisAdaptation.snapshot(),
        lettaGovernanceAdaptation:this.lettaGovernanceAdaptation.snapshot(),
        conscioAdaptation:this.conscioAdaptation.snapshot(),
      },
      capturedAt:Date.now(),
    };
  }

  /** Restore only the physical owners. Derived/non-owned Core engines stay untouched. */
  restoreFromPersisted(persisted: any): void {
    const facets=persisted?.facets ?? {};
    const memory=facets.memory ?? {};
    const cognition=facets.cognition ?? {};
    const advanced=facets.advanced ?? {};
    const learning=facets.learning ?? {};
    const consciousness=facets.consciousness ?? {};
    const evolution=facets.evolution ?? {};
    const system=persisted?.system ?? {};

    this.world.restoreFromPersisted({ persisted, cognition, advanced, consciousness, learning });
    this.memory.restoreFromPersisted({ memory, advanced });
    this.embodiment.restoreFromPersisted({ cognition, embodiment:facets.embodiment ?? {}, advanced });
    this.agency.restore({
      selfProjects:evolution.selfProjects,
      agency:evolution.agency,
      budget:cognition.budget,
      quorum:system.cognitiveQuorum,
      executor:system.autonomousProjectExecutor,
      p67:advanced.p67AutonomousGoalGenesis,
      p68:advanced.p68GoalEcology,
    });
    this.self.restoreFromPersisted({ consciousness, learning, advanced });
    this.governance.restoreFromPersisted({ advanced });
    this.research.restoreFromPersisted(system);
    this.willIntegration.restore(system.willIntegration);
    this.luminaAdaptation.restore(system.luminaAdaptation);
    this.hexisAdaptation.restore(system.hexisAdaptation);
    this.lettaGovernanceAdaptation.restore(system.lettaGovernanceAdaptation);
    this.conscioAdaptation.restore(system.conscioAdaptation);
  }

  contract(name: OrganismSystemName): OrganismSystemContract { return organismSystemContract(name); }

  contracts(): ReadonlyArray<ResolvedOrganismSystemContract> {
    return this.resolvedContracts;
  }

  capabilityMatrix() {
    return this.contracts().map(contract => ({ name:contract.name, phase:contract.phase, estimatedCost01:contract.estimatedCost01, cadenceCycles:contract.cadenceCycles, dependencies:[...contract.dependencies], capabilities:[...contract.capabilityNames], snapshotWeight01:contract.snapshotWeight01 }));
  }

  dependencyOrder(): OrganismSystemName[] {
    return this.names().slice().sort((a,b) => (this.contract(b).executionRank ?? 99) - (this.contract(a).executionRank ?? 99)).reverse();
  }

  dependencyCycles() {
    const contracts=this.contracts();
    const seen=new Set<OrganismSystemName>();
    const stack=new Set<OrganismSystemName>();
    const cycles=new Set<string>();
    const visit=(name:OrganismSystemName, path:OrganismSystemName[])=>{
      if(stack.has(name)){ const at=path.indexOf(name); const cycle=(at>=0?path.slice(at):path).concat(name).join('>'); cycles.add(cycle); return; }
      if(seen.has(name)) return;
      seen.add(name); stack.add(name);
      const deps=contracts.find(c=>c.name===name)?.dependencies ?? [];
      for(const dep of deps) visit(dep, [...path,name]);
      stack.delete(name);
    };
    for(const name of this.names()) visit(name, []);
    return [...cycles];
  }

  executionOrder(): OrganismSystemName[] {
    return this.contracts().slice().sort((a,b)=>(a.executionRank ?? 99)-(b.executionRank ?? 99)).map(c=>c.name);
  }

  systemGraph(){
    return { order:this.executionOrder(), dependencyCycles:this.dependencyCycles(), nodes:this.contracts().map(c=>({name:c.name,phase:c.phase,cost01:c.estimatedCost01,cadence:c.cadenceCycles,executionRank:c.executionRank ?? 99})), edges:this.contracts().flatMap(c=>c.dependencies.map(dep=>({from:dep,to:c.name}))), cognitiveArchitecture:buildCognitiveArchitectureSnapshot() };
  }

  /** Full brain-like system map for the UI; read-only over canonical owners. */
  cognitiveArchitecture(){ return buildCognitiveArchitectureSnapshot(); }

  health(): OrganismSystemHealthSnapshot[] {
    return this.names().map(name => {
      const runtime = this.get(name);
      return runtimeHealth(runtime);
    });
  }

  manifest() {
    return this.names().map(name=>({name, owner:'physical' as const, contract:this.contract(name), api:Object.getOwnPropertyNames(Object.getPrototypeOf(this[name])).filter(k=>k!=='constructor')}));
  }
}
