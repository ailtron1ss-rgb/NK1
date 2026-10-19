import assert from 'node:assert/strict';
import { B336ProjectCausalOwnershipGate } from '../src/organism/system/B336ProjectCausalOwnershipGate.ts';
const g=new B336ProjectCausalOwnershipGate();
for(let i=0;i<3;i++) g.observe({projectActive:true,candidates:[{action:'explore',fullRaw:.80,ablatedRaw:.62,projectContribution:.18},{action:'rest',fullRaw:.70,ablatedRaw:.70,projectContribution:0}]});
const d=g.diagnostics(); assert.equal(d.eligible,true); assert.equal(d.changedTopAction,3); assert.ok(d.meanProjectContribution01>0); console.log(JSON.stringify({pass:true,d},null,2));
