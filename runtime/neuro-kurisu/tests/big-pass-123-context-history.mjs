import assert from 'node:assert/strict';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';
const e=new PersonalCurriculumEngine();
for(let i=0;i<8;i++){e.beginCycle();e.observeDevelopmentalContext({action:'respond',source:'social',contextKey:`ctx-${i%4}`,pressure01:.56,identity01:.82,social01:i%2?.78:.42,causal01:.61,evidence01:.74,unresolved01:.43,at:2000+i,label:'repeated life/social learning'});}
const s=e.snapshot();
assert.ok(s.threads.length>=1);assert.ok(s.curriculumPressure01>.2);assert.ok(s.autobiographicalLearning01>.2);assert.ok(s.transferReadiness01>.1);
const contextThreads=s.threads.filter(t=>t.family.startsWith('context:'));assert.ok(contextThreads.length>=1);assert.ok(contextThreads.some(t=>t.contexts>=3));
console.log(`BIG_PASS_123_CONTEXT_HISTORY=PASS threads=${s.threads.length} contextThreads=${contextThreads.length} transfer=${s.transferReadiness01.toFixed(3)}`);
