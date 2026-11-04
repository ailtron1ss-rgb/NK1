import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CognitiveResourceEconomy, attentionIntentForAction } from '../src/organism/system/CognitiveResourceEconomy.ts';

const base={tick:1,energy01:.8,cognitiveLoad01:.2,uncertainty01:.35,novelty01:.4,thermalStrain01:.2,ramPressure01:.2,awake:true};

test('rest action reduces only the attention envelope and persists the effort set-point',()=>{
 const economy=new CognitiveResourceEconomy();
 const baseline=economy.allocate(base);
 const rested=economy.allocate({...base,tick:2,attentionIntent:'rest'});
 assert.equal(rested.attentionEffort01,.4);
 assert.ok(rested.attention01 < baseline.attention01);
 assert.equal(rested.totalBudget01,baseline.totalBudget01);
 assert.equal(rested.simulation01,baseline.simulation01);
 assert.equal(rested.learning01,baseline.learning01);
 assert.equal(rested.memory01,baseline.memory01);
 assert.equal(rested.externalInteraction01,baseline.externalInteraction01);
 assert.equal(economy.snapshot().attentionEffort01,.4);
});

test('focus restores full available attention while neutral intent relaxes toward baseline',()=>{
 const economy=new CognitiveResourceEconomy();
 economy.allocate({...base,attentionIntent:'rest'});
 const recovering=economy.allocate({...base,tick:2,attentionIntent:'neutral'});
 assert.ok(recovering.attentionEffort01>.4&&recovering.attentionEffort01<.8);
 const focused=economy.allocate({...base,tick:3,attentionIntent:'focus'});
 assert.equal(focused.attentionEffort01,1);
 assert.equal(focused.attention01,baseAttention(base));
});

function baseAttention(input){
 const probe=new CognitiveResourceEconomy();
 return probe.allocate({...input,attentionIntent:undefined}).attention01;
}

test('legacy snapshots without attention effort restore with neutral full-capacity behavior',()=>{
 const economy=new CognitiveResourceEconomy();
 economy.restore({version:1,cycles:4,attentionBudget01:.7,lastTick:3});
 const result=economy.allocate({...base,tick:4});
 assert.equal(result.attentionEffort01,1);
 assert.equal(result.attention01,baseAttention(base));
});

test('invalid attention intent cannot grant focus and all budgets remain finite',()=>{
 const economy=new CognitiveResourceEconomy();
 const result=economy.allocate({...base,attentionIntent:'untrusted'});
 assert.ok(result.attentionEffort01>=.8&&result.attentionEffort01<=1);
 assert.ok([result.totalBudget01,result.attention01,result.simulation01,result.learning01,result.memory01,result.externalInteraction01].every(Number.isFinite));
});

test('neutral recovery is monotonic, bounded and converges without oscillation',()=>{
 const economy=new CognitiveResourceEconomy();
 economy.allocate({...base,attentionIntent:'rest'});
 let previous=.4;
 for(let tick=2;tick<=102;tick++){
   const result=economy.allocate({...base,tick,attentionIntent:'neutral'});
   assert.ok(result.attentionEffort01>=previous,'neutral recovery must not move away from baseline');
   assert.ok(result.attentionEffort01<=.8,'neutral recovery must not overshoot the baseline');
   assert.ok(result.attention01<=result.totalBudget01,'attention must remain inside the resource ceiling');
   previous=result.attentionEffort01;
 }
 assert.ok(previous>.79,'the effort set-point should converge toward its neutral baseline');
});

test('maps only deliberate explore/verify and rest actions to effort requests',()=>{
 assert.equal(attentionIntentForAction('explore'),'focus');
 assert.equal(attentionIntentForAction('verify'),'focus');
 assert.equal(attentionIntentForAction('rest'),'rest');
 for(const action of ['respond','reflect','wait','defer','none',null,{},'untrusted']) assert.equal(attentionIntentForAction(action),'neutral');
});

test('both runtime resource-allocation passes must preserve the current action intent',async()=>{
 const runtimeSource=await readFile(new URL('../src/organism/core/OrganismRuntime.ts',import.meta.url),'utf8');
 const allocations=[...runtimeSource.matchAll(/this\.resourceEconomy\.allocate\(\{([\s\S]*?)\}\);/g)];
 assert.equal(allocations.length,2,'runtime currently has two resource allocation passes');
 assert.equal(
   allocations.filter(match=>match[1].includes('attentionIntent: attentionIntentForAction')).length,
   2,
   'both pre-decision and post-embodiment allocation passes must receive the action-conditioned intent',
 );
});
