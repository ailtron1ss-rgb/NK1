import React, { useEffect, useState } from 'react';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';

export const PromiseStrip: React.FC = () => {
  const [open, setOpen] = useState(() => desireAndPromiseStore.openPromises());
  const [desire, setDesire] = useState(() => desireAndPromiseStore.topDesire());

  useEffect(() => {
    const t = setInterval(() => {
      setOpen(desireAndPromiseStore.openPromises());
      setDesire(desireAndPromiseStore.topDesire());
    }, 2000);
    return () => clearInterval(t);
  }, []);

  if (!open.length && !desire) {
    return (
      <div className="text-[10px] font-mono text-white/35 px-3 py-1.5 border-b border-white/5">
        Обещаний нет · можно добавить через характер/желания
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 border-b border-[#FF3B30]/20 bg-[#FF3B30]/5 text-[10px] font-mono space-y-0.5">
      {desire && <div className="text-[#FF6B8A]">Желание: {desire.text}</div>}
      {open.slice(0, 3).map(p => (
        <div key={p.id} className="text-white/70 truncate">
          · ({p.from}) {p.text}
        </div>
      ))}
    </div>
  );
};
