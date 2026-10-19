import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const cosine=(a:number[],b:number[])=>{let aa=0,bb=0,ab=0;const n=Math.min(a.length,b.length);for(let i=0;i<n;i++){const x=a[i]??0,y=b[i]??0;aa+=x*x;bb+=y*y;ab+=x*y;}return aa>1e-9&&bb>1e-9?clamp01((ab/Math.sqrt(aa*bb)+1)/2):0.5;};
const similarity=(a:number[],b:number[])=>{const n=Math.min(a.length,b.length);if(!n)return 0;let d=0;for(let i=0;i<n;i++)d+=Math.abs((a[i]??0)-(b[i]??0));return clamp01(1-d/n);};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;

export interface B385Episode { tick:number; action:ActionKind; goalId:string|null; context:number[]; reward01:number; predictionError01:number; salience01:number; verified01:number; selfBefore:number[]; selfAfter:number[]; valueBefore:number[]; valueAfter:number[]; outcomeSignature:number[]; significance01:number; retrieved01:number; causalCredit01:number; }
export interface B385Goal { id:string; vector:number[]; status:'active'|'paused'|'completed'|'abandoned'; ownership01:number; commitment01:number; value01:number; progress01:number; attempts:number; successes:number; failures:number; createdTick:number; lastTick:number; }
export interface B385State {
  version:1;
  enabled:boolean;
  tick:number;
  retrievalEnabled:boolean;
  selfModelEnabled:boolean;
  predictionEnabled:boolean;
  motivationEnabled:boolean;
  episodes:B385Episode[];
  self:{current:number[];stable:number[];future:number[];agency01:number;continuity01:number;growth01:number;predictionError01:number;revisionCount:number;consolidations:number;lastAction:ActionKind|'none';lastTick:number};
  values:Array<{id:string;value01:number;confidence01:number;support01:number;counterEvidence01:number;revisions:number;lastTick:number}>;
  goals:B385Goal[];
  motivation:{curiosity01:number;stability01:number;coherence01:number;novelty01:number;knowledge01:number;autonomy01:number;drive01:number;arousal01:number;lastTick:number;adaptations:number};
  prediction:{actionUtility01:number[];actionConfidence01:number[];errors:number[];updates:number;longHorizon01:number;modelAgreement01:number;lastTick:number};
  metrics:{cycles:number;verifiedEpisodes:number;rejectedEpisodes:number;retrievals:number;successfulRetrievals:number;causalCredits:number;goalRevisions:number;selfRevisions:number;valueRevisions:number;predictionUpdates:number;motivationUpdates:number;unseenEvaluations:number;knockoutEvaluations:number;restartChecks:number;integratedDecisions:number;lastCausalDelta01:number;lastRetrievalStrength01:number;lastDecisionAction:ActionKind|'none'};
  last:{context:number[];goalId:string|null;actionBias:number[];retrievedTicks:number[];prediction:number[];selfBefore:number[];selfAfterPrediction:number[]};
}

export const defaultB385B390State=():B385State=>({
  version:1,enabled:true,tick:0,retrievalEnabled:true,selfModelEnabled:true,predictionEnabled:true,motivationEnabled:true,episodes:[],
  self:{current:Array.from({length:12},()=>0.5),stable:Array.from({length:12},()=>0.5),future:Array.from({length:12},()=>0.5),agency01:.52,continuity01:.55,growth01:.5,predictionError01:.2,revisionCount:0,consolidations:0,lastAction:'none',lastTick:0},
  values:Array.from({length:8},(_,i)=>({id:['truth','evidence','autonomy','responsibility','curiosity','preservation','connection','novelty'][i]!,value01:.5,confidence01:.15,support01:0,counterEvidence01:0,revisions:0,lastTick:0})),
  goals:[],
  motivation:{curiosity01:.55,stability01:.5,coherence01:.58,novelty01:.48,knowledge01:.56,autonomy01:.58,drive01:.5,arousal01:.45,lastTick:0,adaptations:0},
  prediction:{actionUtility01:Array(7).fill(.5),actionConfidence01:Array(7).fill(.12),errors:Array(7).fill(.2),updates:0,longHorizon01:.35,modelAgreement01:.5,lastTick:0},
  metrics:{cycles:0,verifiedEpisodes:0,rejectedEpisodes:0,retrievals:0,successfulRetrievals:0,causalCredits:0,goalRevisions:0,selfRevisions:0,valueRevisions:0,predictionUpdates:0,motivationUpdates:0,unseenEvaluations:0,knockoutEvaluations:0,restartChecks:0,integratedDecisions:0,lastCausalDelta01:0,lastRetrievalStrength01:0,lastDecisionAction:'none'},
  last:{context:Array(8).fill(.5),goalId:null,actionBias:Array(7).fill(0),retrievedTicks:[],prediction:Array(7).fill(.5),selfBefore:Array(12).fill(.5),selfAfterPrediction:Array(12).fill(.5)},
});

