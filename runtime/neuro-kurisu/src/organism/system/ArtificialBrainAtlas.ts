/**
 * BIG PASS 207 — canonical artificial brain atlas.
 *
 * This is an implementation-facing ontology, not a claim of anatomical
 * equivalence. It binds the research map to stable computational owners so
 * future brain modules cannot become duplicate P/Pxx silos.
 */
export type BrainScale = 'macro'|'network'|'circuit'|'cellular'|'neuromodulatory'|'body'|'metabolic'|'developmental'|'temporal';
export type BrainPriority = 'critical'|'high'|'medium'|'low';

export interface BrainAtlasRegion {
  id: string;
  scale: BrainScale;
  name: string;
  biologicalRole: string;
  computationalRole: string;
  currentOwners: string[];
  missingCapabilities: string[];
  priority: BrainPriority;
  timescaleMs: [number, number];
}

export interface BrainAtlasEdge {
  from: string;
  to: string;
  relation: 'feedforward'|'feedback'|'gating'|'modulation'|'prediction'|'memory'|'homeostasis'|'motor'|'social'|'replay'|'consolidation';
  strength01: number;
  evidenceLevel: 'research'|'implemented'|'verified';
}

export interface ArtificialBrainAtlasSnapshot {
  version: 1;
  release: string;
  regionCount: number;
  edgeCount: number;
  implementedCount: number;
  criticalGapCount: number;
  regions: BrainAtlasRegion[];
  edges: BrainAtlasEdge[];
}

