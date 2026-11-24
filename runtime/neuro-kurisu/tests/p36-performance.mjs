import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';
const engine=new P36AutonomousSelfDevelopmentEngine();
const state={version:39,tick:1,at:Date.now(),needs:{energy:.8,cognitiveLoad:.2,uncertainty:.6,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.3},predictionError:.5,attentionBudget:.8,lastAction:'wait',lastActionSuccess:.5,autonomyScore:.8,selfPredictionError:.4,predictedNextAction:'wait',lastPredictionConfidence:.6,worldContextVersion:1};
const t=Date.now();
for(let i=0;i<10000;i++){engine.beginCycle(); if(i%8===0){const h=engine.propose({...state,tick:i}); if(h)engine.runSafeExperiment(h.id,{...state,tick:i},i+1);}}
const ms=Date.now()-t; assert.ok(ms<1500);
console.log('P36_PERFORMANCE=PASS',JSON.stringify({cycles:engine.diagnostics().cycles,ms,experiments:engine.diagnostics().experiments}));
