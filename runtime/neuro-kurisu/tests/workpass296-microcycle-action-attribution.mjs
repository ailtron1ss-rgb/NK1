import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/organism/core/OperationalMicroCycleRuntime.ts', import.meta.url), 'utf8');
const architecture = await readFile(new URL('../src/organism/core/CognitiveArchitectureMap.ts', import.meta.url), 'utf8');

// A reduced-resolution heartbeat does not execute a new action. It must not
// label a prior full-cycle action as if it were executed at the current tick.
assert.match(source, /const microAction:\s*ActionKind\s*=\s*'wait';/);
assert.doesNotMatch(source, /const microAction\s*=\s*\(persistedState\.traces\[0\].*selected\?\.action/);
assert.match(source, /const microReward\s*=\s*0\.5;/);
assert.match(source, /const microVerified\s*=\s*false;/);
assert.match(source, /previousDecision\?\.selected\?\.action\s*\?\?\s*state\.lastAction/);

assert.match(architecture, /from:'lifecycle',to:'outcome-learning',kind:'governance',signal:'heartbeat tick is not an action receipt; no micro-cycle action credit'/);

console.log('WorkPass296 micro-cycle action attribution contract: OK');