const REGION_DATA: BrainAtlasRegion[] = [
  {id:'cortex.association',scale:'macro',name:'Association cortex',biologicalRole:'hierarchical multimodal integration, planning, abstraction',computationalRole:'recurrent multimodal inference and global workspace',currentOwners:['P61IntegratedMindKernel','P64IntegratedOrganismDynamics','CognitiveKernelCoordinator','CorticalHierarchyEngine'],missingCapabilities:['360-area ontology','laminar dynamics','biological cell-type/laminar mapping','explicit cortical area graph'],priority:'critical',timescaleMs:[20,2000]},
  {id:'hippocampus.formation',scale:'macro',name:'Hippocampal formation',biologicalRole:'episodic encoding, pattern separation/completion, replay',computationalRole:'episodic memory and consolidation routing',currentOwners:['HippocampalMemorySubstrate','AutobiographicalMemory','MemoryOS2','P75MemoryContinuumOS'],missingCapabilities:['SWR-like replay state','distributed procedural replay routing'],priority:'high',timescaleMs:[20,100000]},
  {id:'thalamus.gateway',scale:'macro',name:'Thalamic gateway',biologicalRole:'state-dependent routing and brain-wide information control',computationalRole:'precision/gain gating before broadcast and action arbitration',currentOwners:['ThalamocorticalGate','CognitiveKernelCoordinator'],missingCapabilities:['nucleus-specific channels'],priority:'critical',timescaleMs:[10,1000]},
  {id:'basal_ganglia.selection',scale:'macro',name:'Basal ganglia',biologicalRole:'action selection, reinforcement, habit gating',computationalRole:'candidate selection and policy arbitration',currentOwners:['AgencySubsystemRuntime','P64IntegratedOrganismDynamics','ActionGateway','BasalGangliaSelectionCircuit'],missingCapabilities:['explicit nucleus state dynamics','explicit dorsal/ventral striatal territory graph','full cortico-basal-ganglia-thalamo-cortical closed-loop motor execution'],priority:'critical',timescaleMs:[20,5000]},
  {id:'cerebellum.predictive_control',scale:'macro',name:'Cerebellum',biologicalRole:'predictive sensorimotor control and error correction',computationalRole:'fast forward model / timing / calibration',currentOwners:['ActiveInferenceEngine','P64IntegratedOrganismDynamics','CerebellarPredictiveController'],missingCapabilities:['granule-Purkinje-climbing-fiber microcircuit','explicit multisynaptic microcircuit dynamics'],priority:'high',timescaleMs:[5,500]},
  {id:'hypothalamus.allostasis',scale:'macro',name:'Hypothalamus',biologicalRole:'homeostasis/allostasis and autonomic regulation',computationalRole:'resource, drive and body-state regulation',currentOwners:['PredictiveAllostasis','PhoneRuntimePolicy','OrganismResourceAllocator','HypothalamicHomeostasisController'],missingCapabilities:['nuclei-level drive pathways','autonomic effector model'],priority:'critical',timescaleMs:[50,60000]},
  {id:'brainstem.arousal',scale:'macro',name:'Brainstem arousal',biologicalRole:'arousal, vigilance, sleep-wake and reflex regulation',computationalRole:'global state / wakefulness gate',currentOwners:['TemporalResolutionGovernor','CognitiveSpineScheduler','PhoneRuntimePolicy'],missingCapabilities:['explicit ascending arousal system','sleep stage model'],priority:'high',timescaleMs:[10,3600000]},
  {id:'limbic.valuation',scale:'macro',name:'Limbic valuation',biologicalRole:'affect, salience, reward, memory-value interaction',computationalRole:'appraisal, emotion, salience and motivational weighting',currentOwners:['EmotionAppraisalEngine','SocialDevelopmentSystem','AgencySubsystemRuntime'],missingCapabilities:['explicit amygdala-vmPFC-striatum loop'],priority:'high',timescaleMs:[20,10000]},
  {id:'insular_interoception',scale:'network',name:'Insular/interoceptive network',biologicalRole:'internal-state representation and salience',computationalRole:'body-state evidence and precision weighting',currentOwners:['MultimodalSituationModel','PredictiveAllostasis','P37EmbodiedSensorium','InteroceptiveStateEstimator','LongHorizonAutonomyController'],missingCapabilities:['distributed efferent interoceptive pathway','insula-to-cingulate control topology'],priority:'critical',timescaleMs:[50,5000]},
  {id:'salience.network',scale:'network',name:'Salience network',biologicalRole:'switching between internal/external processing and salience',computationalRole:'interrupts, attention shifts and gating',currentOwners:['CognitiveFrame','CognitiveSpineScheduler','AttentionSchema'],missingCapabilities:['explicit fronto-insular/ACC topology'],priority:'high',timescaleMs:[50,5000]},
  {id:'frontoparietal.control',scale:'network',name:'Frontoparietal control network',biologicalRole:'goal-directed control and flexible cognition',computationalRole:'executive control, task maintenance and metacognition',currentOwners:['AgencySubsystemRuntime','DevelopmentalExecutiveEngine','SelfModelValidationEngine','AutonomousPersonhoodKernel','LongHorizonAutonomyController'],missingCapabilities:['network-specific working-memory loops'],priority:'high',timescaleMs:[50,10000]},
  {id:'default_mode.self',scale:'network',name:'Default mode / autobiographical system',biologicalRole:'self-related processing, autobiographical simulation, scene construction',computationalRole:'self-model, autobiographical continuity and imagination',currentOwners:['IdentityLifeOS','P78AutobiographicalSelfContinuity','MentalScene','AutonomousPersonhoodKernel','LongHorizonAutonomyController'],missingCapabilities:['explicit default-mode subnetwork graph'],priority:'high',timescaleMs:[100,10000]},
  {id:'neuromodulation.sources',scale:'neuromodulatory',name:'Neuromodulatory sources',biologicalRole:'dopamine, norepinephrine, acetylcholine, serotonin and related gain/plasticity control',computationalRole:'global state-dependent learning and exploration modulation',currentOwners:['NeuromodulationSystem','P28PlasticitySubstrate','EmotionAppraisalEngine'],missingCapabilities:['source-to-target projection graph','pulse/timing semantics'],priority:'critical',timescaleMs:[100,60000]},
  {id:'glia.support',scale:'cellular',name:'Glial support',biologicalRole:'synaptic regulation, myelination, metabolic support, immune signalling',computationalRole:'maintenance, plasticity cost and circuit health',currentOwners:['OrganismResourceAllocator','MemoryRetentionEconomy'],missingCapabilities:['astrocyte unit','oligodendrocyte/myelin state','microglial pruning'],priority:'high',timescaleMs:[1000,86400000]},
  {id:'vascular.metabolic',scale:'metabolic',name:'Vascular/metabolic system',biologicalRole:'energy delivery, substrate exchange and neurovascular coupling',computationalRole:'energy budget and neural work capacity',currentOwners:['CognitiveResourceEconomy','PhoneRuntimePolicy','PredictiveAllostasis'],missingCapabilities:['neurovascular coupling model','metabolic reserve compartments'],priority:'high',timescaleMs:[1000,600000]},
  {id:'sleep.replay',scale:'temporal',name:'Sleep/offline replay',biologicalRole:'memory consolidation, synaptic regulation and offline processing',computationalRole:'dream/replay/consolidation cycles',currentOwners:['MicroDreamEngine','HippocampalMemorySubstrate','DormantMemoryController'],missingCapabilities:['explicit NREM/REM state machine','SWR/spindle coupling'],priority:'high',timescaleMs:[1000,3600000]},
  {id:'immune.homeostasis',scale:'cellular',name:'Neuroimmune maintenance',biologicalRole:'microglial/immune interactions affecting synapses and tissue health',computationalRole:'long-horizon circuit integrity and pruning pressure',currentOwners:['IntegritySentinel','ContinuityLedger'],missingCapabilities:['immune state variables','pruning/repair dynamics'],priority:'medium',timescaleMs:[60000,2592000000]},
  {id:'language.social',scale:'network',name:'Language/social cognition',biologicalRole:'language, theory of mind, social learning and communication',computationalRole:'LanguageOrgan + social model + relationship memory',currentOwners:['B288SocialPredictiveSelfOtherBrain','LanguageOrgan'],missingCapabilities:['distributed language network graph','social neuromodulation coupling'],priority:'high',timescaleMs:[100,30000]},
];

