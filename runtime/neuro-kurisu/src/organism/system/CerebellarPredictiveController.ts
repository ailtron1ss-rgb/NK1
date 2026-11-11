/**
 * BIG PASS 209 — computational cerebellar analogue.
 *
 * Goal: provide a fast forward-prediction / calibration layer for action
 * candidates. This is deliberately not an anatomical equivalence claim.
 */
export interface CerebellarCandidate { action:string; score:number; predictedUtility?:number; confidence01:number; }
export interface CerebellarContext { predictionError01:number; uncertainty01:number; novelty01:number; bodyEnergy01:number; thermal01:number; cognitiveCapacity01:number; tick:number; }
export interface CerebellarActionState { meanError01:number; bias01:number; timing01:number; samples:number; lastTick:number; }
export interface CerebellarPredictionRow { action:string; correction01:number; calibratedScore01:number; calibratedUtility01:number; forwardError01:number; confidence01:number; }
export interface CerebellarFrame { version:1; tick:number; lesionApplied:boolean; meanForwardError01:number; rows:CerebellarPredictionRow[]; predictedAt:number; }
export interface CerebellarState { version:1; cycles:number; predictions:number; outcomeUpdates:number; lesionCycles:number; meanForwardError01:number; meanCorrection01:number; actionModels:Record<string,CerebellarActionState>; lastFrame:CerebellarFrame|null; }

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));

export const defaultCerebellarState=():CerebellarState=>({version:1,cycles:0,predictions:0,outcomeUpdates:0,lesionCycles:0,meanForwardError01:.5,meanCorrection01:0,actionModels:{},lastFrame:null});

export class CerebellarPredictiveController {
  private state=defaultCerebellarState();
  private lesion=false;

  setLesion(enabled:boolean){ this.lesion=Boolean(enabled); }
  lesionActive(){ return this.lesion; }
  restore(raw?:Partial<CerebellarState>|null){
    const d=defaultCerebellarState(), r=raw??{};
    const models=Object.fromEntries(Object.entries(r.actionModels??{}).map(([k,v]:any)=>[k,{meanError01:clamp(v?.meanError01??.5),bias01:signed(v?.bias01??0),timing01:clamp(v?.timing01??.5),samples:Math.max(0,Math.floor(v?.samples??0)),lastTick:Math.max(0,Math.floor(v?.lastTick??0))}]));
    this.state={...d,...r,version:1,actionModels:models,lastFrame:r.lastFrame?structuredClone(r.lastFrame):null};
    this.lesion=false;
  }
  snapshot(){ return structuredClone(this.state); }

  calibrate(candidates:CerebellarCandidate[], context:CerebellarContext):CerebellarFrame{
    const pe=clamp(context.predictionError01), uncertainty=clamp(context.uncertainty01), novelty=clamp(context.novelty01);
    const energy=clamp(context.bodyEnergy01), thermal=clamp(context.thermal01), capacity=clamp(context.cognitiveCapacity01);
    const fastGain=clamp(.16 + pe*.26 + uncertainty*.12 + novelty*.06 + capacity*.10 - thermal*.16 - (1-energy)*.10);
    const rows=(candidates??[]).slice(0,16).map(c=>{
      const model=this.state.actionModels[c.action]??{meanError01:.5,bias01:0,timing01:.5,samples:0,lastTick:0};
      const known=clamp(Math.min(1,model.samples/8));
      const error=clamp(model.meanError01*(.55+.45*(1-known)));
      const bias= this.lesion ? 0 : model.bias01*fastGain;
      const correction=signed((.5-error)*fastGain + bias);
      const score=clamp(c.score + correction*.08);
      const utility=clamp((c.predictedUtility??c.score) + correction*.12);
      const confidence=clamp(c.confidence01*(.88+.12*(1-error)));
      return {action:c.action,correction01:correction,calibratedScore01:score,calibratedUtility01:utility,forwardError01:error,confidence01:confidence};
    });
    const meanError=rows.length?rows.reduce((s,r)=>s+r.forwardError01,0)/rows.length:pe;
    const meanCorrection=rows.length?rows.reduce((s,r)=>s+Math.abs(r.correction01),0)/rows.length:0;
    this.state.cycles++; this.state.predictions+=rows.length; if(this.lesion)this.state.lesionCycles++;
    this.state.meanForwardError01=clamp(this.state.meanForwardError01*.94+meanError*.06);
    this.state.meanCorrection01=clamp(this.state.meanCorrection01*.94+meanCorrection*.06);
    const frame:CerebellarFrame={version:1,tick:Math.max(0,Math.floor(context.tick)),lesionApplied:this.lesion,meanForwardError01:meanError,rows,predictedAt:Date.now()};
    this.state.lastFrame=structuredClone(frame);
    return structuredClone(frame);
  }

  recordOutcome(action:string,predicted01:number,actual01:number,surprise01:number,tick:number){
    const key=String(action), predicted=clamp(predicted01), actual=clamp(actual01), surprise=clamp(surprise01);
    const targetError=Math.abs(actual-predicted);
    const old=this.state.actionModels[key]??{meanError01:.5,bias01:0,timing01:.5,samples:0,lastTick:tick};
    const lr=this.lesion?0:.08+.10*surprise;
    const signedError=signed(actual-predicted);
    const next={
      meanError01:clamp(old.meanError01*(1-lr)+targetError*lr),
      bias01:signed(old.bias01*(1-lr*.7)+signedError*(lr*.7)),
      timing01:clamp(old.timing01*.92+((tick-old.lastTick)>0?1:0)*.08),
      samples:old.samples+1,lastTick:Math.max(0,Math.floor(tick))
    };
    this.state.actionModels[key]=next; this.state.outcomeUpdates++;
    this.state.meanForwardError01=clamp(this.state.meanForwardError01*.95+targetError*.05);
    return {action:key,targetError01:targetError,meanError01:next.meanError01,bias01:next.bias01,samples:next.samples};
  }

  diagnostics(){
    const entries=Object.entries(this.state.actionModels).sort((a,b)=>a[1].meanError01-b[1].meanError01);
    return {cycles:this.state.cycles,predictions:this.state.predictions,outcomeUpdates:this.state.outcomeUpdates,lesionCycles:this.state.lesionCycles,meanForwardError01:this.state.meanForwardError01,meanCorrection01:this.state.meanCorrection01,bestCalibratedAction:entries[0]?.[0]??null,bestCalibratedError01:entries[0]?.[1].meanError01??null,actionCount:entries.length};
  }
}
