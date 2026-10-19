/**
 * Emotional State Calculator & Gauge Panel for Makise Kurisu.
 * Displays real-time metrics for Trust, Affection, Irritation, Curiosity, Happiness, Fatigue,
 * and Relationship Stage with recharge/rest actions.
 */

import React from 'react';
import { EmotionalState, RelationshipStage } from '../types';
import { Heart, Shield, AlertTriangle, Sparkles, Smile, BatteryCharging, Moon } from 'lucide-react';

interface EmotionalStatePanelProps {
  emotions: EmotionalState;
  onRest: () => void;
}

const STAGE_TRANSLATIONS: Record<RelationshipStage, { title: string; color: string; desc: string }> = {
  Stranger: { title: 'Незнакомец', color: 'bg-slate-700 text-slate-300', desc: 'Формальное научное общение' },
  Acquaintance: { title: 'Знакомый', color: 'bg-blue-900/60 text-blue-300 border-blue-700/50', desc: 'Осторожный интерес и сарказм' },
  Friend: { title: 'Друг', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50', desc: 'Готовность делиться гипотезами' },
  CloseFriend: { title: 'Близкий друг', color: 'bg-amber-900/60 text-amber-300 border-amber-700/50', desc: 'Смущение при похвале и забота' },
  TrustedCompanion: { title: 'Надежный спутник', color: 'bg-red-900/60 text-red-300 border-red-700/50', desc: 'Абсолютное доверие и привязанность' }
};

export const EmotionalStatePanel: React.FC<EmotionalStatePanelProps> = ({ emotions, onRest }) => {
  const stageInfo = STAGE_TRANSLATIONS[emotions.stage] || STAGE_TRANSLATIONS.Stranger;

  const items = [
    { label: 'Уровень доверия', val: emotions.trust, icon: Shield, color: 'bg-[#00FF94]', glow: 'shadow-[0_0_8px_#00FF94]', textCol: 'text-[#00FF94]' },
    { label: 'Интеллектуальный резонанс', val: emotions.affection, icon: Heart, color: 'bg-[#5AC8FA]', glow: 'shadow-[0_0_8px_#5AC8FA]', textCol: 'text-[#5AC8FA]' },
    { label: 'Раздражение', val: emotions.irritation, icon: AlertTriangle, color: 'bg-[#FF3B30]', glow: 'shadow-[0_0_8px_#FF3B30]', textCol: 'text-[#FF3B30]' },
    { label: 'Любопытство', val: emotions.curiosity, icon: Sparkles, color: 'bg-cyan-400', glow: 'shadow-[0_0_8px_#22d3ee]', textCol: 'text-cyan-400' },
    { label: 'Счастье', val: emotions.happiness, icon: Smile, color: 'bg-emerald-400', glow: 'shadow-[0_0_8px_#34d399]', textCol: 'text-emerald-400' },
    { label: 'Усталость', val: emotions.fatigue, icon: BatteryCharging, color: 'bg-purple-400', glow: 'shadow-[0_0_8px_#c084fc]', textCol: 'text-purple-400' },
  ];

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-4 sm:p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      {/* Header & Stage Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <span className="w-2 h-4 bg-[#FF3B30] rounded-full" />
            Психоэмоциональное Состояние ИИ
          </h3>
          <p className="text-xs text-white/70 mt-0.5">Динамическая система эмоций Макисэ Курису</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${stageInfo.color} shadow-sm font-mono`}>
            {stageInfo.title}
          </span>
          <button
            onClick={onRest}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium rounded-lg border border-white/10 transition-all active:scale-95"
            title="Отправить Курису отдохнуть и снизить ментальную усталость"
          >
            <Moon className="w-3.5 h-3.5 text-[#5AC8FA]" />
            Отдых
          </button>
        </div>
      </div>

      {/* Stage Description & Autonomous Mind Lock Notice */}
      <div className="my-3 space-y-2">
        <div className="text-xs text-white/60 bg-white/5 p-2.5 rounded-lg border border-white/5 font-sans flex items-center justify-between">
          <div>
            <span className="text-[#FF3B30] font-mono font-medium">Текущий модус:</span> {stageInfo.desc}
          </div>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-2.5 flex items-center gap-2 text-[10px] font-mono text-purple-200">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            🔒 Автономный разум ИИ: Эмоции рассчитываются естественным образом на основе ваших поступков и диалогов. Прямая ручная регулировка чувств запрещена для сохранения подлинности личности.
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 text-white/80 font-medium">
                  <Icon className={`w-3.5 h-3.5 ${item.textCol}`} />
                  {item.label}
                </span>
                <span className={`font-mono font-bold text-xs ${item.textCol}`}>{item.val}%</span>
              </div>

              {/* Progress Bar with Immersive Glow */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color} ${item.glow} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, item.val))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
