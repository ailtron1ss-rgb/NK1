/**
 * B503 Experience Integration Layer
 *
 * Turns a raw experience signal into bounded pressures used by memory,
 * identity and learning. Kept deterministic and allocation-light for phones.
 */
export interface ExperienceSignal {
  id:string;
  timestamp:number;
  source:string;
  meaning:number;
  novelty:number;
  emotionalImpact:number;
  tags:string[];
}

export interface ExperienceResult {
  importance:number;
  learningPressure:number;
  identityPressure:number;
  memoryPriority:number;
}

const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

export class B503ExperienceIntegrationLayer {
  private processed=0;

  process(signal:ExperienceSignal):ExperienceResult {
    const meaning=clamp(signal.meaning);
    const novelty=clamp(signal.novelty);
    const emotionalImpact=clamp(signal.emotionalImpact);
    const importance=clamp(meaning*0.45+novelty*0.25+emotionalImpact*0.30);
    const learningPressure=clamp(novelty*0.6+meaning*0.4);
    const identityPressure=clamp(emotionalImpact*0.5+importance*0.5);
    const memoryPriority=clamp(importance*0.7+identityPressure*0.3);
    this.processed++;
    return {importance,learningPressure,identityPressure,memoryPriority};
  }

  stats(){return {processed:this.processed};}

  snapshot(){return {processed:this.processed};}

  restore(snapshot?:{processed?:number}|null){
    if(!snapshot) return;
    this.processed=Math.max(0, Math.floor(Number.isFinite(snapshot.processed)?snapshot.processed!:0));
  }
}

export default B503ExperienceIntegrationLayer;
