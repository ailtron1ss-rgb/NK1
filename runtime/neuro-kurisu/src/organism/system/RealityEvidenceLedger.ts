/**
 * BIG PASS 162 — Reality / Simulation evidence separation.
 *
 * The ledger prevents internal simulation evidence from being silently treated
 * as independent reality evidence. It is a compact accounting layer; detailed
 * provenance remains in RuntimeEvidenceBus / ExternalEvidenceTrust.
 */
export type EvidenceRealityClass = 'external-observation'|'device-observation'|'simulator'|'derived'|'model-generated'|'user-reported';

export interface RealityEvidenceRecord {
  id:string;
  tick:number;
  at:number;
  realityClass:EvidenceRealityClass;
  claim:string;
  confidence01:number;
  independenceKey:string;
  parentIds:string[];
}

export interface RealityEvidenceLedgerState {
  version:1;
  total:number;
  externalCount:number;
  simulatorCount:number;
  independentSources:number;
  recent:RealityEvidenceRecord[];
}

const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const REALITY_CLASSES = new Set<EvidenceRealityClass>(['external-observation','device-observation','simulator','derived','model-generated','user-reported']);
const EXTERNAL=new Set<EvidenceRealityClass>(['external-observation','device-observation','user-reported']);
const safeTotal = (value: unknown, fallback = 0): number => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : fallback;

export class RealityEvidenceLedger {
  private readonly capacity:number;
  private records:RealityEvidenceRecord[]=[];
  private total=0;

  constructor(capacity=384){this.capacity=Math.max(128,Math.min(2048,Math.floor(Number.isFinite(capacity)?capacity:384)));}

