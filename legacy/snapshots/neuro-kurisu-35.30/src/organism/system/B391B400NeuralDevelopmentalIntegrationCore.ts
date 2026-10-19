import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;
const dot=(a:number[],b:number[])=>{let s=0,n=Math.min(a.length,b.length);for(let i=0;i<n;i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cosine=(a:number[],b:number[])=>clamp01((dot(a,b)/(norm(a)*norm(b))+1)/2);
const distance=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??0)-(b[i]??0))));
const hashVector=(v:number[])=>{let h=2166136261;for(const x of v){h^=Math.round(clamp01(x)*1000);h=Math.imul(h,16777619);}return h>>>0;};

export interface B391Experience { tick:number; action:ActionKind; context:number[]; reward01:number; surprise01:number; verified01:number; salience01:number; stateVector:number[]; outcomeVector:number[]; selfVector:number[]; goalVector:number[]; identityImpact01:number; predictionAccuracy01:number; causalStrength01:number; }
export interface B391Goal { id:string; vector:number[]; priority01:number; ownership01:number; commitment01:number; expectedValue01:number; uncertainty01:number; origin:'intrinsic'|'learned'|'self'|'recovery'; status:'candidate'|'active'|'paused'|'completed'; age:number; evidence01:number; }
export interface B391Neuron { w:number[]; bias:number; activation01:number; plasticity01:number; lastSpike:number; }
export interface B391State {
  version:1;
  enabled:boolean;
  tick:number;
  lesion:{memory:boolean;self:boolean;goal:boolean;prediction:boolean;motivation:boolean;neural:boolean;executive:boolean};
  self:{now:number[];stable:number[];future:number[];agency01:number;coherence01:number;identityTension01:number;growth01:number;authorship01:number;futureAlignment01:number;revisionCount:number;predictionError01:number};
  values:{truth01:number;evidence01:number;autonomy01:number;responsibility01:number;curiosity01:number;preservation01:number;connection01:number;novelty01:number;plasticity01:number;confidence01:number};
  goals:B391Goal[];
  motivation:{curiosity01:number;exploration01:number;reflection01:number;maintenance01:number;knowledge01:number;autonomy01:number;drive01:number;arousal01:number;adaptations:number};
  prediction:{short:number[];medium:number[];long:number[];confidence:number[];errors:number[];surprise01:number;modelAgreement01:number;updates:number;counterfactuals:number};
  neural:{neurons:B391Neuron[];globalGain01:number;neuromod01:number;plasticity01:number;activeAssemblies:number;cycles:number;lesionImpact01:number};
  executive:{actionMass:number[];actionConfidence:number[];selected:ActionKind|'none';overridePressure01:number;metacontrol01:number;decisions:number};
  memory:{episodes:B391Experience[];retrievals:number;successful:number;consolidated:number;causalLinks:number;semanticCompression01:number;autobiographicalContinuity01:number};
  development:{epoch:number;experienceCount:number;selfRevisions:number;goalRevisions:number;valueRevisions:number;predictionRevisions:number;neuralRevisions:number;conflictResolutions:number;unseenTests:number;knockouts:number;restarts:number;lastCausalDelta01:number;lastDevelopmentalGain01:number;lastHoldout01:number;lastIntegrity01:number};
  last:{context:number[];actionBias:number[];retrieval:number[];prediction:number[];counterfactual:number[];selfBefore:number[];selfAfter:number[];goalId:string|null};
}

