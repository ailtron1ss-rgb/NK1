import React from 'react';
import { listAllSprites } from '../avatar/spriteEngine';

export const SpriteGallery: React.FC<{ onPick?: (path: string) => void }> = ({ onPick }) => {
  const list = listAllSprites();
  return (
    <div className="p-3 space-y-2">
      <div className="text-[#5AC8FA] font-mono text-xs font-bold">Галерея спрайтов ({list.length})</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
        {list.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick?.(s.path)}
            className="bg-white/5 border border-white/10 rounded-lg overflow-hidden text-left"
          >
            <img src={s.path} alt={s.id} className="w-full aspect-[3/4] object-cover" loading="lazy" />
            <div className="text-[9px] font-mono text-white/60 px-1 py-0.5 truncate">{s.id}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
