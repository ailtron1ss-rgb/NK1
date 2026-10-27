/**
 * Multi-source continual-learning mechanisms adapted for Neuro-Kurisu.
 * Design references: Avalanche; Tianshou/PER; SkillLearnBench; AgentMemoryBench;
 * XSkill; Letta/MemGPT; Mem0; Generative Agents; Voyager; Reflexion;
 * ContinualSkillBench; Berkeley CL Bench; Stable-Baselines3; CleanRL;
 * LangGraph; OpenHands; TRL; RLlib; MemoryBank; and replay/retention literature.
 * These are small TypeScript reimplementations, not copied upstream runtimes.
 * Scores are heuristics until verified task-stream experiments demonstrate uplift.
 */
import type { LearningExperience } from './P23LearningEngine.ts';
import type { ReplaySelectionOptions } from './ReplaySelectionPolicy.ts';
export interface ReplayPriority { id:string; priority01:number; recency01:number; surprise01:number; predictionError01:number; novelty01:number; forgettingRisk01:number; reasons:string[] }
export interface LearningHealth { predictionError01:number; recentPredictionError01:number; replayTdError01:number; evidenceDebt01:number; memoryPressure01:number; energy01:number }
export interface CurriculumTask { id:string; uncertainty01:number; readiness01:number; transfer01:number; novelty01:number; verificationCost01:number; repairValue01:number; blocked?:boolean }
export interface SkillEvidence { trainN:number; trainPass01:number; validationN:number; validationPass01:number; independentN:number; holdoutN?:number; priorPass01?:number; recentPass01?:number; recentN?:number }
export type SkillDecision='candidate'|'promote'|'hold'|'rollback';
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const f=(x:number,d=0)=>Number.isFinite(x)?x:d;
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};

