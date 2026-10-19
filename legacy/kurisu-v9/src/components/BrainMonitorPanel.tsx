import React, { useEffect, useState } from 'react';
import { brain, MonitorSnapshot } from '../brain/BrainOrchestrator';
import { neuralLocalEngine } from '../services/neuralLocalEngine';
import { getActiveCloudProvider } from '../services/providerConfig';
import { Activity, Cpu, Cloud, Database } from 'lucide-react';

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
        <Activity className="w-4 h-4" /> Brain Monitor
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Intent</div>
          <div className="text-white font-bold">{snap.intent}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Route</div>
          <div className="text-[#00FF94] font-bold">{snap.route}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2 col-span-2">
          <div className="text-white/40">Reason</div>
          <div className="text-white/90">{snap.reason}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40 flex items-center gap-1"><Cloud className="w-3 h-3" /> Cloud</div>
          <div className="text-white">{cloud ? `${cloud.name}` : 'нет ключа'}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40 flex items-center gap-1"><Cpu className="w-3 h-3" /> Neural</div>
          <div className="text-white">{neural.enabled ? `${neural.modelId} ${neural.loaded ? 'READY' : '…'}` : 'off'}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Latency</div>
          <div className="text-amber-300">{snap.lastLatencyMs ?? '—'} ms</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <div className="text-white/40">Backend</div>
          <div className="text-white/80 truncate">{snap.backendHint}</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
        <div className="text-white/40 flex items-center gap-1 mb-1"><Database className="w-3 h-3" /> Top memory</div>
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
        <div className="text-white/40 mb-1">Energy budget</div>
        <div>auto {snap.budget.autonomousUsed}/{snap.budget.maxAutonomousPerHour}/h</div>
        <div>search {snap.budget.searchUsed}/{snap.budget.maxSearchPerHour}/h</div>
        <div>neural loads {snap.budget.neuralLoads}/{snap.budget.maxNeuralLoadsPerDay}/day</div>
      </div>
    </div>
  );
};
