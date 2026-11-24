import React, { useEffect, useState } from 'react';
import { runHierarchicalMind } from '../neural/HierarchicalMind';
import { latticeModuleCount } from '../neural/MicroNeuralLattice';

export const HierarchyMindPanel: React.FC = () => {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), 1400);
    return () => clearInterval(id);
  }, []);

  let snap = null as ReturnType<typeof runHierarchicalMind> | null;
  try {
    snap = (window as any).__kurisuHierarchy || null;
    if (!snap) {
      const u = (window as any).__kurisuLastUser || '';
      if (u) snap = runHierarchicalMind(u);
    }
  } catch {
    /* */
  }

  if (!snap) {
    return (
      <div className="text-[9px] font-mono text-white/35 border border-white/10 rounded-lg p-2">
        HIERARCHY idle · L0×{latticeModuleCount()} → L1 coalitions → workspace
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#A78BFA]/25 bg-black/45 p-2 text-[9px] font-mono text-white/75 space-y-1 max-h-56 overflow-y-auto">
      <div className="text-[#A78BFA] flex justify-between">
        <span>HIERARCHY FAN-IN</span>
        <span>H={snap.workspace.entropy.toFixed(2)}</span>
      </div>
      <div className="text-white/40">broadcast: {snap.workspace.winners.map(w => w.id).join(' + ')}</div>
      {snap.coalitions
        .slice()
        .sort((a, b) => b.activation - a.activation)
        .map(c => (
          <div key={c.id} className="flex items-center gap-1">
            <span className="w-16 truncate text-white/50">{c.id}</span>
            <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
              <div
                className="h-full bg-[#A78BFA]/90 transition-all duration-500"
                style={{ width: `${Math.round(c.activation * 100)}%` }}
              />
            </div>
            <span className="w-7 text-right">{Math.round(c.activation * 100)}</span>
          </div>
        ))}
      <div className="text-white/35 pt-0.5">{snap.styleLine}</div>
    </div>
  );
};