export interface B385DecisionInput {
  tick:number; context01:number[]; b365ActionProbabilities:Record<ActionKind,number>; b365ForecastUtilities:Record<ActionKind,number>; b365NeuralConfidence01:number; b365PredictionError01:number;
  activeGoal?:{id:string;vector:number[];ownership01?:number;commitment01?:number}|null;
  reward01?:number; novelty01?:number; uncertainty01?:number; energy01?:number; cognitiveLoad01?:number; autonomy01?:number;
}

export interface B385DecisionOutput { actionBias:Record<ActionKind,number>; retrieval:{strength01:number;episodeTicks:number[];episodeCount:number;matchedActions:string[]}; prediction:Record<ActionKind,number>; selfField:{agency01:number;continuity01:number;growth01:number;identityTension01:number}; motivation:{drive01:number;curiosity01:number;stability01:number;exploration01:number;reflection01:number}; goal:{alignment01:number;commitment01:number;ownership01:number}; integratedConfidence01:number; }

export class B385B390AutonomousDevelopmentalOrganismCore {
  private state:B385State=defaultB385B390State();
  snapshot(){return structuredClone(this.state);}
  restore(source?:Partial<B385State>){const d=defaultB385B390State();const s=source??{};this.state={...d,...structuredClone(s),self:{...d.self,...(s as any).self},motivation:{...d.motivation,...(s as any).motivation},prediction:{...d.prediction,...(s as any).prediction},metrics:{...d.metrics,...(s as any).metrics},last:{...d.last,...(s as any).last},episodes:Array.isArray((s as any).episodes)?structuredClone((s as any).episodes).slice(-192):[],goals:Array.isArray((s as any).goals)?structuredClone((s as any).goals).slice(-24):[],values:Array.isArray((s as any).values)?structuredClone((s as any).values).slice(0,8):d.values};}
  diagnostics(){return structuredClone(this.state);}
  setEnabled(enabled:boolean){this.state.enabled=Boolean(enabled);}
  setKnockouts(input:{retrieval?:boolean;selfModel?:boolean;prediction?:boolean;motivation?:boolean}){if(input.retrieval!==undefined)this.state.retrievalEnabled=Boolean(input.retrieval);if(input.selfModel!==undefined)this.state.selfModelEnabled=Boolean(input.selfModel);if(input.prediction!==undefined)this.state.predictionEnabled=Boolean(input.prediction);if(input.motivation!==undefined)this.state.motivationEnabled=Boolean(input.motivation);}

