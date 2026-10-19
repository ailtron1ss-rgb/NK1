import assert from 'node:assert/strict';
import { TemporalContinuityEngine, defaultTemporalContinuity } from '../src/organism/learning/TemporalContinuityEngine.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const now = Date.now();
const engine = new TemporalContinuityEngine();
engine.restore(defaultTemporalContinuity(now));
engine.startSession(now, 'test');
engine.endSession(now + 5_000, 'test-stop', true);

const persisted = engine.snapshot();
const fiveDays = 5 * 24 * 60 * 60 * 1000;
const hugeGap = 100000 * 60 * 60 * 1000;
const raw = { schemaVersion:22, state:{version:22,tick:7}, facets:{advanced:{temporalContinuity:{...persisted,lastCheckpointAt:now+5_000,currentSessionId:'old-session',sessionCount:1}}}};
const migrated = migratePersistedOrganism(raw);
const restored = new TemporalContinuityEngine();
restored.restore(migrated.facets.advanced.temporalContinuity, now + 5_000 + fiveDays);
const resumed = restored.startSession(now + 5_000 + fiveDays, 'resume');

assert.equal(resumed.gapSincePreviousClass, 'days');
assert.equal(resumed.gapSincePreviousMs, fiveDays);
assert.ok(resumed.totalOfflineMs >= fiveDays);
assert.equal(resumed.sessionCount, 2);
assert.ok(resumed.lastCalendarContext.iso.endsWith('Z'));

const huge = new TemporalContinuityEngine();
huge.restore(resumed, now + 5_000 + fiveDays);
const hugeResumedAt = now + 5_000 + hugeGap + fiveDays;
huge.restore({...resumed,lastCheckpointAt: now + 5_000 + fiveDays, currentSessionId:'old-session'}, hugeResumedAt);
const hugeResumed = huge.startSession(hugeResumedAt, 'resume-huge-gap');
assert.equal(hugeResumed.gapSincePreviousClass, 'years');
assert.equal(hugeResumed.gapSincePreviousMs, hugeGap);
assert.equal(hugeResumed.sessionCount, 3);

console.log(`P20_TEMPORAL_CONTINUITY=PASS gapClass=${resumed.gapSincePreviousClass} gapMs=${resumed.gapSincePreviousMs} hugeGapClass=${hugeResumed.gapSincePreviousClass} hugeGapHours=${(hugeGap/3600000).toFixed(0)} sessions=${hugeResumed.sessionCount}`);
