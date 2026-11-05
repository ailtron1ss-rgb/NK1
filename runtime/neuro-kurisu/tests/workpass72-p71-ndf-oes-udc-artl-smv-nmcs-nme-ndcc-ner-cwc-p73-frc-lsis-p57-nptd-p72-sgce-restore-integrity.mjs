import assert from 'node:assert/strict';
import { P71SelfConsistencyModel, defaultP71 } from '../src/organism/cognition/P71SelfConsistencyModel.ts';
import { NeuroDigitalFusionKernel, defaultNeuroDigitalFusion } from '../src/organism/cognition/NeuroDigitalFusionKernel.ts';
import { OpenEndedSkillAcquisitionController, defaultOpenEndedSkill } from '../src/organism/system/OpenEndedSkillAcquisitionController.ts';
import { UnifiedDevelopmentalCompiler, defaultUnifiedDevelopmental } from '../src/organism/system/UnifiedDevelopmentalCompiler.ts';
import { AutonomousResourceToolLifeController, defaultAutonomousResourceToolLife } from '../src/organism/system/AutonomousResourceToolLifeController.ts';
import { SelfModelValidationEngine, defaultSelfModelValidation } from '../src/organism/system/SelfModelValidationEngine.ts';
import { NeuralMorphogeneticConstraintSolver, defaultNeuralMorphConstraint } from '../src/organism/system/NeuralMorphogeneticConstraintSolver.ts';
import { NeuralMorphogenesisEngine, defaultNeuralMorphogenesis } from '../src/organism/system/NeuralMorphogenesisEngine.ts';
import { NeuralDigitalCoevolutionController, defaultNeuralDigitalCoevolution } from '../src/organism/system/NeuralDigitalCoevolutionController.ts';
import { NeuralEcologyRouter, defaultNeuralEcology } from '../src/organism/system/NeuralEcologyRouter.ts';
import { CounterfactualWorldCompiler, defaultCounterfactualWorld } from '../src/organism/system/CounterfactualWorldCompiler.ts';
import { P73CapabilityEvolutionLedger, defaultP73 } from '../src/organism/system/P73CapabilityEvolutionLedger.ts';
import { FailureRecoveryCertification, defaultFailureRecoveryCertification } from '../src/organism/system/FailureRecoveryCertification.ts';
import { LiveSelfImprovementSupervisor, defaultLiveSupervisor } from '../src/organism/system/LiveSelfImprovementSupervisor.ts';
import { P57RealityFirstObservatory, defaultP57 } from '../src/organism/system/P57RealityFirstObservatory.ts';
import { NeuralPhaseTransitionDetector, defaultNeuralPhaseTransition } from '../src/organism/system/NeuralPhaseTransitionDetector.ts';
import { P72LifeCycleOrchestrator, defaultP72 } from '../src/organism/system/P72LifeCycleOrchestrator.ts';
import { SelfGeneratedCurriculumEngine, defaultSelfGeneratedCurriculum } from '../src/organism/system/SelfGeneratedCurriculumEngine.ts';