  beforeDecision(input:B385DecisionInput):B385DecisionOutput{
    const s=this.state;this.state.tick=Math.floor(input.tick);s.metrics.cycles+=1;
    const context=Array.from({length:8},(_,i)=>clamp01(Number(input.context01?.[i]??.5)));
    const goal=input.activeGoal;
    let retrieved:Array<{e:B385Episode;sim:number;score:number}>=[];
    if(s.enabled&&s.retrievalEnabled){retrieved=s.episodes.map(e=>({e,sim:similarity(context,e.context),score:similarity(context,e.context)*(.25+.75*e.significance01)*(e.verified01>=.99?1:.2)})).filter(x=>x.sim>.58).sort((a,b)=>b.score-a.score).slice(0,8);}
    const retrievalStrength=clamp01(mean(retrieved.map(x=>x.score))*(retrieved.length?1:0));
    s.metrics.retrievals+=retrieved.length;s.metrics.successfulRetrievals+=retrieved.length>0?1:0;s.metrics.lastRetrievalStrength01=retrievalStrength;
    const retrievedTicks=retrieved.map(x=>x.e.tick);

    const selfBefore=s.self.current.slice();
    const selfTarget=selfBefore.map((v,i)=>clamp01(.58*v+.24*context[i%8]+.10*(goal?.vector?.[i%(goal.vector.length||1)]??.5)+.08*(input.autonomy01??.5)));
    const identityTension=clamp01(1-cosine(selfTarget,s.self.stable));
    if(s.enabled&&s.selfModelEnabled){
      const gain=.018+.025*retrievalStrength+.010*(1-(input.energy01??.7))+Math.min(.02,(input.b365PredictionError01??.2)*.025);
      s.self.current=s.self.current.map((v,i)=>clamp01(v+(selfTarget[i]-v)*gain));
      s.self.future=s.self.current.map((v,i)=>clamp01(v*.88+.12*(goal?.vector?.[i%(goal.vector.length||1)]??.5)));
      s.self.agency01=clamp01(s.self.agency01*.94+.06*(input.autonomy01??.5)+(retrievalStrength>.02?.006:0));
      s.self.continuity01=clamp01(s.self.continuity01*.95+.05*(1-identityTension));
      s.self.growth01=clamp01(s.self.growth01*.94+.06*(.35+retrievalStrength*.30+(input.novelty01??.5)*.20+(input.b365PredictionError01??.2)*.15));
      s.self.predictionError01=clamp01(s.self.predictionError01*.94+identityTension*.06);
      if(identityTension>.04){s.self.revisionCount+=1;s.metrics.selfRevisions+=1;}
    }

    const prediction:number[]=Array(7).fill(.5).map((_,a)=>{const action=ACTIONS[a]!;const base=clamp01(input.b365ForecastUtilities[action]??input.b365ActionProbabilities[action]??.5);const learned=s.prediction.actionUtility01[a]??.5;const confidence=s.prediction.actionConfidence01[a]??.1;let retrievedReward=.5;if(retrieved.length){const rows=retrieved.filter(x=>x.e.action===action);if(rows.length)retrievedReward=mean(rows.map(x=>x.e.reward01))*(.55+retrievalStrength*.45)+.5*(.45-retrievalStrength*.45);}const worldPattern=.5+.35*(base-.5);return clamp01(.34*base+.28*learned+.18*retrievedReward+.12*worldPattern+.08*confidence);});
    if(!s.enabled||!s.predictionEnabled) for(let i=0;i<7;i++) prediction[i]=clamp01(.68*(input.b365ForecastUtilities[ACTIONS[i]!]??.5)+.32*(s.prediction.actionUtility01[i]??.5));

    const values=s.values.map(v=>v.value01);
    const goalAlignment=goal?.vector?.length?clamp01(1-Math.min(1,goal.vector.reduce((sum,v,i)=>sum+Math.abs((v??0)-((values[i%8]-.5)*2)),0)/goal.vector.length/2)):0.5;
    const axis={respond:[3,6],explore:[4,7],verify:[0,1,3],rest:[5],reflect:[0,2,3],wait:[0,1],defer:[0,1,2]} as Record<ActionKind,number[]>;
    const retrievalBias=ACTIONS.map(action=>{if(!retrievalStrength)return 0;const rows=retrieved.filter(x=>x.e.action===action);if(!rows.length)return 0;return clamp11(mean(rows.map(x=>(x.e.reward01-.5)*x.score))*1.65);});
    const valueBias=ACTIONS.map(action=>{const ids=axis[action];const avg=mean(ids.map(i=>values[i]??.5));return clamp11((avg-.5)*1.35);});
    const goalBias=ACTIONS.map(action=>{const av=valueBias[ACTIONS.indexOf(action)]??0;return clamp11(av*(goal?.ownership01??.5)*(.45+(goal?.commitment01??.5)*.55));});

    const uncertainty=clamp01(input.uncertainty01??.5),novelty=clamp01(input.novelty01??.5),energy=clamp01(input.energy01??.7),load=clamp01(input.cognitiveLoad01??.2),autonomy=clamp01(input.autonomy01??.5);
    const motivationDrive=clamp01((1-energy)*.22+load*.18+uncertainty*.20+novelty*.16+(1-s.self.continuity01)*.10+(1-goalAlignment)*.14+autonomy*.10);
    if(s.enabled&&s.motivationEnabled){
      s.motivation.curiosity01=clamp01(s.motivation.curiosity01*.97+.03*(.45+novelty*.35+uncertainty*.20));
      s.motivation.stability01=clamp01(s.motivation.stability01*.97+.03*(.35+energy*.40+(1-uncertainty)*.25));
      s.motivation.coherence01=clamp01(s.motivation.coherence01*.97+.03*(.35+s.self.continuity01*.40+(1-identityTension)*.25));
      s.motivation.novelty01=clamp01(s.motivation.novelty01*.97+.03*novelty);
      s.motivation.knowledge01=clamp01(s.motivation.knowledge01*.97+.03*(.45+uncertainty*.25+(1-s.prediction.modelAgreement01)*.30));
      s.motivation.autonomy01=clamp01(s.motivation.autonomy01*.97+.03*autonomy);
      s.motivation.drive01=clamp01(s.motivation.drive01*.92+.08*motivationDrive);s.motivation.arousal01=clamp01(s.motivation.arousal01*.90+.10*(novelty*.38+uncertainty*.30+load*.18+energy*.14));s.motivation.lastTick=input.tick;s.metrics.motivationUpdates+=1;
    }
    const exploration=clamp01((s.motivation.curiosity01*.44+s.motivation.novelty01*.28+uncertainty*.28));
    const reflection=clamp01((s.motivation.coherence01*.45+(1-energy)*.15+uncertainty*.20+s.self.growth01*.20));
    const stability=clamp01(s.motivation.stability01*.7+s.self.continuity01*.3);

    const bias=ACTIONS.map((action,a)=>clamp11(
      (s.enabled&&s.retrievalEnabled?retrievalBias[a]!:0)*(.30+retrievalStrength*.85)
      +(s.enabled&&s.predictionEnabled?((prediction[a]??.5)-(input.b365ForecastUtilities[action]??.5))*.72:0)
      +(s.enabled&&s.selfModelEnabled?(s.self.current[a%12]-.5)*.22:0)
      +(s.enabled&&s.motivationEnabled?(action==='explore'?exploration*.22:action==='reflect'?reflection*.18:action==='rest'?stability*.16:0):0)
      +goalBias[a]!*.30
      +valueBias[a]!*.28
    ));
    const integratedConfidence=clamp01(.20+retrievalStrength*.32+s.self.continuity01*.18+s.prediction.actionConfidence01.reduce((x,y)=>x+y,0)/7*.12+s.motivation.coherence01*.10+(input.b365NeuralConfidence01??.5)*.08);
    s.last={context,goalId:goal?.id??null,actionBias:bias.slice(),retrievedTicks,prediction:prediction.slice(),selfBefore:selfBefore.slice(),selfAfterPrediction:s.self.current.slice()};s.metrics.integratedDecisions+=1;s.metrics.lastDecisionAction='none';
    return {actionBias:Object.fromEntries(ACTIONS.map((a,i)=>[a,bias[i]!])) as Record<ActionKind,number>,retrieval:{strength01:retrievalStrength,episodeTicks:retrievedTicks,episodeCount:retrieved.length,matchedActions:retrieved.map(x=>x.e.action)},prediction:Object.fromEntries(ACTIONS.map((a,i)=>[a,prediction[i]!])) as Record<ActionKind,number>,selfField:{agency01:s.self.agency01,continuity01:s.self.continuity01,growth01:s.self.growth01,identityTension01:identityTension},motivation:{drive01:s.motivation.drive01,curiosity01:s.motivation.curiosity01,stability01:stability,exploration01:exploration,reflection01:reflection},goal:{alignment01:goalAlignment,commitment01:goal?.commitment01??.5,ownership01:goal?.ownership01??.5},integratedConfidence01:integratedConfidence};
  }