export interface B391Input { tick:number; context01:number[]; baseProbabilities:Record<ActionKind,number>; baseUtilities:Record<ActionKind,number>; selfVector?:number[]; goal?:{id:string;vector:number[];ownership01?:number;commitment01?:number}|null; energy01:number; uncertainty01:number; novelty01:number; cognitiveLoad01:number; autonomy01:number; predictionError01:number; neuralAssembly?:number[]; reward01?:number; }
export interface B391Output { actionBias:Record<ActionKind,number>; retrievalStrength01:number; predictiveUtility:Record<ActionKind,number>; self:{agency01:number;coherence01:number;identityTension01:number;futureAlignment01:number}; motivation:{drive01:number;curiosity01:number;exploration01:number;reflection01:number}; goal:{alignment01:number;ownership01:number;commitment01:number;generated:number}; neural:{readout01:number;plasticity01:number;assemblyNovelty01:number}; metacontrol01:number; integratedConfidence01:number; }

const axisFor:(a:ActionKind)=>number[]=(a)=>({respond:[3,6],explore:[4,7],verify:[0,1,3],rest:[5],reflect:[0,2,3],wait:[0,1],defer:[0,1,2]} as Record<ActionKind,number[]>)[a]??[];

export const defaultB391B400State=():B391State=>({
  version:1,enabled:true,tick:0,
  lesion:{memory:false,self:false,goal:false,prediction:false,motivation:false,neural:false,executive:false},
  self:{now:Array(16).fill(.5),stable:Array(16).fill(.5),future:Array(16).fill(.5),agency01:.54,coherence01:.58,identityTension01:.12,growth01:.5,authorship01:.52,futureAlignment01:.5,revisionCount:0,predictionError01:.2},
  values:{truth01:.58,evidence01:.62,autonomy01:.58,responsibility01:.56,curiosity01:.60,preservation01:.54,connection01:.50,novelty01:.48,plasticity01:.55,confidence01:.18},
  goals:[],
  motivation:{curiosity01:.58,exploration01:.52,reflection01:.46,maintenance01:.48,knowledge01:.56,autonomy01:.60,drive01:.50,arousal01:.42,adaptations:0},
  prediction:{short:Array(7).fill(.5),medium:Array(7).fill(.5),long:Array(7).fill(.5),confidence:Array(7).fill(.12),errors:Array(7).fill(.20),surprise01:.2,modelAgreement01:.5,updates:0,counterfactuals:0},
  neural:{neurons:Array.from({length:24},(_,n)=>({w:Array.from({length:8},(_,i)=>(((n*7+i*11)%19)-9)/120),bias:((n*13)%17-8)/150,activation01:.5,plasticity01:.30,lastSpike:0})),globalGain01:.52,neuromod01:.48,plasticity01:.38,activeAssemblies:0,cycles:0,lesionImpact01:0},
  executive:{actionMass:Array(7).fill(1/7),actionConfidence:Array(7).fill(.2),selected:'none',overridePressure01:.1,metacontrol01:.5,decisions:0},
  memory:{episodes:[],retrievals:0,successful:0,consolidated:0,causalLinks:0,semanticCompression01:.25,autobiographicalContinuity01:.55},
  development:{epoch:0,experienceCount:0,selfRevisions:0,goalRevisions:0,valueRevisions:0,predictionRevisions:0,neuralRevisions:0,conflictResolutions:0,unseenTests:0,knockouts:0,restarts:0,lastCausalDelta01:0,lastDevelopmentalGain01:0,lastHoldout01:0,lastIntegrity01:1},
  last:{context:Array(8).fill(.5),actionBias:Array(7).fill(0),retrieval:Array(8).fill(0),prediction:Array(7).fill(.5),counterfactual:Array(7).fill(.5),selfBefore:Array(16).fill(.5),selfAfter:Array(16).fill(.5),goalId:null},
});

