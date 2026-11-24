export interface SemanticScar{id:string;trigger:string;policy:string;confidence:number;createdAt:number;uses:number;}
export interface SemanticScarState{scars:SemanticScar[];version:number;}
export const defaultSemanticScarState=():SemanticScarState=>({scars:[],version:1});
export class SemanticScarEngine{private state=defaultSemanticScarState();restore(s:SemanticScarState|undefined){this.state={...defaultSemanticScarState(),...(s??{}),scars:Array.isArray(s?.scars)?s!.scars.slice(0,128):[]};
}observe(trigger:string,policy:string,strength:number){let s=this.state.scars.find(x=>x.trigger===trigger&&x.policy===policy);if(!s){s={id:`scar-${this.state.scars.length+1}-${Date.now()}`,trigger,policy,confidence:strength,createdAt:Date.now(),uses:0};
this.state.scars.unshift(s);}else{s.confidence=Math.max(s.confidence,strength);s.uses++;}this.state.scars=this.state.scars.slice(0,128);return structuredClone(s);}bias(text:string){const t=text.toLowerCase();return this.state.scars.filter(s=>t.includes(s.trigger.toLowerCase())).reduce((v,s)=>v+s.confidence*.08,0);}snapshot(){return structuredClone(this.state);}}
