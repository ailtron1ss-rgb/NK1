/** Bounded fixed-window limiter with a reserved overflow bucket. */
export function parseRateLimitSetting(rawValue, { fallback, minimum, maximum }) {
  if (!Number.isSafeInteger(fallback) || !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
    || minimum < 1 || maximum < minimum || fallback < minimum || fallback > maximum) throw new Error('invalid-rate-setting-bounds');
  if (typeof rawValue !== 'string') return fallback;
  const normalized = rawValue.trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
export class BoundedRateLimiter {
  constructor({ windowMs, limit, maxKeys = 512 }) {
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error('invalid-rate-window');
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid-rate-limit');
    if (!Number.isSafeInteger(maxKeys) || maxKeys < 1 || maxKeys > 65_536) throw new Error('invalid-rate-bucket-capacity');
    this.windowMs=windowMs; this.limit=limit; this.maxKeys=maxKeys; this.buckets=new Map(); this.overflowKey='\u0000nk1-rate-overflow';
  }
  get size(){return this.buckets.size;}
  consume(rawKey, rawNow=Date.now()){
    const now=Number.isFinite(rawNow)&&rawNow>=0?rawNow:Date.now();
    let key=typeof rawKey==='string'&&rawKey.trim()?rawKey.trim().slice(0,160):'unknown';
    let bucket=this.buckets.get(key);
    if(!bucket&&key!==this.overflowKey&&this.buckets.size>=this.maxKeys-1){
      for(const [existingKey,existing] of this.buckets){
        if(now<existing.startedAt||now-existing.startedAt>=this.windowMs)this.buckets.delete(existingKey);
      }
      if(this.buckets.size>=this.maxKeys-1)key=this.overflowKey;
      bucket=this.buckets.get(key);
    }
    if(!bucket||now<bucket.startedAt||now-bucket.startedAt>=this.windowMs)bucket={startedAt:now,count:0};
    bucket.count=Math.min(this.limit+1,bucket.count+1);
    this.buckets.delete(key);this.buckets.set(key,bucket);
    if(this.buckets.size>this.maxKeys)throw new Error('rate-limiter-capacity-invariant');
    if(bucket.count<=this.limit)return {allowed:true,remaining:this.limit-bucket.count};
    return {allowed:false,retryAfterSec:Math.max(1,Math.ceil((bucket.startedAt+this.windowMs-now)/1000))};
  }
}