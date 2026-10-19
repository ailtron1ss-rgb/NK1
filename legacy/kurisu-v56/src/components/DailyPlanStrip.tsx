import React, { useEffect, useState } from 'react';
import { dailyPlan } from '../brain/dailyPlan';

export const DailyPlanStrip: React.FC = () => {
  const [plan, setPlan] = useState(() => dailyPlan.get());
  useEffect(() => {
    const t = setInterval(() => setPlan(dailyPlan.get()), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="px-3 py-1.5 border-b border-[#5AC8FA]/20 bg-[#5AC8FA]/5 text-[10px] font-mono">
      <div className="text-[#5AC8FA] mb-0.5">План дня · {plan.note}</div>
      {plan.items.map(it => (
        <div key={it.id} className={it.done ? 'text-white/30 line-through' : 'text-white/75'}>
          [{it.done ? 'x' : ' '}] {it.text}
        </div>
      ))}
    </div>
  );
};
