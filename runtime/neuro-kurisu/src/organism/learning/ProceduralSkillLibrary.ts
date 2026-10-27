export interface SkillRecord {
  id:string;
  action:string;
  context:string;
  uses:number;
  successes:number;
  failures:number;
  successRate:number;
  confidence:number;
  cost01:number;
  status:'candidate'|'habit'|'disabled';
  lastUsedAt:number;
  failureModes:string[];
  validatedUses:number;
  independentEvidenceUses:number;
  distinctContexts:number;
  contextKeys:string[];
  transferScore01:number;
}

export interface CompoundSkillStep {
  id:string;
  action:string;
  toolId:string;
  input:Record<string,unknown>;
  inputBindings?:Record<string,string>;
  allowUnverified?:boolean;
  expectedOutputKeys?:string[];
  requiredInputKeys?:string[];
  fallbackToolIds?:string[];
  maxAttempts?:number;
  resourceCost01?:number;
}

export interface CompoundSkillPolicy {
  version:1;
  maxTotalAttempts:number;
  maxTotalResourceCost01:number;
  requireVerified:boolean;
  minEvidence01:number;
}

export interface CompoundSkillVariant {
  id:string; parentId:string|null; version:number; stepId:string; fromTool:string; toTool:string; reason:string;
  steps:CompoundSkillStep[]; createdAt:number; status:'candidate'|'active'|'retired'|'rejected'; trials:number; successes:number; nonHoldoutTrials:number; nonHoldoutSuccesses:number;
  verifiedExecutions:number; verifiedNonHoldoutExecutions:number; independentExecutions:number; holdoutExecutions:number; distinctContexts:number; confidence01:number;
  lastOutcome01:number; lastContext:string;
}

export type SkillMetaOperation='diagnose'|'select-repair'|'compare-variants'|'validate-variant'|'promote-variant'|'rollback';

export interface CompoundSkillRepair {
  at:number;
  stepId:string;
  toolId:string;
  failureFingerprint:string;
  diagnosis:'unknown-tool'|'destructive-tool'|'execution-error'|'unverified'|'postcondition-missing'|'input-binding'|'budget'|'max-attempts'|'unknown';
  contextSignature:string;
  candidateTools:string[];
  selectedTool?:string;
  verified:boolean;
  confidence01:number;
  holdout:boolean;
}

export interface CompoundSkillAdaptation {
  at:number;
  stepId:string;
  fromTool:string;
  toTool:string;
  reason:string;
  verified:boolean;
  confidence01:number;
}

export interface CompoundSkillRecord {
  id:string;
  name:string;
  origin:string;
  projectSignature:string;
  steps:CompoundSkillStep[];
  uses:number;
  successes:number;
  nonHoldoutUses:number;
  nonHoldoutSuccesses:number;
  verifiedExecutions:number;
  nonHoldoutVerifiedExecutions:number;
  independentExecutions:number;
  nonHoldoutIndependentExecutions:number;
  distinctContexts:number;
  confidence01:number;
  transferScore01:number;
  lastOutcome01:number;
  lastContext:string;
  status:'candidate'|'reusable'|'disabled';
  createdAt:number;
  lastUsedAt:number;
  policy:CompoundSkillPolicy;
  mutations:number;
  repairs:number;
  successfulFallbacks:number;
  adaptations:CompoundSkillAdaptation[];
  repairsLedger:CompoundSkillRepair[];
  lineageVersion:number;
  activeVariantId:string|null;
  variants:CompoundSkillVariant[];
}

export interface SkillLibraryState {
  version:8;
  skills:SkillRecord[];
  compoundSkills:CompoundSkillRecord[];
  promotions:number;
  demotions:number;
  compoundPromotions:number;
}

export interface SkillBiasResult {
  bias01:number;
  similarity01:number;
  confidence01:number;
  sourceSkillId:string|null;
  transferable:boolean;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const normalizeTokens=(value:string):string[]=>String(value??'').toLocaleLowerCase('ru-RU').normalize('NFKC').replace(/[^\p{L}\p{N}:/_-]+/gu,' ').split(/\s+/).filter(Boolean).slice(0,32);
const jaccard=(a:string[],b:string[])=>{const A=new Set(a),B=new Set(b);if(!A.size&&!B.size)return 1;let inter=0;for(const x of A)if(B.has(x))inter++;return inter/Math.max(1,new Set([...A,...B]).size);};
const hashSignature=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)};

export const defaultSkillLibrary=():SkillLibraryState=>({version:8,skills:[],compoundSkills:[],promotions:0,demotions:0,compoundPromotions:0});

