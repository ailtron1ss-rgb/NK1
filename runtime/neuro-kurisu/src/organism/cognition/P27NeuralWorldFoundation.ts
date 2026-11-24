import type { ActionKind, OrganismState, WorldContext } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const unit=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sig=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const now=()=>Date.now();

export interface EncodedModality { modality:'text'|'vision'|'audio'|'sensor'|'world'; vector:number[]; confidence01:number; novelty01:number; source:string; at:number; }
export interface LatentSituation { version:1; vector:number[]; confidence01:number; conflict01:number; modalities:string[]; at:number; }
export interface P27WorldModelState { version:2;
 featureDim:number;
 hiddenDim:number;
 hiddenWeights:number[][];
 hiddenBias:number[];
 outputWeights:Record<ActionKind,number[]>;
 outputBias:Record<ActionKind,number>;
 actionWeights:Record<ActionKind,number[]>;
 actionBias:Record<ActionKind,number>;
 transitionWeights:number[];
 transitionBias:number;
 rewardWeights:number[];
 rewardBias:number;
 samples:number;
 updates:number;
 predictionError01:number;
 lastLatentConfidence01:number;
 }
export interface P27NeuralWorldState { version:1;
 encoders:{text:number;
vision:number;
audio:number;
sensor:number;
world:number};
 latent:LatentSituation;
 world:P27WorldModelState;
 counterfactuals:Array<{id:string;
at:number;
action:ActionKind;
predictedReward01:number;
confidence01:number;
source:'learned-model'}>;
 metrics:{encoded:number;
fused:number;
worldUpdates:number;
holdoutBefore01:number;
holdoutAfter01:number;
holdoutDelta01:number;
crossModalAgreement01:number;
};
 lastAt:number;
 }

const DIM=16;
const featureNames=['energy','load','uncertainty','novelty','goal','social','predictionError','attention','identity','bodyCapacity','thermal','boredom','resourceRisk','external','latentConfidence','bias'];
const hash=(s:string)=>{let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0;};
function textEncode(text:string):number[]{const v=new Array(DIM).fill(0);
 const t=text.toLowerCase().slice(0,4096);
 for(let i=0;
i<t.length;
i++){const h=hash(t.slice(Math.max(0,i-2),i+3));
 v[h%DIM]+=((h>>>8)%200-100)/100;
} const norm=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;
 return v.map(x=>clamp(x/norm));
}
function vectorEncode(values:number[], seed:string):number[]{const v=new Array(DIM).fill(0); values.slice(0,128).forEach((x,i)=>{const h=hash(seed+':'+i); v[h%DIM]+=clamp(x)*(((h>>>9)%200-100)/100);}); const norm=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1; return v.map(x=>clamp(x/norm));}
function sensorVector(s:OrganismState):number[]{return vectorEncode([s.needs.energy,s.needs.cognitiveLoad,s.needs.uncertainty,s.needs.novelty,s.needs.goalPressure,s.needs.socialNeed,s.predictionError,s.attentionBudget,s.needs.identityCoherence], 'sensor');}
function worldVector(w?:WorldContext):number[]{if(!w)return new Array(DIM).fill(0); const objects=Array.isArray(w.objects)?w.objects:[]; const events=Array.isArray(w.events)?w.events:[]; const facts=Array.isArray(w.facts)?w.facts:[]; const semantic=[...objects.slice(0,16).map(o=>hash(String(o.label))),...events.slice(0,12).map(e=>hash(String(e))),...facts.slice(-16).map(f=>hash(String(f)))]; const seedVector=vectorEncode(semantic.map(h=>(h%1000)/1000),'world-semantic'); const base=vectorEncode([w.energy,w.attention,w.uncertainty,objects.length,events.length,facts.length,objects.filter(o=>o.visible).length,facts.filter(f=>String(f).startsWith('relation:')).length],'world'); return base.map((x,i)=>clamp(x*.72+seedVector[i]*.28));}
function defaultWorld():P27WorldModelState{const actionWeights={} as Record<ActionKind,number[]>;
 const actionBias={} as Record<ActionKind,number>;
 const outputWeights={} as Record<ActionKind,number[]>;
 const outputBias={} as Record<ActionKind,number>;
 const hiddenDim=8;
 for(const a of ACTIONS){actionWeights[a]=new Array(DIM).fill(0);
 actionBias[a]=0;
 outputWeights[a]=new Array(hiddenDim).fill(0);
 outputBias[a]=0;
} return {version:2,featureDim:DIM,hiddenDim,hiddenWeights:Array.from({length:hiddenDim},()=>new Array(DIM+2).fill(0)),hiddenBias:new Array(hiddenDim).fill(0),outputWeights,outputBias,actionWeights,actionBias,transitionWeights:new Array(DIM).fill(0),transitionBias:0,rewardWeights:new Array(DIM).fill(0),rewardBias:0,samples:0,updates:0,predictionError01:.5,lastLatentConfidence01:0};
}
export function defaultP27NeuralWorld():P27NeuralWorldState{return {version:1,encoders:{text:0,vision:0,audio:0,sensor:0,world:0},latent:{version:1,vector:new Array(DIM).fill(0),confidence01:0,conflict01:0,modalities:[],at:0},world:defaultWorld(),counterfactuals:[],metrics:{encoded:0,fused:0,worldUpdates:0,holdoutBefore01:.5,holdoutAfter01:.5,holdoutDelta01:0,crossModalAgreement01:0},lastAt:0};
}

