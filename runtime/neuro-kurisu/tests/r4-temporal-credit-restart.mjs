import assert from 'node:assert/strict';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';

const a=new CanonicalTemporalCreditAuthority({gamma01:.88,lambda01:.82,maxHorizonTicks:8});
a.registerDecision({decisionId:'resume-1',tick:7,action:'verify',contextKey:'resume-context',predicted01:.35,at:7});
a.registerDecision({decisionId:'resume-2',tick:8,action:'respond',contextKey:'resume-context-2',predicted01:.4,at:8});
const snapshot=a.snapshot();
const restored=new CanonicalTemporalCreditAuthority();
restored.restore(snapshot);
const result=restored.resolveOutcome({decisionId:'resume-2',tick:9,reward01:.9,predictionError01:.4,verified01:1,independent01:1,autonomous01:1,at:9});
assert.equal(result.assignments.length,2);
assert.equal(new Set(result.assignments.map(a=>a.contextKey)).size,2);
assert(result.assignments.some(a=>a.decisionId==='resume-1' && a.contextKey==='resume-context'));
assert(result.assignments.some(a=>a.decisionId==='resume-2' && a.contextKey==='resume-context-2'));
assert.equal(result.openDecisions,0);
console.log('R4_TEMPORAL_CREDIT_RESTART_PASS', JSON.stringify({
  assignments:result.assignments.map(a=>({decisionId:a.decisionId,delayTicks:a.delayTicks,contextKey:a.contextKey})),
  restoredDiagnostics:restored.diagnostics(),
}));