export class ProceduralSkillLibrary{
 private state:SkillLibraryState=defaultSkillLibrary();
 private readonly contextTokenCache=new Map<string,string[]>();
 private readonly actionIndex=new Map<string,SkillRecord[]>();
 private readonly compoundContextTokenCache=new Map<string,string[]>();
 private readonly compoundActionIndex=new Map<string,CompoundSkillRecord[]>();
 private rebuildIndexes(){
  this.contextTokenCache.clear(); this.actionIndex.clear();
  for(const skill of this.state.skills){
   this.contextTokenCache.set(skill.id,normalizeTokens(skill.context));
   const list=this.actionIndex.get(skill.action)??[]; list.push(skill); this.actionIndex.set(skill.action,list);
  }
  this.compoundContextTokenCache.clear();
  this.compoundActionIndex.clear();
  for(const skill of this.state.compoundSkills){
   this.compoundContextTokenCache.set(skill.id,normalizeTokens(skill.lastContext||skill.name));
   const action=skill.steps[0]?.action;
   if(action){ const list=this.compoundActionIndex.get(action)??[]; list.push(skill); this.compoundActionIndex.set(action,list); }
  }
 }
 private tokensFor(skill:SkillRecord){
  const cached=this.contextTokenCache.get(skill.id); if(cached) return cached;
  const tokens=normalizeTokens(skill.context); this.contextTokenCache.set(skill.id,tokens); return tokens;
 }
 private compoundTokensFor(skill:CompoundSkillRecord){
  const cached=this.compoundContextTokenCache.get(skill.id); if(cached) return cached;
  const tokens=normalizeTokens(skill.lastContext||skill.name); this.compoundContextTokenCache.set(skill.id,tokens); return tokens;
 }
 private actionDistinctContexts(action:string){ const contexts=this.state.skills.filter(x=>x.action===action&&x.status!=='disabled').map(x=>x.context); return new Set(contexts).size; }
 private reevaluateActionPromotions(action:string){
  const contexts=this.actionDistinctContexts(action); if(contexts<3)return;
  for(const skill of this.state.skills.filter(x=>x.action===action&&x.status==='candidate')){
   const sufficient=skill.uses>=6&&skill.successRate>=.75&&skill.confidence>=.52&&skill.independentEvidenceUses>=2&&skill.validatedUses>=2;
   if(sufficient){skill.status='habit';this.state.promotions++;}
  }
 }
 private registerSkill(skill:SkillRecord){
  this.contextTokenCache.set(skill.id,normalizeTokens(skill.context));
  const list=this.actionIndex.get(skill.action)??[];
  if(!list.includes(skill)) list.push(skill);
  this.actionIndex.set(skill.action,list);
 }
 restore(s:Partial<SkillLibraryState>|undefined){
  const d:SkillLibraryState=defaultSkillLibrary();
  const rawSkills=Array.isArray(s?.skills)?s!.skills.slice(0,256):[];
  const rawCompound=Array.isArray((s as any)?.compoundSkills)?(s as any).compoundSkills.slice(0,64):[];
  this.state={...d,...(s??{}),version:8,promotions:Math.max(0,Math.floor(Number(s?.promotions??0))),demotions:Math.max(0,Math.floor(Number(s?.demotions??0))),compoundPromotions:Math.max(0,Math.floor(Number((s as any)?.compoundPromotions??0))),skills:rawSkills.map((x:any)=>({
    ...x,
    validatedUses:Math.max(0,Math.floor(Number(x.validatedUses??0))),
    independentEvidenceUses:Math.max(0,Math.floor(Number(x.independentEvidenceUses??0))),
    distinctContexts:Math.max(1,Math.floor(Number(x.distinctContexts??1))),
    contextKeys:Array.isArray(x.contextKeys)?Array.from(new Set(x.contextKeys.map((v:any)=>String(v).slice(0,180)))).slice(0,16):[String(x.context??'general').slice(0,180)],
    transferScore01:clamp(Number(x.transferScore01??(x.status==='habit'?0.6:0)))
  })),compoundSkills:rawCompound.map((x:any)=>({
    id:String(x.id??''),name:String(x.name??x.id??'compound-skill'),origin:String(x.origin??'project'),projectSignature:String(x.projectSignature??''),
    steps:Array.isArray(x.steps)
      ? x.steps.slice(0,8).map((step:any)=>({
        id:String(step.id??'step'),
        action:String(step.action??'reflect'),
        toolId:String(step.toolId??''),
        input:step.input&&typeof step.input==='object'?{...step.input}:{},
        inputBindings:step.inputBindings&&typeof step.inputBindings==='object'
          ? Object.fromEntries(Object.entries(step.inputBindings).slice(0,16).map(([k,v])=>[String(k),String(v)]))
          : undefined,
        allowUnverified:Boolean(step.allowUnverified),
        expectedOutputKeys:Array.isArray(step.expectedOutputKeys)?step.expectedOutputKeys.map((v:any)=>String(v)).slice(0,16):undefined,
        requiredInputKeys:Array.isArray(step.requiredInputKeys)?step.requiredInputKeys.map((v:any)=>String(v)).slice(0,16):undefined,
        fallbackToolIds:Array.isArray(step.fallbackToolIds)?step.fallbackToolIds.map((v:any)=>String(v)).slice(0,4):undefined,
        maxAttempts:Math.max(1,Math.min(8,Math.floor(Number(step.maxAttempts??3)))),
        resourceCost01:clamp(Number(step.resourceCost01??.1))
      }))
      : [],
    uses:Math.max(0,Math.floor(Number(x.uses??0))),
    successes:Math.max(0,Math.floor(Number(x.successes??0))),
    nonHoldoutUses:Math.max(0,Math.floor(Number(x.nonHoldoutUses??0))),
    nonHoldoutSuccesses:Math.max(0,Math.floor(Number(x.nonHoldoutSuccesses??0))),
    verifiedExecutions:Math.max(0,Math.floor(Number(x.verifiedExecutions??0))),
    nonHoldoutVerifiedExecutions:Math.max(0,Math.floor(Number(x.nonHoldoutVerifiedExecutions??0))),
    independentExecutions:Math.max(0,Math.floor(Number(x.independentExecutions??0))),
    nonHoldoutIndependentExecutions:Math.max(0,Math.floor(Number(x.nonHoldoutIndependentExecutions??0))),
    distinctContexts:Math.max(1,Math.floor(Number(x.distinctContexts??1))),
    confidence01:clamp(Number(x.confidence01??0)),
    transferScore01:clamp(Number(x.transferScore01??0)),
    lastOutcome01:clamp(Number(x.lastOutcome01??0)),
    lastContext:String(x.lastContext??''),
    status:x.status==='reusable'||x.status==='disabled'?('reusable'===x.status?'reusable':'disabled'):'candidate',
    createdAt:Math.max(0,Number(x.createdAt??0)),
    lastUsedAt:Math.max(0,Number(x.lastUsedAt??0)),
    policy:{
      version:1,
      maxTotalAttempts:Math.max(1,Math.min(24,Math.floor(Number(x.policy?.maxTotalAttempts??8)))),
      maxTotalResourceCost01:clamp(Number(x.policy?.maxTotalResourceCost01??.9)),
      requireVerified:x.policy?.requireVerified!==false,
      minEvidence01:clamp(Number(x.policy?.minEvidence01??.72))
    },
    mutations:Math.max(0,Math.floor(Number(x.mutations??0))),
    repairs:Math.max(0,Math.floor(Number(x.repairs??0))),
    successfulFallbacks:Math.max(0,Math.floor(Number(x.successfulFallbacks??0))),
    repairsLedger:Array.isArray(x.repairsLedger)
      ? x.repairsLedger.slice(0,48).map((r:any)=>({
        at:Math.max(0,Number(r.at??0)),stepId:String(r.stepId??''),toolId:String(r.toolId??''),failureFingerprint:String(r.failureFingerprint??''),
        diagnosis:['unknown-tool','destructive-tool','execution-error','unverified','postcondition-missing','input-binding','budget','max-attempts'].includes(r.diagnosis)?r.diagnosis:'unknown',
        contextSignature:String(r.contextSignature??''),candidateTools:Array.isArray(r.candidateTools)?r.candidateTools.map((v:any)=>String(v)).slice(0,5):[],
        selectedTool:r.selectedTool?String(r.selectedTool):undefined,verified:Boolean(r.verified),confidence01:clamp(Number(r.confidence01??0)),holdout:Boolean(r.holdout)
      })) : [],
    lineageVersion:Math.max(1,Math.floor(Number(x.lineageVersion??1))),
    activeVariantId:x.activeVariantId?String(x.activeVariantId):null,
    variants:Array.isArray(x.variants)?x.variants.slice(0,8).map((v:any)=>({
      id:String(v.id??''),parentId:v.parentId?String(v.parentId):null,version:Math.max(1,Math.floor(Number(v.version??1))),stepId:String(v.stepId??''),
      fromTool:String(v.fromTool??''),toTool:String(v.toTool??''),reason:String(v.reason??'').slice(0,120),steps:Array.isArray(v.steps)?v.steps.slice(0,8).map((step:any)=>({
        id:String(step.id??'step'),action:String(step.action??'reflect'),toolId:String(step.toolId??''),input:step.input&&typeof step.input==='object'?{...step.input}:{},
        inputBindings:step.inputBindings&&typeof step.inputBindings==='object'?Object.fromEntries(Object.entries(step.inputBindings).slice(0,16).map(([k,val])=>[String(k),String(val)])):undefined,
        allowUnverified:Boolean(step.allowUnverified),expectedOutputKeys:Array.isArray(step.expectedOutputKeys)?step.expectedOutputKeys.map((q:any)=>String(q)).slice(0,16):undefined,
        requiredInputKeys:Array.isArray(step.requiredInputKeys)?step.requiredInputKeys.map((q:any)=>String(q)).slice(0,16):undefined,fallbackToolIds:Array.isArray(step.fallbackToolIds)?step.fallbackToolIds.map((q:any)=>String(q)).slice(0,4):undefined,
        maxAttempts:Math.max(1,Math.min(8,Math.floor(Number(step.maxAttempts??3)))),resourceCost01:clamp(Number(step.resourceCost01??.1))
      })):[],createdAt:Math.max(0,Number(v.createdAt??0)),status:['candidate','active','retired','rejected'].includes(v.status)?v.status:'candidate',
      trials:Math.max(0,Math.floor(Number(v.trials??0))),successes:Math.max(0,Math.floor(Number(v.successes??0))),nonHoldoutTrials:Math.max(0,Math.floor(Number(v.nonHoldoutTrials??0))),nonHoldoutSuccesses:Math.max(0,Math.floor(Number(v.nonHoldoutSuccesses??0))),verifiedExecutions:Math.max(0,Math.floor(Number(v.verifiedExecutions??0))),verifiedNonHoldoutExecutions:Math.max(0,Math.floor(Number(v.verifiedNonHoldoutExecutions??0))),independentExecutions:Math.max(0,Math.floor(Number(v.independentExecutions??0))),holdoutExecutions:Math.max(0,Math.floor(Number(v.holdoutExecutions??0))),distinctContexts:Math.max(1,Math.floor(Number(v.distinctContexts??1))),confidence01:clamp(Number(v.confidence01??0)),lastOutcome01:clamp(Number(v.lastOutcome01??0)),lastContext:String(v.lastContext??'')
    })):[],
    adaptations:Array.isArray(x.adaptations)
      ? x.adaptations.slice(0,32).map((a:any)=>({
        at:Math.max(0,Number(a.at??0)),
        stepId:String(a.stepId??''),
        fromTool:String(a.fromTool??''),
        toTool:String(a.toTool??''),
        reason:String(a.reason??'').slice(0,120),
        verified:Boolean(a.verified),
        confidence01:clamp(Number(a.confidence01??0))
      }))
      : []
  }))};
  for(const skill of this.state.compoundSkills){
    if(!skill.variants.length){
      const baseId=`base:${skill.id}`;
      skill.variants=[{id:baseId,parentId:null,version:1,stepId:'__base__',fromTool:'',toTool:'',reason:'compiled-base',steps:structuredClone(skill.steps),createdAt:skill.createdAt,status:'active',trials:skill.uses,successes:skill.successes,nonHoldoutTrials:0,nonHoldoutSuccesses:0,verifiedExecutions:skill.verifiedExecutions,verifiedNonHoldoutExecutions:0,independentExecutions:skill.independentExecutions,holdoutExecutions:0,distinctContexts:skill.distinctContexts,confidence01:Math.max(.35,skill.confidence01),lastOutcome01:skill.lastOutcome01,lastContext:skill.lastContext}];
      skill.activeVariantId=baseId;
    } else if(!skill.activeVariantId){
      const active=skill.variants.find(v=>v.status==='active')??skill.variants[0];
      skill.activeVariantId=active?.id??null;
    }
  }
  this.rebuildIndexes();
 }
 snapshot(){return structuredClone(this.state);}

