/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
export interface SocialPrediction { agent:string; predictedNeed:string; predictedValence:number; confidence:number; evidence:string[]; updatedAt:number; }
export class SocialWorldModel {
  private predictions: SocialPrediction[]=[];
  restore(rows:SocialPrediction[]|undefined){ this.predictions=(rows||[]).slice(0,50).map(x=>structuredClone(x)); }
  observe(agent:string,text:string,trust:number){
    const t=text.toLowerCase();
    const predictedNeed=/помоги|сделай|можешь/.test(t)?'assistance':/почему|как|что/.test(t)?'information':/скучаю|одиноко|поговор/.test(t)?'connection':'dialogue';
    const predictedValence=/спасибо|отлично|здорово/.test(t)?0.65:/плохо|страшно|груст/.test(t)?-0.45:0.05;
    const row={agent,predictedNeed,predictedValence,confidence:Math.max(0.2,Math.min(0.95,0.45+trust*0.3)),evidence:[text.slice(0,180)],updatedAt:Date.now()};
    this.predictions.unshift(row); this.predictions=this.predictions.slice(0,50); return structuredClone(row);
  }
  feedback(agent:string, actualNeed:string, actualValence:number){
    const row=this.predictions.find(x=>x.agent===agent); if(!row) return null;
    const error=Math.abs((row.predictedNeed===actualNeed?0:1)*0.7 + Math.abs(row.predictedValence-actualValence)*0.3);
    row.confidence=Math.max(0.05,Math.min(0.98,row.confidence+(error<0.35?0.03:-0.05))); return error;
  }
  snapshot(){ return this.predictions.map(x=>structuredClone(x)); }
}
