import React, { useEffect, useState } from 'react';
import { brain, MonitorSnapshot } from '../brain/BrainOrchestrator';
import { attentionEconomy } from '../brain/attentionEconomy';
import { eventBus } from '../brain/eventBus';
import { getLabShift } from '../brain/labClock';
import { dailyPlan } from '../brain/dailyPlan';
import { userModel } from '../brain/userModel';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { personalityCore } from '../psyche/PersonalityCore';
import { neuralPathways } from '../psyche/NeuralPathwayGraph';
import { multiLayerConsciousness } from '../cognitive/MultiLayerConsciousness';
import { neuralLocalEngine } from '../services/neuralLocalEngine';
import { getActiveCloudProvider } from '../services/providerConfig';
import { Activity, Cpu, Cloud, Database } from 'lucide-react';
import { ProvenanceChip } from './ProvenanceChip';

export const BrainMonitorPanel: React.FC = () => {
  const [snap, setSnap] = useState<MonitorSnapshot>(() => brain.getMonitorSnapshot());
  const [neural, setNeural] = useState(() => neuralLocalEngine.getStatus());

  useEffect(() => {
    const t = setInterval(() => {
      setSnap(brain.getMonitorSnapshot());
      setNeural(neuralLocalEngine.getStatus());
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const cloud = getActiveCloudProvider();

  return (
    <div className="space-y-3 p-3 font-mono text-[11px]">
      <div className="flex items-center gap-2 text-[#5AC8FA] font-bold text-sm">
        <Activity className="w-4 h-4" /> Монитор мозга
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Намерение <ProvenanceChip source="runtime" confidence="measured" /></div>
          <div className="text-white font-bold">{snap.intent}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Маршрут <ProvenanceChip source="runtime" confidence="measured" /></div>
          <div className="text-[#00FF94] font-bold">{snap.route}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2 col-span-2">
          <div className="text-white/40">Причина <ProvenanceChip source="runtime" confidence="model" /></div>
          <div className="text-white/90">{snap.reason}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40 flex items-center gap-1"><Cloud className="w-3 h-3" /> Облако</div>
          <div className="text-white">{cloud ? `${cloud.name}` : 'нет ключа'}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40 flex items-center gap-1"><Cpu className="w-3 h-3" /> Нейро</div>
          <div className="text-white">{neural.enabled ? `${neural.modelId} ${neural.loaded ? 'READY' : '…'}` : 'off'}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Задержка <ProvenanceChip source="performance.now" confidence="measured" /></div>
          <div className="text-amber-300">{snap.lastLatencyMs ?? '—'} ms</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Бэкенд</div>
          <div className="text-white/80 truncate">{snap.backendHint}</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 flex items-center gap-1 mb-1"><Database className="w-3 h-3" /> Главная память</div>
        {snap.memoryTop.length ? (
          <ul className="space-y-1 text-white/80">
            {snap.memoryTop.map((m, i) => (
              <li key={i} className="truncate">• {m}</li>
            ))}
          </ul>
        ) : (
          <div className="text-white/40">Пока пусто — напиши сообщение</div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Энергобюджет</div>
        <div>auto {snap.budget.autonomousUsed}/{snap.budget.maxAutonomousPerHour}/h</div>
        <div>search {snap.budget.searchUsed}/{snap.budget.maxSearchPerHour}/h</div>
        <div>нейро-загрузки {snap.budget.neuralLoads}/{snap.budget.maxNeuralLoadsPerDay}/день</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Фоновый вычислительный бюджет</div>
        <div>{attentionEconomy.get().tokens}/{attentionEconomy.get().maxTokens} (spent {attentionEconomy.get().spent})</div>
        <div className="text-white/40 mt-1">Lab shift: {getLabShift()}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Последние события</div>
        {eventBus.recent(5).map((e, i) => (
          <div key={i} className="truncate text-white/60">{e.type}</div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">План дня</div>
        {dailyPlan.get().items.map(it => (
          <div key={it.id} className="truncate">{it.done ? '✓' : '·'} {it.text}</div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Модель пользователя</div>
        <div className="truncate">{JSON.stringify(userModel.get().topics.slice(0,4))}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Текущее рабочее состояние</div>
        <div className="text-white/70">Фокус: {snap.organism?.attention.workspace[0]?.label || '—'}</div>
        <div className="text-white/50 mt-1">Доминанта: {snap.organism?.workspace?.lead || '—'} · действие: {snap.organism?.workspace?.responsePolicy || '—'}</div>
      </div>

      <div className="bg-white/5 border border-cyan-400/20 rounded-xl p-2">
        <div className="text-cyan-200 font-semibold mb-1">Когнитивный организм</div>
        <div className="grid grid-cols-2 gap-1 text-white/75">
          <div>фокус {Math.round(snap.organism?.attention.focusStability ?? 0)}</div>
          <div>рабочее пространство {snap.organism?.attention.workspace.length ?? 0}</div>
          <div>калибровка {Math.round(snap.organism?.meta.calibration ?? 0)}</div>
          <div>целостность {Math.round(snap.organism?.self.coherence ?? 0)}</div>
        </div>
        <div className="mt-2 text-white/50">Фокус</div>
        <div className="truncate text-white/80">{snap.organism?.attention.workspace[0]?.label || '—'}</div>
        <div className="mt-2 space-y-1">
          {(snap.organism?.attention.workspace || []).map((w, i) => (
            <div key={w.id} className="flex items-center gap-2">
              <span className="w-16 text-[9px] text-white/40 truncate">{w.source}</span>
              <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.max(3, Math.min(100, w.salience))}%` }} />
              </div>
              <span className="w-6 text-right text-[9px] text-white/40">{Math.round(w.salience)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-white/50">Главная цель</div>
        <div className="truncate text-white/80">{snap.organism?.goals.find(g => g.status === 'active')?.title || 'нет'}</div>
        <div className="mt-2 text-white/50">Тело аватара</div>
        <div className="text-white/70">{snap.organism?.avatar.posture || 'neutral'} · motion {Math.round(snap.organism?.avatar.motionEnergy ?? 0)}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Состояние чувств</div>
        <div>dominant: {emotionAffect.dominantEmotion()}</div>
        <div className="truncate">привязанность {Math.round(emotionAffect.get().feelings.attachment)} одиночество {Math.round(emotionAffect.get().feelings.loneliness)}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Черты</div>
        <div className="truncate">цундере {personalityCore.get().traits.tsundere} строгость {personalityCore.get().traits.rigor} любопытство {personalityCore.get().traits.curiosity}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Связи</div>
        {neuralPathways.topLinks(4).map((l, i) => (
          <div key={i} className="truncate">{l}</div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 mb-1">Многоуровневый стек</div>
        {multiLayerConsciousness.hud().layers.map(l => (
          <div key={l.name} className="flex justify-between gap-2">
            <span>{l.name}</span>
            <span className="text-[#00FF94]">{Math.round(l.score)}</span>
          </div>
        ))}
        <div className="text-white/40 mt-1">готовность {multiLayerConsciousness.hud().readiness}</div>
      </div>
    </div>
  );
};
