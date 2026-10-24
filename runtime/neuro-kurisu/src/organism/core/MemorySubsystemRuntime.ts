import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { createHash } from 'node:crypto';
import { LettaMemoryBridge, type LettaCanonicalMemorySyncInput, type LettaMemoryBridgeOptions } from '../integration/letta/LettaMemoryBridge.ts';
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

interface LettaSyncOutboxEntry {
  key: string;
  input: LettaCanonicalMemorySyncInput;
  enqueuedAt: number;
  attempts: number;
  lastError: string | null;
}

export interface LettaSyncOutboxSnapshot {
  version: 1;
  entries: LettaSyncOutboxEntry[];
  completedKeys: string[];
  overflowCount: number;
}

const MAX_LETTA_SYNC_OUTBOX_ENTRIES = 4096;
const MAX_LETTA_SYNC_RECEIPTS = 1024;

/** BIG PASS 51: physical owner for persistent and working-memory machinery. */
export class MemorySubsystemRuntime {
  readonly systemName='memory' as const;
  readonly dependencies=['world'] as const;
  readonly systemCapabilities=['state', 'memory', 'persistence'] as const;
  /** Optional external long-term memory provider; NK1 remains the canonical owner. */
  readonly lettaBridge: LettaMemoryBridge;
  private suppressLettaSync = false;
  private lettaSyncOutbox: LettaSyncOutboxEntry[] = [];
  private lettaSyncCompletedKeys: string[] = [];
  private lettaSyncOutboxOverflowCount = 0;
  private lettaSyncDrainPromise: Promise<void> | null = null;
  private lettaSyncDraining = false;
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
    let input: LettaCanonicalMemorySyncInput;
    if (observation.action === 'forget') {
      input = {
        action: 'forget', id: observation.memoryId, source: 'nk1-memory-fabric',
        kind: 'canonical-memory-lifecycle', reason: observation.reason ?? 'canonical-forget', occurredAt: Date.now(),
      };
    } else {
      const item = observation.item;
      if (!item) return;
      const summary = JSON.stringify({
        canonicalOwner: 'NK1/MemoryFabric', memoryId: item.id,
        lifecycleAction: observation.action, commandId: observation.commandId ?? null, tick: observation.tick,
        content: item.content, context: item.context ?? {}, createdAt: item.createdAt,
        observedAt: item.observedAt ?? null, validFromAt: item.validFromAt ?? null, validUntilAt: item.validUntilAt ?? null,
        epistemicStatus: item.epistemicStatus, supersedesId: item.supersedesId ?? null,
        supersededById: item.supersededById ?? null, revisionGroupId: item.revisionGroupId ?? null,
        revisionSequence: item.revisionSequence ?? null, provenanceClass: item.provenanceClass ?? 'unknown',
        sourceAuthority01: item.sourceAuthority01 ?? null,
      });
      const tags = [
        ...(item.tags ?? []), 'nk1-canonical-memory', 'nk1-kind:' + item.kind,
        'nk1-epistemic:' + item.epistemicStatus, 'nk1-provenance:' + (item.provenanceClass ?? 'unknown'),
        ...(item.supersedesId ? ['nk1-supersedes:' + item.supersedesId] : []),
        ...(item.supersededById ? ['nk1-superseded-by:' + item.supersededById] : []),
      ].slice(0, 24);
      input = {
        action: 'upsert', id: item.id, source: item.source || 'nk1-memory-fabric', kind: item.kind,
        summary, occurredAt: item.observedAt ?? item.createdAt, confidence01: item.confidence, tags,
      };
    }
    this.enqueueLettaSync(input);
  }

  private enqueueLettaSync(input: LettaCanonicalMemorySyncInput): void {
    const key = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    if (input.action === 'forget') {
      // A canonical delete supersedes every unsent upsert for the same memory
      // and takes priority over unrelated failed writes to protect privacy.
      this.lettaSyncOutbox = this.lettaSyncOutbox.filter(
        entry => !(entry.input.action === 'upsert' && entry.input.id === input.id),
      );
    } else if (this.lettaSyncOutbox.some(
      entry => entry.input.action === 'forget' && entry.input.id === input.id,
    )) {
      return; // Never enqueue a stale upsert behind a pending forget.
    }
    if (this.lettaSyncCompletedKeys.includes(key) || this.lettaSyncOutbox.some(entry => entry.key === key)) return;
    if (this.lettaSyncOutbox.length >= MAX_LETTA_SYNC_OUTBOX_ENTRIES) {
      if (input.action === 'forget') {
        const evictIndex = this.lettaSyncOutbox.findLastIndex(entry => entry.input.action === 'upsert');
        if (evictIndex >= 0) {
          this.lettaSyncOutbox.splice(evictIndex, 1);
          this.lettaSyncOutboxOverflowCount += 1;
        } else {
          // Keep the hard bound: overflow is explicit and forces reconciliation.
          this.lettaSyncOutboxOverflowCount += 1;
          return;
        }
      } else {
        this.lettaSyncOutboxOverflowCount += 1;
        return;
      }
    }
    const entry = { key, input: structuredClone(input), enqueuedAt: Date.now(), attempts: 0, lastError: null };
    if (input.action === 'forget') this.lettaSyncOutbox.unshift(entry);
    else this.lettaSyncOutbox.push(entry);
    this.scheduleLettaSyncDrain();
  }

  private scheduleLettaSyncDrain(): void {
    if (!this.lettaBridge.status().enabled || this.lettaSyncOutbox.length === 0 || this.lettaSyncDrainPromise) return;
    let scheduled!: Promise<void>;
    scheduled = Promise.resolve().then(() => this.drainLettaSyncOutbox()).finally(() => {
      if (this.lettaSyncDrainPromise === scheduled) this.lettaSyncDrainPromise = null;
    });
    this.lettaSyncDrainPromise = scheduled;
  }

  private async drainLettaSyncOutbox(): Promise<void> {
    if (this.lettaSyncDraining || !this.lettaBridge.status().enabled) return;
    this.lettaSyncDraining = true;
    try {
      while (this.lettaBridge.status().enabled && this.lettaSyncOutbox.length > 0) {
        const entry = this.lettaSyncOutbox[0];
        entry.attempts += 1;
        try {
          const result = await this.lettaBridge.synchronizeCanonicalMemory(entry.input);
          if (!result.ok) {
            entry.lastError = result.reason ?? 'letta-sync-not-confirmed';
            if (this.lettaSyncOutbox[0]?.key !== entry.key) continue;
            break;
          }
          const pendingIndex = this.lettaSyncOutbox.findIndex(candidate => candidate.key === entry.key);
          if (pendingIndex >= 0) this.lettaSyncOutbox.splice(pendingIndex, 1);
          this.lettaSyncCompletedKeys.push(entry.key);
          if (this.lettaSyncCompletedKeys.length > MAX_LETTA_SYNC_RECEIPTS) {
            this.lettaSyncCompletedKeys = this.lettaSyncCompletedKeys.slice(-MAX_LETTA_SYNC_RECEIPTS);
          }
        } catch (error) {
          entry.lastError = error instanceof Error ? error.message.slice(0, 500) : 'letta-sync-failed';
          if (this.lettaSyncOutbox[0]?.key !== entry.key) continue;
          break;
        }
      }
    } finally {
      this.lettaSyncDraining = false;
    }
  }

  getLettaSyncOutboxSnapshot(): LettaSyncOutboxSnapshot {
    return structuredClone({
      version: 1 as const, entries: this.lettaSyncOutbox,
      completedKeys: this.lettaSyncCompletedKeys, overflowCount: this.lettaSyncOutboxOverflowCount,
    });
  }

  private restoreLettaSyncOutbox(raw: unknown): void {
    this.lettaSyncOutbox = [];
    this.lettaSyncCompletedKeys = [];
    this.lettaSyncOutboxOverflowCount = 0;
    if (!raw || typeof raw !== 'object') return;
    const snapshot = raw as Partial<LettaSyncOutboxSnapshot>;
    if (snapshot.version !== 1 || !Array.isArray(snapshot.entries)) return;
    const validKey = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
    const validOperation = (value: unknown): value is LettaCanonicalMemorySyncInput => {
      if (!value || typeof value !== 'object') return false;
      const operation = value as LettaCanonicalMemorySyncInput;
      if ((operation.action !== 'upsert' && operation.action !== 'forget') || typeof operation.id !== 'string' || !operation.id.trim()) return false;
      if (operation.action === 'upsert') return typeof operation.summary === 'string' && typeof operation.source === 'string' && typeof operation.kind === 'string';
      return true;
    };
    this.lettaSyncOutbox = snapshot.entries.slice(-MAX_LETTA_SYNC_OUTBOX_ENTRIES).flatMap(rawEntry => {
      if (!rawEntry || typeof rawEntry !== 'object') return [];
      const entry = rawEntry as LettaSyncOutboxEntry;
      if (!validKey(entry.key) || !validOperation(entry.input)) return [];
      const expectedKey = createHash('sha256').update(JSON.stringify(entry.input)).digest('hex');
      if (entry.key !== expectedKey) return [];
      return [{
        key: entry.key, input: structuredClone(entry.input),
        enqueuedAt: typeof entry.enqueuedAt === 'number' && Number.isFinite(entry.enqueuedAt) ? Math.max(0, entry.enqueuedAt) : Date.now(),
        attempts: typeof entry.attempts === 'number' && Number.isSafeInteger(entry.attempts) ? Math.max(0, Math.min(100000, entry.attempts)) : 0,
        lastError: typeof entry.lastError === 'string' ? entry.lastError.slice(0, 500) : null,
      }];
    });
    this.lettaSyncCompletedKeys = Array.isArray(snapshot.completedKeys)
      ? snapshot.completedKeys.filter(validKey).slice(-MAX_LETTA_SYNC_RECEIPTS)
      : [];
    this.lettaSyncOutboxOverflowCount = typeof snapshot.overflowCount === 'number' && Number.isSafeInteger(snapshot.overflowCount)
      ? Math.max(0, snapshot.overflowCount) : 0;
  }

  lettaSyncOutboxStatus() {
    return {
      pending: this.lettaSyncOutbox.length, oldestEnqueuedAt: this.lettaSyncOutbox[0]?.enqueuedAt ?? null,
      oldestAttempts: this.lettaSyncOutbox[0]?.attempts ?? 0, oldestLastError: this.lettaSyncOutbox[0]?.lastError ?? null,
      completedReceipts: this.lettaSyncCompletedKeys.length, overflowCount: this.lettaSyncOutboxOverflowCount,
      requiresReconciliation: this.lettaSyncOutboxOverflowCount > 0,
    };
  }

  async flushLettaMemorySync(): Promise<void> {
    if (!this.lettaBridge.status().enabled || this.lettaSyncOutbox.length === 0) {
      if (this.lettaSyncDrainPromise) await this.lettaSyncDrainPromise;
      return;
    }
    if (this.lettaSyncDrainPromise) await this.lettaSyncDrainPromise;
    if (this.lettaSyncOutbox.length > 0 && this.lettaBridge.status().enabled) {
      await this.drainLettaSyncOutbox();
    }
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
    this.restoreLettaSyncOutbox(advanced.lettaSyncOutbox ?? memory.lettaSyncOutbox);
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
    this.scheduleLettaSyncDrain();
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
    p75:this.p75MemoryContinuumOS.snapshot(), fabric:this.fabric.snapshot(), experienceContinuum:this.experienceContinuum.snapshot(), hippocampal:this.hippocampal.snapshot(), hippocampalFormation:this.hippocampalFormation.snapshot(), consolidationController:this.consolidationController.snapshot(), memoryLifecycleAuthority:this.memoryLifecycleAuthority.snapshot(), lettaBridge:this.lettaBridge.snapshot(), lettaSyncOutbox:this.getLettaSyncOutboxSnapshot(),
  }; }
}
