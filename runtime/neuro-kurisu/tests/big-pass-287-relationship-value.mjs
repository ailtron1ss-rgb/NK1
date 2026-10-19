import { B287RelationshipValueDevelopmentCore } from '../src/organism/cognition/B287RelationshipValueDevelopmentCore.ts';

const net = new B287RelationshipValueDevelopmentCore();
for (let t = 1; t <= 320; t++) {
  const rel = t % 2 === 0 ? 'alice' : 'bob';
  const success = rel === 'alice'
    ? (t % 5 !== 0 ? (t > .6 ? 1 : .7) : .2)
    : (t % 7 === 0 ? .1 : .82);
  net.step({
    tick: t, relationId: rel,
    selfLatent: Array.from({ length: 24 }, (_, i) => Math.sin(t * .07 + i * .11)),
    relationshipLatent: [rel === 'alice' ? .8 : .25, rel === 'alice' ? .3 : .78, .6, .4],
    goalVector: [rel === 'alice' ? .8 : .2, .5, .3],
    futureSelf: Array.from({ length: 32 }, (_, i) => Math.cos(t * .03 + i * .09)),
    personalityVector: Array.from({ length: 24 }, (_, i) => ((i % 6) - 2.5) / 5),
    socialState: {
      trust01: rel === 'alice' ? .7 : .38, warmth01: rel === 'alice' ? .72 : .3,
      predictability01: rel === 'alice' ? .78 : .42, guardedness01: rel === 'alice' ? .2 : .6,
      agency01: .6, intentUncertainty01: rel === 'alice' ? .25 : .55,
      relationshipStrength01: rel === 'alice' ? .68 : .28,
    },
    action: rel === 'alice' ? 'respond' : 'verify', reward01: success,
    predictionError01: Math.abs(success - .65), surprise01: Math.abs(success - .65),
    importance01: t % 16 === 0 ? .9 : .45, repairAttempted: success < .35, learningEnabled: true,
  });
}

const d = net.diagnostics();
if (d.relationCount !== 2) throw new Error(`relationCount=${d.relationCount}`);
if (d.relationshipDifferentiation01 < .08) throw new Error(`differentiation too low ${d.relationshipDifferentiation01}`);
if (d.transferUses < 1) throw new Error(`no transfer uses ${d.transferUses}`);
const ab = net.identityAblation('alice');
if (ab <= 0) throw new Error(`ablation ${ab}`);
const snap = net.snapshot();
const net2 = new B287RelationshipValueDevelopmentCore();
net2.restore(snap);
if (JSON.stringify(net2.snapshot()) !== JSON.stringify(snap)) throw new Error('round-trip mismatch');

console.log(JSON.stringify({ pass: true, diagnostics: d, ablation: ab }));
