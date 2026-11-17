import assert from 'node:assert/strict';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';

const runtime = new EvidenceResearchSubsystemRuntime();
assert.ok(
  runtime.scienceRepublic,
  'EvidenceResearchSubsystemRuntime must expose Science Republic over its canonical Invention Loop',
);
assert.equal(runtime.snapshot().scienceRepublic?.version, 1);
console.log('SCIENCE_REPUBLIC_RUNTIME_OWNERSHIP=PASS');
