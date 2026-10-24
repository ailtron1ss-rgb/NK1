import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { LettaMemoryBridge, type LettaMemoryBridgeOptions } from '../integration/letta/LettaMemoryBridge.ts';
import { EventLog } from '../memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../memory/MultiTimescaleMemory.ts';
import { AutobiographicalMemory } from '../memory/AutobiographicalMemory.ts';
import { SelfModelEngine } from '../cognition/SelfModelV2.ts';
import { SocialWorldModel } from '../cognition/SocialWorldModel.ts';
import { ValuePlasticity } from '../cognition/ValuePlasticity.ts';
import { RecurrentWorkspaceV2 } from '../cognition/RecurrentWorkspaceV2.ts';
import { SemanticMemoryGraph } from '../memory/SemanticMemoryGraph.ts';
import { MemoryOS2 } from '../developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../developmental/UnifiedMemorySystem.ts';
import { P47TemporalMemoryMind } from '../developmental/P47TemporalMemoryMind.ts';
import { P59MemoryOperatingSystem } from '../developmental/P59MemoryOperatingSystem.ts';
import { P62MemoryFabric } from '../memory/P62MemoryFabric.ts';
import { P65EpistemicLedger } from '../memory/P65EpistemicLedger.ts';
import { P70MemoryLifecycleGovernor } from '../developmental/P70MemoryLifecycleGovernor.ts';
import { P75MemoryContinuumOS } from '../developmental/P75MemoryContinuumOS.ts';
import { MemoryFabric, type MemoryLifecycleObservation } from '../memory/MemoryFabric.ts';
import { ExperienceContinuumFabric } from '../memory/ExperienceContinuumFabric.ts';
import { HippocampalMemorySubstrate } from '../memory/HippocampalMemorySubstrate.ts';
import { HippocampalFormationCircuit } from '../memory/HippocampalFormationCircuit.ts';
import { MemoryConsolidationController } from '../memory/MemoryConsolidationController.ts';
import { CanonicalMemoryLifecycleAuthority } from '../memory/CanonicalMemoryLifecycleAuthority.ts';
import { MemoryRetentionEconomy, defaultMemoryRetentionEconomy } from '../system/MemoryRetentionEconomy.ts';
import { MemoryCausalEconomy, defaultMemoryCausalEconomy } from '../system/MemoryCausalEconomy.ts';
import { CausalLifeGraph } from '../system/CausalLifeGraph.ts';
import { MemoryWorldCausalBridge, defaultMemoryWorldCausalBridge } from '../system/MemoryWorldCausalBridge.ts';

/** BIG PASS 51: physical owner for persistent and working-memory machinery. */
export class MemorySubsystemRuntime {
  readonly systemName='memory' as const;
  readonly dependencies=['world'] as const;
  readonly systemCapabilities=['state', 'memory', 'persistence'] as const;
  /** Optional external long-term memory provider; NK1 remains the canonical owner. */
  readonly lettaBridge: LettaMemoryBridge;
  private suppressLettaSync = false;
  private readonly pendingLettaSyncs = new Set<Promise<void>>();
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly events = new EventLog();
  readonly memories = new MultiTimescaleMemory();
  readonly autobiographical = new AutobiographicalMemory();
  readonly selfModel = new SelfModelEngine();
  readonly socialModel = new SocialWorldModel();
  readonly valuePlasticity = new ValuePlasticity();
  readonly workspaceV2 = new RecurrentWorkspaceV2();
  readonly semanticMemory = new SemanticMemoryGraph();
  readonly memoryOS = new MemoryOS2();
  readonly memorySubstrate = new MemorySubstrateCoordinator();
  readonly unifiedMemory = new UnifiedMemorySystem();
  readonly p47MemoryMind = new P47TemporalMemoryMind();
  readonly p59MemoryOperatingSystem = new P59MemoryOperatingSystem();
  readonly p62MemoryFabric = new P62MemoryFabric();
  readonly p65EpistemicLedger = new P65EpistemicLedger();
  readonly p70MemoryLifecycleGovernor = new P70MemoryLifecycleGovernor();
  readonly p75MemoryContinuumOS = new P75MemoryContinuumOS();
  readonly fabric = new MemoryFabric(this.memoryOS,this.events,this.memories,this.memorySubstrate,this.unifiedMemory,this.p62MemoryFabric,this.semanticMemory);
  readonly experienceContinuum = new ExperienceContinuumFabric();
  readonly hippocampal = new HippocampalMemorySubstrate();
  readonly hippocampalFormation = new HippocampalFormationCircuit();
  readonly consolidationController = new MemoryConsolidationController();
  readonly memoryLifecycleAuthority = new CanonicalMemoryLifecycleAuthority(this.fabric, this.p70MemoryLifecycleGovernor, this.consolidationController);


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly memoryRetentionEconomy = new MemoryRetentionEconomy();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly memoryCausalEconomy = new MemoryCausalEconomy();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly causalLifeGraph = new CausalLifeGraph();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly memoryWorldCausalBridge = new MemoryWorldCausalBridge(96);

