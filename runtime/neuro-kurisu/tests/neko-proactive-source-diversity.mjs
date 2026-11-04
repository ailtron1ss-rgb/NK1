import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const hour = 60 * 60 * 1000;
const start = 1_810_000_000_000;

function input(at, topics) {
  return {
    at,
    externalInput: false,
    socialNeed01: .92,
    relationship01: .42,
    energy01: .9,
    identity01: .96,
    novelty01: 0,
    topics,
    quietPeriodMs: 0,
    cooldownMs: 0,
    startupGraceMs: 0,
  };
}

function candidate(topic, source) {
  return {
    topic,
    source,
    salience01: .9,
    freshness01: .86,
    interestFit01: .72,
    affectFit01: .65,
  };
}

function acknowledge(engine, at, topic, source) {
  const result = engine.cycle(input(at, [candidate(topic, source)]));
  assert.ok(result.initiative, `expected initiative from ${source}: ${topic}`);
  assert.equal(engine.stageMessage(result.initiative.id, `A thought about ${topic}.`, at + 1), true);
  assert.equal(engine.acknowledge(result.initiative.id, at + 2), true);
}

{
  const engine = new AutonomousSocialInitiativeEngine();
  let at = start;
  for (let index = 0; index < 6; index += 1) {
    acknowledge(
      engine,
      at,
      `Reflection on tactile prediction calibration under unique sensor condition ${index}`,
      'reflection',
    );
    at += hour;
  }

  const reflection = candidate(
    'A new reflection about embodied prediction under tactile uncertainty',
    'reflection',
  );
  const curiosity = candidate(
    'An independent curiosity about harmonic memory and spatial timing',
    'curiosity',
  );
  const result = engine.cycle(input(at, [reflection, curiosity]));

  assert.equal(
    result.initiative?.topic,
    curiosity.topic,
    'among near-equal candidates, a recently underused source should not be starved by a source with stronger static weight',
  );
}

{
  const engine = new AutonomousSocialInitiativeEngine();
  const result = engine.cycle(input(start, [
    candidate('A new reflection about embodied prediction under tactile uncertainty', 'reflection'),
  ]));
  assert.equal(result.initiative?.topic, 'A new reflection about embodied prediction under tactile uncertainty',
    'source diversity must never block an initiative when only one eligible source is available');
}

{
  const engine = new AutonomousSocialInitiativeEngine();
  const deferred = engine.cycle(input(start, [
    candidate('A deferred active goal about adaptive reasoning under uncertainty', 'active-goal'),
  ]));
  assert.ok(deferred.initiative);
  assert.equal(engine.defer(deferred.initiative.id, start + 1), true);

  const activeGoal = candidate('A fresh active goal about planning under uncertain conditions', 'active-goal');
  const curiosity = candidate('An unrelated curiosity about harmonic memory and spatial timing', 'curiosity');
  const result = engine.cycle(input(start + hour, [activeGoal, curiosity]));
  assert.equal(result.initiative?.topic, activeGoal.topic,
    'planned/deferred items are not delivery evidence and must not affect source rotation');
}

console.log('NEKO_PROACTIVE_SOURCE_DIVERSITY=PASS cases=3');
