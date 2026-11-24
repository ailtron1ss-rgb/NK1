export interface PerturbationalResult{baseline:number[];perturbed:number[];complexity:number;distance:number;note:string;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
function entropy(xs:number[]){if(!xs.length)return 0; const bins=new Array(8).fill(0); for(const x of xs){bins[Math.min(7,Math.max(0,Math.floor(clamp(x)*8)))]++;} let h=0; for(const c of bins){if(!c)continue;const p=c/xs.length;h-=p*Math.log2(p);} return clamp(h/3);}
export class PerturbationalProbe{
  run(baseline:number[],perturbed:number[]):PerturbationalResult{
    const n=Math.max(baseline.length,perturbed.length); const a=[...baseline],b=[...perturbed]; while(a.length<n)a.push(a.at(-1)??0); while(b.length<n)b.push(b.at(-1)??0);
    const distance=clamp(Math.sqrt(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/Math.max(1,n))*1.7);
    const complexity=clamp((entropy(a)+entropy(b))/2*0.7+distance*0.3);
    return{baseline:a,perturbed:b,complexity,distance,note:'Это perturbational proxy, не IIT Φ и не мера сознания.'};
  }
}