export interface P27ObservationInput { text?:string; vision?:{features?:number[];sceneLabel?:string;objects?:Array<{label:string}>;confidence01?:number}; audio?:{samples:number[];sampleRate?:number;confidence01?:number}; sensorState?:OrganismState; world?:WorldContext; }
function audioFeatures(samples:number[],sampleRate=16000):number[]{const xs=samples.slice(0,3200).map(Number);
 if(!xs.length)return [0,0,0,0];
 let sum=0,z=0,prev=0;
 const bands=new Array(4).fill(0);
 for(let i=0;
i<xs.length;
i++){const x=Math.max(-1,Math.min(1,xs[i]));
 sum+=x*x;
 if(i&&x*prev<0)z++;
 prev=x;
 const b=Math.min(3,Math.floor(i/Math.max(1,xs.length/4)));
 bands[b]+=Math.abs(x);
} const rms=Math.sqrt(sum/xs.length);
 return [rms,z/xs.length,Math.min(1,sampleRate/48000),...bands.map(x=>x/xs.length)];
}

export class P27NeuralWorldFoundation {
 private state=defaultP27NeuralWorld();
 restore(raw?:Partial<P27NeuralWorldState>|null){const d=defaultP27NeuralWorld();
 this.state={
   ...d,...(raw??{}),
   encoders:{...d.encoders,...(raw?.encoders??{})},
   latent:{...d.latent,...(raw?.latent??{}),vector:Array.isArray(raw?.latent?.vector)?raw!.latent!.vector.slice(0,DIM):d.latent.vector},
   world:{...d.world,...(raw?.world??{}),version:2,hiddenDim:8,
     hiddenWeights:Array.isArray(raw?.world?.hiddenWeights)?raw!.world!.hiddenWeights.slice(0,8).map((r:any)=>Array.isArray(r)?r.slice(0,DIM+2):new Array(DIM+2).fill(0)):d.world.hiddenWeights,
     hiddenBias:Array.isArray(raw?.world?.hiddenBias)?raw!.world!.hiddenBias.slice(0,8):d.world.hiddenBias,
     outputWeights:{...d.world.outputWeights,...(raw?.world?.outputWeights??{})},
     outputBias:{...d.world.outputBias,...(raw?.world?.outputBias??{})},
     actionWeights:{...d.world.actionWeights,...(raw?.world?.actionWeights??{})},
     actionBias:{...d.world.actionBias,...(raw?.world?.actionBias??{})},
     transitionWeights:Array.isArray(raw?.world?.transitionWeights)?raw!.world!.transitionWeights.slice(0,DIM):d.world.transitionWeights,
     rewardWeights:Array.isArray(raw?.world?.rewardWeights)?raw!.world!.rewardWeights.slice(0,DIM):d.world.rewardWeights},
   counterfactuals:Array.isArray(raw?.counterfactuals)?raw!.counterfactuals.slice(-128):d.counterfactuals,
   metrics:{...d.metrics,...(raw?.metrics??{})}
 };
}
 snapshot(){return structuredClone(this.state);}
 encode(input:P27ObservationInput):EncodedModality[]{const out:EncodedModality[]=[];
 if(input.text){out.push({modality:'text',vector:textEncode(input.text),confidence01:.82,novelty01:unit(Math.min(1,input.text.length/280)),source:'text',at:now()});
this.state.encoders.text++;
} if(input.vision){const rawFeatures=Array.isArray(input.vision.features)?input.vision.features.filter(Number.isFinite).slice(0,128):[]; const semanticFeatures=rawFeatures.length?rawFeatures:[...(input.vision.sceneLabel?[hash(String(input.vision.sceneLabel))%1000/1000]:[]),...(input.vision.objects??[]).slice(0,16).map(o=>hash(String(o.label))%1000/1000)]; const features=semanticFeatures.length?semanticFeatures:[0]; out.push({modality:'vision',vector:vectorEncode(features,'vision'),confidence01:unit(input.vision.confidence01??.62),novelty01:unit(features.length/64),source:rawFeatures.length?'compact-vision-features':'vision-semantic-fallback',at:now()});
this.state.encoders.vision++;
} if(input.audio){const f=audioFeatures(input.audio.samples,input.audio.sampleRate);
out.push({modality:'audio',vector:vectorEncode(f,'audio'),confidence01:unit(input.audio.confidence01??.58),novelty01:unit(f[0]*1.8+f[1]*2),source:'local-audio-features',at:now()});
this.state.encoders.audio++;
} if(input.sensorState){out.push({modality:'sensor',vector:sensorVector(input.sensorState),confidence01:.9,novelty01:unit(input.sensorState.predictionError),source:'organism-state',at:now()});
this.state.encoders.sensor++;
} if(input.world){out.push({modality:'world',vector:worldVector(input.world),confidence01:.78,novelty01:unit((Array.isArray(input.world.events)?input.world.events.length:0)/8),source:'world-context',at:now()});
this.state.encoders.world++;
} this.state.metrics.encoded+=out.length;
 return out;
}
 fuse(encoded:EncodedModality[]):LatentSituation{if(!encoded.length)return this.state.latent;
 const weights=encoded.map(x=>x.confidence01+0.05);
 const total=weights.reduce((a,b)=>a+b,0);
 const v=new Array(DIM).fill(0);
 encoded.forEach((e,j)=>e.vector.forEach((x,i)=>v[i]+=x*weights[j]/total));
 const agreement=encoded.length<2?1:unit(1-(encoded.reduce((s,e)=>s+Math.sqrt(e.vector.reduce((q,x,i)=>q+(x-(v[i]||0))**2,0)/DIM),0)/encoded.length));
 const confidence=unit(encoded.reduce((s,e)=>s+e.confidence01,0)/encoded.length*(.7+.3*agreement));
 this.state.latent={version:1,vector:v.map(clamp),confidence01:confidence,conflict01:1-agreement,modalities:encoded.map(e=>e.modality),at:now()};
 this.state.metrics.fused++;
 this.state.metrics.crossModalAgreement01=unit(this.state.metrics.crossModalAgreement01*.8+agreement*.2);
 return this.state.latent;
}
 private inputVector(latent:LatentSituation,action:ActionKind){const a=ACTIONS.indexOf(action)/Math.max(1,ACTIONS.length-1); return [...latent.vector.map(unit),unit(a),unit(1-a)];}
 predict(latent:LatentSituation,action:ActionKind){const x=this.inputVector(latent,action);
 const hidden=this.state.world.hiddenWeights.map((row,j)=>Math.tanh((this.state.world.hiddenBias[j]??0)+row.reduce((sum,v,i)=>sum+v*(x[i]??0),0)));
 const ow=this.state.world.outputWeights[action]??new Array(8).fill(0);
 let z=this.state.world.outputBias[action]??0;
 for(let j=0;
j<8;
j++)z+=hidden[j]*(ow[j]??0);
 const reward=unit(sig(z));
 const transition=unit(sig(this.state.world.transitionBias+x.slice(0,DIM).reduce((s,v,i)=>s+v*(this.state.world.transitionWeights[i]??0),0)));
 const confidence=unit(.18+Math.min(.72,this.state.world.samples/250)*this.state.latent.confidence01);
 return {reward01:reward,transition01:transition,confidence01:confidence};
}
 train(latent:LatentSituation,action:ActionKind,reward01:number,nextLatent?:LatentSituation){const x=this.inputVector(latent,action);
 const p=this.predict(latent,action);
 const err=clamp(reward01-p.reward01);
 const lr=.09/Math.sqrt(1+this.state.world.updates/400);
 const hidden=this.state.world.hiddenWeights.map((row,j)=>Math.tanh((this.state.world.hiddenBias[j]??0)+row.reduce((sum,v,i)=>sum+v*(x[i]??0),0)));
 const ow=this.state.world.outputWeights[action];
 const outBias=this.state.world.outputBias[action]??0;
 const outDer=p.reward01*(1-p.reward01);
 const deltaOut=err*outDer;
 const hiddenDelta=hidden.map((h,j)=>deltaOut*(ow[j]??0)*(1-h*h));
 for(let j=0;
j<8;
j++){ow[j]=clamp((ow[j]??0)+lr*deltaOut*hidden[j]);
 const row=this.state.world.hiddenWeights[j];
 for(let i=0;
i<row.length;
i++)row[i]=clamp((row[i]??0)+lr*hiddenDelta[j]*(x[i]??0));
 this.state.world.hiddenBias[j]=clamp((this.state.world.hiddenBias[j]??0)+lr*hiddenDelta[j]);
} this.state.world.outputBias[action]=clamp(outBias+lr*deltaOut);
 const transTarget=nextLatent?unit(nextLatent.vector.reduce((s,v,i)=>s+Math.abs(v-(latent.vector[i]??0)),0)/(DIM*2)+.5):.5;
 const terr=transTarget-this.predict(latent,action).transition01;
 for(let i=0;
i<DIM;
i++)this.state.world.transitionWeights[i]=clamp(this.state.world.transitionWeights[i]+lr*.35*terr*(x[i]??0));
 this.state.world.transitionBias=clamp(this.state.world.transitionBias+lr*.35*terr);
 this.state.world.samples++;
 this.state.world.updates++;
 this.state.metrics.worldUpdates++;
 this.state.world.predictionError01=unit(this.state.world.predictionError01*.97+Math.abs(err)*.03);
 return {error01:Math.abs(err),predictionBefore01:p.reward01};
}
 observePassiveTransition(before:LatentSituation,after:LatentSituation){
  if(!before.vector.length||!after.vector.length)return {error01:0,confidence01:0};
  const x=before.vector.map(unit);
  const target=unit(after.vector.reduce((sum,v,i)=>sum+Math.abs(v-(before.vector[i]??0)),0)/(DIM*2)+.5);
  const predicted=unit(sig(this.state.world.transitionBias+x.reduce((sum,v,i)=>sum+v*(this.state.world.transitionWeights[i]??0),0)));
  const error=target-predicted;
  const lr=.045/Math.sqrt(1+this.state.world.updates/500);
  for(let i=0;i<DIM;i++)this.state.world.transitionWeights[i]=clamp(this.state.world.transitionWeights[i]+lr*error*(x[i]??0));
  this.state.world.transitionBias=clamp(this.state.world.transitionBias+lr*error);
  this.state.world.samples++;this.state.world.updates++;
  this.state.world.predictionError01=unit(this.state.world.predictionError01*.985+Math.abs(error)*.015);
  this.state.metrics.worldUpdates++;
  return {error01:Math.abs(error),confidence01:unit(before.confidence01*.4+after.confidence01*.6)};
}
 counterfactuals(latent:LatentSituation,exclude:ActionKind|null=null){const rows=ACTIONS.filter(a=>a!==exclude).map(action=>({id:`cf-${now()}-${action}`,at:now(),action,predictedReward01:this.predict(latent,action).reward01,confidence01:this.predict(latent,action).confidence01,source:'learned-model' as const}));
 this.state.counterfactuals=[...rows,...this.state.counterfactuals].slice(0,128);
 return rows;
}
 recordHoldout(before01:number,after01:number){this.state.metrics.holdoutBefore01=unit(before01);this.state.metrics.holdoutAfter01=unit(after01);this.state.metrics.holdoutDelta01=after01-before01;return {...this.state.metrics};}
 featureNames(){return [...featureNames];}
}
