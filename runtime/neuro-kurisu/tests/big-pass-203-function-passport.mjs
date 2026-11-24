import assert from 'node:assert/strict';
import { derivePassportVerdict, requiredProofFor, passportConfidence, finalizePassport } from '../src/organism/verification/FunctionPassport.ts';

const contract={preconditions:[],postconditions:['observable state changes'],invariants:['no invalid state'],expectedEffects:['changes intended state and affects later behaviour'],forbiddenEffects:[]};
const plan=requiredProofFor('stateful',contract,'memory');
assert.equal(plan.some(x=>x.tier==='direct'&&x.required),true);
assert.equal(plan.some(x=>x.tier==='regression'&&x.required),true);
assert.equal(plan.some(x=>x.tier==='persistence'&&x.required),true);
assert.equal(derivePassportVerdict({safety:'stateful',proofPlan:plan,evidence:[]}), 'UNVERIFIED');
assert.equal(derivePassportVerdict({safety:'stateful',proofPlan:plan,evidence:[
  {tier:'direct',ok:true,at:1,source:'test',functionId:'x'},
  {tier:'regression',ok:true,at:1,source:'test',functionId:'x'}
]}), 'INTEGRATION_ONLY');
assert.equal(derivePassportVerdict({safety:'stateful',proofPlan:plan,evidence:[
  {tier:'direct',ok:true,at:1,source:'test',functionId:'x'},
  {tier:'regression',ok:true,at:1,source:'test',functionId:'x'},
  {tier:'persistence',ok:true,at:1,source:'test',functionId:'x'}
]}), 'VERIFIED');
assert.equal(derivePassportVerdict({safety:'external-side-effect',proofPlan:[],evidence:[]}), 'UNSAFE_TO_AUTO_RUN');
const p=finalizePassport({schemaVersion:1,id:'x',file:'x',line:1,name:'x',kind:'function',domain:'memory',criticality:.9,exported:true,paramCount:0,safety:'stateful',contract,proofPlan:plan,evidence:[{tier:'direct',ok:true,at:1,source:'test',functionId:'x'},{tier:'regression',ok:true,at:1,source:'test',functionId:'x'},{tier:'persistence',ok:true,at:1,source:'test',functionId:'x'}],verdict:'UNVERIFIED',confidence01:0,blockers:[],staticReferences:0,testReferences:1});
assert.equal(p.verdict,'VERIFIED');
assert.equal(p.blockers.length,0);
assert.ok(p.confidence01>0.8);
console.log(JSON.stringify({pass:203,status:'PASS',verdict:p.verdict,confidence01:p.confidence01,proofPlan:plan},null,2));
