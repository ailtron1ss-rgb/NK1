import type { AdaptiveValueWeights, ValueRevision } from '../ValuePlasticity.ts';
import type { ActionKind } from '../../core/types.ts';

export interface ValueEvolutionState { version:1; revisions:ValueRevision[]; evidenceStreaks:Record<string,number>; tentativePressure:Record<string,number>; protectedFloor:Record<string,number>; totalRevisionMagnitude:number; lastRevisionAt:number; }
export interface ValueAttribution {
  value:keyof Pick<AdaptiveValueWeights,'curiosity'|'truth'|'autonomy'|'evidence'|'care'|'responsibility'|'social'>;
  confidence01:number;
  action:ActionKind|string;
  rationale:string;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function defaultValueEvolution():ValueEvolutionState{return{version:1,revisions:[],evidenceStreaks:{},tentativePressure:{},protectedFloor:{truth:0.9,autonomy:0.78,responsibility:0.82,care:0.55,curiosity:0.65,evidence:0.82,social:0.25},totalRevisionMagnitude:0,lastRevisionAt:0};}
export class ValueEvolutionEngine{
  private state=defaultValueEvolution();
  restore(v:ValueEvolutionState|undefined){this.state={...defaultValueEvolution(),...(v||{}),revisions:[...(v?.revisions||[])],evidenceStreaks:{...(v?.evidenceStreaks||{})},tentativePressure:{...((v as any)?.tentativePressure||{})},protectedFloor:{...defaultValueEvolution().protectedFloor,...(v?.protectedFloor||{})}};}
  snapshot(){return structuredClone(this.state);}

  /** Attribute an outcome to the value family actually engaged by the action/goal context.
   * This is explanatory metadata for learning; it never mutates values or becomes a policy owner.
   */
  attributeExperience(input:{action:ActionKind|string;goalTitle?:string|null;goalSource?:string|null;projectOrigin?:string|null}):ValueAttribution{
    const action=String(input.action||'wait');
    const title=String(input.goalTitle??'').toLowerCase();
    const source=String(input.goalSource??input.projectOrigin??'').toLowerCase();
    const scores:Record<string,number>={curiosity:.1,truth:.1,autonomy:.1,evidence:.1,care:.1,responsibility:.1,social:.1};
    const add=(k:string,v:number)=>{scores[k]=(scores[k]??0)+v;};
    if(action==='verify'){add('truth',.55);add('evidence',.50);add('responsibility',.12);}
    else if(action==='explore'){add('curiosity',.55);add('autonomy',.42);add('evidence',.10);}
    else if(action==='respond'){add('social',.50);add('care',.34);add('responsibility',.18);}
    else if(action==='reflect'){add('truth',.28);add('evidence',.26);add('autonomy',.18);add('responsibility',.18);}
    else if(action==='rest'){add('responsibility',.36);add('care',.28);add('autonomy',.10);}
    else {add('responsibility',.28);add('evidence',.20);add('autonomy',.12);}
    const keywords:Array<[string,string[]]>=[
      ['truth',['истин','правд','провер','verify','fact']],
      ['evidence',['доказ','evidence','подтверд','наблюден']],
      ['curiosity',['исслед','нов','узнат','explor']],
      ['autonomy',['самосто','автоном','собствен']],
      ['care',['забот','поддерж','помощ']],
      ['responsibility',['ответствен','исправ','восстанов']],
      ['social',['социаль','диалог','связ','отнош','общен']],
    ];
    for(const [value,words] of keywords) if(words.some(w=>title.includes(w))) add(value,.26);
    if(source.includes('learned')){add('evidence',.06);add('truth',.04);}
    if(source.includes('identity')){add('autonomy',.05);add('responsibility',.05);}
    const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const best=ranked[0];
    const second=ranked[1]??[best[0],0];
    const confidence01=clamp(.5+(best[1]-Number(second[1]))*.38);
    return {value:best[0] as ValueAttribution['value'],confidence01,action,rationale:`action=${action}; goal=${title||'none'}; source=${source||'none'}; top=${best[0]}`};
  }

  applyRevision(values:AdaptiveValueWeights, revision:ValueRevision): AdaptiveValueWeights {
    const next={...values}; const key=revision.value as keyof AdaptiveValueWeights; if(key==='updatedAt'||key==='plasticityBudget') return next;
    const floor=this.state.protectedFloor[String(key)]??0.1; (next as any)[key]=clamp(Math.max(floor, revision.after)); next.updatedAt=Date.now(); return next;
  }

  observeExperience(input:{values:AdaptiveValueWeights; success:number; surprise:number; projectOrigin:string; evidenceCount:number; independentSourceCount?:number; value:keyof AdaptiveValueWeights; direction:number; reference01?:number; attributionConfidence01?:number; causalSupport01?:number}): ValueRevision|null {
    const k=input.value as keyof AdaptiveValueWeights; if(k==='updatedAt'||k==='plasticityBudget') return null;
    const key=String(k); const streak=(this.state.evidenceStreaks[key]??0)+1; this.state.evidenceStreaks[key]=streak;
    const independentSources=Math.max(0,Math.floor(Number((input as any).independentSourceCount??0)));
    const attributionConfidence=clamp(input.attributionConfidence01??1);
    const causalSupport=clamp(input.causalSupport01??(independentSources>=2?.72:.45));
    const directionalPressure=(clamp(input.success)-clamp(input.reference01??0.5))*clamp(input.surprise);
    this.state.tentativePressure[key]=Math.max(-1,Math.min(1,(this.state.tentativePressure[key]??0)+directionalPressure*.05));
    // Internal repetition may accumulate tentative pressure, but canonical values only change
    // after independently corroborated evidence. This prevents self-generated feedback loops.
    const sufficientlyCorroborated=independentSources>=2 && causalSupport>=.58 && input.evidenceCount>=3;
    if(streak<3 || !sufficientlyCorroborated || input.surprise<0.4 || attributionConfidence<0.56) return null;
    const before=Number((input.values as any)[k]); const budget=Math.min(0.012, Math.max(0.002, input.values.plasticityBudget*0.1));
    const floor=this.state.protectedFloor[key]??0.1; const reference=clamp(input.reference01??0.5); const delta=clamp(input.direction)*(input.success-reference)*budget;
    if(Math.abs(delta)<0.001) return null;
    const after=clamp(Math.max(floor,before+delta)); if(Math.abs(after-before)<0.0009) return null;
    this.state.evidenceStreaks[key]=0;
    const revision:ValueRevision={id:`evo-${Date.now()}-${Math.random().toString(16).slice(2)}`,value:k as any,before,after,delta:after-before,success:clamp(input.success),surprise:clamp(input.surprise),at:Date.now()};
    this.state.revisions=[revision,...this.state.revisions].slice(0,512); this.state.totalRevisionMagnitude+=Math.abs(revision.delta); this.state.lastRevisionAt=revision.at; return structuredClone(revision);
  }
}
