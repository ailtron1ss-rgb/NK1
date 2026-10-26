/**
 * Bounded snapshot of plain persisted/runtime data without invoking caller-owned getters.
 * This is an in-process integrity boundary, not a substitute for OS/process isolation.
 */
export interface PlainDataSnapshotOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxStringUnits?: number;
  allowNonFiniteNumbers?: boolean;
}
type SnapshotBudget = { nodes: number; stringUnits: number };
export function snapshotPlainData<T = unknown>(input: unknown, options: PlainDataSnapshotOptions = {}): T {
  const maxDepth=options.maxDepth??64, maxNodes=options.maxNodes??100_000, maxStringUnits=options.maxStringUnits??4*1024*1024;
  const allowNonFiniteNumbers=options.allowNonFiniteNumbers??false, budget:SnapshotBudget={nodes:0,stringUnits:0};
  const visit=(value:unknown,ancestors:Set<object>,depth:number):unknown=>{
    if(typeof value==='string'){budget.stringUnits+=value.length;if(budget.stringUnits>maxStringUnits)throw new Error('plain-data-snapshot-size-limit');return value;}
    if(value===null||typeof value==='undefined'||typeof value==='boolean')return value;
    if(typeof value==='number'){if(!allowNonFiniteNumbers&&!Number.isFinite(value))throw new Error('plain-data-snapshot-non-finite-number');return value;}
    if(typeof value!=='object')throw new Error('plain-data-snapshot-unsupported-value');
    if(depth>maxDepth||budget.nodes>=maxNodes)throw new Error('plain-data-snapshot-size-limit');
    budget.nodes++;if(ancestors.has(value))throw new Error('plain-data-snapshot-cycle');
    const prototype=Object.getPrototypeOf(value);
    if(Array.isArray(value)){
      if(prototype!==Array.prototype)throw new Error('plain-data-snapshot-array-prototype-invalid');
      const keys=Reflect.ownKeys(value),lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length'),length=lengthDescriptor?.value;
      if(!Number.isSafeInteger(length)||(length as number)<0||(length as number)>maxNodes||keys.length!==(length as number)+1)throw new Error('plain-data-snapshot-array-shape-invalid');
      ancestors.add(value);try{const result:unknown[]=[];for(let i=0;i<(length as number);i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value'in d)||d.get||d.set||!d.enumerable)throw new Error('plain-data-snapshot-accessor-or-sparse-array');result.push(visit(d.value,ancestors,depth+1));}return result;}finally{ancestors.delete(value);}
    }
    if(prototype!==Object.prototype&&prototype!==null)throw new Error('plain-data-snapshot-object-prototype-invalid');
    const keys=Reflect.ownKeys(value);if(keys.length>maxNodes)throw new Error('plain-data-snapshot-size-limit');
    const result=Object.create(prototype===null?null:Object.prototype) as Record<string,unknown>;
    ancestors.add(value);try{for(const key of keys){if(typeof key!=='string')throw new Error('plain-data-snapshot-symbol-key');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d)||d.get||d.set||!d.enumerable)throw new Error('plain-data-snapshot-accessor-or-hidden-property');Object.defineProperty(result,key,{value:visit(d.value,ancestors,depth+1),enumerable:true,configurable:true,writable:true});}return result;}finally{ancestors.delete(value);}
  };
  return visit(input,new Set<object>(),0) as T;
}
