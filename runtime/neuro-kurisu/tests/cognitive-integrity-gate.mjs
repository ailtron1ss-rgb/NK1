import { CognitiveImmuneSystem } from '../src/organism/cognition/CognitiveImmuneSystem.ts';
const c=new CognitiveImmuneSystem();
const review=c.assess({source:'user',confidence01:.35,evidence01:.25,contradiction01:.2,identityCritical:true,kind:'claim'});
if(review.status!=='review') throw new Error('identity claim should require review');
const q=c.assess({source:'unknown',confidence01:.2,evidence01:.1,contradiction01:.2,identityCritical:true,kind:'self'});
if(q.status!=='quarantine') throw new Error('unknown identity claim should quarantine');
console.log('PASS cognitive integrity gate');
