/** OmeStro #10: bounded cross-domain discovery by causal structure, never keyword overlap. */
export type ActorRole = 'producer'|'consumer'|'sensor'|'controller'|'gate'|'queue'|'reservoir'|'transformer'|'memory'|'environment'|'selector'|'executor'|'repairer'|'coordinator'|'regulator';
export type FlowKind = 'signal'|'resource'|'control'|'material'|'credit'|'request'|'result';
export type ConstraintKind = 'capacity'|'latency'|'noise'|'trust'|'scarcity'|'dependency'|'safety'|'cost'|'irreversibility'|'bandwidth';
export type ResourceKind = 'compute'|'memory'|'energy'|'time'|'attention'|'trust'|'material'|'bandwidth';
export type DynamicRegime = 'saturation'|'oscillation'|'cascade'|'equilibrium'|'adaptation'|'recovery'|'growth'|'decay'|'competition'|'delayed-response';
export interface MechanismActor { id:string; role:ActorRole; label?:string }
export interface MechanismFlow { id:string; fromRole:ActorRole; toRole:ActorRole; kind:FlowKind }
export interface MechanismConstraint { id:string; kind:ConstraintKind; onRole:ActorRole; severity01?:number }
export interface MechanismFeedbackLoop { id:string; sourceRole:ActorRole; targetRole:ActorRole; polarity:'positive'|'negative'; delay01?:number }
export interface MechanismResource { id:string; kind:ResourceKind }
export interface MechanismDescription { id:string; title:string; domain:string; actors:MechanismActor[]; flows:MechanismFlow[]; constraints:MechanismConstraint[]; feedbackLoops:MechanismFeedbackLoop[]; resources:MechanismResource[]; dynamics:{regimes:DynamicRegime[];timescale:'fast'|'slow'|'mixed'} }
export interface MechanismCorrespondence { aspect:'actor'|'flow'|'constraint'|'feedback'|'resource'|'dynamic'; problemElementId:string; referenceElementId:string; structuralFeature:string; confidence01:number; explanation:string }
export interface MechanismBreakpoint { kind:string; problemFeature:string; referenceFeature:string; consequence:string; severity01:number }
export interface MechanismDiscovery { id:string; problemId:string; referenceMechanismId:string; problemTitle:string; referenceTitle:string; sourceDomain:string; targetDomain:string; similarity01:number; confidence01:number; transferability01:number; novelty01:number; coverage01:number; correspondences:MechanismCorrespondence[]; breakpoints:MechanismBreakpoint[]; hypothesis:string; verificationPlan:string; falsifier:string; status:'candidate'; epistemicStatus:'hypothesis' }
export interface MechanismSerendipityResult { problemId:string; status:'matched'|'no-match'|'insufficient-structure'; evaluatedN:number; emittedN:number; rejectedN:number; discoveries:MechanismDiscovery[]; reasons:string[] }
export interface MechanismSerendipityOptions { minSimilarity?:number; maxResults?:number }

