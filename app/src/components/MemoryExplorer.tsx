import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";
import { parseMemoryExplorerResponse, type MemoryExplorerItem, type MemoryExplorerResult } from "@/organism/memoryExplorer";

type TemporalMode = "current" | "all";

function formatTime(value: number | null): string {
  if (value === null) return "Time unavailable";
  if (value > 100_000_000_000) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
  }
  return "Runtime time " + value;
}

function MemoryCard({ item }: { item: MemoryExplorerItem }) {
  return (
    <article className="rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-fg">{item.text}</p>
          <p className="mt-2 break-all font-mono text-[10px] text-subtle">{item.id}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted">{item.kind}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tabular-nums text-muted">
        {item.confidence !== null ? <span>Confidence {item.confidence.toFixed(3)}</span> : null}
        {item.salience !== null ? <span>Salience {item.salience.toFixed(3)}</span> : null}
        <span>{formatTime(item.createdAt)}</span>
      </div>
      {item.source || item.provenance ? (
        <div className="mt-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[10px] text-muted">
          {item.source ? <p>Source: {item.source}</p> : null}
          {item.provenance ? <p className="mt-0.5 break-words">Provenance: {item.provenance}</p> : null}
        </div>
      ) : null}
      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] text-subtle">Inspect raw canonical record</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-surface p-2 text-[10px] leading-relaxed text-muted">{JSON.stringify(item.raw, null, 2)}</pre>
      </details>
    </article>
  );
}

export function MemoryExplorer() {
  const [query, setQuery] = useState("");
  const [temporalMode, setTemporalMode] = useState<TemporalMode>("current");
  const [semantic, setSemantic] = useState(false);
  const [result, setResult] = useState<MemoryExplorerResult | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const runSearch = useCallback(async (overrides?: { query?: string; temporalMode?: TemporalMode; semantic?: boolean }) => {
    const searchQuery = overrides?.query ?? query;
    const timeMode = overrides?.temporalMode ?? temporalMode;
    const semanticEnabled = overrides?.semantic ?? semantic;
    const requestId = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      const response = await neuroApi.memoryInspector({
        query: searchQuery,
        limit: 24,
        temporalMode: timeMode,
        semantic: semanticEnabled && timeMode === "current",
      });
      if (requestId !== sequence.current) return;
      const parsed = parseMemoryExplorerResponse(response);
      setRawResponse(response);
      setResult(parsed);
    } catch (cause) {
      if (requestId !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestId === sequence.current) setBusy(false);
    }
  }, [query, temporalMode, semantic]);

  useEffect(() => {
    void runSearch({ query: "", temporalMode: "current", semantic: false });
    return () => { sequence.current += 1; };
  }, [runSearch]);

  const exportResult = () => {
    if (rawResponse === null) return;
    const blob = new Blob([JSON.stringify(rawResponse, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neurocore-memory-inspector.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3" aria-label="Canonical memory explorer">
      <div className="rounded-lg border border-border bg-bg p-3">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-accent" aria-hidden="true" />
          <div><h3 className="text-sm font-semibold text-fg">Canonical MemoryOS2 explorer</h3><p className="text-[10px] text-muted">Read-only search · no memory writes · no automatic promotion</p></div>
        </div>
        <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={512} placeholder="Search memories, experiences, facts and events…" aria-label="Search canonical memories" className="h-11 min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-fg" />
          <Button type="submit" disabled={busy}><Search className="mr-2 size-4" />Search</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-9 items-center gap-2 text-xs text-muted">
            <span>Time scope</span>
            <select value={temporalMode} onChange={(event) => { const next = event.target.value as TemporalMode; setTemporalMode(next); if (next === "all") setSemantic(false); }} className="h-9 rounded-md border border-border bg-surface px-2 text-fg">
              <option value="current">Current view</option>
              <option value="all">All temporal records</option>
            </select>
          </label>
          <label className="flex min-h-9 items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={semantic} disabled={temporalMode !== "current"} onChange={(event) => setSemantic(event.target.checked)} />
            Semantic retrieval preview
          </label>
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void runSearch()}><RefreshCw className="mr-1.5 size-3.5" />Refresh</Button>
            <Button type="button" size="sm" variant="ghost" disabled={!rawResponse} onClick={exportResult}><Download className="mr-1.5 size-3.5" />Export</Button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-md border border-rose-500/40 bg-bg p-3 text-xs text-muted" role="alert">{error}</div> : null}
      {busy ? <p className="text-xs text-muted" role="status">Querying canonical MemoryOS2…</p> : null}
      {result?.note ? <p className="text-[10px] leading-relaxed text-subtle">{result.note}</p> : null}
      {result?.semantic !== null && result?.semantic !== undefined ? (
        <details className="rounded-md border border-border bg-bg p-2">
          <summary className="cursor-pointer text-[10px] text-muted">Semantic retrieval diagnostics</summary>
          <pre className="mt-2 max-h-36 overflow-auto text-[10px] text-subtle">{JSON.stringify(result.semantic, null, 2)}</pre>
        </details>
      ) : null}
      {result ? <div className="flex items-center justify-between gap-2 text-[10px] text-muted"><span>{result.memories.length} records shown · {result.temporalMode}</span><span>{result.query ? "Query: " + result.query : "Latest canonical records"}</span></div> : null}
      <div className="grid gap-2 xl:grid-cols-2">
        {result?.memories.map((item) => <MemoryCard key={item.id} item={item} />)}
      </div>
      {result && result.memories.length === 0 && !busy ? <p className="rounded-md border border-border bg-bg p-4 text-sm text-muted">No matching canonical memory records were returned.</p> : null}
    </section>
  );
}