  private normalizeRecord(value: unknown): RealityEvidenceRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Partial<RealityEvidenceRecord>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || id.length > 256) return null;
    if (typeof row.tick !== 'number' || !Number.isSafeInteger(row.tick) || row.tick < 0) return null;
    if (typeof row.at !== 'number' || !Number.isFinite(row.at) || row.at < 0) return null;
    if (typeof row.realityClass !== 'string' || !REALITY_CLASSES.has(row.realityClass as EvidenceRealityClass)) return null;
    if (typeof row.claim !== 'string') return null;
    if (typeof row.independenceKey !== 'string' || !row.independenceKey.trim()) return null;
    const confidenceValue = row.confidence01 ?? 0.5;
    if (typeof confidenceValue !== 'number' || !Number.isFinite(confidenceValue)) return null;
    const confidence = confidenceValue;
    const parentIds = Array.isArray(row.parentIds)
      ? row.parentIds.filter((parent): parent is string => typeof parent === 'string' && parent.length > 0).slice(0, 8)
      : [];
    return {
      id,
      tick: row.tick,
      at: row.at,
      realityClass: row.realityClass as EvidenceRealityClass,
      claim: row.claim.slice(0, 240),
      confidence01: clamp01(confidence),
      independenceKey: row.independenceKey.trim().slice(0, 160),
      parentIds,
    };
  }

  restore(raw?:Partial<RealityEvidenceLedgerState>|null):void {
    const source = Array.isArray(raw?.recent) ? raw!.recent.slice(0, this.capacity * 4) : [];
    const seen = new Set<string>();
    const rows: RealityEvidenceRecord[] = [];
    for (const value of source) {
      const row = this.normalizeRecord(value);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
    this.records = rows.slice(0, this.capacity);
    this.total = Math.max(this.records.length, safeTotal(raw?.total, this.records.length));
  }

  /**
   * Merge snapshots by immutable evidence id. Runtime and Core may project the
   * same canonical ledger at different points in a cycle; merging must never
   * replace evidence already recorded by another writer or count a replay twice.
   */
  mergeFrom(raw?:Partial<RealityEvidenceLedgerState>|null):void {
    if (!raw || typeof raw !== 'object') return;
    const incoming = Array.isArray(raw.recent) ? raw.recent.slice(0, this.capacity * 4) : [];
    const seen = new Set(this.records.map(row => row.id));
    const merged = [...this.records];
    let added = 0;
    for (const value of incoming) {
      const row = this.normalizeRecord(value);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      added += 1;
    }
    merged.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
    this.records = merged.slice(0, this.capacity);
    this.total = Math.max(this.total + added, safeTotal(raw.total, 0), this.records.length);
  }

  record(input:{tick:number;realityClass:EvidenceRealityClass;claim:string;confidence01?:number;independenceKey:string;parentIds?:string[];at?:number}):RealityEvidenceRecord{
    if (!input || typeof input !== 'object') throw new TypeError('reality-evidence-input-must-be-object');
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('reality-evidence-tick-must-be-non-negative-safe-integer');
    const at = input.at === undefined ? Date.now() : input.at;
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) throw new RangeError('reality-evidence-timestamp-must-be-finite-and-non-negative');
    if (typeof input.realityClass !== 'string' || !REALITY_CLASSES.has(input.realityClass as EvidenceRealityClass)) throw new TypeError('reality-evidence-class-invalid');
    if (typeof input.claim !== 'string' || !input.claim.trim()) throw new TypeError('reality-evidence-claim-required');
    if (typeof input.independenceKey !== 'string' || !input.independenceKey.trim()) throw new TypeError('reality-evidence-independence-key-required');
    const confidence = input.confidence01 ?? 0.5;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) throw new RangeError('reality-evidence-confidence-must-be-finite');
    if (input.parentIds !== undefined && !Array.isArray(input.parentIds)) throw new TypeError('reality-evidence-parent-ids-must-be-array');
    const parentIds = [...new Set((input.parentIds ?? []).filter(parent => typeof parent === 'string' && parent.trim()).map(parent => parent.trim().slice(0, 256)))].slice(0, 8);
    const row:RealityEvidenceRecord={id:`rel:${at}:${input.tick}:${Math.random().toString(16).slice(2)}`,tick:input.tick,at,realityClass:input.realityClass,claim:input.claim.trim().slice(0,240),confidence01:clamp01(confidence),independenceKey:input.independenceKey.trim().slice(0,160),parentIds};
    this.records.unshift(row);if(this.records.length>this.capacity)this.records.length=this.capacity;this.total++;return structuredClone(row);
  }

  recent(limit=64){return structuredClone(this.records.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))));}

  claimAssessment(claim:string){
    const rows=this.records.filter(r=>r.claim===claim);
    const external=rows.filter(r=>EXTERNAL.has(r.realityClass));
    const simulator=rows.filter(r=>r.realityClass==='simulator');
    const externalKeys=new Set(external.map(r=>r.independenceKey));
    const simulationKeys=new Set(simulator.map(r=>r.independenceKey));
    const externalConfidence=external.length?Math.max(...external.map(r=>r.confidence01)):0;
    const simulationConfidence=simulator.length?Math.max(...simulator.map(r=>r.confidence01)):0;
    return {
      claim,
      samples:rows.length,
      externalSamples:external.length,
      simulationSamples:simulator.length,
      externalConfidence01:externalConfidence,
      simulationConfidence01:simulationConfidence,
      independentExternalSources:externalKeys.size,
      independentSimulationSources:simulationKeys.size,
      promotionAllowed:external.length>0&&externalKeys.size>0&&externalConfidence>=.55,
      realityGap01:Math.max(0,simulationConfidence-externalConfidence),
    };
  }

  snapshot():RealityEvidenceLedgerState{
    const independent=new Set(this.records.filter(r=>EXTERNAL.has(r.realityClass)).map(r=>r.independenceKey));
    return {version:1,total:this.total,externalCount:this.records.filter(r=>EXTERNAL.has(r.realityClass)).length,simulatorCount:this.records.filter(r=>r.realityClass==='simulator').length,independentSources:independent.size,recent:this.recent(96)};
  }
}