const roles = new Set<ActorRole>(['producer','consumer','sensor','controller','gate','queue','reservoir','transformer','memory','environment','selector','executor','repairer','coordinator','regulator']);
const flows = new Set<FlowKind>(['signal','resource','control','material','credit','request','result']);
const constraints = new Set<ConstraintKind>(['capacity','latency','noise','trust','scarcity','dependency','safety','cost','irreversibility','bandwidth']);
const resources = new Set<ResourceKind>(['compute','memory','energy','time','attention','trust','material','bandwidth']);
const regimes = new Set<DynamicRegime>(['saturation','oscillation','cascade','equilibrium','adaptation','recovery','growth','decay','competition','delayed-response']);
const clamp=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const clean=(v:unknown,n=120)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/gu,' ').trim().slice(0,n):'';
const safeId=(v:unknown)=>clean(v,96).replace(/[^a-zA-Z0-9._:-]/gu,'-');
const unique=<T>(xs:T[])=>[...new Set(xs)];
function rows<T extends {id:string}>(raw:unknown,max:number,parse:(v:unknown)=>T|null):T[]{
 if(!Array.isArray(raw))return[];const seen=new Set<string>(),out:T[]=[];
 for(const value of raw.slice(0,max)){const item=parse(value);if(!item||seen.has(item.id))continue;seen.add(item.id);out.push(item);}return out;
}
function normalize(raw:unknown):MechanismDescription|null{
 if(!raw||typeof raw!=='object')return null;const x=raw as Record<string,unknown>,id=safeId(x.id),title=clean(x.title),domain=clean(x.domain,80);
 if(!id||!title||!domain)return null;
 const actors=rows(x.actors,24,v=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,rid=safeId(r.id);return rid&&roles.has(r.role as ActorRole)?{id:rid,role:r.role as ActorRole,label:clean(r.label,96)}:null;});
 const actorRoles=new Set(actors.map(x=>x.role));
 const fs=rows(x.flows,48,v=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,rid=safeId(r.id);return rid&&actorRoles.has(r.fromRole as ActorRole)&&actorRoles.has(r.toRole as ActorRole)&&flows.has(r.kind as FlowKind)?{id:rid,fromRole:r.fromRole as ActorRole,toRole:r.toRole as ActorRole,kind:r.kind as FlowKind}:null;});
 const cs=rows(x.constraints,32,v=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,rid=safeId(r.id);return rid&&actorRoles.has(r.onRole as ActorRole)&&constraints.has(r.kind as ConstraintKind)?{id:rid,kind:r.kind as ConstraintKind,onRole:r.onRole as ActorRole,severity01:clamp(r.severity01)}:null;});
 const bs=rows(x.feedbackLoops,32,v=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,rid=safeId(r.id);return rid&&actorRoles.has(r.sourceRole as ActorRole)&&actorRoles.has(r.targetRole as ActorRole)&&['positive','negative'].includes(String(r.polarity))?{id:rid,sourceRole:r.sourceRole as ActorRole,targetRole:r.targetRole as ActorRole,polarity:r.polarity as 'positive'|'negative',delay01:clamp(r.delay01)}:null;});
 const rs=rows(x.resources,24,v=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,rid=safeId(r.id);return rid&&resources.has(r.kind as ResourceKind)?{id:rid,kind:r.kind as ResourceKind}:null;});
 const d=x.dynamics&&typeof x.dynamics==='object'?x.dynamics as Record<string,unknown>:{};
 const ds=unique((Array.isArray(d.regimes)?d.regimes:[]).slice(0,10).filter((v):v is DynamicRegime=>typeof v==='string'&&regimes.has(v as DynamicRegime)));
 const timescale=['fast','slow','mixed'].includes(String(d.timescale))?d.timescale as 'fast'|'slow'|'mixed':'mixed';
 return actors.length>=2&&fs.length?{id,title,domain,actors,flows:fs,constraints:cs,feedbackLoops:bs,resources:rs,dynamics:{regimes:ds,timescale}}:null;
}
function dice(a:readonly string[],b:readonly string[]):number{
 if(!a.length&&!b.length)return 1;if(!a.length||!b.length)return 0;const counts=new Map<string,number>();for(const v of a)counts.set(v,(counts.get(v)||0)+1);
 let overlap=0;for(const v of b){const n=counts.get(v)||0;if(n){overlap++;counts.set(v,n-1);}}return 2*overlap/(a.length+b.length);
}
const weights={actors:.24,flows:.24,constraints:.16,feedback:.16,resources:.10,dynamics:.10} as const;
function signature(m:MechanismDescription){return{
 actors:m.actors.map(x=>x.role),flows:m.flows.map(x=>x.fromRole+'>'+x.toRole+':'+x.kind),
 constraints:m.constraints.map(x=>x.kind+'@'+x.onRole),feedback:m.feedbackLoops.map(x=>x.sourceRole+'>'+x.targetRole+':'+x.polarity),
 resources:m.resources.map(x=>x.kind),dynamics:m.dynamics.regimes,
};}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function correspond(a:MechanismDescription,b:MechanismDescription):MechanismCorrespondence[]{
 const out:MechanismCorrespondence[]=[];
 const add=(aspect:MechanismCorrespondence['aspect'],p:string,r:string,feature:string)=>out.push({aspect,problemElementId:p,referenceElementId:r,structuralFeature:feature,confidence01:.82,explanation:'Точно совпадает типизированный структурный признак; это не доказывает причинную эквивалентность.'});
 const match=<T extends {id:string}>(aspect:MechanismCorrespondence['aspect'],left:T[],right:T[],key:(x:T)=>string)=>{
  const used=new Set<string>();for(const x of left){const k=key(x),y=right.find(z=>key(z)===k&&!used.has(z.id));if(y){used.add(y.id);add(aspect,x.id,y.id,k);}}
 };
 match('actor',a.actors,b.actors,x=>x.role);
 match('flow',a.flows,b.flows,x=>x.fromRole+'>'+x.toRole+':'+x.kind);
 match('constraint',a.constraints,b.constraints,x=>x.kind+'@'+x.onRole);
 match('feedback',a.feedbackLoops,b.feedbackLoops,x=>x.sourceRole+'>'+x.targetRole+':'+x.polarity);
 match('resource',a.resources,b.resources,x=>x.kind);
 match('dynamic',a.dynamics.regimes.map((regime,i)=>({id:'p'+i,regime})),b.dynamics.regimes.map((regime,i)=>({id:'r'+i,regime})),x=>x.regime);
 return out.slice(0,32);
}
function findBreakpoints(a:MechanismDescription,b:MechanismDescription):MechanismBreakpoint[]{
 const out:MechanismBreakpoint[]=[];const targetRoles=new Set(b.actors.map(x=>x.role));
 for(const role of new Set(a.actors.map(x=>x.role)))if(!targetRoles.has(role))out.push({kind:'missing-reference-role',problemFeature:role,referenceFeature:'absent',consequence:'У эталонного механизма нет этой роли; её нельзя переносить без отдельной реализации.',severity01:.55});
 for(const flow of a.flows){
  const exact=b.flows.some(x=>x.fromRole===flow.fromRole&&x.toRole===flow.toRole&&x.kind===flow.kind);if(exact)continue;
  const reverse=b.flows.filter(x=>x.fromRole===flow.toRole&&x.toRole===flow.fromRole);
  const direct=b.flows.filter(x=>x.fromRole===flow.fromRole&&x.toRole===flow.toRole);
  if(reverse.length)out.push({kind:'flow-direction-reversal',problemFeature:flow.fromRole+'>'+flow.toRole+':'+flow.kind,referenceFeature:reverse.map(x=>x.kind).join(','),consequence:'Направление потока обращено; прямой перенос может развернуть причинное воздействие.',severity01:.92});
  else if(direct.length)out.push({kind:'flow-kind-mismatch',problemFeature:flow.fromRole+'>'+flow.toRole+':'+flow.kind,referenceFeature:direct.map(x=>x.kind).join(','),consequence:'Поток связывает те же роли, но переносит другой тип воздействия.',severity01:.68});
  else out.push({kind:'missing-reference-flow',problemFeature:flow.fromRole+'>'+flow.toRole+':'+flow.kind,referenceFeature:'absent',consequence:'В эталоне отсутствует этот причинный переход; соответствие неполно.',severity01:.52});
 }
 for(const c of a.constraints){const same=b.constraints.filter(x=>x.onRole===c.onRole);if(!same.some(x=>x.kind===c.kind))out.push({kind:'constraint-kind-mismatch',problemFeature:c.kind+'@'+c.onRole,referenceFeature:same.map(x=>x.kind).join(',')||'no-constraint-on-role',consequence:'Ограничение целевой системы отличается; пороги нельзя переносить напрямую.',severity01:.72});}
 for(const loop of a.feedbackLoops){
  const same=b.feedbackLoops.filter(x=>x.sourceRole===loop.sourceRole&&x.targetRole===loop.targetRole);
  if(same.length&&!same.some(x=>x.polarity===loop.polarity))out.push({kind:'feedback-polarity-mismatch',problemFeature:loop.sourceRole+'>'+loop.targetRole+':'+loop.polarity,referenceFeature:same.map(x=>x.polarity).join(','),consequence:'Обратная связь может усилить ошибку вместо её подавления.',severity01:.94});
  else if(!same.length)out.push({kind:'missing-feedback-path',problemFeature:loop.sourceRole+'>'+loop.targetRole,referenceFeature:'absent',consequence:'Контур обратной связи не подтверждён в эталоне; динамику нельзя считать эквивалентной.',severity01:.66});
 }
 const referenceResources=new Set(b.resources.map(x=>x.kind));
 for(const resource of a.resources)if(!referenceResources.has(resource.kind))out.push({kind:'resource-kind-mismatch',problemFeature:resource.kind,referenceFeature:[...referenceResources].join(',')||'none',consequence:'Ресурсные ограничения различаются; бюджет и стоимость переноса требуют самостоятельной оценки.',severity01:.56});
 for(const regime of a.dynamics.regimes)if(b.dynamics.regimes.length&&!b.dynamics.regimes.includes(regime))out.push({kind:'dynamic-regime-mismatch',problemFeature:regime,referenceFeature:b.dynamics.regimes.join(','),consequence:'Требуется отдельная проверка устойчивости целевого динамического режима.',severity01:.65});
 if(a.dynamics.timescale!=='mixed'&&b.dynamics.timescale!=='mixed'&&a.dynamics.timescale!==b.dynamics.timescale)out.push({kind:'timescale-mismatch',problemFeature:a.dynamics.timescale,referenceFeature:b.dynamics.timescale,consequence:'Разница временных масштабов может сделать обратную связь нестабильной.',severity01:.5});
 return out.slice(0,16);
}
const actor=(id:string,role:ActorRole):MechanismActor=>({id,role});
const flow=(id:string,fromRole:ActorRole,toRole:ActorRole,kind:FlowKind):MechanismFlow=>({id,fromRole,toRole,kind});
const constraint=(id:string,kind:ConstraintKind,onRole:ActorRole):MechanismConstraint=>({id,kind,onRole});
const feedback=(id:string,sourceRole:ActorRole,targetRole:ActorRole,polarity:'positive'|'negative'):MechanismFeedbackLoop=>({id,sourceRole,targetRole,polarity});
export const DEFAULT_MECHANISM_CATALOG:readonly MechanismDescription[]=[
 {id:'distributed-backpressure',title:'Backpressure in bounded pipelines',domain:'distributed-systems',actors:[actor('bp-p','producer'),actor('bp-q','queue'),actor('bp-c','consumer'),actor('bp-k','controller')],flows:[flow('bp-f1','producer','queue','request'),flow('bp-f2','queue','consumer','request'),flow('bp-f3','consumer','controller','signal'),flow('bp-f4','controller','producer','control')],constraints:[constraint('bp-c1','capacity','queue'),constraint('bp-c2','latency','queue')],feedbackLoops:[feedback('bp-b1','consumer','controller','negative'),feedback('bp-b2','controller','producer','negative')],resources:[{id:'bp-r1',kind:'compute'},{id:'bp-r2',kind:'memory'},{id:'bp-r3',kind:'time'}],dynamics:{regimes:['saturation','recovery'],timescale:'fast'}},
 {id:'immune-quarantine',title:'Immune quarantine and controlled escalation',domain:'immunology',actors:[actor('iq-s','sensor'),actor('iq-g','gate'),actor('iq-m','memory'),actor('iq-r','regulator'),actor('iq-e','executor')],flows:[flow('iq-f1','sensor','gate','signal'),flow('iq-f2','gate','memory','signal'),flow('iq-f3','gate','executor','control'),flow('iq-f4','memory','regulator','signal'),flow('iq-f5','regulator','gate','control')],constraints:[constraint('iq-c1','trust','gate'),constraint('iq-c2','noise','sensor')],feedbackLoops:[feedback('iq-b1','regulator','gate','negative')],resources:[{id:'iq-r1',kind:'attention'},{id:'iq-r2',kind:'memory'},{id:'iq-r3',kind:'energy'}],dynamics:{regimes:['cascade','recovery'],timescale:'mixed'}},
 {id:'ecological-population-regulation',title:'Predator–prey population regulation',domain:'ecology',actors:[actor('eco-p','producer'),actor('eco-c','consumer'),actor('eco-r','reservoir'),actor('eco-e','environment')],flows:[flow('eco-f1','producer','consumer','resource'),flow('eco-f2','consumer','reservoir','material'),flow('eco-f3','reservoir','environment','resource'),flow('eco-f4','environment','producer','resource')],constraints:[constraint('eco-c1','scarcity','reservoir'),constraint('eco-c2','dependency','consumer')],feedbackLoops:[feedback('eco-b1','consumer','producer','negative'),feedback('eco-b2','producer','consumer','positive')],resources:[{id:'eco-r1',kind:'material'},{id:'eco-r2',kind:'energy'},{id:'eco-r3',kind:'time'}],dynamics:{regimes:['oscillation','equilibrium','delayed-response'],timescale:'slow'}},
 {id:'predictive-error-correction',title:'Predictive error correction loop',domain:'control-theory',actors:[actor('pec-s','sensor'),actor('pec-m','memory'),actor('pec-k','controller'),actor('pec-e','environment')],flows:[flow('pec-f1','environment','sensor','signal'),flow('pec-f2','sensor','memory','signal'),flow('pec-f3','memory','controller','credit'),flow('pec-f4','controller','environment','control')],constraints:[constraint('pec-c1','noise','sensor'),constraint('pec-c2','latency','memory')],feedbackLoops:[feedback('pec-b1','controller','environment','negative')],resources:[{id:'pec-r1',kind:'attention'},{id:'pec-r2',kind:'memory'},{id:'pec-r3',kind:'compute'}],dynamics:{regimes:['adaptation','recovery'],timescale:'mixed'}},
 {id:'evolutionary-selection',title:'Variation–selection–retention cycle',domain:'evolutionary-biology',actors:[actor('ev-p','producer'),actor('ev-s','selector'),actor('ev-m','memory'),actor('ev-e','environment')],flows:[flow('ev-f1','producer','selector','result'),flow('ev-f2','environment','selector','signal'),flow('ev-f3','selector','memory','credit'),flow('ev-f4','memory','producer','resource')],constraints:[constraint('ev-c1','cost','producer'),constraint('ev-c2','capacity','memory')],feedbackLoops:[feedback('ev-b1','selector','producer','negative')],resources:[{id:'ev-r1',kind:'energy'},{id:'ev-r2',kind:'time'},{id:'ev-r3',kind:'memory'}],dynamics:{regimes:['growth','decay','adaptation'],timescale:'slow'}},
];

