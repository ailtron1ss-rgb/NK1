import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { EventLog } from '../memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../memory/MultiTimescaleMemory.ts';
import { AutobiographicalMemory } from '../memory/AutobiographicalMemory.ts';
import { SelfModelEngine } from '../cognition/SelfModelV2.ts';
import { SocialWorldModel } from '../cognition/SocialWorldModel.ts';
import { ValuePlasticity } from '../cognition/ValuePlasticity.ts';
import { RecurrentWorkspaceV2 } from '../cognition/RecurrentWorkspaceV2.ts';
import { AttentionAllocator } from '../cognition/AttentionSchema.ts';
import { SemanticMemoryGraph } from '../memory/SemanticMemoryGraph.ts';
import { MemoryOS2 } from '../developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../developmental/UnifiedMemorySystem.ts';
import { P47TemporalMemoryMind } from '../developmental/P47TemporalMemoryMind.ts';
import { P59MemoryOperatingSystem } from '../developmental/P59MemoryOperatingSystem.ts';
import { P62MemoryFabric } from '../memory/P62MemoryFabric.ts';
import { P65EpistemicLedger } from '../memory/P65EpistemicLedger.ts';
import { SourceMonitor } from '../memory/SourceMonitor.ts';
import { HexisCanonicalEvidenceBridge } from '../integration/hexis/HexisCanonicalEvidenceBridge.ts';
import { P70MemoryLifecycleGovernor } from '../developmental/P70MemoryLifecycleGovernor.ts';
import { P75MemoryContinuumOS } from '../developmental/P75MemoryContinuumOS.ts';
import { MemoryFabric } from '../memory/MemoryFabric.ts';
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
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly events = new EventLog();
  readonly memories = new MultiTimescaleMemory();
  readonly autobiographical = new AutobiographicalMemory();
  readonly selfModel = new SelfModelEngine();
  readonly socialModel = new SocialWorldModel();
  readonly valuePlasticity = new ValuePlasticity();
  readonly workspaceV2 = new RecurrentWorkspaceV2();
  /** Canonical attention allocator; its bounded state is persisted with memory. */
  readonly attentionAllocator = new AttentionAllocator();
  readonly semanticMemory = new SemanticMemoryGraph();
  readonly memoryOS = new MemoryOS2();
  readonly memorySubstrate = new MemorySubstrateCoordinator();
  readonly unifiedMemory = new UnifiedMemorySystem();
  readonly p47MemoryMind = new P47TemporalMemoryMind();
  readonly p59MemoryOperatingSystem = new P59MemoryOperatingSystem();
  readonly p62MemoryFabric = new P62MemoryFabric();
  readonly p65EpistemicLedger = new P65EpistemicLedger();
  readonly sourceMonitor = new SourceMonitor();
  readonly p70MemoryLifecycleGovernor = new P70MemoryLifecycleGovernor();
  readonly p75MemoryContinuumOS = new P75MemoryContinuumOS();
  readonly fabric = new MemoryFabric(this.memoryOS,this.events,this.memories,this.memorySubstrate,this.unifiedMemory,this.p62MemoryFabric,this.semanticMemory);
  /** One-way OMEGA/Hexis provenance bridge; MemoryFabric remains the canonical write boundary. */
  readonly hexisCanonicalEvidenceBridge = new HexisCanonicalEvidenceBridge(this.fabric, this.sourceMonitor, this.p65EpistemicLedger);
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
  restoreFromPersisted(input: { memory?: any; advanced?: any }) {
    const memory=input.memory ?? {}; const advanced=input.advanced ?? {};
    this.events.restore(memory.eventLog);
    this.memories.restore(memory.autobiographicalMemories);
    this.selfModel.restore(memory.selfModel);
    this.socialModel.restore(memory.socialModel);
    this.valuePlasticity.restore(memory.adaptiveValues);
    this.workspaceV2.restore(memory.workspace);
    // Attention allocation state (dwell/inhibition/switch counts) is part of the
    // organism's working memory and must survive a restart.
    this.attentionAllocator.restore(memory.attentionAllocator);
    this.semanticMemory.restore(memory.semanticGraph);
    this.memoryOS.restore(advanced.memoryOS);
    this.fabric.restore(advanced.memoryFabric);
    this.unifiedMemory.restore(advanced.unifiedMemory);
    this.p47MemoryMind.restore(advanced.p47);
    this.p59MemoryOperatingSystem.restore(advanced.p59MemoryOperatingSystem);
    this.p62MemoryFabric.restore(advanced.p62MemoryFabric);
    this.p65EpistemicLedger.restore(advanced.p65EpistemicLedger);
    this.sourceMonitor.restore(advanced.hexisSourceMonitor ?? advanced.sourceMonitor);
    this.p70MemoryLifecycleGovernor.restore(advanced.p70MemoryLifecycleGovernor);
    this.p75MemoryContinuumOS.restore(advanced.p75MemoryContinuumOS);
    this.experienceContinuum.restore(advanced.experienceContinuum);
    this.hippocampal.restore(advanced.hippocampal);
    this.hippocampalFormation.restore(advanced.hippocampalFormation);
    this.consolidationController.restore(advanced.consolidationController);
    this.memoryLifecycleAuthority.restore(advanced.memoryLifecycleAuthority);
    // Import legacy rows using the persisted lifecycle tick; doing this before restore
    // would silently reset compatibility timestamps to tick zero on every restart.
    const restoredLifecycleTick=this.memoryLifecycleAuthority.snapshot().lastTick;
    this.fabric.consolidateCompatibility(this.memories.snapshot({clone:false}), 96, restoredLifecycleTick >= 0 ? restoredLifecycleTick : 0);
    // Preserve learned memory policy and causal life continuity across process restarts.
    this.memoryRetentionEconomy.restore(advanced.memoryRetentionEconomy);
    this.memoryCausalEconomy.restore(advanced.memoryCausalEconomy);
    this.causalLifeGraph.restore(advanced.causalLifeGraph);
    this.memoryWorldCausalBridge.restore(advanced.memoryWorldCausalBridge);
  }

  /** Read-only memory hygiene report; destructive repair remains an explicit separate operation. */
  doctor(options:{at?:number;maxIssues?:number}={}) { return this.memoryOS.doctor(options); }

  snapshot() { return {
    events:this.events.recent(64), memories:this.memories.snapshot({clone:false}),
    selfModel:this.selfModel.snapshot(), socialModel:this.socialModel.snapshot(), adaptiveValues:this.valuePlasticity.snapshot(),
    workspace:this.workspaceV2.snapshot(), attentionAllocator:this.attentionAllocator.snapshot(), semanticGraph:this.semanticMemory.snapshot(), memoryOS:this.memoryOS.snapshot(),
    unifiedMemory:this.unifiedMemory.snapshot(), p47:this.p47MemoryMind.snapshot(), p59:this.p59MemoryOperatingSystem.snapshot(),
    p62:this.p62MemoryFabric.snapshot(), p65:this.p65EpistemicLedger.snapshot(), hexisSourceMonitor:this.sourceMonitor.snapshot(), p70:this.p70MemoryLifecycleGovernor.snapshot(),
    p75:this.p75MemoryContinuumOS.snapshot(), fabric:this.fabric.snapshot(), experienceContinuum:this.experienceContinuum.snapshot(), hippocampal:this.hippocampal.snapshot(), hippocampalFormation:this.hippocampalFormation.snapshot(), consolidationController:this.consolidationController.snapshot(), memoryLifecycleAuthority:this.memoryLifecycleAuthority.snapshot(),
    memoryRetentionEconomy:this.memoryRetentionEconomy.snapshot(), memoryCausalEconomy:this.memoryCausalEconomy.snapshot(),
    causalLifeGraph:this.causalLifeGraph.snapshot(), memoryWorldCausalBridge:this.memoryWorldCausalBridge.snapshot(),
  }; }
}
