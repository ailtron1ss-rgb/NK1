import { SelfSubsystemRuntime } from './SelfSubsystemRuntime.ts';
import { GovernanceSubsystemRuntime } from './GovernanceSubsystemRuntime.ts';
import { MemorySubsystemRuntime } from './MemorySubsystemRuntime.ts';
import { WorldSubsystemRuntime } from './WorldSubsystemRuntime.ts';
import { EmbodimentSubsystemRuntime } from './EmbodimentSubsystemRuntime.ts';
import { AgencySubsystemRuntime } from './AgencySubsystemRuntime.ts';
import { EvidenceResearchSubsystemRuntime } from './EvidenceResearchSubsystemRuntime.ts';
import { organismSystemContract, organismSystemContracts, type OrganismSystemContract, type ResolvedOrganismSystemContract, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { WillIntegrationBridge } from '../integration/will/WillIntegrationBridge.ts';
import { LuminaAdaptationFabric } from '../integration/lumina/LuminaAdaptationFabric.ts';
import { HexisAdaptationFabric, type HexisGoalProposal } from '../integration/hexis/HexisAdaptationFabric.ts';
import { HexisCanonicalMemoryProjector } from '../integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { LettaGovernanceAdaptationFabric } from '../integration/letta/LettaGovernanceAdaptationFabric.ts';
import { ConscioAdaptationFabric } from '../integration/conscio/ConscioAdaptationFabric.ts';
import { buildCognitiveArchitectureSnapshot } from './CognitiveArchitectureMap.ts';
import { sha256Stable } from './StableSerialization.ts';

export type OrganismSystemName = 'self'|'governance'|'memory'|'world'|'embodiment'|'agency'|'research';

export interface OrganismSystemFabricSnapshot {
  version: 1;
  systems: Record<OrganismSystemName, unknown> & { willIntegration: unknown; luminaAdaptation: unknown; hexisAdaptation: unknown; lettaGovernanceAdaptation: unknown; conscioAdaptation: unknown };
  capturedAt: number;
}


const hmxGraphRelation=(value:unknown):'supports'|'contradicts'|'causes'|'associated'|'about'|'located' => {
  const relation=String(value??'').toLowerCase();
  if(relation==='supports'||relation==='contradicts'||relation==='causes'||relation==='about'||relation==='located'||relation==='associated') return relation;
  return 'associated';
};

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
    this.research=input.research ?? new EvidenceResearchSubsystemRuntime();
    this.willIntegration=input.willIntegration ?? new WillIntegrationBridge();
    this.luminaAdaptation=input.luminaAdaptation ?? new LuminaAdaptationFabric();
    this.hexisAdaptation=input.hexisAdaptation ?? new HexisAdaptationFabric();
    const canonicalMemoryProjector = new HexisCanonicalMemoryProjector(this.memory.fabric, this.memory.semanticMemory, this.hexisAdaptation);
    this.hexisAdaptation.bindCanonicalMemoryApply(stage => canonicalMemoryProjector.apply(stage));
    this.hexisAdaptation.bindCanonicalBeliefProjection(projection => {
      const canonical = this.memory.fabric.canonicalSnapshot(false).items.find(item => item.id === projection.memoryId);
      if (!canonical) return 'unavailable';
      const evidenceDigest = sha256Stable(projection.evidenceKey, 'legacy');
      const independenceKey = 'hexis-belief:' + evidenceDigest;
      const canonicalLineageKey = 'lineage:' + independenceKey.toLowerCase();
      const priorSources = Array.isArray(canonical.evidenceSources) ? canonical.evidenceSources : [];
      const alreadyKnown = canonical.evidenceLineageKeys?.includes(canonicalLineageKey) ||
        priorSources.some(source => String(source.independenceKey ?? '').trim().normalize('NFKC').toLowerCase() === independenceKey.toLowerCase());
      if (alreadyKnown) return 'duplicate';
      const evidenceSource = {
        source: 'hexis-evidence:' + evidenceDigest,
        provenanceClass: 'external' as const,
        sourceAuthority01: projection.evidenceTrust01,
        independenceKey,
        observedAt: projection.at,
        evidenceFreshnessAt: projection.at,
      };
      const updated = this.memory.fabric.updateSignals(
        projection.memoryId,
        { confidence: projection.posteriorConfidence01, evidenceSources: [evidenceSource] },
        'hexis-belief-revision:' + projection.stance + ':' + evidenceDigest.slice(0, 16),
        { commandId: 'hexis-belief-revision:' + projection.auditId },
      );
      if (!updated) throw new Error('hexis-canonical-belief-projection-failed');
      return 'projected';
    });
    this.lettaGovernanceAdaptation=input.lettaGovernanceAdaptation ?? new LettaGovernanceAdaptationFabric();
    this.conscioAdaptation=input.conscioAdaptation ?? new ConscioAdaptationFabric();
    this.resolvedContracts = organismSystemContracts().map(contract => {
      const runtime = this[contract.name!];
      return { ...contract, systemName: runtime.systemName, dependencies:[...runtime.dependencies], capabilityNames:[...contract.capabilityNames], capabilities:[...contract.capabilityNames], snapshot:()=>runtime.snapshot(), health:()=>runtimeHealth(runtime) };
    });
  }

  /**
   * Materialize only an explicitly approved Hexis goal into NK1's agency project
   * registry. The canonical project remains paused, never 'proposed', until the
   * caller invokes activateHexisGoalProposal() as a separate decision.
   */
  materializeApprovedHexisGoalProposal(proposalId:string):{
    proposal:HexisGoalProposal;
    project:import('../cognition/evolution/SelfProjectEngine.ts').SelfProject;
  } {
    const proposal=this.hexisAdaptation.getGoalProposal(proposalId);
    if(!proposal) throw new Error('hexis-goal-proposal-not-found');
    const existingProject=this.agency.selfProjects.snapshot().projects.find(project=>project.hexisProposalId===proposal.id);
    if(proposal.status==='materialized'){
      if(!existingProject || existingProject.id!==proposal.canonicalGoalId) throw new Error('hexis-materialized-goal-project-missing');
      return {proposal,project:existingProject};
    }
    if(proposal.status!=='approved') throw new Error('hmx-goal-must-be-approved-before-materialization');

    const projectState=this.agency.selfProjects.snapshot();
    const hexisState=this.hexisAdaptation.snapshot();
    try {
      const project=this.agency.selfProjects.materializeApprovedHexisGoal({
        proposalId:proposal.id,
        sourceLineageId:proposal.sourceLineageId,
        sourceRef:proposal.sourceRef,
        title:proposal.title,
        description:proposal.description,
        importance:proposal.importance,
        urgency:proposal.urgency,
        confidence:proposal.confidence,
        approvedAt:proposal.decidedAt ?? proposal.createdAt,
      });
      const materialized=this.hexisAdaptation.markGoalProposalMaterialized(proposal.id,project.id);
      if(!materialized || materialized.status!=='materialized') throw new Error('hexis-goal-materialization-receipt-failed');
      return {proposal:materialized,project};
    } catch(error) {
      this.agency.selfProjects.restore(projectState);
      this.hexisAdaptation.restore(hexisState);
      throw error;
    }
  }

  /**
   * Explicit activation gate. Resolve already-imported memory endpoints by their
   * source refs, project only resolvable goal edges, and record deferred edges
   * rather than pretending unresolved Hexis relationships were integrated.
   */
  activateHexisGoalProposal(proposalId:string):{
    proposal:HexisGoalProposal;
    project:import('../cognition/evolution/SelfProjectEngine.ts').SelfProject;
    receipt:NonNullable<HexisGoalProposal['goalRelationshipReceipt']>;
  } {
    const proposal=this.hexisAdaptation.getGoalProposal(proposalId);
    if(!proposal) throw new Error('hexis-goal-proposal-not-found');
    if(proposal.status!=='materialized' || !proposal.canonicalGoalId) throw new Error('hmx-goal-must-be-materialized-before-activation');
    const project=this.agency.selfProjects.snapshot().projects.find(item=>item.id===proposal.canonicalGoalId && item.hexisProposalId===proposal.id);
    if(!project) throw new Error('hexis-materialized-goal-project-missing');
    if(proposal.goalRelationshipReceipt){
      if(project.status==='active') return {proposal,project,receipt:proposal.goalRelationshipReceipt};
      throw new Error('hexis-goal-activation-state-inconsistent');
    }

    const projectState=this.agency.selfProjects.snapshot();
    const hexisState=this.hexisAdaptation.snapshot();
    const graphState=this.memory.semanticMemory.snapshot();
    try {
      const activeProject=this.agency.selfProjects.activateApprovedHexisGoal(proposal.canonicalGoalId,proposal.id);
      if(!activeProject) throw new Error('hexis-goal-project-activation-failed');

      const stage=this.hexisAdaptation.getHmxStage(proposal.stageId);
      const stageIsApplied=Boolean(stage?.status==='applied');
      const relationshipRows=stage && Array.isArray(stage.stagedSections?.relationships)
        ? stage.stagedSections.relationships.filter((row:any)=>String(row?.source_ref??'')===proposal.sourceRef||String(row?.target_ref??'')===proposal.sourceRef)
        : [];
      const graphSourceKey='hexis:'+sha256Stable(proposal.sourceLineageId,'legacy').slice(0,12)+':goal:'+sha256Stable(proposal.sourceRef,'legacy').slice(0,24);
      const goalNode=this.memory.semanticMemory.upsertNode(proposal.title,'goal',proposal.importance,graphSourceKey);
      const semanticEdgeIds:string[]=[];
      let deferred=0;
      const canonicalItems=this.memory.fabric.canonicalSnapshot(false).items;
      const graphNodes=this.memory.semanticMemory.snapshot().nodes;

      for(const row of relationshipRows){
        if(!stageIsApplied){deferred++;continue;}
        const sourceRef=String(row?.source_ref??'');
        const targetRef=String(row?.target_ref??'');
        const otherRef=sourceRef===proposal.sourceRef?targetRef:sourceRef;
        if(!otherRef || otherRef===proposal.sourceRef){deferred++;continue;}
        const canonicalMemory=canonicalItems.find(item=>
          item.context?.hexisMemoryRef===otherRef &&
          item.context?.hexisSourceLineageId===proposal.sourceLineageId
        );
        const endpointKey=String(canonicalMemory?.context?.hexisGraphSourceKey??'');
        const endpointNode=endpointKey?graphNodes.find(node=>String(node.sourceKey??'')===endpointKey):undefined;
        if(!endpointNode){deferred++;continue;}
        const relation=hmxGraphRelation(row?.edge_type);
        const weightValue=row?.properties?.weight ?? row?.properties?.confidence ?? .55;
        const weight=Number.isFinite(Number(weightValue))?Math.max(0,Math.min(1,Number(weightValue))):.55;
        const edge=sourceRef===proposal.sourceRef
          ? this.memory.semanticMemory.connect(goalNode.id,endpointNode.id,relation,weight)
          : this.memory.semanticMemory.connect(endpointNode.id,goalNode.id,relation,weight);
        semanticEdgeIds.push(edge.id);
      }
      const receipt={
        sourceStageFound:stageIsApplied,
        candidateRelationships:relationshipRows.length,
        projected:semanticEdgeIds.length,
        deferred,
        semanticEdgeIds:[...new Set(semanticEdgeIds)],
        at:Date.now(),
      };
      const activated=this.hexisAdaptation.markGoalProposalActivated(proposal.id,proposal.canonicalGoalId,receipt);
      if(!activated) throw new Error('hexis-goal-activation-receipt-failed');
      this.agency.deliberation.record({
        requestedAction:null,
        chosenAction:'activate-approved-hexis-goal',
        externalPressure:.65,
        intrinsicPressure:.35,
        reason:'explicit approval followed by explicit Hexis goal activation: '+proposal.id,
        autonomous:false,
      });
      return {proposal:activated,project:activeProject,receipt:activated.goalRelationshipReceipt!};
    } catch(error) {
      this.memory.semanticMemory.restore(graphState);
      this.agency.selfProjects.restore(projectState);
      this.hexisAdaptation.restore(hexisState);
      throw error;
    }
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
