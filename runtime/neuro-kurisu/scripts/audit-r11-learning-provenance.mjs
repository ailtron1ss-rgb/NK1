import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const start = source.indexOf('  async feedback(outcome:');
const end = source.indexOf('\n  cameraEvidenceSnapshot()', start);
if (start < 0 || end < 0) throw new Error('feedback-boundary-not-found');
const feedback = source.slice(start, end);
const learningRegion = feedback.replace(/  private async feedbackSpineOnly[\s\S]*?async feedback\(/, 'async feedback(');

const forbidden = [
  { token: 'reward: success,', reason: 'recovery-learning must consume gated reward' },
  { token: 'success01: success,', reason: 'learning owner must consume gated success' },
  { token: 'reward01: clamp(outcome.reward', reason: 'raw outcome reward must not bypass learning gate' },
  { token: 'reward01: outcome.reward', reason: 'raw outcome reward must not bypass learning gate' },
  { token: 'surprise01: surprise,', reason: 'learning owner must consume gated surprise' },
  { token: 'recordTaskScore(taskId, success,', reason: 'continual score is a learning update' },
  { token: 'observeRuntimeOutcome(trace.selected.action, success,', reason: 'developmental learning must consume gated success' },
  { token: 'observeOutcome(success, gatedSurprise01)', reason: 'semantic perception must consume gated success' },
];

const violations=[];
for (const rule of forbidden) {
  const index=learningRegion.indexOf(rule.token);
  if(index>=0) violations.push({token:rule.token,reason:rule.reason,line:feedback.slice(0,index).split('\n').length});
}

// Explicitly permitted raw-signal consumers: state bookkeeping and independent evaluation/ground truth.
const rawEvaluationMarkers=['modelOlympics.scoreRound','shadowOrganism.observeOutcome','p57RealityFirstObservatory.observe','researchGradeOrganism.recordPostcondition','operationalLife.recordPostcondition'];
const rawRewardOccurrences=(feedback.match(/\b(?:success|surprise|outcome\.reward)\b/g)||[]).length;
for(const marker of rawEvaluationMarkers){ if(!feedback.includes(marker)) violations.push({token:marker,reason:'expected evaluation boundary missing',line:0}); }

console.log(JSON.stringify({
  pass:violations.length===0,
  forbiddenRules:forbidden.length,
  violations,
  rawOutcomeTokenCount:rawRewardOccurrences,
  evaluationBoundaries:rawEvaluationMarkers.length,
},null,2));
if(violations.length) process.exit(1);
