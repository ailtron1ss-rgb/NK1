/**
 * BIG PASS 234 — Neuro-Digital Fusion Kernel.
 * A bounded event-driven neural layer coupled to a continuous predictive latent state.
 * This is a computational analogue, not a biological neuron claim.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-12,Math.min(12,x))));

export interface NeuroDigitalFusionState {
 version:1; cycles:number; neuronCount:number; spikes:number; lastSpikeRate01:number;
 latent:number[]; membrane:number[]; recurrentGain01:number; sparsity01:number;
 predictionError01:number; coherence01:number; energyCost01:number; lesion01:number;
 lastDrive01:number; lastReward01:number;
}
export const defaultNeuroDigitalFusion=():NeuroDigitalFusionState=>({version:1,cycles:0,neuronCount:32,spikes:0,lastSpikeRate01:0,latent:Array.from({length:12},()=>.5),membrane:Array.from({length:32},()=>0),recurrentGain01:.42,sparsity01:.72,predictionError01:.5,coherence01:.5,energyCost01:0,lesion01:0,lastDrive01:0,lastReward01:.5});

export class NeuroDigitalFusionKernel{
 private state=defaultNeuroDigitalFusion();
 restore(raw?:Partial<NeuroDigitalFusionState>|null){const d=defaultNeuroDigitalFusion(),r=raw??{};this.state={...d,...r,latent:Array.isArray(r.latent)?r.latent.slice(0,12):d.latent,membrane:Array.isArray(r.membrane)?r.membrane.slice(0,32):d.membrane,version:1};}
 snapshot(){return structuredClone(this.state);}
 cycle(input:{drive01:number;predictionError01:number;novelty01:number;reward01:number;plasticity01:number;lesion01?:number}){
  const s=this.state, drive=clamp(input.drive01), err=clamp(input.predictionError01), novelty=clamp(input.novelty01), reward=clamp(input.reward01), plasticity=clamp(input.plasticity01), lesion=clamp(input.lesion01??s.lesion01);
  const effectiveGain=s.recurrentGain01*(1-lesion*.8); let fired=0;
  for(let i=0;i<s.membrane.length;i++){
   const neighbor=s.membrane[(i+1)%s.membrane.length]*.12 + s.membrane[(i+31)%s.membrane.length]*.08;
   const inputCurrent=drive*(.52+(i%7)*.025)+err*.18+novelty*.1+reward*.06;
   const next=s.membrane[i]*.84 + inputCurrent*(1-effectiveGain) + neighbor*effectiveGain;
   const spike=next>.71 && (i%5!==0 || novelty>.28);
   s.membrane[i]=spike?next*.22:Math.max(0,Math.min(1.2,next*.96)); if(spike){fired++;s.spikes++;}
  }
  const rate=clamp(fired/s.membrane.length), targetError=clamp(Math.abs(rate-(.18+novelty*.22)));
  for(let j=0;j<s.latent.length;j++){
   const pulse=(rate*(1-(j%4)*.09)+drive*.22+reward*.12-err*.16);
   s.latent[j]=clamp(s.latent[j]*(1-plasticity*.12)+sigmoid(pulse*3-1.2)*plasticity*.12);
  }
  s.cycles++;s.lastSpikeRate01=rate;s.predictionError01=clamp(s.predictionError01*.82+targetError*.18);s.coherence01=clamp(.55+rate*.55-s.predictionError01*.45);s.sparsity01=clamp(1-rate);s.energyCost01=clamp(rate*.7+plasticity*.08);s.lesion01=lesion;s.lastDrive01=drive;s.lastReward01=reward;
  return {spikeRate01:rate,predictionError01:s.predictionError01,coherence01:s.coherence01,sparsity01:s.sparsity01,energyCost01:s.energyCost01,latent:s.latent.slice()};
 }
 lesion(level01:number){this.state.lesion01=clamp(level01);}
 summary(){return{cycles:this.state.cycles,spikes:this.state.spikes,lastSpikeRate01:this.state.lastSpikeRate01,coherence01:this.state.coherence01,sparsity01:this.state.sparsity01,energyCost01:this.state.energyCost01,predictionError01:this.state.predictionError01,lesion01:this.state.lesion01};}
}
