import React, { useEffect, useState } from 'react';
import { latticeModuleCount } from '../neural/MicroNeuralLattice';
import { resonanceField } from '../neural/ResonanceField';

export const NeuralLatticePanel: React.FC<{ lastUserText?: string }> = ({ lastUserText = '' }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, []);

  let snap = resonanceField.get();
  try {
    if (!snap && lastUserText) snap = resonanceField.resonate(lastUserText);
    if (!snap) snap = (window as any).__kurisuResonance || null;
  } catch {
    /* */
  }

  if (!snap) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] font-mono text-white/40">
        RESONANCE idle · {latticeModuleCount()} modules offline
      </div>
    );
  }

  const top = snap.lattice.top || [];
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] font-mono text-white/70 space-y-1 max-h-52 overflow-y-auto">
      <div className="flex justify-between text-[#5AC8FA]">
        <span>
          RESONANCE ×{latticeModuleCount()} · {snap.phase}
          {snap.lattice.eureka ? ' ⚡' : ''}
        </span>
        <span>I {Math.round(snap.intensity * 100)}%</span>
      </div>
      <div className="text-white/40">
        tone={snap.lattice.tone.tone} emo={snap.lattice.tone.emotion} v={snap.lattice.tone.valence.toFixed(2)}
      </div>
      {top.map(m => {
        const v = snap!.smooth[m.id] ?? m.activation;
        return (
          <div key={m.id} className="flex items-center gap-1">
            <span className="w-24 truncate text-white/50">{m.id}</span>
            <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-[#FF3B30]/80 transition-all duration-500" style={{ width: `${Math.round(v * 100)}%` }} />
            </div>
            <span className="w-8 text-right">{Math.round(v * 100)}</span>
          </div>
        );
      })}
    </div>
  );
};