  constructor(options: { letta?: LettaMemoryBridgeOptions } = {}) {
    this.lettaBridge = new LettaMemoryBridge(options.letta);
    this.fabric.subscribeLifecycleObserver((observation) => this.onMemoryLifecycleObservation(observation));
  }

  private onMemoryLifecycleObservation(observation: MemoryLifecycleObservation): void {
    if (this.suppressLettaSync || !this.lettaBridge.status().enabled || !observation.memoryId) return;
    let request: Promise<unknown>;
    if (observation.action === 'forget') {
      request = this.lettaBridge.synchronizeCanonicalMemory({
        action: 'forget',
        id: observation.memoryId,
        source: 'nk1-memory-fabric',
        kind: 'canonical-memory-lifecycle',
        reason: observation.reason ?? 'canonical-forget',
        occurredAt: Date.now(),
      });
    } else {
      const item = observation.item;
      if (!item) return;
      const summary = JSON.stringify({
        canonicalOwner: 'NK1/MemoryFabric',
        memoryId: item.id,
        lifecycleAction: observation.action,
        commandId: observation.commandId ?? null,
        tick: observation.tick,
        content: item.content,
        context: item.context ?? {},
        createdAt: item.createdAt,
        observedAt: item.observedAt ?? null,
        validFromAt: item.validFromAt ?? null,
        validUntilAt: item.validUntilAt ?? null,
        epistemicStatus: item.epistemicStatus,
        supersedesId: item.supersedesId ?? null,
        supersededById: item.supersededById ?? null,
        revisionGroupId: item.revisionGroupId ?? null,
        revisionSequence: item.revisionSequence ?? null,
        provenanceClass: item.provenanceClass ?? 'unknown',
        sourceAuthority01: item.sourceAuthority01 ?? null,
      });
      const tags = [
        ...(item.tags ?? []),
        'nk1-canonical-memory',
        'nk1-kind:' + item.kind,
        'nk1-epistemic:' + item.epistemicStatus,
        'nk1-provenance:' + (item.provenanceClass ?? 'unknown'),
        ...(item.supersedesId ? ['nk1-supersedes:' + item.supersedesId] : []),
        ...(item.supersededById ? ['nk1-superseded-by:' + item.supersededById] : []),
      ].slice(0, 24);
      request = this.lettaBridge.synchronizeCanonicalMemory({
        action: 'upsert',
        id: item.id,
        source: item.source || 'nk1-memory-fabric',
        kind: item.kind,
        summary,
        occurredAt: item.observedAt ?? item.createdAt,
        confidence01: item.confidence,
        tags,
      });
    }
    const tracked = request.then(() => undefined, () => undefined);
    this.pendingLettaSyncs.add(tracked);
    void tracked.then(() => { this.pendingLettaSyncs.delete(tracked); });
  }

  /** Wait for best-effort external memory operations before graceful shutdown/tests. */
  async flushLettaMemorySync(): Promise<void> {
    while (this.pendingLettaSyncs.size > 0) await Promise.all([...this.pendingLettaSyncs]);
  }

  async close(): Promise<void> {
    await this.flushLettaMemorySync();
    await this.lettaBridge.close();
  }