 observeOutcome(action:string,context:string,success:number,cost01:number,failureMode?:string, evidence?:{verified?:boolean;independent?:boolean;context?:string}){
  const normalizedContext=String(context??'general').slice(0,180);
  const key=`${action}|${normalizedContext}`;
  let s=this.state.skills.find(x=>x.id===key);
  if(!s){
    s={id:key,action,context:normalizedContext,uses:0,successes:0,failures:0,successRate:.5,confidence:.25,cost01:clamp(cost01),status:'candidate',lastUsedAt:0,failureModes:[],validatedUses:0,independentEvidenceUses:0,distinctContexts:1,contextKeys:[normalizedContext],transferScore01:0};
    this.state.skills=[s,...this.state.skills].slice(0,256);
    this.registerSkill(s);
  }
  s.uses++;
  const ok=clamp(success)>=.62;
  if(ok)s.successes++; else {s.failures++;if(failureMode)s.failureModes=Array.from(new Set([failureMode,...s.failureModes])).slice(0,8);}
  if(evidence?.verified) s.validatedUses++;
  if(evidence?.independent) s.independentEvidenceUses++;
  const incomingContext=String(evidence?.context??normalizedContext).slice(0,180);
  const priorContextSet=new Set(normalizeTokens(s.context));
  const incomingContexts=normalizeTokens(incomingContext);
  const similarity=jaccard([...priorContextSet],incomingContexts);
  const contextNovel=s.contextKeys.every(k=>jaccard(normalizeTokens(k),incomingContexts)<.72);
  if(contextNovel) s.contextKeys=[incomingContext,...s.contextKeys].slice(0,16);
  s.distinctContexts=Math.min(16,Math.max(1,s.contextKeys.length));
  s.successRate=s.uses?clamp(s.successes/s.uses):.5;
  const reliability=Math.min(1,s.uses/12);
  const evidenceQuality=clamp((s.validatedUses/Math.max(1,s.uses))*.65+(s.independentEvidenceUses/Math.max(1,s.uses))*.35);
  s.confidence=clamp(.72*(s.confidence*.86+reliability*.14)+.28*evidenceQuality);
  s.cost01=clamp(s.cost01*.85+clamp(cost01)*.15);
  s.transferScore01=clamp(s.transferScore01*.88 + Math.max(.05,similarity)*.12);
  s.lastUsedAt=Date.now();

  const generalContext=normalizedContext==='general' || normalizedContext==='active';
  const sufficientEvidence=s.independentEvidenceUses>=2 && s.validatedUses>=2 && s.distinctContexts>=2;
  const generalEvidence=s.independentEvidenceUses>=3 && s.validatedUses>=3 && generalContext;
  if(s.status==='candidate'&&s.uses>=6&&s.successRate>=.75&&s.confidence>=.52&&(sufficientEvidence||generalEvidence)){
    s.status='habit';
    this.state.promotions++;
  }
  this.reevaluateActionPromotions(s.action);
  if(s.status==='habit'&&s.uses>=8&&s.successRate<.45){
    s.status='candidate';
    s.transferScore01=clamp(s.transferScore01*.5);
    this.state.demotions++;
  }
 }