/** Titles/labels are not scored. Domain names only rule out same-domain results. */
export class MechanismSerendipityEngine {
 private readonly catalog:readonly MechanismDescription[];
 constructor(catalog:readonly MechanismDescription[]=DEFAULT_MECHANISM_CATALOG){this.catalog=catalog;}
 analyze(input:unknown,options:MechanismSerendipityOptions={}):MechanismSerendipityResult{
  const a=normalize(input),rawId=input&&typeof input==='object'?safeId((input as Record<string,unknown>).id):'';
  const problemId=a?.id||rawId||'invalid-problem';
  if(!a)return{problemId,status:'insufficient-structure',evaluatedN:0,emittedN:0,rejectedN:0,discoveries:[],reasons:['Нужны минимум два участника и один валидный направленный поток.']};
  const left=signature(a),keys=Object.keys(weights) as (keyof typeof weights)[],coverage=keys.filter(k=>left[k].length>0).length/keys.length;
  if(coverage<.5)return{problemId:a.id,status:'insufficient-structure',evaluatedN:0,emittedN:0,rejectedN:0,discoveries:[],reasons:['Недостаточно слоёв: нужны участники, потоки и дополнительные причинные признаки.']};
  const min=Math.max(0,Math.min(1,Number.isFinite(options.minSimilarity)?Number(options.minSimilarity):.36));
  const limit=Math.max(1,Math.min(8,Number.isInteger(options.maxResults)?Number(options.maxResults):3));
  const found:MechanismDiscovery[]=[];let evaluatedN=0,rejectedN=0;
  for(const raw of this.catalog.slice(0,128)){
   const b=normalize(raw);if(!b||b.domain.toLowerCase()===a.domain.toLowerCase())continue;evaluatedN++;
   const right=signature(b);let weighted=0,total=0,categories=0;
   for(const key of keys){if(!left[key].length)continue;weighted+=dice(left[key],right[key])*weights[key];total+=weights[key];categories++;}
   const similarity=total?weighted/total:0;if(categories<3||similarity<min){rejectedN++;continue;}
   const links=correspond(a,b),aspects=new Set(links.map(x=>x.aspect)),breaks=findBreakpoints(a,b);
   if(links.length<3||!aspects.has('flow')||aspects.size<3){rejectedN++;continue;}
   const transferPenalty=breaks.reduce((sum,x)=>sum+x.severity01*(x.kind.includes('direction')?.20:x.kind.includes('feedback')?.16:x.kind.includes('constraint')?.12:.07),0);
   const transfer=clamp(similarity*(1-Math.min(.75,transferPenalty)));
   const confidence=clamp(similarity*coverage*(.9+Math.min(.1,links.length/100)));
   const metric=a.constraints[0]?.kind||a.flows[0]?.kind||'system-outcome';
   const hypothesis='Unverified cross-domain mechanism hypothesis only: принцип «'+b.title+'» из области «'+b.domain+'» может помочь в задаче «'+a.title+'» ('+a.domain+'), поскольку совпадают структурные слои '+[...aspects].join(', ')+'. Причинная эквивалентность не доказана.';
   const verificationPlan='Сравнить baseline и одну изолированную модификацию на независимых holdout-наборах; измерить '+metric+', побочные эффекты, безопасность и стоимость; сохранить rollback.';
   const falsifier='Отвергнуть перенос, если holdout-повторы не превосходят baseline по '+metric+' или нарушаются ограничения безопасности/ресурсов.';
   found.push({id:'mechanism-'+hash(a.id+'|'+b.id+'|'+similarity.toFixed(4)),problemId:a.id,referenceMechanismId:b.id,problemTitle:a.title,referenceTitle:b.title,sourceDomain:b.domain,targetDomain:a.domain,similarity01:Number(similarity.toFixed(4)),confidence01:Number(confidence.toFixed(4)),transferability01:Number(transfer.toFixed(4)),novelty01:Number(clamp(.5+.5*(1-similarity)).toFixed(4)),coverage01:Number(coverage.toFixed(4)),correspondences:links,breakpoints:breaks,hypothesis,verificationPlan,falsifier,status:'candidate',epistemicStatus:'hypothesis'});
  }
  found.sort((x,y)=>y.transferability01-x.transferability01||y.confidence01-x.confidence01||x.referenceMechanismId.localeCompare(y.referenceMechanismId));
  const discoveries=found.slice(0,limit);
  return{problemId:a.id,status:discoveries.length?'matched':'no-match',evaluatedN,emittedN:discoveries.length,rejectedN:rejectedN+found.length-discoveries.length,discoveries,reasons:discoveries.length?['Найдена структурная междоменная аналогия; требуется независимая проверка.']:['Аналогия выше порога не найдена.']};
 }
}
