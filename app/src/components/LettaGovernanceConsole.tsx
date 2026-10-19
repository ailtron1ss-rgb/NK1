import { useEffect, useState } from 'react';
import { ShieldCheck, Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { neuroApi } from '@/neuro-kurisu/api';

type AnyRecord = Record<string, unknown>;

export function LettaGovernanceConsole() {
  const [state, setState] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const [redactSensitive, setRedactSensitive] = useState(true);
  const [sourceName, setSourceName] = useState('runtime/neuro-kurisu/src');
  const [reviewKind, setReviewKind] = useState('generated-code');
  const [reviewSource, setReviewSource] = useState('operator-ui');
  const [reviewId, setReviewId] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [governance, telemetry] = await Promise.all([neuroApi.lettaGovernance(), neuroApi.lettaTelemetryPolicy()]);
      const governanceData = (governance as AnyRecord).governance ?? governance;
      const telemetryData = (telemetry as AnyRecord).telemetry ?? (governance as AnyRecord).telemetry ?? {};
      setState({ governance: governanceData, telemetry: telemetryData });
      const t = telemetryData as AnyRecord;
      setTelemetryEnabled(t.enabled !== false);
      setLocalOnly(t.localOnly !== false);
      setRedactSensitive(t.redactSensitive !== false);
    } catch (error) {
      setState({ ok: false, error: String(error instanceof Error ? error.message : error) });
    } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const saveTelemetry = async () => {
    setBusy(true);
    try { await neuroApi.lettaSetTelemetryPolicy({ enabled: telemetryEnabled, localOnly, redactSensitive, exportAllowed: false }); await load(); }
    finally { setBusy(false); }
  };

  const checkSource = async () => {
    setBusy(true);
    try { const result = await neuroApi.lettaSourceBoundary(sourceName, 'canonical'); setState(prev => ({ ...(prev ?? {}), sourceCheck: result })); }
    finally { setBusy(false); }
  };

  const createReview = async () => {
    setBusy(true);
    try {
      const result = await neuroApi.lettaArtifactReview({ kind: reviewKind, source: reviewSource, generatedBy: 'ChatGPT', disclosure: 'AI-assisted', humanReviewed: false, status: 'pending' });
      setReviewId(String((result as AnyRecord).id ?? (result as AnyRecord).reviewId ?? ''));
      setState(prev => ({ ...(prev ?? {}), latestReview: result }));
    } finally { setBusy(false); }
  };

  const decideReview = async (status: 'approved' | 'rejected') => {
    if (!reviewId) return;
    setBusy(true);
    try { const result = await neuroApi.lettaArtifactDecide({ id: reviewId, decision: status, reason: 'operator UI governance decision' }); setState(prev => ({ ...(prev ?? {}), latestDecision: result })); await load(); }
    finally { setBusy(false); }
  };

  return (
    <section className="mt-4 rounded-lg border border-border bg-bg p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle"><ShieldCheck className="size-4" />Governance / source boundaries</div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}><RefreshCw className={`mr-2 size-3 ${busy ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{state ? JSON.stringify(state, null, 2) : 'Loading…'}</pre>
        <div className="space-y-3 rounded-md border border-border p-3 text-xs text-muted">
          <div>
            <div className="mb-2 font-medium text-fg">Telemetry policy</div>
            <label className="mb-2 flex items-center gap-2"><input type="checkbox" checked={telemetryEnabled} onChange={e => setTelemetryEnabled(e.target.checked)} /> enabled</label>
            <label className="mb-2 flex items-center gap-2"><input type="checkbox" checked={localOnly} onChange={e => setLocalOnly(e.target.checked)} /> local only</label>
            <label className="mb-3 flex items-center gap-2"><input type="checkbox" checked={redactSensitive} onChange={e => setRedactSensitive(e.target.checked)} /> redact sensitive values</label>
            <Button disabled={busy} onClick={() => void saveTelemetry()}><Save className="mr-2 size-4" />Save policy</Button>
          </div>
          <div className="border-t border-border pt-3">
            <div className="mb-2 font-medium text-fg">Source boundary</div>
            <div className="flex gap-2"><input value={sourceName} onChange={e => setSourceName(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2" /><Button variant="outline" size="sm" disabled={busy} onClick={() => void checkSource()}>Check</Button></div>
          </div>
          <div className="border-t border-border pt-3">
            <div className="mb-2 font-medium text-fg">Generated artifact review</div>
            <div className="grid gap-2 sm:grid-cols-2"><input value={reviewKind} onChange={e => setReviewKind(e.target.value)} placeholder="kind" className="h-8 rounded-md border border-border bg-bg px-2" /><input value={reviewSource} onChange={e => setReviewSource(e.target.value)} placeholder="source" className="h-8 rounded-md border border-border bg-bg px-2" /></div>
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => void createReview()}>Create review</Button><Button size="sm" variant="outline" disabled={busy || !reviewId} onClick={() => void decideReview('approved')}><CheckCircle2 className="mr-1 size-3" />Approve</Button><Button size="sm" variant="outline" disabled={busy || !reviewId} onClick={() => void decideReview('rejected')}>Reject</Button></div>
            {reviewId ? <p className="mt-2 text-[10px] text-subtle">review id: {reviewId}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