 bias(action:string,context:string):number{return (this.biasDetails(action,context).bias01-.5);}
 biasDetails(action:string,context:string):SkillBiasResult{
  const targetContext=String(context??'').slice(0,180);
  const exact=this.state.skills.find(s=>s.id===`${action}|${targetContext}`&&s.status!=='disabled');
  if(exact){
    const quality=clamp(exact.successRate*.56+exact.confidence*.24+exact.transferScore01*.20+(exact.status==='habit'?.16:0));
    return {bias01:clamp(.5+(quality-.5)*.55),similarity01:1,confidence01:exact.confidence,sourceSkillId:exact.id,transferable:exact.status==='habit'&&exact.confidence>=.52};
  }
  const target=normalizeTokens(targetContext);
  const candidates=(this.actionIndex.get(action)??[]).filter(s=>s.status!=='disabled');
  if(!candidates.length)return {bias01:.5,similarity01:0,confidence01:0,sourceSkillId:null,transferable:false};
  let best:SkillRecord|null=null;let bestSimilarity=0;
  for(const skill of candidates){
    const sim=jaccard(target,this.tokensFor(skill));
    if(sim>bestSimilarity){bestSimilarity=sim;best=skill;}
  }
  if(!best || bestSimilarity<.45)return {bias01:.5,similarity01:bestSimilarity,confidence01:best?.confidence??0,sourceSkillId:null,transferable:false};
  const habitBonus=best.status==='habit'?.16:0;
  const transfer=best.status==='habit'&&bestSimilarity>=.55&&best.confidence>=.52;
  const quality=clamp(best.successRate*.56+best.confidence*.24+best.transferScore01*.20+habitBonus);
  return {bias01:clamp(.5+(quality-.5)*Math.min(.55,0.35+bestSimilarity*.35)),similarity01:bestSimilarity,confidence01:best.confidence,sourceSkillId:best.id,transferable:transfer};
 }

