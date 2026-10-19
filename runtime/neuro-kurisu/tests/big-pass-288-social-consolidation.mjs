import assert from 'node:assert/strict';
import { B288SocialPredictiveSelfOtherBrain, defaultB288State } from '../src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts';
import { SocialMindKernel, defaultSocialMindState } from '../src/organism/cognition/SocialMindKernel.ts';
import { SocialPredictiveNeuralSubstrate } from '../src/organism/cognition/SocialPredictiveNeuralSubstrate.ts';
import { SocialWorldModel } from '../src/organism/cognition/SocialWorldModel.ts';
import { RelationshipSelf, defaultRelationshipSelf } from '../src/organism/developmental/RelationshipSelf.ts';
import { LongTermSocialMind, defaultLongTermSocialMind } from '../src/organism/developmental/LongTermSocialMind.ts';
import { SocialDevelopmentSystem, defaultSocialDevelopment } from '../src/organism/developmental/SocialDevelopmentSystem.ts';
import { AutonomousRelationshipManager, defaultAutonomousRelationship } from '../src/organism/system/AutonomousRelationshipManager.ts';
import { AutonomousSocialInitiativeEngine, defaultAutonomousSocialInitiative } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';
import { B287RelationshipValueDevelopmentCore } from '../src/organism/cognition/B287RelationshipValueDevelopmentCore.ts';

const brain = new B288SocialPredictiveSelfOtherBrain();
const socialMind = new SocialMindKernel();
const socialPredictive = new SocialPredictiveNeuralSubstrate();
const socialWorld = new SocialWorldModel();
const relationshipSelf = new RelationshipSelf();
const longTerm = new LongTermSocialMind();
const socialDev = new SocialDevelopmentSystem();
const autonomousRelationships = new AutonomousRelationshipManager();
const initiatives = new AutonomousSocialInitiativeEngine();
const relationshipCore = new B287RelationshipValueDevelopmentCore();

brain.ingestLegacySources('user', {
  socialMindState: socialMind.snapshot(),
  relationshipCore,
  socialPredictiveNeural: socialPredictive.snapshot(),
  relationshipSelfState: relationshipSelf.snapshot(),
  longTermSocialMind: longTerm.snapshot(),
  socialDevelopment: socialDev.snapshot(),
  autonomousRelationships: autonomousRelationships.snapshot(),
  autonomousSocialInitiative: initiatives.snapshot(),
});
const d = brain.diagnostics();
assert.equal(d.canonicalOwner, 'B288SocialPredictiveSelfOtherBrain');
assert.equal(d.version, 2);
assert.equal(d.legacyAdapterCoverage01, 1);
assert.equal(new Set(d.deduplicatedSources).size, d.deduplicatedSources.length);
assert.ok(d.deduplicatedSources.length >= 9);
assert.ok(Number.isFinite(d.legacyConflict01));
const snap = brain.snapshot();
const restored = new B288SocialPredictiveSelfOtherBrain();
restored.restore(snap);
assert.deepEqual(restored.diagnostics(), d);
assert.deepEqual(defaultB288State().persons, []);
void defaultSocialMindState; void defaultRelationshipSelf; void defaultLongTermSocialMind; void defaultSocialDevelopment; void defaultAutonomousRelationship; void defaultAutonomousSocialInitiative; void socialWorld;
console.log(JSON.stringify({pass:true,canonicalOwner:d.canonicalOwner,coverage01:d.legacyAdapterCoverage01,deduplicatedSources:d.deduplicatedSources.length,conflict01:d.legacyConflict01,restore:true}));