/**
 * WorkPass72 — system/self-improvement cluster: the self-consistency model,
 * neuro-digital fusion kernel, open-ended skill acquisition, unified
 * developmental compiler, autonomous tool-life controller, self-model
 * validation, morphogenetic constraint solver + engine, neuro-digital
 * coevolution, ecology router, counterfactual compiler, capability-evolution
 * ledger, recovery certification, live self-improvement supervisor, reality-
 * first observatory, phase-transition detector, life-cycle orchestrator and
 * self-generated curriculum. Each merged a persisted snapshot with a bare
 * spread, letting NaN/negative/hostile values reach neural arrays, skill
 * tracks, tool receipts, prediction records, circuits, ledgers and mode counts.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P71SelfConsistencyModel ------------------------------------------------
{
  const m = new P71SelfConsistencyModel();
  m.restore({ version: 1, cycles: -1, meanConsistency01: 9, lastReason: 5,
    history: [{ tick: -1, consistency01: 9, reason: 5 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p71 negative cycles -> 0');
  assert.equal(st.meanConsistency01, 1, 'p71 over-1 consistency -> 1');
  assert.equal(typeof st.lastReason, 'string', 'p71 non-string reason -> default');
  assert.equal(st.history.length, 1, 'p71 drops non-object history');
  assert.equal(st.history[0].consistency01, 1, 'p71 over-1 history value -> 1');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  m.restore(defaultP71());
  assert.deepEqual(m.snapshot(), defaultP71(), 'p71 default round-trips');
}

// --- NeuroDigitalFusionKernel -----------------------------------------------
{
  const m = new NeuroDigitalFusionKernel();
  m.restore({ version: 1, cycles: -1, neuronCount: 999, latent: [2, 'x'], membrane: [9, 'x'],
    recurrentGain01: 9, lesion01: 9 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'ndf negative cycles -> 0');
  assert.equal(st.neuronCount, 128, 'ndf over-max neuronCount -> 128');
  assert.equal(st.latent.length, 12, 'ndf latent rebuilt');
  assert.equal(st.latent[0], 1, 'ndf over-1 latent -> 1');
  assert.equal(st.latent[1], .5, 'ndf non-number latent -> .5');
  assert.equal(st.membrane.length, 32, 'ndf membrane rebuilt');
  assert.equal(st.membrane[0], 1, 'ndf over-1 membrane -> 1');
  assert.equal(st.membrane[1], 0, 'ndf non-number membrane -> 0');
  assert.equal(st.recurrentGain01, 1, 'ndf over-1 gain -> 1');
  assert.equal(st.lesion01, 1, 'ndf over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('latent')));
  m.restore(defaultNeuroDigitalFusion());
  assert.deepEqual(m.snapshot(), defaultNeuroDigitalFusion(), 'ndf default round-trips');
}

// --- OpenEndedSkillAcquisitionController ------------------------------------
{
  const m = new OpenEndedSkillAcquisitionController();
  m.restore({ version: 1, cycles: -1, active: 5, meanMastery01: 9,
    tracks: [{ id: 5, status: 'bogus', mastery01: 9, practice: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'oes negative cycles -> 0');
  assert.equal(st.active, null, 'oes non-string active -> null');
  assert.equal(st.meanMastery01, 1, 'oes over-1 mastery -> 1');
  assert.equal(st.tracks.length, 1, 'oes drops non-object tracks');
  assert.equal(st.tracks[0].status, 'queued', 'oes unknown status -> default');
  assert.equal(st.tracks[0].mastery01, 1, 'oes over-1 track mastery -> 1');
  assert.equal(st.tracks[0].practice, 0, 'oes negative practice -> 0');
  assert.equal(typeof st.tracks[0].id, 'string', 'oes non-string id -> default');
  assert.doesNotThrow(() => m.restore(hostile('tracks')));
  m.restore(defaultOpenEndedSkill());
  assert.deepEqual(m.snapshot(), defaultOpenEndedSkill(), 'oes default round-trips');
}

// --- UnifiedDevelopmentalCompiler -------------------------------------------
{
  const m = new UnifiedDevelopmentalCompiler();
  m.restore({ version: 1, cycles: -1, developmentIndex01: 9, nextOperation: 5, rejectedOperations: -1 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'udc negative cycles -> 0');
  assert.equal(st.developmentIndex01, 1, 'udc over-1 index -> 1');
  assert.equal(typeof st.nextOperation, 'string', 'udc non-string operation -> default');
  assert.equal(st.rejectedOperations, 0, 'udc negative rejects -> 0');
  assert.doesNotThrow(() => m.restore(hostile('nextOperation')));
  m.restore(defaultUnifiedDevelopmental());
  assert.deepEqual(m.snapshot(), defaultUnifiedDevelopmental(), 'udc default round-trips');
}

// --- AutonomousResourceToolLifeController -----------------------------------
{
  const m = new AutonomousResourceToolLifeController();
  m.restore({ version: 1, ticks: -1, initiative01: 9, lastToolId: 5, lastReason: 5,
    recent: [{ tick: -1, toolId: 5, ok: 'yes', cost01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'artl negative ticks -> 0');
  assert.equal(st.initiative01, 1, 'artl over-1 initiative -> 1');
  assert.equal(st.lastToolId, null, 'artl non-string tool id -> null');
  assert.equal(typeof st.lastReason, 'string', 'artl non-string reason -> default');
  assert.equal(st.recent.length, 1, 'artl drops non-object receipts');
  assert.equal(st.recent[0].ok, false, 'artl non-boolean ok -> false');
  assert.equal(st.recent[0].cost01, 1, 'artl over-1 cost -> 1');
  assert.equal(typeof st.recent[0].toolId, 'string', 'artl non-string toolId -> default');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  m.restore(defaultAutonomousResourceToolLife());
  assert.deepEqual(m.snapshot(), defaultAutonomousResourceToolLife(), 'artl default round-trips');
}

// --- SelfModelValidationEngine ----------------------------------------------
{
  const m = new SelfModelValidationEngine();
  m.restore({ version: 1, predictions: -1, accuracy01: 9, records: [{ predicted: 5, correct: 'yes', confidence01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.predictions, 0, 'smv negative predictions -> 0');
  assert.equal(st.accuracy01, 1, 'smv over-1 accuracy -> 1');
  assert.equal(st.records.length, 1, 'smv drops non-object records');
  assert.equal(st.records[0].correct, false, 'smv non-boolean correct -> false');
  assert.equal(st.records[0].confidence01, 1, 'smv over-1 confidence -> 1');
  assert.equal(typeof st.records[0].predicted, 'string', 'smv non-string predicted -> default');
  assert.doesNotThrow(() => m.restore(hostile('records')));
  m.restore(defaultSelfModelValidation());
  assert.deepEqual(m.snapshot(), defaultSelfModelValidation(), 'smv default round-trips');
}

// --- NeuralMorphogeneticConstraintSolver ------------------------------------
{
  const m = new NeuralMorphogeneticConstraintSolver();
  m.restore({ version: 1, cycles: -1, feasible01: 9, violations: -1 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'nmcs negative cycles -> 0');
  assert.equal(st.feasible01, 1, 'nmcs over-1 feasible -> 1');
  assert.equal(st.violations, 0, 'nmcs negative violations -> 0');
  assert.doesNotThrow(() => m.restore(hostile('feasible01')));
  m.restore(defaultNeuralMorphConstraint());
  assert.deepEqual(m.snapshot(), defaultNeuralMorphConstraint(), 'nmcs default round-trips');
}

// --- NeuralMorphogenesisEngine ----------------------------------------------
{
  const m = new NeuralMorphogenesisEngine();
  m.restore({ version: 1, cycles: -1, neurons: 999, synapses: 9999, structuralFitness01: 9,
    circuits: [{ id: 5, weight01: 9, usage01: 9, age: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'nme negative cycles -> 0');
  assert.equal(st.neurons, 96, 'nme over-max neurons -> 96');
  assert.equal(st.synapses, 384, 'nme over-max synapses -> 384');
  assert.equal(st.structuralFitness01, 1, 'nme over-1 fitness -> 1');
  assert.equal(st.circuits.length, 1, 'nme drops non-object circuits');
  assert.equal(st.circuits[0].weight01, 1, 'nme over-1 circuit weight -> 1');
  assert.equal(st.circuits[0].age, 0, 'nme negative age -> 0');
  assert.equal(typeof st.circuits[0].id, 'string', 'nme non-string circuit id -> default');
  assert.doesNotThrow(() => m.restore(hostile('circuits')));
  m.restore(defaultNeuralMorphogenesis());
  assert.deepEqual(m.snapshot(), defaultNeuralMorphogenesis(), 'nme default round-trips');
}

// --- NeuralDigitalCoevolutionController -------------------------------------
{
  const m = new NeuralDigitalCoevolutionController();
  m.restore({ version: 1, cycles: -1, organismAdapt01: 9, drift01: 9, updates: -1 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'ndcc negative cycles -> 0');
  assert.equal(st.organismAdapt01, 1, 'ndcc over-1 organism adapt -> 1');
  assert.equal(st.drift01, 1, 'ndcc over-1 drift -> 1');
  assert.equal(st.updates, 0, 'ndcc negative updates -> 0');
  assert.doesNotThrow(() => m.restore(hostile('drift01')));
  m.restore(defaultNeuralDigitalCoevolution());
  assert.deepEqual(m.snapshot(), defaultNeuralDigitalCoevolution(), 'ndcc default round-trips');
}

// --- NeuralEcologyRouter ----------------------------------------------------
{
  const m = new NeuralEcologyRouter();
  m.restore({ version: 1, cycles: -1, fast01: 9, lastChannel: 'bogus' });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'ner negative cycles -> 0');
  assert.equal(st.fast01, 1, 'ner over-1 fast -> 1');
  assert.equal(st.lastChannel, 'fast', 'ner unknown channel -> default');
  assert.doesNotThrow(() => m.restore(hostile('fast01')));
  m.restore(defaultNeuralEcology());
  assert.deepEqual(m.snapshot(), defaultNeuralEcology(), 'ner default round-trips');
}

// --- CounterfactualWorldCompiler --------------------------------------------
{
  const m = new CounterfactualWorldCompiler();
  m.restore({ version: 1, cycles: -1, compiled: -1, meanSeparation01: 9, lastDomain: 5 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'cwc negative cycles -> 0');
  assert.equal(st.compiled, 0, 'cwc negative compiled -> 0');
  assert.equal(st.meanSeparation01, 1, 'cwc over-1 separation -> 1');
  assert.equal(typeof st.lastDomain, 'string', 'cwc non-string domain -> default');
  assert.doesNotThrow(() => m.restore(hostile('lastDomain')));
  m.restore(defaultCounterfactualWorld());
  assert.deepEqual(m.snapshot(), defaultCounterfactualWorld(), 'cwc default round-trips');
}

// --- P73CapabilityEvolutionLedger -------------------------------------------
{
  const m = new P73CapabilityEvolutionLedger();
  m.restore({ version: 1, cycles: -1, baselineCapability01: 9, lastOutcome01: 'x',
    recent: [{ tick: -1, capability01: 9, evidence: 'yes' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p73 negative cycles -> 0');
  assert.equal(st.baselineCapability01, 1, 'p73 over-1 baseline -> 1');
  assert.equal(st.lastOutcome01, null, 'p73 non-number outcome -> null');
  assert.equal(st.recent.length, 1, 'p73 drops non-object rows');
  assert.equal(st.recent[0].capability01, 1, 'p73 over-1 row capability -> 1');
  assert.equal(st.recent[0].evidence, false, 'p73 non-boolean evidence -> false');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  m.restore(defaultP73());
  assert.deepEqual(m.snapshot(), defaultP73(), 'p73 default round-trips');
}

// --- FailureRecoveryCertification -------------------------------------------
{
  const m = new FailureRecoveryCertification();
  m.restore({ version: 1, checkpoints: -1, lastCheckpointHash: 5,
    history: [{ phase: 'bogus', ok: 'yes', hash: 5 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.checkpoints, 0, 'frc negative checkpoints -> 0');
  assert.equal(typeof st.lastCheckpointHash, 'string', 'frc non-string hash -> default');
  assert.equal(st.history.length, 1, 'frc drops non-object history');
  assert.equal(st.history[0].phase, 'checkpoint', 'frc unknown phase -> default');
  assert.equal(st.history[0].ok, false, 'frc non-boolean ok -> false');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  m.restore(defaultFailureRecoveryCertification());
  assert.deepEqual(m.snapshot(), defaultFailureRecoveryCertification(), 'frc default round-trips');
}

// --- LiveSelfImprovementSupervisor ------------------------------------------
{
  const m = new LiveSelfImprovementSupervisor();
  m.restore({ version: 1, cycles: -1, meanSteering01: 9, lastDecision: 'bogus',
    lessonsData: [{ id: 5, delta01: 9, validated01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'lsis negative cycles -> 0');
  assert.equal(st.meanSteering01, 1, 'lsis over-1 steering -> 1');
  assert.equal(st.lastDecision, 'continue', 'lsis unknown decision -> default');
  assert.equal(st.lessonsData.length, 1, 'lsis drops non-object lessons');
  assert.equal(st.lessonsData[0].delta01, 1, 'lsis over-1 delta -> 1');
  assert.equal(typeof st.lessonsData[0].id, 'string', 'lsis non-string lesson id -> default');
  assert.doesNotThrow(() => m.restore(hostile('lessonsData')));
  m.restore(defaultLiveSupervisor());
  assert.deepEqual(m.snapshot(), defaultLiveSupervisor(), 'lsis default round-trips');
}

// --- P57RealityFirstObservatory ---------------------------------------------
{
  const m = new P57RealityFirstObservatory();
  m.restore({ version: 1, observations: -1, meanRealityGap01: 9, lastAnchorId: 5,
    anchors: [{ id: 5, source: 'bogus', gap01: 9, predicted01: 'x' }, 'x'],
    recentOutcomes: [9, 'x'] });
  const st = m.snapshot();
  assert.equal(st.observations, 0, 'p57 negative observations -> 0');
  assert.equal(st.meanRealityGap01, 1, 'p57 over-1 reality gap -> 1');
  assert.equal(st.lastAnchorId, null, 'p57 non-string anchor id -> null');
  assert.equal(st.anchors.length, 1, 'p57 drops non-object anchors');
  assert.equal(st.anchors[0].source, 'unknown', 'p57 unknown source -> default');
  assert.equal(st.anchors[0].gap01, 1, 'p57 over-1 gap -> 1');
  assert.equal(st.anchors[0].predicted01, null, 'p57 non-number predicted -> null');
  assert.equal(st.recentOutcomes.length, 2, 'p57 keeps recent outcomes');
  assert.equal(st.recentOutcomes[0], 1, 'p57 over-1 outcome -> 1');
  assert.doesNotThrow(() => m.restore(hostile('anchors')));
  m.restore(defaultP57());
  assert.deepEqual(m.snapshot(), defaultP57(), 'p57 default round-trips');
}

// --- NeuralPhaseTransitionDetector ------------------------------------------
{
  const m = new NeuralPhaseTransitionDetector();
  m.restore({ version: 1, cycles: -1, instability01: 9, lastRegime: 5 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'nptd negative cycles -> 0');
  assert.equal(st.instability01, 1, 'nptd over-1 instability -> 1');
  assert.equal(typeof st.lastRegime, 'string', 'nptd non-string regime -> default');
  assert.doesNotThrow(() => m.restore(hostile('lastRegime')));
  m.restore(defaultNeuralPhaseTransition());
  assert.deepEqual(m.snapshot(), defaultNeuralPhaseTransition(), 'nptd default round-trips');
}

// --- P72LifeCycleOrchestrator -----------------------------------------------
{
  const m = new P72LifeCycleOrchestrator();
  m.restore({ version: 1, cycles: -1, clockCounts: { cognitive: -1 }, lastClock: 'bogus', meanDuty01: 9 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p72 negative cycles -> 0');
  assert.equal(st.clockCounts.cognitive, 0, 'p72 negative clock count -> 0');
  assert.ok(typeof st.clockCounts.reflex === 'number', 'p72 clock counts rebuilt');
  assert.equal(st.lastClock, 'cognitive', 'p72 unknown clock -> default');
  assert.equal(st.meanDuty01, 1, 'p72 over-1 duty -> 1');
  assert.doesNotThrow(() => m.restore(hostile('clockCounts')));
  m.restore(defaultP72());
  assert.deepEqual(m.snapshot(), defaultP72(), 'p72 default round-trips');
}

// --- SelfGeneratedCurriculumEngine ------------------------------------------
{
  const m = new SelfGeneratedCurriculumEngine();
  m.restore({ version: 1, cycles: -1, meanDifficulty01: 9, lastSkill: 5,
    queue: [{ id: 5, difficulty01: 9, priority01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'sgce negative cycles -> 0');
  assert.equal(st.meanDifficulty01, 1, 'sgce over-1 difficulty -> 1');
  assert.equal(typeof st.lastSkill, 'string', 'sgce non-string skill -> default');
  assert.equal(st.queue.length, 1, 'sgce drops non-object tasks');
  assert.equal(st.queue[0].difficulty01, 1, 'sgce over-1 task difficulty -> 1');
  assert.equal(typeof st.queue[0].id, 'string', 'sgce non-string task id -> default');
  assert.doesNotThrow(() => m.restore(hostile('queue')));
  m.restore(defaultSelfGeneratedCurriculum());
  assert.deepEqual(m.snapshot(), defaultSelfGeneratedCurriculum(), 'sgce default round-trips');
}

console.log('WORKPASS72_P71_NDF_OES_UDC_ARTL_SMV_NMCS_NME_NDCC_NER_CWC_P73_FRC_LSIS_P57_NPTD_P72_SGCE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: 18 }));