export class B391B400NeuralDevelopmentalIntegrationCore {
  private state:B391State=defaultB391B400State();
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone(this.state);}
  restore(source?:Partial<B391State>){const d=defaultB391B400State();const s:any=source??{};this.state={...d,...structuredClone(s),lesion:{...d.lesion,...(s.lesion??{})},self:{...d.self,...(s.self??{})},values:{...d.values,...(s.values??{})},motivation:{...d.motivation,...(s.motivation??{})},prediction:{...d.prediction,...(s.prediction??{})},neural:{...d.neural,...(s.neural??{})},executive:{...d.executive,...(s.executive??{})},memory:{...d.memory,...(s.memory??{}),episodes:Array.isArray(s.memory?.episodes)?structuredClone(s.memory.episodes).slice(-256):[]},development:{...d.development,...(s.development??{})},last:{...d.last,...(s.last??{})},goals:Array.isArray(s.goals)?structuredClone(s.goals).slice(-32):[]};}
  setEnabled(v:boolean){this.state.enabled=Boolean(v);}
  setLesions(v:Partial<B391State['lesion']>){this.state.lesion={...this.state.lesion,...v};}

  private valueVector(){const v=this.state.values;return [v.truth01,v.evidence01,v.autonomy01,v.responsibility01,v.curiosity01,v.preservation01,v.connection01,v.novelty01];}
  private generateGoals(input:B391Input):B391Goal[]{
    if(this.state.lesion.goal)return [];
    const v=this.valueVector();
    const drives=[
      ['goal:verify',[v[0],v[1],.72,.35,.58,.40,.32,.28],'learned'],
      ['goal:explore',[.40,.48,.62,.35,v[4],.28,.35,Math.max(v[7],input.novelty01)],'intrinsic'],
      ['goal:stabilize',[.46,.52,.54,.66,.30,v[5],.30,.25],'recovery'],
      ['goal:understand',[.62,.72,.58,.52,v[4],.35,.38,.45],'self'],
    ] as Array<[string,number[],B391Goal['origin']]>;
    const pressure=clamp01(.45*input.uncertainty01+.25*input.predictionError01+.15*input.novelty01+.15*(1-input.energy01));
    return drives.map(([id,vec,origin],i)=>({id:`${id}:${this.state.development.epoch}`,vector:vec.map((x,j)=>clamp01(x*.72+(.28*(input.context01[j%8]??.5)))),priority01:clamp01(.34+pressure*.36+(i===1?input.novelty01*.18:0)),ownership01:origin==='self'?clamp01(.62+input.autonomy01*.2):clamp01(.42+input.autonomy01*.12),commitment01:clamp01(.45+input.autonomy01*.18-pressure*.10),expectedValue01:clamp01(.48+v[i%8]*.28),uncertainty01:clamp01(.35+.55*input.uncertainty01),origin,status:'candidate',age:0,evidence01:.18}));
  }

  private retrieve(context:number[],action:ActionKind):{items:B391Experience[];strength01:number;novelty01:number}{
    if(this.state.lesion.memory)return {items:[],strength01:0,novelty01:1};
    const rows=this.state.memory.episodes.map(e=>({e,score:clamp01((1-distance(context,e.context))*.62+cosine(context,e.outcomeVector)*.18+(.5+.5*e.salience01)*.12+(e.action===action?.08:0))})).sort((a,b)=>b.score-a.score).slice(0,10);
    const strong=rows.filter(x=>x.score>.54).map(x=>x.e);
    this.state.memory.retrievals+=rows.length; if(strong.length)this.state.memory.successful+=1;
    const strength=clamp01(mean(rows.slice(0,5).map(x=>x.score))*(strong.length?1:0));
    return {items:strong,strength01:strength,novelty01:clamp01(1-strength)};
  }

  private neuralRead(context:number[],learning:boolean):{readout:number[];activity:number;novelty:number}{
    if(this.state.lesion.neural)return {readout:Array(7).fill(.5),activity:.5,novelty:1};
    const s=this.state;const out=Array(7).fill(.5);let activity=0,spikes=0;
    for(const n of s.neural.neurons){
      const z=clamp11(dot(n.w,context)/Math.max(1,norm(n.w)*norm(context))*1.6+n.bias);n.activation01=clamp01(.5+z*.5);activity+=n.activation01;if(n.activation01>.68){spikes++;n.lastSpike=s.tick;}
      if(learning){const eta=.0025*s.neural.plasticity01;for(let i=0;i<Math.min(n.w.length,context.length);i++)n.w[i]=clamp11(n.w[i]+eta*(context[i]-.5)*(n.activation01-.5));n.bias=clamp11(n.bias+eta*(n.activation01-.5)*.2);}
    }
    const assembly=clamp01(activity/Math.max(1,s.neural.neurons.length));
    for(let a=0;a<7;a++){let sum=0;for(let i=a;i<s.neural.neurons.length;i+=7)sum+=s.neural.neurons[i]!.activation01;out[a]=clamp01(sum/Math.ceil(s.neural.neurons.length/7));}
    s.neural.activeAssemblies=spikes;s.neural.cycles+=1;s.neural.globalGain01=clamp01(s.neural.globalGain01*.98+assembly*.02);s.neural.plasticity01=clamp01(s.neural.plasticity01*.996 + .004*(0.25 + assembly*.5));
    return {readout:out,activity:assembly,novelty:clamp01(1-assembly)};
  }

  beforeDecision(input:B391Input):B391Output{
    const s=this.state;s.tick=Math.floor(input.tick);if(!s.enabled)return this.disabledOutput(input);
    const ctx=Array.from({length:8},(_,i)=>clamp01(input.context01?.[i]??.5));
    const selfBefore=s.self.now.slice();
    const retrieval=this.retrieve(ctx,'explore');
    const generated=this.generateGoals(input);
    for(const g of generated){const existing=s.goals.find(x=>x.id===g.id);if(!existing)s.goals.push(g);}
    const goal=(input.goal?{...input.goal,vector:input.goal.vector.slice(0,16)}:null) ?? s.goals.filter(g=>g.status==='candidate'||g.status==='active').sort((a,b)=>b.priority01-a.priority01)[0] ?? null;
    const goalVector=goal?.vector??ctx;
    const targetSelf=Array.from({length:16},(_,i)=>clamp01(.42*selfBefore[i%16]+.27*ctx[i%8]+.16*(goalVector[i%(goalVector.length||1)]??.5)+.10*input.autonomy01+.05*(1-input.uncertainty01)));
    const identityTension=clamp01(distance(targetSelf,s.self.stable));
    if(!s.lesion.self){
      const rate=.014+.018*retrieval.strength01+.008*input.autonomy01;
      s.self.now=s.self.now.map((v,i)=>clamp01(v+(targetSelf[i]-v)*rate));
      s.self.future=s.self.now.map((v,i)=>clamp01(v*.76+.24*(goalVector[i%(goalVector.length||1)]??.5)));
      s.self.agency01=clamp01(s.self.agency01*.96+.04*input.autonomy01);
      s.self.coherence01=clamp01(s.self.coherence01*.955+.045*(1-identityTension));
      s.self.identityTension01=clamp01(s.self.identityTension01*.92+identityTension*.08);
      s.self.growth01=clamp01(s.self.growth01*.97+.03*(retrieval.strength01*.45+input.novelty01*.30+input.predictionError01*.25));
      s.self.authorship01=clamp01(s.self.authorship01*.965+.035*(goal?.ownership01??input.autonomy01));
      s.self.futureAlignment01=cosine(s.self.now,s.self.future);
      s.self.predictionError01=clamp01(s.self.predictionError01*.94+identityTension*.06);
      if(identityTension>.045)s.self.revisionCount+=1,s.development.selfRevisions+=1;
    }
    const neural=this.neuralRead(ctx,true);
    const motivation=s.lesion.motivation?{drive01:.5,curiosity01:.5,exploration01:.5,reflection01:.5}:{
      drive01:clamp01(.26*input.autonomy01+.24*input.novelty01+.22*input.uncertainty01+.16*(1-input.energy01)+.12*input.predictionError01),
      curiosity01:clamp01(.56+.28*input.uncertainty01+.18*input.novelty01),
      exploration01:clamp01(.42+.32*input.novelty01+.18*input.uncertainty01+.10*neural.novelty),
      reflection01:clamp01(.36+.34*input.predictionError01+.18*input.cognitiveLoad01+.12*identityTension),
    };
    if(!s.lesion.motivation){s.motivation.drive01=motivation.drive01;s.motivation.curiosity01=motivation.curiosity01;s.motivation.exploration01=motivation.exploration01;s.motivation.reflection01=motivation.reflection01;s.motivation.maintenance01=clamp01(.45+(1-input.energy01)*.42+input.cognitiveLoad01*.13);s.motivation.knowledge01=clamp01(.50+input.uncertainty01*.32+input.predictionError01*.18);s.motivation.autonomy01=clamp01(.55+input.autonomy01*.45);s.motivation.arousal01=clamp01(.34+motivation.drive01*.42);s.motivation.adaptations+=1;}
    const value=this.valueVector();
    const predict=ACTIONS.map((action,ai)=>{const base=clamp01(input.baseUtilities[action]??input.baseProbabilities[action]??.5);const remembered=retrieval.items.filter(e=>e.action===action);const memReward=remembered.length?mean(remembered.map(e=>e.reward01)):.5;const prior=s.prediction.short[ai]??.5;const neuralU=neural.readout[ai]??.5;return clamp01(.24*base+.22*memReward+.22*prior+.18*neuralU+.14*(.5+(.5-neuralU)*.16));});
    const medium=predict.map((v,i)=>clamp01(.76*v+.24*(s.prediction.medium[i]??.5)));const long=predict.map((v,i)=>clamp01(.58*v+.42*(s.prediction.long[i]??.5)));
    if(!s.lesion.prediction){for(let i=0;i<7;i++){s.prediction.short[i]=predict[i]!;s.prediction.medium[i]=medium[i]!;s.prediction.long[i]=long[i]!;s.prediction.confidence[i]=clamp01(s.prediction.confidence[i]!* .96+(1-input.predictionError01)*.04);}}
    const actionBias=ACTIONS.map((action,i)=>{
      const axes=axisFor(action);const val=axes.length?mean(axes.map(ix=>value[ix]??.5)):.5;const goalAlign=clamp01(1-distance(goalVector.slice(0,8),ctx));const retrievalAction=clamp01(mean(retrieval.items.filter(e=>e.action===action).map(e=>e.reward01))||.5);
      const exploratory=action==='explore'?motivation.exploration01*.30:action==='reflect'?motivation.reflection01*.24:action==='verify'?value[0]*.16+value[1]*.16:action==='rest'?s.motivation.maintenance01*.22:0;
      const contradiction=action==='defer'||action==='wait'?input.uncertainty01*.14:0;
      const raw=.30*(predict[i]!-0.5)+.16*(long[i]!-0.5)+.14*(val-.5)+.12*(goalAlign-.5)+.10*(retrievalAction-.5)+exploratory+contradiction;
      return clamp11(raw);
    });
    const selfField={agency01:s.self.agency01,coherence01:s.self.coherence01,identityTension01:identityTension,futureAlignment01:s.self.futureAlignment01};
    const goalField={alignment01:clamp01(1-distance(goalVector.slice(0,8),ctx)),ownership01:goal?.ownership01??s.self.authorship01,commitment01:goal?.commitment01??.5,generated:generated.length};
    const metacontrol=s.lesion.executive?.5:clamp01(.28+s.self.coherence01*.25+(1-input.predictionError01)*.20+s.self.futureAlignment01*.15+input.autonomy01*.12);
    const actionMass=this.softmax(actionBias.map((b,i)=>clamp01(.5+b+.08*(predict[i]!-0.5))),.20);s.executive.actionMass=actionMass;s.executive.actionConfidence=ACTIONS.map((_,i)=>clamp01(.18+.58*actionMass[i]!+.24*s.prediction.confidence[i]!));s.executive.metacontrol01=metacontrol;s.executive.overridePressure01=clamp01(input.uncertainty01*.35+input.predictionError01*.3+(1-s.self.coherence01)*.35);s.executive.decisions+=1;
    s.last={context:ctx.slice(),actionBias:actionBias.slice(),retrieval:retrieval.items.slice(0,8).map(e=>e.tick),prediction:predict.slice(),counterfactual:long.slice(),selfBefore:selfBefore.slice(),selfAfter:s.self.now.slice(),goalId:goal?.id??null};
    s.development.experienceCount+=1;
    const readout01=mean(neural.readout),integratedConfidence01=clamp01(.22*selfField.coherence01+.18*selfField.futureAlignment01+.18*retrieval.strength01+.18*mean(s.prediction.confidence)+.12*goalField.commitment01+.12*metacontrol);
    return {actionBias:Object.fromEntries(ACTIONS.map((a,i)=>[a,actionBias[i]!])) as Record<ActionKind,number>,retrievalStrength01:retrieval.strength01,predictiveUtility:Object.fromEntries(ACTIONS.map((a,i)=>[a,predict[i]!])) as Record<ActionKind,number>,self:selfField,motivation,goal:goalField,neural:{readout01,plasticity01:s.neural.plasticity01,assemblyNovelty01:neural.novelty},metacontrol01:metacontrol,integratedConfidence01};
  }

  afterOutcome(input:{tick:number;action:ActionKind;context01:number[];reward01:number;predictionError01:number;verified01:number;independent01:number;salience01:number;goalId?:string|null;outcomeVector01?:number[]}):{accepted:boolean;causalStrength01:number;developmentalGain01:number;predictionGain01:number;neuralGain01:number;goalGain01:number;selfGain01:number;integrity01:number}{
    const s=this.state;const accepted=clamp01(input.verified01)>=.8&&clamp01(input.independent01)>=.65;
    if(!accepted||!s.enabled)return {accepted:false,causalStrength01:0,developmentalGain01:0,predictionGain01:0,neuralGain01:0,goalGain01:0,selfGain01:0,integrity01:1};
    const ctx=Array.from({length:8},(_,i)=>clamp01(input.context01?.[i]??.5));const reward=clamp01(input.reward01);const pe=clamp01(input.predictionError01);const sal=clamp01(input.salience01);const actionIndex=ACTIONS.indexOf(input.action);const beforeSelf=s.self.now.slice();const prior=s.prediction.short[actionIndex]??.5;
    const target=clamp01(.50+(reward-.5)*.64-pe*.12);const err=Math.abs(target-prior);const eta=.045+.035*sal+.025*(1-pe);
    if(!s.lesion.prediction){s.prediction.short[actionIndex]=clamp01(prior+(target-prior)*eta);s.prediction.medium[actionIndex]=clamp01((s.prediction.medium[actionIndex]??.5)*.93+s.prediction.short[actionIndex]!* .07);s.prediction.long[actionIndex]=clamp01((s.prediction.long[actionIndex]??.5)*.97+s.prediction.medium[actionIndex]!* .03);s.prediction.errors[actionIndex]=clamp01((s.prediction.errors[actionIndex]??.2)*.88+err*.12);s.prediction.confidence[actionIndex]=clamp01((s.prediction.confidence[actionIndex]??.1)*.93+(1-pe)*.07);s.prediction.updates+=1;s.development.predictionRevisions+=1;s.prediction.surprise01=clamp01(s.prediction.surprise01*.88+pe*.12);s.prediction.modelAgreement01=clamp01(s.prediction.modelAgreement01*.94+(1-pe)*.06);}
    const centered=(reward-.5)*2;let valueGain=0;const axes=axisFor(input.action);for(let i=0;i<8;i++){const relevance=axes.includes(i)?1:.16;const targetValue=clamp01(.5+centered*(.24*relevance+.10*(1-relevance))+(1-pe-.5)*.06);const old=this.valueVector()[i]??.5;const delta=(targetValue-old)*(.012+.018*sal+.009*(1-pe));const key=['truth01','evidence01','autonomy01','responsibility01','curiosity01','preservation01','connection01','novelty01'][i] as keyof B391State['values'];s.values[key]=clamp01((s.values[key] as number)+delta);valueGain+=Math.abs(delta);if(Math.abs(delta)>.00001)s.development.valueRevisions+=1;}
    if(!s.lesion.self){s.self.stable=s.self.stable.map((v,i)=>clamp01(v*.985+.015*s.values[['truth01','evidence01','autonomy01','responsibility01','curiosity01','preservation01','connection01','novelty01'][i%8] as keyof B391State['values']] as number));s.self.now=s.self.now.map((v,i)=>clamp01(v*.962+.038*(ctx[i%8]*.58+(s.values[['truth01','evidence01','autonomy01','responsibility01','curiosity01','preservation01','connection01','novelty01'][i%8] as keyof B391State['values']] as number)*.42)));s.self.future=s.self.now.map((v,i)=>clamp01(v*.78+.22*s.self.future[i]!));s.self.growth01=clamp01(s.self.growth01*.95+.05*(sal*.45+(1-pe)*.35+Math.abs(centered)*.20));s.self.futureAlignment01=cosine(s.self.now,s.self.future);}
    let goalGain=0;if(input.goalId&&!s.lesion.goal){const g=s.goals.find(x=>x.id===input.goalId)||s.goals.find(x=>x.status==='candidate');if(g){const before=g.expectedValue01;g.status='active';g.age+=1;g.evidence01=clamp01(g.evidence01*.92+(1-pe)*.08);g.expectedValue01=clamp01(g.expectedValue01*.94+reward*.06);g.commitment01=clamp01(g.commitment01+(centered>0?.014:-.008)*sal);g.priority01=clamp01(g.priority01+(reward-.5)*.05);goalGain=Math.abs(g.expectedValue01-before);s.development.goalRevisions+=goalGain>.003?1:0;if(g.commitment01<.20&&g.expectedValue01<.25)g.status='paused';if(g.commitment01>.90&&g.evidence01>.75)g.status='active';}}
    const out=input.outcomeVector01?.slice(0,8)??[reward,1-pe,sal,...ctx.slice(0,5)];const ep:B391Experience={tick:input.tick,action:input.action,context:ctx,reward01:reward,surprise01:pe,verified01:1,salience01:sal,stateVector:s.self.now.slice(0,8),outcomeVector:out,selfVector:s.self.now.slice(0,8),goalVector:(s.goals.find(g=>g.id===input.goalId)?.vector??ctx).slice(0,8),identityImpact01:distance(beforeSelf,s.self.now),predictionAccuracy01:1-pe,causalStrength01:clamp01(.24+.26*(1-pe)+.20*sal+.18*retrievalProxy(s.last.retrieval)+.12*(Math.abs(centered)))};
    if(!s.lesion.memory){s.memory.episodes=[...s.memory.episodes,ep].slice(-256);s.memory.consolidated+=1;s.memory.causalLinks+=ep.causalStrength01>.55?1:0;s.memory.semanticCompression01=clamp01(s.memory.semanticCompression01*.985+.015*(s.memory.episodes.length/256));s.memory.autobiographicalContinuity01=clamp01(s.memory.autobiographicalContinuity01*.97+.03*(1-distance(s.self.now,s.self.stable)));}
    const neuralGain=s.lesion.neural?0:clamp01(.002+sal*.008+(1-pe)*.006);if(!s.lesion.neural){s.neural.plasticity01=clamp01(s.neural.plasticity01*.992+neuralGain*.008);this.neuralReweight(actionIndex,ctx,reward,pe);s.development.neuralRevisions+=1;}
    const selfGain=distance(beforeSelf,s.self.now);const predictionGain=Math.abs(target-prior);const developmentalGain=clamp01(valueGain+.75*selfGain+.60*goalGain+.65*predictionGain+.40*neuralGain);const causalStrength=ep.causalStrength01;s.development.lastCausalDelta01=causalStrength;s.development.lastDevelopmentalGain01=developmentalGain;s.development.lastIntegrity01=accepted?1:0;s.development.lastHoldout01=clamp01((1-pe)*.65+(retrievalProxy(s.last.retrieval)>0?.35:0));return {accepted:true,causalStrength01:causalStrength,developmentalGain01:developmentalGain,predictionGain01:predictionGain,neuralGain01:neuralGain,goalGain01:goalGain,selfGain01:selfGain,integrity01:1};
  }

  private neuralReweight(actionIndex:number,ctx:number[],reward:number,pe:number){const target=clamp01(.5+(reward-.5)*.5);for(let i=actionIndex;i<this.state.neural.neurons.length;i+=ACTIONS.length){const n=this.state.neural.neurons[i]!;const eta=.0015*(1-pe)*this.state.neural.plasticity01;for(let j=0;j<8;j++)n.w[j]=clamp11(n.w[j]+eta*(ctx[j]-.5)*(target-n.activation01));}}
  private softmax(xs:number[],temperature=.2){const m=Math.max(...xs);const e=xs.map(x=>Math.exp((x-m)/temperature));const t=e.reduce((a,b)=>a+b,0)||1;return e.map(x=>x/t);}
  evaluateKnockout(input:B391Input){
    const snapshot=this.snapshot();
    const on=this.beforeDecision(input);
    this.restore(snapshot);
    this.setLesions({memory:true,self:true,goal:true,prediction:true,motivation:true,neural:true,executive:true});
    const off=this.beforeDecision(input);
    const actionDelta=mean(ACTIONS.map(a=>Math.abs((on.actionBias[a]??0)-(off.actionBias[a]??0))));
    const retrievalDelta=Math.abs(on.retrievalStrength01-off.retrievalStrength01);
    const confidenceDelta=Math.abs(on.integratedConfidence01-off.integratedConfidence01);
    this.restore(snapshot);
    this.state.development.knockouts+=1;
    this.state.development.lastCausalDelta01=clamp01(actionDelta+retrievalDelta+confidenceDelta);
    return {causalDelta01:this.state.development.lastCausalDelta01,actionDelta01:actionDelta,retrievalDelta01:retrievalDelta,confidenceDelta01:confidenceDelta,on,off};
  }
  evaluateLesion(input:B391Input,lesion:Partial<B391State['lesion']>){const snapshot=this.snapshot();const on=this.beforeDecision(input);this.restore(snapshot);this.setLesions(lesion);const off=this.beforeDecision(input);const delta=mean(ACTIONS.map(a=>Math.abs((on.actionBias[a]??0)-(off.actionBias[a]??0))));this.restore(snapshot);return {lesion,delta01:delta,on,off};}
  markUnseenEvaluation(score01:number){this.state.development.unseenTests+=1;this.state.development.lastHoldout01=clamp01(score01);}
  markRestart(){this.state.development.restarts+=1;}
  private disabledOutput(input:B391Input):B391Output{return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,retrievalStrength01:0,predictiveUtility:Object.fromEntries(ACTIONS.map(a=>[a,input.baseUtilities[a]??.5])) as Record<ActionKind,number>,self:{agency01:.5,coherence01:.5,identityTension01:.5,futureAlignment01:.5},motivation:{drive01:.5,curiosity01:.5,exploration01:.5,reflection01:.5},goal:{alignment01:.5,ownership01:.5,commitment01:.5,generated:0},neural:{readout01:.5,plasticity01:0,assemblyNovelty01:.5},metacontrol01:.5,integratedConfidence01:.5};}
}

const retrievalProxy=(ticks:number[])=>Array.isArray(ticks)?clamp01(ticks.length/8):0;
