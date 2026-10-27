import {
  normalizeEvidenceLineageProvenance,
  type EvidenceLineageProvenance,
} from './EvidenceLineageProvenance.ts';

export type SourceTraceProvenance = EvidenceLineageProvenance;
export interface SourceTrace {
  id: string;
  source: 'user' | 'system' | 'world' | 'model' | 'tool' | 'memory';
  kind: string;
  confidence: number;
  epistemicStatus: 'input' | 'hypothesis' | 'observation' | 'fact' | 'rejected';
  at: number;
  provenance?: SourceTraceProvenance;
}
export interface SourceMonitorState { traces: SourceTrace[]; conflicts: number; unattributed: number; }
export const defaultSourceMonitor = (): SourceMonitorState => ({ traces: [], conflicts: 0, unattributed: 0 });

export class SourceMonitor {
  private state = defaultSourceMonitor();

  restore(s: SourceMonitorState | undefined) {
    const traces = Array.isArray(s?.traces) ? s!.traces.slice(0, 512).flatMap((raw: any) => {
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return [];
      try {
        const row = structuredClone(raw) as SourceTrace;
        const provenance = normalizeEvidenceLineageProvenance(row.provenance);
        if (provenance) row.provenance = provenance;
        else delete row.provenance;
        return [row];
      } catch {
        return [];
      }
    }) : [];
    this.state = {
      ...defaultSourceMonitor(),
      conflicts: Number.isSafeInteger(s?.conflicts) && Number(s?.conflicts) >= 0 ? Number(s?.conflicts) : 0,
      unattributed: Number.isSafeInteger(s?.unattributed) && Number(s?.unattributed) >= 0 ? Number(s?.unattributed) : 0,
      traces,
    };
  }

  record(trace: SourceTrace) {
    if (!trace?.id) {
      this.state.unattributed++;
      return;
    }
    const row = structuredClone(trace);
    const provenance = normalizeEvidenceLineageProvenance(row.provenance);
    if (provenance) row.provenance = provenance;
    else delete row.provenance;

    // Trace IDs are immutable event identities. An exact replay is a no-op;
    // conflicting reuse must not shadow the original trace consumed by lineage().
    const existing = this.state.traces.find(candidate => candidate.id === row.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row)) this.state.conflicts++;
      return;
    }
    this.state.traces = [row, ...this.state.traces].slice(0, 512);
  }

  add(source: SourceTrace['source'], kind: string, confidence: number, epistemicStatus: SourceTrace['epistemicStatus'] = 'observation') {
    this.record({
      id: `src-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source, kind, confidence: Math.max(0, Math.min(1, confidence)), epistemicStatus, at: Date.now(),
    });
  }

  latest(limit = 16) {
    const bounded = Math.max(1, Math.min(64, Math.floor(Number.isFinite(limit) ? limit : 16)));
    return this.state.traces.slice(0, bounded).map(x => structuredClone(x));
  }

  lineage(traceId: string, limit = 1): SourceTrace[] {
    if (typeof traceId !== 'string' || !traceId || traceId.length > 192 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(traceId)) return [];
    const bounded = Math.max(1, Math.min(8, Math.floor(Number.isFinite(limit) ? limit : 1)));
    return this.state.traces.filter(row => row.id === traceId).slice(0, bounded).map(row => structuredClone(row));
  }

  snapshot() { return structuredClone(this.state); }
}