  afterOutcome(input: {
    tick:number; action:ActionKind; goalId?:string|null; context01:number[];
    reward01:number; predictionError01:number; salience01:number;
    verified01:number; independent01:number; outcomeSignature01?:number[];
  }): {
    updated:boolean; causalCredit01:number; valueImpact01:number; selfImpact01:number;
    goalImpact01:number; predictionImpact01:number; accepted:boolean;
  } {
    const s=this.state;
    const verified=clamp01(input.verified01)>=.80&&clamp01(input.independent01)>=.65;
    s.tick=Math.floor(input.tick);
    if(!s.enabled||!verified){
      s.metrics.rejectedEpisodes+=1;
      return {updated:false,causalCredit01:0,valueImpact01:0,selfImpact01:0,goalImpact01:0,predictionImpact01:0,accepted:false};
    }
    const ctx=Array.from({length:8},(_,i)=>clamp01(input.context01?.[i]??.5));
    const aidx=ACTIONS.indexOf(input.action);
    const beforeSelf=s.self.current.slice();
    const beforeValues=s.values.map(v=>v.value01);
    const centered=(clamp01(input.reward01)-.5)*2;
    const pe=clamp01(input.predictionError01);
    const sal=clamp01(input.salience01);

    const priorPrediction=s.prediction.actionUtility01[aidx]??.5;
    const target=clamp01(.50+centered*.34-pe*.08);
    const peta=.035+.035*sal+.02*(1-pe);
    s.prediction.actionUtility01[aidx]=clamp01(priorPrediction+(target-priorPrediction)*peta);
    s.prediction.actionConfidence01[aidx]=clamp01((s.prediction.actionConfidence01[aidx]??.1)*.94+(1-pe)*.06);
    s.prediction.errors[aidx]=clamp01((s.prediction.errors[aidx]??.2)*.90+Math.abs(target-priorPrediction)*.10);
    s.prediction.updates+=1;
    s.prediction.longHorizon01=clamp01(s.prediction.longHorizon01*.97+(.30+.30*(1-pe)+.20*sal)*.03);
    s.prediction.modelAgreement01=clamp01(s.prediction.modelAgreement01*.95+(1-pe)*.05);
    s.metrics.predictionUpdates+=1;

    const axisByAction:Record<ActionKind,number[]>={
      respond:[3,6], explore:[4,7], verify:[0,1,3], rest:[5],
      reflect:[0,2,3], wait:[0,1], defer:[0,1,2],
    };
    const axis=axisByAction[input.action]??[];
    const eta=.010+.018*sal+.012*(1-pe);
    let valueImpact=0;
    for(let i=0;i<8;i++){
      const v=s.values[i]!;
      const relevance=axis.includes(i)?1:.18;
      const targetValue=clamp01(.5+centered*(.30*relevance+.08*(1-relevance))+(1-pe-.5)*.08);
      const delta=(targetValue-v.value01)*eta;
      v.value01=clamp01(v.value01+delta);
      v.confidence01=clamp01(v.confidence01*.95+(1-pe)*.05);
      if(centered>0&&Math.abs(delta)>1e-7)
        v.support01=clamp01(v.support01*.94+Math.abs(centered)*.06);
      if(centered<0&&Math.abs(delta)>1e-7)
        v.counterEvidence01=clamp01(v.counterEvidence01*.94+Math.abs(centered)*.06);
      if(Math.abs(delta)>1e-7){
        v.revisions+=1;
        v.lastTick=input.tick;
        s.metrics.valueRevisions+=1;
        valueImpact+=Math.abs(delta);
      }
    }

    s.self.stable=s.self.stable.map((v,i)=>clamp01(v*.985+.015*s.values[i%8]!.value01));
    s.self.current=s.self.current.map((v,i)=>clamp01(v*.965+.035*(ctx[i%8]*.55+s.values[i%8]!.value01*.45)));
    const selfImpact=mean(s.self.current.map((v,i)=>Math.abs(v-beforeSelf[i]!)));
    s.self.agency01=clamp01(s.self.agency01*.96+.04*(input.action==='explore'||input.action==='verify'?1:0.8)+(verified?0.006:0));
    s.self.continuity01=clamp01(s.self.continuity01*.96+.04*(1-Math.min(1,selfImpact*4)));
    s.self.growth01=clamp01(s.self.growth01*.96+.04*(sal*.45+(1-pe)*.30+Math.abs(centered)*.25));
    s.self.predictionError01=clamp01(s.self.predictionError01*.92+Math.abs(selfImpact)*.08);
    if(selfImpact>.005){s.self.revisionCount+=1;s.metrics.selfRevisions+=1;}

    let goalImpact=0;
    if(input.goalId){
      let g=s.goals.find(x=>x.id===input.goalId);
      if(!g){
        g={id:input.goalId,vector:ctx.slice(),status:'active',ownership01:.55,commitment01:.50,
          value01:.45,progress01:0,attempts:0,successes:0,failures:0,createdTick:input.tick,lastTick:input.tick};
        s.goals.push(g);
      }
      const old=g.progress01;
      g.attempts+=1;
      g.lastTick=input.tick;
      if(centered>0){
        g.successes+=1;
        g.progress01=clamp01(g.progress01+.035+.045*Math.abs(centered)+.020*sal);
        g.commitment01=clamp01(g.commitment01+.012*(1-pe));
        g.value01=clamp01(g.value01+.015*Math.abs(centered));
      }else{
        g.failures+=1;
        g.progress01=clamp01(g.progress01-.018*Math.abs(centered));
        g.commitment01=clamp01(g.commitment01-.008*Math.abs(centered));
        g.value01=clamp01(g.value01-.006*Math.abs(centered));
      }
      if(g.progress01>=.90&&g.successes>=3) g.status='completed';
      else if(g.failures>=4&&g.progress01<.15) g.status='paused';
      goalImpact=Math.abs(g.progress01-old);
      if(goalImpact>.005) s.metrics.goalRevisions+=1;
    }

    const episode:B385Episode={
      tick:input.tick, action:input.action, goalId:input.goalId??null, context:ctx,
      reward01:clamp01(input.reward01), predictionError01:pe, salience01:sal, verified01:1,
      selfBefore:beforeSelf, selfAfter:s.self.current.slice(), valueBefore:beforeValues,
      valueAfter:s.values.map(v=>v.value01),
      outcomeSignature:Array.isArray(input.outcomeSignature01)?input.outcomeSignature01.slice(0,8):ctx.slice(),
      significance01:clamp01(.28+.30*sal+.22*(1-pe)+.20*Math.abs(centered)),
      retrieved01:s.last.retrievedTicks.length?1:0,
      causalCredit01:clamp01(.22+sal*.24+(1-pe)*.24+s.last.retrievedTicks.length*.03),
    };
    s.episodes=[...s.episodes,episode].slice(-192);
    s.metrics.verifiedEpisodes+=1;
    s.metrics.causalCredits+=1;
    s.metrics.lastDecisionAction=input.action;
    s.metrics.lastCausalDelta01=episode.causalCredit01;
    if(!s.last.retrievedTicks.length) s.metrics.unseenEvaluations+=1;
    s.self.consolidations+=1;
    s.motivation.adaptations+=1;
    return {
      updated:true, causalCredit01:episode.causalCredit01, valueImpact01:valueImpact/8,
      selfImpact01:selfImpact, goalImpact01:goalImpact,
      predictionImpact01:Math.abs(target-priorPrediction), accepted:true,
    };
  }

  evaluateKnockout(input:B385DecisionInput){const snapshot=this.snapshot();const on=this.beforeDecision(input);this.restore(snapshot);this.setKnockouts({retrieval:false,selfModel:false,motivation:false,prediction:false});const off=this.beforeDecision(input);const actionDelta=Math.abs(Object.values(on.actionBias).reduce((a,b)=>a+b,0)-Object.values(off.actionBias).reduce((a,b)=>a+b,0));const retrievalDelta=Math.abs(on.retrieval.strength01-off.retrieval.strength01);this.restore(snapshot);this.state.metrics.knockoutEvaluations+=1;this.state.metrics.lastCausalDelta01=clamp01(actionDelta+retrievalDelta);return {actionDelta01:actionDelta,retrievalDelta01:retrievalDelta,causalDelta01:clamp01(actionDelta+retrievalDelta),on,off};}
  markRestartCheck(){this.state.metrics.restartChecks+=1;}
}
