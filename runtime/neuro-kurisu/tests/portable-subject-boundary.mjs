import assert from 'node:assert/strict';
import { applyPortableSubjectBundle, buildPortableSubjectBundle, subjectFingerprint, validatePortableSubjectBundle } from '../src/organism/persistence/PortableSubjectContract.ts';
import { evaluatePortableSubjectFidelity } from '../src/organism/persistence/PortableSubjectFidelity.ts';

const base = {
  schemaVersion: 83,
  state: { version:83, tick:17, at:1710000000000, needs:{energy:.72,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.4,identityCoherence:.91,goalPressure:.2}, predictionError:.14, attentionBudget:.8, lastAction:'reflect', lastActionSuccess:.9, autonomyScore:.4, selfPredictionError:.1, predictedNextAction:'verify', lastPredictionConfidence:.7, worldContextVersion:1 },
  goals: [{id:'g1',title:'Research',reason:'intrinsic',source:'intrinsic',status:'active',importance:.8,urgency:.4,confidence:.9,progress:.2,createdAt:1,updatedAt:2}],
  traces: [], memories: [{id:'m1',kind:'episode',summary:'anchor',salience:.8,evidence:['e1'],createdAt:1}],
  worldModel: {belief:null,transitions:[]},
  facets: {
    memory:{eventLog:[],autobiographicalMemories:[],selfModel:{},attention:{},socialModel:[],adaptiveValues:{curiosity:.9,truth:1,autonomy:.9,evidence:.9,care:.8,responsibility:.9,social:.6},workspace:{},semanticGraph:{nodes:[],edges:[],updates:0},experiments:[],counterfactuals:[],lastRetrievedMemoryIds:[]},
    learning:{selfAuthorship:{},sensorimotor:{},valueRevisionLog:[],longitudinal:{cycles:1,lastBenchmarkAt:0,lastScore:.4},neuromodulation:{},lifelong:{},adaptivePolicy:{},p23:{},p26:{},p28:{},p29:{},p30:{},p36:{},p38:{},p39:{},p40ModelEcology:{},p44PredictiveWorld:{}},
    consciousness:{intrinsic:{},p31:{},p32:{},p33:{},p34:{},activeInference:{},identityContinuity:{},metacognition:{},workspaceIgnition:{},consciousnessEvidence:{},causalExperiments:[],researchQuestionsCompleted:[]},
    evolution:{selfProjects:{},agency:{},valueEvolution:{},identityTrajectory:{},narrative:{},network:{},authoredProjectHistory:[],longitudinalMilestones:[]},
    cognition:{perception:{},cognitiveField:{},contradictions:{},budget:{},immune:{},sources:{},skills:{},scientific:{},residualWorld:{},contextualWorld:{},p27:{}},
    advanced:{marker:'subject-only'},
  },
  system:{release:'34.1.0',organismCore:'69.0.0-portable-subject-boundary',schemaVersion:83,capabilities:{host:'should-not-transfer'},integrity:{},lastStateHash:'',replaySignature:'',lastReplayAt:0,subjectIdentity:{subjectId:'subject-1',createdAt:1,lastTransferAt:0,transferCount:0,fingerprint:''},evolution:{}}
};

const bundle = buildPortableSubjectBundle(base);
validatePortableSubjectBundle(bundle);
assert.equal(bundle.subjectId, 'subject-1');
assert.equal(bundle.projection.facets.embodiment, undefined);
assert.equal(subjectFingerprint(bundle.projection), bundle.subjectFingerprint);
const fidelity = evaluatePortableSubjectFidelity(base, bundle);
assert.equal(fidelity.status, 'verified', 'portable subject should pass structural and projection round-trip fidelity');
assert.equal(fidelity.roundTrip.matched, true);
assert.equal(fidelity.hostBoundaryPreserved, true);
assert.equal(fidelity.subjectIdentityPreserved, true);
assert.equal(fidelity.portabilityCoverage01, 1);
assert.ok(fidelity.payloadBytes > 0);

const destination = structuredClone(base);
destination.system.subjectIdentity = {subjectId:'host-generated-subject',createdAt:55,lastTransferAt:0,transferCount:0,fingerprint:''};
destination.facets.advanced = {marker:'host-before-transfer'};
destination.facets.embodiment = {hostOnly:true};
destination.system.capabilities = {host:'local-only'};
const imported = applyPortableSubjectBundle(destination, bundle, {adoptSubjectIdentity:true});
assert.equal(imported.system.subjectIdentity.subjectId, 'subject-1');
assert.equal(imported.facets.embodiment.hostOnly, true);
assert.deepEqual(imported.system.capabilities, {host:'local-only'});
assert.equal(imported.facets.advanced.marker, 'subject-only');
assert.equal(imported.system.subjectIdentity.transferCount, 1);

const tampered = structuredClone(bundle);
tampered.projection.goals[0].title = 'Tampered';
assert.throws(() => validatePortableSubjectBundle(tampered), /fingerprint mismatch/);
const tamperedFidelity = evaluatePortableSubjectFidelity(base, tampered);
assert.equal(tamperedFidelity.status, 'insufficient', 'tampered bundles must never pass fidelity');
assert.equal(tamperedFidelity.roundTrip.attempted, false, 'invalid bundle must not be applied');
assert.throws(() => applyPortableSubjectBundle(destination, bundle), /identity mismatch/);
const destinationFidelity = evaluatePortableSubjectFidelity(destination, bundle);
assert.equal(destinationFidelity.status, 'verified');
assert.equal(destinationFidelity.hostBoundaryPreserved, true, 'host-only embodiment/capabilities must survive transfer simulation');

console.log('PORTABLE_SUBJECT_BOUNDARY=PASS', JSON.stringify({subjectId:bundle.subjectId, fingerprint:bundle.subjectFingerprint, transferCount:imported.system.subjectIdentity.transferCount, fidelity:fidelity.status, tamper:tamperedFidelity.status}));