  compileCompoundSkill(input:{projectId:string;name:string;origin:string;steps:Array<{id:string;action:string;toolId?:string;input?:Record<string,unknown>;inputBindings?:Record<string,string>;allowUnverified?:boolean;expectedOutputKeys?:string[];requiredInputKeys?:string[];fallbackToolIds?:string[];maxAttempts?:number;resourceCost01?:number}>}):CompoundSkillRecord|null{
    const steps=(input.steps??[])
      .filter(step=>String(step.toolId??'').trim())
      .slice(0,8)
      .map(step=>({
        id:String(step.id),
        action:String(step.action),
        toolId:String(step.toolId),
        input:step.input&&typeof step.input==='object'?{...step.input}:{},
        inputBindings:step.inputBindings&&typeof step.inputBindings==='object'
          ? Object.fromEntries(Object.entries(step.inputBindings).slice(0,16).map(([k,v])=>[String(k),String(v)]))
          : undefined,
        allowUnverified:Boolean(step.allowUnverified),
        expectedOutputKeys:Array.isArray(step.expectedOutputKeys)?step.expectedOutputKeys.map(v=>String(v)).slice(0,16):undefined,
        requiredInputKeys:Array.isArray(step.requiredInputKeys)?step.requiredInputKeys.map(v=>String(v)).slice(0,16):undefined,
        fallbackToolIds:Array.isArray(step.fallbackToolIds)?step.fallbackToolIds.map(v=>String(v)).slice(0,4):undefined,
        maxAttempts:Math.max(1,Math.min(8,Math.floor(Number(step.maxAttempts??3)))),
        resourceCost01:clamp(Number(step.resourceCost01??.1))
      }));
    if(steps.length<2)return null;
    const projectSignature=`${String(input.projectId).slice(0,96)}::${String(input.name).slice(0,96)}::${steps.map(step=>`${step.id}:${step.action}>${step.toolId}`).join('|')}`;
    const id=`compound:${hashSignature(projectSignature)}`;
    const now=Date.now();
    const existing=this.state.compoundSkills.find(skill=>skill.id===id);
    if(existing){ existing.lastUsedAt=Math.max(existing.lastUsedAt,now); return structuredClone(existing); }
    const maxTotalAttempts=Math.max(steps.length,Math.min(24,steps.reduce((n,step)=>n+(step.maxAttempts??3)*(1+(step.fallbackToolIds??[]).length),0)));
    const maxTotalResourceCost01=clamp(steps.reduce((n,step)=>n+Number(step.resourceCost01??.1)*(1+(step.fallbackToolIds??[]).length),0)*1.35);
    const baseId=`base:${id}`;
    const baseVariant:CompoundSkillVariant={
      id:baseId,parentId:null,version:1,stepId:'__base__',fromTool:'',toTool:'',reason:'compiled-base',
      steps:structuredClone(steps),createdAt:now,status:'active',trials:0,successes:0,nonHoldoutTrials:0,nonHoldoutSuccesses:0,verifiedExecutions:0,
      independentExecutions:0,verifiedNonHoldoutExecutions:0,holdoutExecutions:0,distinctContexts:1,confidence01:.18,lastOutcome01:0,lastContext:''
    };
    const record:CompoundSkillRecord={
      id,name:String(input.name).slice(0,160),origin:String(input.origin).slice(0,48),projectSignature,steps,
      uses:0,successes:0,nonHoldoutUses:0,nonHoldoutSuccesses:0,verifiedExecutions:0,nonHoldoutVerifiedExecutions:0,independentExecutions:0,nonHoldoutIndependentExecutions:0,distinctContexts:1,confidence01:.18,
      transferScore01:0,lastOutcome01:0,lastContext:'',status:'candidate',createdAt:now,lastUsedAt:0,
      policy:{version:1,maxTotalAttempts,maxTotalResourceCost01,requireVerified:true,minEvidence01:.72},mutations:0,
      repairs:0,successfulFallbacks:0,adaptations:[],repairsLedger:[],lineageVersion:1,
      activeVariantId:baseId,variants:[baseVariant]
    };
    this.state.compoundSkills=[record,...this.state.compoundSkills].slice(0,64);
    this.compoundContextTokenCache.set(record.id,normalizeTokens(record.name));
    const firstAction=record.steps[0]?.action;
    if(firstAction){ const list=this.compoundActionIndex.get(firstAction)??[]; list.unshift(record); this.compoundActionIndex.set(firstAction,list.slice(0,64)); }
    return structuredClone(record);
  }
  /**
   * Execute the selected compound-skill variant through the caller's canonical tool gateway.
   * Holdout and independence are explicit run provenance; this method never infers either
   * from context, order, or success. The gateway callback must return verified postcondition
   * evidence rather than treating an exit code or tool response alone as proof.
   */
  async executeCompoundSkill(id:string,input:{
    context:string;
    holdout:boolean;
    independent:boolean;
    executeTool:(toolId:string,toolInput:Record<string,unknown>,step:CompoundSkillStep)=>Promise<{
      ok:boolean; verified:boolean; result?:Record<string,unknown>; error?:string; confidence01?:number;
    }>;
  }):Promise<{ok:boolean;verified:boolean;skill:CompoundSkillRecord|null;outputs:Record<string,Record<string,unknown>>;failedStepId?:string;error?:string}>{
    const initial=this.state.compoundSkills.find(x=>x.id===id);
    if(!initial||initial.status==='disabled')return {ok:false,verified:false,skill:null,outputs:{},error:'compound-skill-unavailable'};
    if(typeof input.context!=='string'||typeof input.holdout!=='boolean'||typeof input.independent!=='boolean'||typeof input.executeTool!=='function'){
      return {ok:false,verified:false,skill:structuredClone(initial),outputs:{},error:'compound-skill-run-provenance-required'};
    }
    const selected=initial.activeVariantId?initial.variants.find(v=>v.id===initial.activeVariantId&&v.status==='active'):null;
    const steps=structuredClone(selected?.steps??initial.steps);
    if(steps.length<2)return {ok:false,verified:false,skill:structuredClone(initial),outputs:{},error:'compound-skill-has-no-executable-steps'};
    const outputs:Record<string,Record<string,unknown>>={};
    const failed: Array<{step:CompoundSkillStep;toolId:string;error:string;candidateTools:string[]}>= [];
    let attempts=0,resourceCost=0,allVerified=true;
    const maxAttempts=Math.max(steps.length,Math.min(24,initial.policy.maxTotalAttempts));
    for(const step of steps){
      const stepInput:Record<string,unknown>={...step.input};
      for(const [target,source] of Object.entries(step.inputBindings??{})){
        const [sourceStep,...sourcePath]=String(source).split('.');
        let value:unknown=outputs[sourceStep];
        for(const part of sourcePath){if(value&&typeof value==='object'&&!Array.isArray(value))value=(value as Record<string,unknown>)[part];else{value=undefined;break;}}
        if(value!==undefined)stepInput[target]=value;
      }
      const candidates=Array.from(new Set([step.toolId,...(step.fallbackToolIds??[])].filter(Boolean))).slice(0,5);
      let completed=false;
      for(const toolId of candidates){
        if(attempts>=maxAttempts||resourceCost+clamp(Number(step.resourceCost01??.1))>initial.policy.maxTotalResourceCost01){
          const error=attempts>=maxAttempts?'compound-skill-max-attempts':'compound-skill-resource-budget';
          this.recordCompoundRepair(id,{stepId:step.id,toolId,error,ok:false,verified:false,confidence01:0,context:input.context,candidateTools:candidates,holdout:input.holdout});
          this.recordCompoundExecution(id,{success01:0,verified:false,independent:input.independent,holdout:input.holdout,context:input.context});
          return {ok:false,verified:false,skill:this.state.compoundSkills.find(x=>x.id===id)?structuredClone(this.state.compoundSkills.find(x=>x.id===id)!):null,outputs,failedStepId:step.id,error};
        }
        attempts++;resourceCost+=clamp(Number(step.resourceCost01??.1));
        let observed:{ok:boolean;verified:boolean;result?:Record<string,unknown>;error?:string;confidence01?:number};
        try{observed=await input.executeTool(toolId,{...stepInput},step);}
        catch(error){observed={ok:false,verified:false,error:String((error as Error)?.message??error).slice(0,180),confidence01:0};}
        const verified=observed.ok===true&&observed.verified===true;
        if(observed.ok===true&&(!initial.policy.requireVerified||verified)){
          outputs[step.id]=observed.result&&typeof observed.result==='object'?{...observed.result}:{};
          allVerified=allVerified&&verified;
          completed=true;
          const priorFailure=failed.find(x=>x.step.id===step.id);
          if(priorFailure&&verified&&!input.holdout){
            this.recordCompoundRepair(id,{stepId:step.id,toolId:priorFailure.toolId,error:priorFailure.error,ok:false,verified:true,confidence01:clamp(Number(observed.confidence01??0)),context:input.context,candidateTools:candidates,selectedTool:toolId,holdout:false});
          }
          break;
        }
        const error=String(observed.error??(observed.ok?'postcondition-missing':'tool-execution-failed')).slice(0,180);
        failed.push({step,toolId,error,candidateTools:candidates});
        if(toolId===candidates[candidates.length-1]){
          this.recordCompoundRepair(id,{stepId:step.id,toolId,error,ok:false,verified,confidence01:clamp(Number(observed.confidence01??0)),context:input.context,candidateTools:candidates,holdout:input.holdout});
        }
      }
      if(!completed){
        const last=failed[failed.length-1];
        this.recordCompoundExecution(id,{success01:0,verified:false,independent:input.independent,holdout:input.holdout,context:input.context});
        const skill=this.state.compoundSkills.find(x=>x.id===id);
        return {ok:false,verified:false,skill:skill?structuredClone(skill):null,outputs,failedStepId:step.id,error:last?.error??'compound-skill-step-failed'};
      }
    }
    const skill=this.recordCompoundExecution(id,{success01:1,verified:allVerified,independent:input.independent,holdout:input.holdout,context:input.context});
    return {ok:true,verified:allVerified,skill,outputs};
  }
  recordCompoundExecution(id:string,input:{success01:number;verified:boolean;independent?:boolean;holdout?:boolean;context?:string}):CompoundSkillRecord|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill || skill.status==='disabled')return null;
    const success=clamp(input.success01); const holdout=Boolean(input.holdout); const context=String(input.context??'').slice(0,180);
    const current=normalizeTokens(context); const previous=normalizeTokens(skill.lastContext); const similarity=jaccard(current,previous);
    skill.uses++; if(success>=.62)skill.successes++;
    if(input.verified)skill.verifiedExecutions++; if(input.independent)skill.independentExecutions++;
    if(!holdout){
      skill.nonHoldoutUses=(skill.nonHoldoutUses??0)+1;
      if(success>=.62)skill.nonHoldoutSuccesses=(skill.nonHoldoutSuccesses??0)+1;
      if(input.verified)skill.nonHoldoutVerifiedExecutions=(skill.nonHoldoutVerifiedExecutions??0)+1;
      if(input.independent)skill.nonHoldoutIndependentExecutions=(skill.nonHoldoutIndependentExecutions??0)+1;
      if(skill.nonHoldoutUses>1&&similarity<.72)skill.distinctContexts=Math.min(32,skill.distinctContexts+1);
      const reliability=Math.min(1,skill.nonHoldoutUses/8);
      const evidenceQuality=clamp((skill.nonHoldoutVerifiedExecutions/Math.max(1,skill.nonHoldoutUses))*.62+(skill.nonHoldoutIndependentExecutions/Math.max(1,skill.nonHoldoutUses))*.38);
      skill.confidence01=clamp(skill.confidence01*.74+reliability*.11+evidenceQuality*.15);
      skill.transferScore01=clamp(skill.transferScore01*.84+Math.max(.25,1-similarity*.25)*.16);
      skill.lastContext=context;
      this.compoundContextTokenCache.set(skill.id,normalizeTokens(context||skill.name));
    }
    skill.lastOutcome01=success; skill.lastUsedAt=Date.now();
    // Feed the actual execution result into the active variant's existing evidence
    // path. Holdout remains explicitly evaluation-only at both aggregation levels.
    if(skill.activeVariantId)this.recordVariantExecution(id,skill.activeVariantId,{success01:success,verified:input.verified,independent:input.independent,holdout,context});
    const nonHoldoutUses=skill.nonHoldoutUses??0;
    const nonHoldoutSuccessRate=(skill.nonHoldoutSuccesses??0)/Math.max(1,nonHoldoutUses);
    const promotable=nonHoldoutUses>=3&&nonHoldoutSuccessRate>=.76&&(skill.nonHoldoutVerifiedExecutions??0)>=2&&(skill.nonHoldoutIndependentExecutions??0)>=2&&skill.confidence01>=.52;
    if(skill.status==='candidate'&&promotable){skill.status='reusable';this.state.compoundPromotions++;}
    if(skill.status==='reusable'&&nonHoldoutUses>=6&&nonHoldoutSuccessRate<.5){skill.status='candidate';this.state.demotions++;}
    return structuredClone(skill);
  }
  diagnoseCompoundFailure(input:{stepId:string;toolId:string;error?:string;ok?:boolean;verified?:boolean;context?:string;candidateTools?:string[]}):{failureFingerprint:string;diagnosis:CompoundSkillRepair['diagnosis'];contextSignature:string}{
    const error=String(input.error??'').toLocaleLowerCase('ru-RU').normalize('NFKC').slice(0,180);
    const diagnosis:CompoundSkillRepair['diagnosis']=/unknown.*tool|tool.*unknown/.test(error)?'unknown-tool':/destructive/.test(error)?'destructive-tool':/binding|input/.test(error)?'input-binding':/budget|resource/.test(error)?'budget':/attempt/.test(error)?'max-attempts':input.ok!==false&&input.verified===false?'unverified':input.ok!==false&&input.verified===true?'postcondition-missing':error?'execution-error':'unknown';
    const contextSignature=normalizeTokens(String(input.context??'')).slice(0,12).join(' ');
    const failureFingerprint=hashSignature(`${input.stepId}|${input.toolId}|${diagnosis}|${error.replace(/\d+/g,'#')}`);
    return {failureFingerprint,diagnosis,contextSignature};
  }
  recordCompoundRepair(id:string,input:{stepId:string;toolId:string;error?:string;ok?:boolean;verified?:boolean;confidence01?:number;context?:string;candidateTools?:string[];selectedTool?:string;holdout?:boolean}):CompoundSkillRecord|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill||skill.status==='disabled')return null;
    const d=this.diagnoseCompoundFailure(input);
    const row:CompoundSkillRepair={at:Date.now(),stepId:String(input.stepId),toolId:String(input.toolId),failureFingerprint:d.failureFingerprint,diagnosis:d.diagnosis,contextSignature:d.contextSignature,candidateTools:Array.from(new Set((input.candidateTools??[]).map(String))).slice(0,5),selectedTool:input.selectedTool?String(input.selectedTool):undefined,verified:Boolean(input.verified),confidence01:clamp(Number(input.confidence01??0)),holdout:Boolean(input.holdout)};
    const duplicate=skill.repairsLedger.some(prior=>prior.failureFingerprint===row.failureFingerprint && prior.selectedTool===row.selectedTool && prior.contextSignature===row.contextSignature);
    if(!duplicate){skill.repairsLedger=[row,...skill.repairsLedger].slice(0,48);skill.lineageVersion++;}
    // Turn verified, non-holdout repair evidence into a staged variant at the point
    // where the runtime records the repair. Holdout observations remain evaluation-only.
    // Variant creation never changes activeVariantId or activates the candidate.
    if(!duplicate && !row.holdout && row.verified && row.confidence01>=skill.policy.minEvidence01 && row.selectedTool &&
       row.candidateTools.includes(row.selectedTool) && row.selectedTool!==row.toolId){
      this.createRepairVariant(id,{
        stepId:row.stepId,
        toTool:row.selectedTool,
        reason:`verified-repair:${row.diagnosis}:${row.failureFingerprint}`,
      });
    }
    return structuredClone(skill);
  }
  repairCandidates(id:string,stepId:string,failedTool:string):string[]{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill)return [];
    const step=skill.steps.find(x=>x.id===stepId); if(!step)return [];
    const historical=skill.repairsLedger.filter(r=>r.stepId===stepId&&r.toolId===failedTool&&r.verified&&r.selectedTool).map(r=>String(r.selectedTool));
    return Array.from(new Set([...historical,...(step.fallbackToolIds??[])])).filter(t=>t!==failedTool).slice(0,4);
  }
  adaptCompoundSkill(id:string,input:{stepId:string;fromTool:string;toTool:string;reason:string;verified:boolean;confidence01:number}):CompoundSkillRecord|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id);
    if(!skill || skill.status==='disabled') return null;
    const step=skill.steps.find(x=>x.id===input.stepId);
    if(!step || !String(input.toTool).trim() || input.toTool===input.fromTool) return structuredClone(skill);
    const confidence=clamp(input.confidence01);
    if(!input.verified || confidence<skill.policy.minEvidence01) return structuredClone(skill);
    step.fallbackToolIds=Array.from(new Set([...(step.fallbackToolIds??[]),String(input.toTool)])).slice(0,4);
    skill.adaptations=[{at:Date.now(),stepId:step.id,fromTool:String(input.fromTool),toTool:String(input.toTool),reason:String(input.reason).slice(0,120),verified:true,confidence01:confidence},...skill.adaptations].slice(0,32);
    skill.repairs++;
    skill.mutations++;
    skill.lineageVersion++;
    skill.successfulFallbacks++;
    return structuredClone(skill);
  }
  promoteFallbackIfReliable(id:string,stepId:string,toTool:string,input:{verified:boolean;confidence01:number}):CompoundSkillRecord|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill||skill.status==='disabled')return null;
    const step=skill.steps.find(x=>x.id===stepId); if(!step)return structuredClone(skill);
    if(!input.verified || input.confidence01<skill.policy.minEvidence01)return structuredClone(skill);
    const recent=skill.adaptations.filter(a=>a.stepId===stepId&&a.toTool===toTool&&a.verified&&a.confidence01>=skill.policy.minEvidence01);
    const holdoutContexts=new Set(skill.repairsLedger.filter(r=>r.stepId===stepId&&r.selectedTool===toTool&&r.verified&&r.holdout).map(r=>r.contextSignature).filter(Boolean));
    const hasIndependentContext=holdoutContexts.size>=1 || recent.some((a,i)=>i>0);
    if(recent.length<2 || !hasIndependentContext || step.toolId===toTool)return structuredClone(skill);
    const old=step.toolId; step.fallbackToolIds=[...(step.fallbackToolIds??[])].filter(x=>x!==toTool); step.fallbackToolIds=Array.from(new Set([old,...(step.fallbackToolIds??[])])); step.toolId=toTool; skill.mutations++; skill.repairs++; skill.lineageVersion++;
    skill.adaptations=[{at:Date.now(),stepId:step.id,fromTool:old,toTool,reason:'verified-fallback-promoted',verified:true,confidence01:clamp(input.confidence01)},...skill.adaptations].slice(0,32);
    return structuredClone(skill);
  }
  createRepairVariant(id:string,input:{stepId:string;toTool:string;reason:string}):CompoundSkillVariant|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill||skill.status==='disabled')return null;
    const i=skill.steps.findIndex(x=>x.id===input.stepId); if(i<0)return null; const toTool=String(input.toTool).trim(); if(!toTool||toTool===skill.steps[i].toolId)return null;
    const known=Array.from(new Set([...(skill.steps[i].fallbackToolIds??[]),...skill.repairsLedger.filter(r=>r.stepId===input.stepId&&r.verified&&r.selectedTool).map(r=>String(r.selectedTool))])); if(!known.includes(toTool))return null;
    const variantId=`variant:${skill.id}:${hashSignature(`${skill.lineageVersion}|${input.stepId}|${toTool}|${String(input.reason).slice(0,120)}`)}`; const existing=skill.variants.find(v=>v.id===variantId); if(existing)return structuredClone(existing);
    const steps=structuredClone(skill.steps); const fromTool=steps[i].toolId; steps[i].toolId=toTool; steps[i].fallbackToolIds=Array.from(new Set([fromTool,...(steps[i].fallbackToolIds??[])] )).filter(x=>x!==toTool).slice(0,4);
    const variant:CompoundSkillVariant={id:variantId,parentId:skill.activeVariantId,version:skill.lineageVersion+1,stepId:input.stepId,fromTool,toTool,reason:String(input.reason).slice(0,120),steps,createdAt:Date.now(),status:'candidate',trials:0,successes:0,nonHoldoutTrials:0,nonHoldoutSuccesses:0,verifiedExecutions:0,verifiedNonHoldoutExecutions:0,independentExecutions:0,holdoutExecutions:0,distinctContexts:1,confidence01:.18,lastOutcome01:0,lastContext:''};
    skill.variants=[variant,...skill.variants.filter(v=>v.id!==variantId)].slice(0,8); skill.lineageVersion=Math.max(skill.lineageVersion,variant.version); return structuredClone(variant);
  }
  recordVariantExecution(id:string,variantId:string,input:{success01:number;verified:boolean;independent?:boolean;holdout?:boolean;context?:string}):CompoundSkillVariant|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); const variant=skill?.variants.find(v=>v.id===variantId); if(!skill||!variant||variant.status==='rejected')return null;
    const success=clamp(input.success01); const holdout=Boolean(input.holdout); const context=String(input.context??'').slice(0,180); const similarity=jaccard(normalizeTokens(context),normalizeTokens(variant.lastContext));
    variant.trials++; if(success>=.62)variant.successes++;
    if(!holdout){
      variant.nonHoldoutTrials=(variant.nonHoldoutTrials??0)+1;
      if(success>=.62)variant.nonHoldoutSuccesses=(variant.nonHoldoutSuccesses??0)+1;
    }
    if(input.verified){variant.verifiedExecutions++; if(!holdout)variant.verifiedNonHoldoutExecutions=(variant.verifiedNonHoldoutExecutions??0)+1;}
    if(input.independent&&!holdout)variant.independentExecutions++;
    if(holdout)variant.holdoutExecutions++;
    if(!holdout&&variant.trials>1&&similarity<.72)variant.distinctContexts=Math.min(32,variant.distinctContexts+1);
    // Holdout observations are evaluation-only: they must not alter confidence,
    // promotion fitness, or rejection decisions.
    if(!holdout){
      const nonHoldoutTrials=variant.nonHoldoutTrials??0;
      const reliability=Math.min(1,nonHoldoutTrials/6);
      const evidence=clamp(((variant.verifiedNonHoldoutExecutions??0)/Math.max(1,nonHoldoutTrials))*.6+(variant.independentExecutions/Math.max(1,nonHoldoutTrials))*.4);
      variant.confidence01=clamp(variant.confidence01*.72+reliability*.12+evidence*.16);
    }
    variant.lastOutcome01=success; if(!holdout)variant.lastContext=context;
    const nonHoldoutTrials=variant.nonHoldoutTrials??0;
    const nonHoldoutSuccessRate=(variant.nonHoldoutSuccesses??0)/Math.max(1,nonHoldoutTrials);
    if(variant.status==='candidate'&&nonHoldoutTrials>=3&&nonHoldoutSuccessRate>=.75&&(variant.verifiedNonHoldoutExecutions??0)>=2&&variant.independentExecutions>=1&&variant.confidence01>=.52)this.promoteVariant(id,variantId);
    else if(variant.status==='candidate'&&nonHoldoutTrials>=4&&nonHoldoutSuccessRate<.5)variant.status='rejected';
    return structuredClone(variant);
  }
  promoteVariant(id:string,variantId:string):CompoundSkillVariant|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); const variant=skill?.variants.find(v=>v.id===variantId); if(!skill||!variant||variant.status==='rejected')return null;
    const oldId=skill.activeVariantId;
    if(oldId===variantId){variant.status='active';return structuredClone(variant);}
    // Enforce the evidence gate at the mutation boundary, not only in the
    // observation path. Public/meta-operation callers must not bypass it.
    const verifiedNonHoldout=Number.isFinite(variant.verifiedNonHoldoutExecutions)?variant.verifiedNonHoldoutExecutions:0;
    const nonHoldoutTrials=Number.isFinite(variant.nonHoldoutTrials)?variant.nonHoldoutTrials:0;
    const nonHoldoutSuccessRate=(Number.isFinite(variant.nonHoldoutSuccesses)?variant.nonHoldoutSuccesses:0)/Math.max(1,nonHoldoutTrials);
    const promotable=variant.status==='candidate'&&nonHoldoutTrials>=3&&nonHoldoutSuccessRate>=.75&&verifiedNonHoldout>=2&&variant.independentExecutions>=1&&variant.confidence01>=.52;
    if(!promotable)return null;
    if(oldId){const old=skill.variants.find(v=>v.id===oldId);if(old)old.status='retired';}
    skill.steps=structuredClone(variant.steps); skill.activeVariantId=variantId; variant.status='active'; skill.mutations++; skill.repairs++; skill.lineageVersion=Math.max(skill.lineageVersion,variant.version);
    skill.adaptations=[{at:Date.now(),stepId:variant.stepId,fromTool:variant.fromTool,toTool:variant.toTool,reason:`variant-promoted:${variant.reason}`,verified:true,confidence01:variant.confidence01},...skill.adaptations].slice(0,32); return structuredClone(variant);
  }
  rollbackCompoundSkill(id:string,reason='evidence-demotion'):CompoundSkillVariant|null{
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill||skill.status==='disabled')return null; const current=skill.activeVariantId?skill.variants.find(v=>v.id===skill.activeVariantId):null;
    const previous=skill.variants.filter(v=>v.status==='retired').sort((a,b)=>b.version-a.version)[0]; if(!previous)return null; if(current)current.status='retired'; previous.status='active'; skill.steps=structuredClone(previous.steps); skill.activeVariantId=previous.id; skill.repairs++; skill.mutations++; skill.lineageVersion++;
    skill.adaptations=[{at:Date.now(),stepId:previous.stepId,fromTool:current?.toTool??previous.fromTool,toTool:previous.toTool,reason:`rollback:${String(reason).slice(0,96)}`,verified:true,confidence01:Math.max(.56,previous.confidence01)},...skill.adaptations].slice(0,32); return structuredClone(previous);
  }
  compareCompoundVariants(id:string){
    const skill=this.state.compoundSkills.find(x=>x.id===id); if(!skill)return []; return skill.variants.map(v=>({id:v.id,status:v.status,score01:clamp(v.confidence01*.55+(v.successes/Math.max(1,v.trials))*.25+Math.min(1,v.holdoutExecutions/2)*.2),confidence01:v.confidence01,successRate01:clamp(v.successes/Math.max(1,v.trials)),verifiedExecutions:v.verifiedExecutions,holdoutExecutions:v.holdoutExecutions})).sort((a,b)=>b.score01-a.score01);
  }
  skillMetaOperation(operation:SkillMetaOperation,id:string,input:any={}):unknown{
    if(operation==='diagnose')return this.diagnoseCompoundFailure(input); if(operation==='select-repair')return this.repairCandidates(id,String(input.stepId??''),String(input.failedTool??'')); if(operation==='compare-variants')return this.compareCompoundVariants(id);
    if(operation==='validate-variant')return this.recordVariantExecution(id,String(input.variantId??''),{success01:clamp(Number(input.success01??0)),verified:Boolean(input.verified),independent:Boolean(input.independent),holdout:Boolean(input.holdout),context:String(input.context??'')});
    if(operation==='promote-variant')return this.promoteVariant(id,String(input.variantId??'')); if(operation==='rollback')return this.rollbackCompoundSkill(id,String(input.reason??'meta-rollback')); return null;
  }
  compoundSkillPolicy(id:string):CompoundSkillPolicy|null{ const skill=this.state.compoundSkills.find(x=>x.id===id); return skill?structuredClone(skill.policy):null; }
  compoundSkillBias(action:string,context:string):number{
    const target=normalizeTokens(context); let score=0;
    for(const skill of (this.compoundActionIndex.get(action)??[])){ if(skill.status==='disabled')continue; const sim=jaccard(target,this.compoundTokensFor(skill)); const usable=skill.status==='reusable'?1:.45; score=Math.max(score,sim*usable*(.35+.65*skill.confidence01)); }
    return score?clamp((score-.25)*.09):0;
  }
  findReusableCompoundSkill(context:string, preferredTool?:string):CompoundSkillRecord|null{
    const target=normalizeTokens(context); let best:CompoundSkillRecord|null=null; let bestScore=0;
    for(const skill of this.state.compoundSkills){ if(skill.status!=='reusable'||skill.confidence01<.52)continue; if(preferredTool && !skill.steps.some(step=>step.toolId===preferredTool))continue; const sim=jaccard(target,this.compoundTokensFor(skill)); const score=sim*.55+skill.transferScore01*.2+skill.confidence01*.25; if(score>bestScore){bestScore=score;best=skill;} }
    return best?structuredClone(best):null;
  }
  compoundSkills(limit=16):CompoundSkillRecord[]{return this.state.compoundSkills.slice(0,Math.max(1,Math.min(64,limit))).map(x=>structuredClone(x));}
 topReusable(limit=12):SkillRecord[]{return this.state.skills.filter(s=>s.status==='habit'&&s.confidence>=.52&&this.actionDistinctContexts(s.action)>=3).sort((a,b)=>(b.confidence+b.transferScore01)-(a.confidence+a.transferScore01)).slice(0,limit).map(x=>structuredClone(x));}
  summary(){return {
    version:this.state.version,
    skills:this.state.skills.length,
    promotions:this.state.promotions,
    demotions:this.state.demotions,
    reusable:this.state.skills.filter(s=>s.status==='habit').length,
    validatedUses:this.state.skills.reduce((n,s)=>n+s.validatedUses,0),
    independentEvidenceUses:this.state.skills.reduce((n,s)=>n+s.independentEvidenceUses,0),
    compoundSkills:this.state.compoundSkills.length,
    compoundPromotions:this.state.compoundPromotions,
    reusableCompoundSkills:this.state.compoundSkills.filter(s=>s.status==='reusable').length,
    compoundMutations:this.state.compoundSkills.reduce((n,s)=>n+s.mutations,0),
    compoundRepairs:this.state.compoundSkills.reduce((n,s)=>n+s.repairs,0),
    repairLedgerEntries:this.state.compoundSkills.reduce((n,s)=>n+s.repairsLedger.length,0),
    lineageVersions:this.state.compoundSkills.reduce((n,s)=>n+s.lineageVersion,0),variants:this.state.compoundSkills.reduce((n,s)=>n+s.variants.length,0),activeVariants:this.state.compoundSkills.filter(s=>Boolean(s.activeVariantId)).length,candidateVariants:this.state.compoundSkills.reduce((n,s)=>n+s.variants.filter(v=>v.status==='candidate').length,0)
  };}
}
