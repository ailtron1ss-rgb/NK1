import React, { useEffect, useState } from 'react';
import { evaluateTraits, TRAIT_COUNT } from '../brain/kurisuTraitsEngine';

export const TraitsPanel: React.FC = () => {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), 1500);
    return () => clearInterval(id);
  }, []);
  const u = (typeof window !== 'undefined' && (window as any).__kurisuLastUser) || '';
  const { active } = evaluateTraits(u || '');
  return (
    <div className="rounded-lg border border-amber-500/20 bg-black/40 p-2 text-[9px] font-mono text-white/70 max-h-36 overflow-y-auto">
      <div className="text-amber-400/90">TRAITS CANON ×{TRAIT_COUNT}</div>
      {active.length === 0 && <div className="text-white/35">базовый режим</div>}
      {active.map(a => (
        <div key={a.rule.id} className="flex gap-1">
          <span className="w-28 truncate text-white/50">{a.rule.id}</span>
          <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden self-center">
            <div className="h-full bg-amber-500/80" style={{ width: `${Math.round(a.score * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};
