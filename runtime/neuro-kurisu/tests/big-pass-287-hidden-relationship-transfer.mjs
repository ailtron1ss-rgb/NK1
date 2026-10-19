import { B287RelationshipValueDevelopmentCore } from '../src/organism/cognition/B287RelationshipValueDevelopmentCore.ts';

function run(seed) {
  const n = new B287RelationshipValueDevelopmentCore();
  for (let t = 1; t <= 240; t++) {
    const rel = t % 2 === 0 ? 'A' : 'B';
    const hidden = rel === 'A' ? 0.85 : 0.18;
    const action = t % 3 === 0 ? 'respond' : 'verify';
    const reward = Math.max(0, Math.min(1,
      hidden * (action === 'respond' ? 1 : .35) +
      (1 - hidden) * (action === 'verify' ? .9 : .25) +
      ((seed % 7) - 3) * .01,
    ));
    n.step({
      tick: t, relationId: rel,
      selfLatent: Array.from({ length: 24 }, (_, i) => Math.sin(t * .04 + i * .07 + seed)),
      relationshipLatent: [hidden, .2 + hidden * .6, .7 - hidden * .3],
      goalVector: [hidden, 1 - hidden, .3],
      futureSelf: Array.from({ length: 32 }, (_, i) => Math.cos(t * .02 + i * .03 + seed)),
      socialState: {
        trust01: hidden, warmth01: hidden, predictability01: .5 + hidden * .4,
        guardedness01: 1 - hidden, agency01: .6, intentUncertainty01: 1 - hidden,
        relationshipStrength01: .2 + hidden * .6,
      },
      action, reward01: reward, predictionError01: .2 + Math.abs(reward - .6),
      surprise01: .1 + Math.abs(reward - .6), importance01: .7, learningEnabled: true,
    });
  }
  return n;
}

const n = run(13);
const d = n.diagnostics();
const a = n.actionBias('respond', 'A');
const b = n.actionBias('respond', 'B');
if (Math.abs(a - b) < .001) throw new Error(`relation action bias not differentiated ${a} ${b}`);
if (d.relationshipDifferentiation01 < .05) throw new Error('hidden differentiation too low');

console.log(JSON.stringify({
  pass: true,
  hiddenRelationActionBiasA: a,
  hiddenRelationActionBiasB: b,
  diagnostics: d,
}));