  restoreFromPersisted(input: { memory?: any; advanced?: any }) {
    this.suppressLettaSync = true;
    try {
      const memory=input.memory ?? {}; const advanced=input.advanced ?? {};
    this.lettaBridge.restore(advanced.lettaBridge ?? memory.lettaBridge);
    this.events.restore(memory.eventLog);
    this.memories.restore(memory.autobiographicalMemories);
    this.selfModel.restore(memory.selfModel);
    this.socialModel.restore(memory.socialModel);
    this.valuePlasticity.restore(memory.adaptiveValues);
    this.workspaceV2.restore(memory.workspace);
    this.semanticMemory.restore(memory.semanticGraph);
    this.memoryOS.restore(advanced.memoryOS);
    this.fabric.restore(advanced.memoryFabric);
    this.fabric.consolidateCompatibility(this.memories.snapshot({clone:false}), 96, this.memoryLifecycleAuthority.snapshot().lastTick >= 0 ? this.memoryLifecycleAuthority.snapshot().lastTick : 0);
    this.unifiedMemory.restore(advanced.unifiedMemory);
    this.p47MemoryMind.restore(advanced.p47);
    this.p59MemoryOperatingSystem.restore(advanced.p59MemoryOperatingSystem);
    this.p62MemoryFabric.restore(advanced.p62MemoryFabric);
    this.p65EpistemicLedger.restore(advanced.p65EpistemicLedger);
    this.p70MemoryLifecycleGovernor.restore(advanced.p70MemoryLifecycleGovernor);
    this.p75MemoryContinuumOS.restore(advanced.p75MemoryContinuumOS);
    this.experienceContinuum.restore(advanced.experienceContinuum);
    this.hippocampal.restore(advanced.hippocampal);
    this.hippocampalFormation.restore(advanced.hippocampalFormation);
    this.consolidationController.restore(advanced.consolidationController);
    this.memoryLifecycleAuthority.restore(advanced.memoryLifecycleAuthority);
    } finally {
      this.suppressLettaSync = false;
    }
  }

  /**
   * Retrieve canonical NK1 memories and, when explicitly enabled, ask Letta for a
   * separate untrusted candidate set. External text is never promoted to MemoryOS2.
   */
  async retrieveForCognitionWithLettaCandidates(
    query: string,
    options: { limit?: number; goalRelevance?: number; identityRelevance?: number; tick?: number } = {},
  ) {
    const limit = Math.max(1, Math.min(32, Math.floor(Number.isFinite(options.limit) ? Number(options.limit) : 8)));
    const canonicalRecords = await this.fabric.retrieveForCognition(
      query,
      limit,
      options.goalRelevance ?? 0,
      options.identityRelevance ?? 0,
      { tick: options.tick },
    );
    if (!this.lettaBridge.status().enabled) {
      return {
        canonicalRecords,
        externalCandidate: null,
        externalStatus: { status: 'disabled' as const, reason: 'letta-disabled' },
      };
    }
    const recalled = await this.lettaBridge.recall(query, { maxResults: limit });
    if (!recalled.ok || !recalled.response) {
      return {
        canonicalRecords,
        externalCandidate: null,
        externalStatus: { status: 'unavailable' as const, reason: recalled.reason ?? 'letta-empty-response' },
      };
    }
    return {
      canonicalRecords,
      externalCandidate: {
        provider: 'letta' as const,
        content: recalled.response,
        trust: 'untrusted-candidate' as const,
        evidence: 'agent-response-unverified' as const,
        agentId: recalled.agentId,
      },
      externalStatus: { status: 'candidate-available' as const },
    };
  }

  /** Read-only memory hygiene report; destructive repair remains an explicit separate operation. */
  doctor(options:{at?:number;maxIssues?:number}={}) { return this.memoryOS.doctor(options); }

  snapshot() { return {
    events:this.events.recent(64), memories:this.memories.snapshot({clone:false}),
    selfModel:this.selfModel.snapshot(), socialModel:this.socialModel.snapshot(), adaptiveValues:this.valuePlasticity.snapshot(),
    workspace:this.workspaceV2.snapshot(), semanticGraph:this.semanticMemory.snapshot(), memoryOS:this.memoryOS.snapshot(),
    unifiedMemory:this.unifiedMemory.snapshot(), p47:this.p47MemoryMind.snapshot(), p59:this.p59MemoryOperatingSystem.snapshot(),
    p62:this.p62MemoryFabric.snapshot(), p65:this.p65EpistemicLedger.snapshot(), p70:this.p70MemoryLifecycleGovernor.snapshot(),
    p75:this.p75MemoryContinuumOS.snapshot(), fabric:this.fabric.snapshot(), experienceContinuum:this.experienceContinuum.snapshot(), hippocampal:this.hippocampal.snapshot(), hippocampalFormation:this.hippocampalFormation.snapshot(), consolidationController:this.consolidationController.snapshot(), memoryLifecycleAuthority:this.memoryLifecycleAuthority.snapshot(), lettaBridge:this.lettaBridge.snapshot(),
  }; }
}
