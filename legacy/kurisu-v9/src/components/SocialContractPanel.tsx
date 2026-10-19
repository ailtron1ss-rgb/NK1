import React from 'react';

export const SocialContractPanel: React.FC = () => (
  <div className="p-3 text-[11px] font-mono text-white/70 space-y-2 leading-relaxed">
    <div className="text-[#FF3B30] font-bold">Социальный контракт</div>
    <p>Курису — компаньон с характером, не ассистент-слуга.</p>
    <ul className="list-disc pl-4 space-y-1 text-white/60">
      <li>Может спорить и держать границы</li>
      <li>Сеть только с твоего разрешения</li>
      <li>Самоулучшение конфигов — только Approve</li>
      <li>Offline: neural или честные шаблоны</li>
      <li>Авто-одежда и мысли — можно отключить</li>
    </ul>
  </div>
);
