export type MemoryFusionProfile = 'quality'|'balanced'|'mobile'|'semantic-only';

export interface MemorySignalInput {
  semantic01:number;
  lexical01:number;
  entity01:number;
  temporal01:number;
  causal01:number;
  recency01:number;
  salience01:number;
  identity01:number;
  goal01:number;
  predictionError01:number;
  temperature01:number;
}

export interface MemorySignalBreakdown extends MemorySignalInput {
  score01:number;
  profile:MemoryFusionProfile;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sanitize=(input:MemorySignalInput):MemorySignalInput=>({
  semantic01:clamp(input.semantic01),lexical01:clamp(input.lexical01),entity01:clamp(input.entity01),
  temporal01:clamp(input.temporal01),causal01:clamp(input.causal01),recency01:clamp(input.recency01),
  salience01:clamp(input.salience01),identity01:clamp(input.identity01),goal01:clamp(input.goal01),
  predictionError01:clamp(input.predictionError01),temperature01:clamp(input.temperature01),
});

/**
 * P2690: low-cost multi-signal memory ranking.
 *
 * Dependency-free fusion for Termux/mobile. `semantic01` is reserved for a
 * genuine embedding signal; MemoryOS2 currently supplies zero until a model
 * provider is wired in. Available lexical/fuzzy, entity and temporal channels
 * receive the redistributed weight instead of treating hashed token vectors
 * as semantic evidence. It only ranks existing candidates; it never expands recall on its own.
 */
export class MemorySignalFusion {
  private readonly profile:MemoryFusionProfile;

  constructor(profile:MemoryFusionProfile='balanced'){ this.profile=profile; }

  score(input:MemorySignalInput):MemorySignalBreakdown {
    const x=sanitize(input);
    const weights=this.weights();
    const score01=clamp(
      weights.semantic*x.semantic01+
      weights.lexical*x.lexical01+
      weights.entity*x.entity01+
      weights.temporal*x.temporal01+
      weights.causal*x.causal01+
      weights.recency*x.recency01+
      weights.salience*x.salience01+
      weights.identity*x.identity01+
      weights.goal*x.goal01+
      weights.prediction*x.predictionError01+
      weights.temperature*x.temperature01
    );
    return {...x,score01,profile:this.profile};
  }

  temporalHint(query:string, memoryCreatedAt:number, now=Date.now()):number {
    const q=String(query??'').toLocaleLowerCase();
    const age=Math.max(0,now-Math.max(0,Number(memoryCreatedAt)||0));
    const day=86_400_000;
    const recent=clamp(Math.exp(-age/(21*day)));
    if(/\b(today|сегодня|current|now|сейчас|текущ)/u.test(q)) return clamp(Math.exp(-age/(2*day)));
    if(/\b(yesterday|вчера)/u.test(q)) return clamp(Math.exp(-Math.abs(age-day)/(1.5*day)));
    if(/\b(this week|recent|recently|на этой неделе|недавно)/u.test(q)) return clamp(Math.exp(-age/(7*day)));
    if(/\b(last week|earlier|before|прошл(ую|ой)|раньше|прежде)/u.test(q)) return clamp((1-recent)*.85+.15);
    const yearMatch=q.match(/\b(20\d{2})\b/);
    if(yearMatch){
      const targetYear=Number(yearMatch[1]);
      const year=new Date(memoryCreatedAt).getUTCFullYear();
      return year===targetYear?1:.18;
    }
    return .5+.5*recent;
  }

  private weights(){
    // Keep the historical profile name accepted for compatibility, but when no
    // true embedding provider exists its only evidence channel is actual lexical
    // match quality—not the old hashed-token pseudo-semantic vector.
    if(this.profile==='semantic-only') return {semantic:0,lexical:1,entity:0,temporal:0,causal:0,recency:0,salience:0,identity:0,goal:0,prediction:0,temperature:0};
    if(this.profile==='quality') return {semantic:0,lexical:.42,entity:.14,temporal:.11,causal:.11,recency:.05,salience:.06,identity:.04,goal:.04,prediction:.02,temperature:.01};
    if(this.profile==='mobile') return {semantic:0,lexical:.46,entity:.14,temporal:.10,causal:.09,recency:.07,salience:.05,identity:.04,goal:.03,prediction:.01,temperature:.01};
    return {semantic:0,lexical:.46,entity:.14,temporal:.10,causal:.10,recency:.06,salience:.06,identity:.04,goal:.03,prediction:.01,temperature:0};
  }
}

export const defaultMemorySignalFusion=(profile:MemoryFusionProfile='balanced')=>new MemorySignalFusion(profile);