/** PER-inspired priority blends prediction mismatch, surprise, rarity and retention risk. */
export function scoreReplayPriority(e:LearningExperience,newestTick:number,frequency=1,transfer01=.5):ReplayPriority{
 const age=Math.max(0,f(newestTick)-f(e.tick)),recency=c(Math.exp(-age/256)),surprise=c(e.surprise);
 const error=c(Math.abs(e.success-e.predictedUtility)),novelty=1/Math.sqrt(Math.max(1,Math.floor(frequency)));
 const forgetting=c((1-recency)*(.45+.55*error));
 const priority=c(.24*surprise+.25*error+.13*recency+.13*novelty+.13*c(transfer01)+.12*forgetting);
 const reasons:string[]=[];if(surprise>=.55)reasons.push('high-surprise');if(error>=.3)reasons.push('prediction-mismatch');
 if(novelty>=.65)reasons.push('rare-context');if(forgetting>=.45)reasons.push('retention-risk');
 if(transfer01>=.65)reasons.push('transfer-potential');if(!reasons.length)reasons.push('balanced');
 return{id:e.id,priority01:priority,recency01:recency,surprise01:surprise,predictionError01:error,novelty01:novelty,forgettingRisk01:forgetting,reasons};
}
/** Replay budget reacts to recent error, evidence debt, memory pressure and available energy. */
export function adaptiveReplayOptions(base:ReplaySelectionOptions,h:LearningHealth,count:number):ReplaySelectionOptions{
 const cap=Math.max(1,Math.min(64,Math.floor(f(base.maxBatchSize??64,64))));
 const pressure=c(.35*h.recentPredictionError01+.25*h.replayTdError01+.2*h.evidenceDebt01+.2*h.memoryPressure01);
 const energy=h.energy01<.2?.5:h.energy01<.4?.75:1;
 const size=Math.max(1,Math.min(cap,Math.max(0,count),Math.round(cap*energy*(.65+.35*pressure))));
 const ratio=c(.35+.25*h.recentPredictionError01+.15*h.evidenceDebt01-.15*h.memoryPressure01);
  // The configured recent quota is a guarantee, not merely a starting hint.
  // Adaptive budgeting may reduce the batch size, but it must preserve as many
  // of the caller-requested newest samples as that reduced capacity can hold.
  const requestedRecent=base.recentQuota===undefined?Math.floor(cap/2):Math.floor(f(base.recentQuota,Math.floor(cap/2)));
  const adaptiveRecent=Math.round(size*ratio);
  const recentQuota=Math.max(0,Math.min(size,Math.max(requestedRecent,adaptiveRecent)));
  return{maxBatchSize:size,recentQuota,ageHalfLifeTicks:pressure>.7?512:Number.POSITIVE_INFINITY};
}
/** Clipped importance weights and update rates stop noisy/rare events dominating. */
export function importanceWeight01(probability01:number,beta01=.4):number{return c(Math.pow(Math.max(.0001,c(probability01)),-c(beta01))/10)}
export function adaptiveReplayLearningRate(x:{baseRate?:number;tdError:number;surprise01:number;confidence01:number;replayCount?:number}):number{
 const base=Math.max(.005,Math.min(.12,f(x.baseRate??.035,.035)));
 const boost=Math.min(1.6,.65+Math.abs(f(x.tdError))*1.2)*(.85+.35*c(x.surprise01))*(1-.35*c(x.confidence01));
 return Math.max(.003,Math.min(.12,base*boost/(1+Math.max(0,f(x.replayCount??0))*.08)));
}
export function bellmanTarget(reward:number,nextValues:readonly number[],gamma=.76):number{
 return c(c(reward)+Math.max(0,Math.min(.95,f(gamma,.76)))*(nextValues.length?Math.max(0,...nextValues.map(c)):0));
}
export function wilsonLowerBound(successes:number,total:number,z=1.96):number{
 if(!Number.isInteger(total)||total<=0||!Number.isInteger(successes)||successes<0||successes>total)return 0;
 const p=successes/total,z2=z*z,den=1+z2/total;
 return c((p+z2/(2*total)-z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/den);
}
/** Evidence-gated skill lifecycle: validation + independent evidence + regression rollback. */
export function decideSkillLifecycle(e:SkillEvidence):{decision:SkillDecision;lowerBound01:number;reasons:string[]}{
 const lb=wilsonLowerBound(Math.round(c(e.validationPass01)*Math.max(0,e.validationN)),Math.max(0,e.validationN));
 const reasons:string[]=[];
 if(e.trainN<6)reasons.push('insufficient-train');if(e.validationN<6)reasons.push('insufficient-validation');
 if(e.independentN<2)reasons.push('independent-evidence-required');if(e.holdoutN!==undefined&&e.holdoutN<3)reasons.push('holdout-insufficient');
 if(e.recentN!==undefined&&e.recentN>=4&&e.recentPass01!==undefined&&e.priorPass01!==undefined&&e.recentPass01+.18<e.priorPass01)
  return{decision:'rollback',lowerBound01:lb,reasons:['recent-regression']};
 if(reasons.length)return{decision:'candidate',lowerBound01:lb,reasons};
 if(e.trainPass01>=.68&&e.validationPass01>=.7&&lb>=.42)return{decision:'promote',lowerBound01:lb,reasons:['validation-cleared']};
 if(e.validationPass01<.45)return{decision:'rollback',lowerBound01:lb,reasons:['validation-regression']};
 return{decision:'hold',lowerBound01:lb,reasons:['more-evidence-needed']};
}
/** Curriculum rewards reachable uncertainty, transfer and repair value; blocked tasks are not selected. */
export function scoreCurriculumTask(t:CurriculumTask):number{
 if(t.blocked)return 0;const readiness=c(t.readiness01);
 return c(.22*c(t.uncertainty01)+.22*(1-Math.abs(readiness-.68))+.2*c(t.transfer01)+.14*c(t.novelty01)+.16*c(t.repairValue01)+.06*(1-c(t.verificationCost01)));
}
export function rankCurriculum<T extends CurriculumTask>(tasks:readonly T[]):T[]{return[...tasks].sort((a,b)=>scoreCurriculumTask(b)-scoreCurriculumTask(a)||a.id.localeCompare(b.id))}
export function stableEvaluationSplit(fingerprint:string):'train'|'validation'|'holdout'{const n=hash(String(fingerprint).normalize('NFKC').trim().toLowerCase())%100;return n<70?'train':n<85?'validation':'holdout'}
export function evidenceIdentity(x:{taskId:string;version:string;method:string;seed:number;attempt:number;ref:string}):string{return[x.taskId,x.version,x.method,x.seed,x.attempt,x.ref].map(v=>encodeURIComponent(String(v))).join('|')}
export function transferConfidence(x:{shared:number;total:number;sourceValidation01:number;independentN:number;distance01:number}):number{
 return c((x.total>0?c(x.shared/x.total):0)*.35+c(x.sourceValidation01)*.35+c(x.independentN/8)*.2+(1-c(x.distance01))*.1);
}
export function forgettingRisk(x:{lastValidatedAt:number;now:number;halfLifeMs?:number;interference01?:number;gapMs?:number}):number{
 const half=Math.max(60000,f(x.halfLifeMs??2592000000)),age=Math.max(0,f(x.now)-f(x.lastValidatedAt));
 return c((1-Math.pow(.5,age/half))*.65+c(x.interference01??0)*.25+c((x.gapMs??age)/(half*2))*.1);
}
export function repairOpportunity(x:{recurrence:number;severity01:number;uncertainty01:number;expectedGain01:number;cost01:number}):number{
 return c((.25*c(Math.log2(Math.max(1,f(x.recurrence)))/5)+.25*c(x.severity01)+.15*c(x.uncertainty01)+.35*c(x.expectedGain01))*(1-.45*c(x.cost01)));
}
export function calibratedConfidence(n:number,mean01:number,error01:number):number{return c(.5*c(mean01)+.3*c(Math.max(0,n)/32)+.2*(1-c(error01)))}
export function retentionDelta(previous01:number,current01:number):number{return c(.5+(c(current01)-c(previous01))/2)}
export function replayReasonCounts(rows:readonly ReplayPriority[]):Record<string,number>{const out:Record<string,number>={};for(const row of rows)for(const reason of row.reasons)out[reason]=(out[reason]??0)+1;return out}
