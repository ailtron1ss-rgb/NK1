import React, { useEffect, useState } from 'react';
import { tokenMeter } from '../services/tokenMeter';

export const TokenStatusBar: React.FC = () => {
  const [s, setS] = useState(() => tokenMeter.snapshot());
  const [note, setNote] = useState('');
  useEffect(() => {
    const id = setInterval(() => setS(tokenMeter.snapshot()), 3000);
    const onSw = (e: Event) => setNote((e as CustomEvent).detail?.msg || '');
    window.addEventListener('kurisu-model-switch', onSw as any);
    return () => {
      clearInterval(id);
      window.removeEventListener('kurisu-model-switch', onSw as any);
    };
  }, []);
  const pct = Math.min(100, Math.round((s.used / s.limit) * 100));
  return (
    <div className="px-3 py-1.5 border-b border-white/10 bg-black/40 text-[10px] font-mono text-white/70 space-y-1">
      <div className="flex justify-between gap-2">
        <span>
          {s.providerName} · {s.model}
        </span>
        <span>
          ~{s.used}/{s.limit} tok
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#5AC8FA] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {note && <div className="text-[#FFB020]">{note}</div>}
    </div>
  );
};