const EDGE_DATA: BrainAtlasEdge[] = [
  {from:'thalamus.gateway',to:'cortex.association',relation:'gating',strength01:.95,evidenceLevel:'implemented'},
  {from:'cortex.association',to:'thalamus.gateway',relation:'feedback',strength01:.92,evidenceLevel:'verified'},
  {from:'cortex.association',to:'cortex.association',relation:'prediction',strength01:.88,evidenceLevel:'implemented'},
  {from:'hippocampus.formation',to:'cortex.association',relation:'memory',strength01:.92,evidenceLevel:'implemented'},
  {from:'cortex.association',to:'hippocampus.formation',relation:'prediction',strength01:.88,evidenceLevel:'verified'},
  {from:'hippocampus.formation',to:'sleep.replay',relation:'replay',strength01:.86,evidenceLevel:'implemented'},
  {from:'sleep.replay',to:'cortex.association',relation:'consolidation',strength01:.82,evidenceLevel:'implemented'},
  {from:'basal_ganglia.selection',to:'cortex.association',relation:'gating',strength01:.8,evidenceLevel:'implemented'},
  {from:'cortex.association',to:'basal_ganglia.selection',relation:'feedforward',strength01:.82,evidenceLevel:'implemented'},
  {from:'cerebellum.predictive_control',to:'basal_ganglia.selection',relation:'prediction',strength01:.62,evidenceLevel:'implemented'},
  {from:'hypothalamus.allostasis',to:'thalamus.gateway',relation:'homeostasis',strength01:.74,evidenceLevel:'research'},
  {from:'brainstem.arousal',to:'thalamus.gateway',relation:'modulation',strength01:.83,evidenceLevel:'research'},
  {from:'insular_interoception',to:'salience.network',relation:'homeostasis',strength01:.88,evidenceLevel:'verified'},
  {from:'insular_interoception',to:'hypothalamus.allostasis',relation:'homeostasis',strength01:.82,evidenceLevel:'implemented'},
  {from:'insular_interoception',to:'frontoparietal.control',relation:'gating',strength01:.74,evidenceLevel:'implemented'},
  {from:'salience.network',to:'frontoparietal.control',relation:'gating',strength01:.72,evidenceLevel:'research'},
  {from:'frontoparietal.control',to:'default_mode.self',relation:'feedback',strength01:.68,evidenceLevel:'research'},
  {from:'neuromodulation.sources',to:'cortex.association',relation:'modulation',strength01:.9,evidenceLevel:'research'},
  {from:'neuromodulation.sources',to:'basal_ganglia.selection',relation:'modulation',strength01:.86,evidenceLevel:'implemented'},
  {from:'glia.support',to:'cortex.association',relation:'modulation',strength01:.58,evidenceLevel:'research'},
  {from:'vascular.metabolic',to:'cortex.association',relation:'homeostasis',strength01:.6,evidenceLevel:'research'},
  {from:'sleep.replay',to:'hippocampus.formation',relation:'memory',strength01:.91,evidenceLevel:'implemented'},
  {from:'basal_ganglia.selection',to:'sleep.replay',relation:'replay',strength01:.69,evidenceLevel:'implemented'},
  {from:'language.social',to:'default_mode.self',relation:'social',strength01:.71,evidenceLevel:'research'},
];

export class ArtificialBrainAtlas {
  private readonly regions = REGION_DATA.map(row => ({...row,currentOwners:[...row.currentOwners],missingCapabilities:[...row.missingCapabilities],timescaleMs:[...row.timescaleMs] as [number,number]}));
  private readonly edges = EDGE_DATA.map(edge => ({...edge}));

  regionsByPriority(priority:BrainPriority){ return this.regions.filter(r=>r.priority===priority).map(cloneRegion); }
  get(id:string){ const found=this.regions.find(r=>r.id===id); return found?cloneRegion(found):null; }
  edgesFor(id:string){ return this.edges.filter(e=>e.from===id||e.to===id).map(e=>({...e})); }
  implementationCoverage01(){
    const score=this.regions.reduce((sum,r)=>sum+(r.missingCapabilities.length===0?1:r.currentOwners.length?0.5:0),0)/Math.max(1,this.regions.length);
    return Math.max(0,Math.min(1,score));
  }
  snapshot():ArtificialBrainAtlasSnapshot{
    return {version:1,release:'35.6.5 B352 SCS-DIT / long-horizon / causal-SNN',regionCount:this.regions.length,edgeCount:this.edges.length,implementedCount:this.regions.filter(r=>r.currentOwners.length>0).length,criticalGapCount:this.regions.filter(r=>r.priority==='critical'&&r.missingCapabilities.length>0).length,regions:this.regions.map(cloneRegion),edges:this.edges.map(e=>({...e}))};
  }
}

function cloneRegion(r:BrainAtlasRegion):BrainAtlasRegion{return {...r,currentOwners:[...r.currentOwners],missingCapabilities:[...r.missingCapabilities],timescaleMs:[...r.timescaleMs] as [number,number]};}
