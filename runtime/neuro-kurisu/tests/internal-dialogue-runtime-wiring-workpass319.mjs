import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const language = await readFile(new URL('../src/organism/language/LanguageOrgan.ts', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../src/organism/cognition/CognitiveEventEvidenceBridge.ts', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
const journal = await readFile(new URL('../src/organism/persistence/OperationalJournal.ts', import.meta.url), 'utf8');

const proposalCall = runtime.indexOf('buildCognitiveProposalPrompt(cycle,fusedObservation');
assert.notEqual(proposalCall, -1, 'runtime must retain the canonical cognitive proposal path');
const proposalInvocation = runtime.slice(proposalCall, runtime.indexOf(';', proposalCall) + 1);
assert.match(proposalInvocation, /this\.core\.cognitiveEventFabricSnapshot\(\)/,
  'runtime must pass Core-owned causal snapshot into internal dialogue');

assert.match(core, /cognitiveEventFabricSnapshot\(\)/,
  'OrganismCore must expose the persisted CEF snapshot accessor');
assert.match(language, /causalSnapshot\?: CognitiveEventFabricSnapshot/,
  'proposal prompt must accept a typed optional CEF snapshot');
assert.match(language, /buildInternalDialogueReview\(cycle, fusedObservation, causalSnapshot\)/,
  'the proposal builder must pass the CEF snapshot into the review');
assert.match(language, /bindCognitiveEventEvidence\(claims, evidence, causalSnapshot\)/,
  'the review must bind its candidates against the canonical causal ledger');

assert.match(bridge, /node\.stage === 'outcome'/);
assert.match(bridge, /node\.stage === 'tool-outcome'/);
assert.match(bridge, /node\.stage === 'external-evidence'/);
assert.match(runtime, /await this\\.restoreLastInternalDialogueReceipt\\(\\)/,
  'runtime startup must restore the latest safe review receipt');
assert.match(runtime, /readRecent\('runtime\.internal-dialogue\.review'/,
  'receipt restore must read only the named review event from the operational journal');
assert.match(runtime, /restoreInternalDialogueReceipt\(record\.data\)/,
  'journal payloads must be schema-validated before restoring diagnostics');
assert.match(runtime, /sanitizeInternalDialogueText\(question,180\)/,
  'restored open questions must pass the privacy sanitizer');
assert.match(journal, /async readRecent\(event:string, limit=32\)/,
  'OperationalJournal must expose bounded filtered readback');
assert.match(journal, /parseJournalRecords/,
  'corrupt/torn JSONL lines must be isolated from prior valid records');
assert.match(runtime, /restoreInternalDialogueReceipt\(record\.data\)/);
assert.match(runtime, /lastInternalDialogueReceipt = receipt/);
assert.match(journal, /filePath\+'\.1'/,
  'readback must include the latest rotated journal when present');

assert.match(runtime, /delete providerRequest\.internalDialogueReceipt/,
  'runtime must strip the host-only receipt before calling any configured language invoker');
assert.match(runtime, /runtime\.internal-dialogue\.review/,
  'runtime must append a durable sanitized receipt to the operational journal');
assert.match(runtime, /internalDialogueReceiptSnapshot\(\)/,
  'runtime must expose only the last bounded review receipt for diagnostics');
assert.match(server, /delete providerRequest\.internalDialogueReceipt/,
  'host-side receipt metadata must be stripped before language-provider submission');

assert.match(bridge, /node\.payload\.independenceKey/,
  'late observations must preserve independent-source requirements');

console.log('NK1_INTERNAL_DIALOGUE_RUNTIME_WIRING=PASS core-snapshot=true proposal-path=true CEF-binding=true');
