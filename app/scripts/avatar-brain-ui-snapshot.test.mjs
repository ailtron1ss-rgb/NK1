import assert from "node:assert/strict";
import test from "node:test";
import { toOrganismSnapshot } from "../src/neuro-kurisu/normalize.ts";

const avatarBrain = (stateVersion = 42) => ({
  schemaVersion: 1,
  stateVersion,
  frame: {
    schemaVersion: 1,
    profile: "3d",
    expression: "curious",
    expressionWeight: 0.7,
    source: "organism-state",
    affect: {
      valence01: 0.68, arousal01: 0.72, dominance01: 0.61, curiosity01: 0.86,
      warmth01: 0.59, stress01: 0.24, confidence01: 0.83, memoryRecall01: 0.2,
    },
    channels: {
      eyeOpen: 0.82, browRaise: 0.66, browFurrow: 0.12, mouthSmile: 0.56,
      mouthOpen: 0.18, cheekRaise: 0.42, headTilt: 0.13, headYaw: 0.04,
      gazeX: 0.29, gazeY: -0.08, idleMotion: 0.34, lipSyncGain: 0.91,
    },
    freshness01: 1,
    reducedMotion: false,
    rendererHints: {
      live2d: { ParamEyeLOpen: 0.82, ParamAngleX: 1.2 },
      layered2d: { parallax01: 0.18, depthBreath01: 0.04, faceRig01: 0.62 },
      spatial3d: { headPitch: 0.03, headYaw: 0.02, gazeDistance01: 0.6, shoulderRelax01: 0.76 },
    },
    projectedAt: 1000,
  },
});

const backendSnapshot = (frame = avatarBrain()) => ({
  ok: true, version: "test", organismCore: "test", schemaVersion: 1,
  at: 1000, tick: 42, awake: true,
  state: {
    needs: { energy: .8, cognitiveLoad: .2, uncertainty: .2, socialNeed: .4, novelty: .7, identityCoherence: .8, goalPressure: .2, sleepPressure: .1 },
    predictionError: .1, selfPredictionError: .1, attentionBudget: 1, lastAction: "explore",
    lastReward01: .8, autonomyScore: .7, predictedNextAction: "respond", lastPredictionConfidence: .8, worldContextVersion: 1,
  },
  emotion: { label: "curiosity", valence: .68, arousal: .72, dominance: .61, tendency: "explore", cause: "novelty" },
  identity: { subjectId: "kurisu", name: "Kurisu", fingerprint: "test", createdAt: 1, cycles: 42, traits: { curiosity: .9 }, traitNames: [], trust: .5 },
  lastDecision: null, memories: [], beliefs: [], skills: [], goals: [],
  world: { featureDim: 32, hiddenDim: 16, predictionError01: .1, modelSamples: 42, lastLatentConfidence01: .8, scene: "lab", entities: 1, conflicts: 0 },
  workspace: { selected: [], ignition01: .4, recurrence01: .3, diversity01: .5 },
  learning: { steps: 4, evidenceDebt: 0, learningDelta01: .2, predictionError01: .1 },
  consciousness: { identityContinuity01: .8, metacognitiveAccuracy01: .7, workspaceIgnition01: .4, evidenceCoverage01: .6 },
  body: { battery01: .9, cognitiveCapacity01: .8, thermalStrain01: .1, cpuLoad01: .2, ramPressure01: .2 },
  voice: { speaking: false, listening: false, ttsAvailable: true, sttAvailable: true },
  avatarBrain: frame,
});

test("normalization preserves the exact canonical avatar brain envelope and its UI tick", () => {
  const remote = backendSnapshot();
  const normalized = toOrganismSnapshot(remote, []);
  assert.deepEqual(normalized.avatarBrain, remote.avatarBrain);
  assert.equal(normalized.avatarBrain.stateVersion, normalized.tick);
  assert.equal(normalized.avatarBrain.frame.source, "organism-state");
  assert.equal(normalized.avatarBrain.frame.channels.gazeX, 0.29);
});

test("normalization rejects avatar brain frames from a stale organism revision", () => {
  const normalized = toOrganismSnapshot(backendSnapshot(avatarBrain(41)), []);
  assert.equal(normalized.avatarBrain, null);
});

test("older backend snapshots remain compatible without an avatar brain frame", () => {
  const remote = backendSnapshot(undefined);
  delete remote.avatarBrain;
  const normalized = toOrganismSnapshot(remote, []);
  assert.equal(normalized.avatarBrain, null);
});

test("normalization rejects malformed or unbounded renderer channels", () => {
  const remote = backendSnapshot();
  remote.avatarBrain.frame.channels.gazeX = 8;
  const normalized = toOrganismSnapshot(remote, []);
  assert.equal(normalized.avatarBrain, null);
});


test("normalization preserves a fresh canonical avatar contact pulse", () => {
  const remote = backendSnapshot();
  remote.avatarInteraction = {
    schemaVersion: 1,
    kind: "avatar-contact",
    zone: "head",
    at: 900,
    confidence01: 0.72,
    evidenceId: "user-action-head-1",
  };
  const normalized = toOrganismSnapshot(remote, []);
  assert.deepEqual(normalized.avatarInteraction, remote.avatarInteraction);
});

test("normalization rejects stale or malformed contact pulses", () => {
  const stale = backendSnapshot();
  stale.at = 5_000;
  stale.avatarInteraction = { schemaVersion: 1, kind: "avatar-contact", zone: "head", at: 1, confidence01: 0.72, evidenceId: "old" };
  assert.equal(toOrganismSnapshot(stale, []).avatarInteraction, null);

  const malformed = backendSnapshot();
  malformed.avatarInteraction = { schemaVersion: 1, kind: "avatar-contact", zone: "feet", at: 999, confidence01: 0.72, evidenceId: "bad" };
  assert.equal(toOrganismSnapshot(malformed, []).avatarInteraction, null);
});
