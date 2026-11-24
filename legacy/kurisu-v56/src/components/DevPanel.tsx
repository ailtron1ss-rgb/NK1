import React, { useState } from 'react';
import { logger } from '../services/logger';
import { powerGovernor } from '../services/powerGovernor';
import { tokenMeter } from '../services/tokenMeter';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { chatService } from '../services/chatService';
import { continuumMemory } from '../cognitive/ContinuumMemory';
import { miruState } from '../cognitive/MiRUState';
import { alasLearning } from '../cognitive/ALASLearning';
import { sleepDreamEngine } from '../cognitive/SleepDreamEngine';
import { runtimeGovernor, PerformanceProfile } from '../services/runtimeGovernor';

export const DevPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState(() => logger.list(30));
  const power = powerGovernor.get();
  const tok = tokenMeter.snapshot();
  const emo = neuroEngine.getEmotions();
  const continuum = continuumMemory.snapshot();
  const miru = miruState.snapshot();
  const alas = alasLearning.snapshot();
  const dreams = sleepDreamEngine.recent();
  const runtime = runtimeGovernor.get();
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 p-3 overflow-y-auto text-[10px] font-mono text-white">
      <div className="flex justify-between mb-2">
        <span className="text-[#5AC8FA] font-bold">DEV PANEL</span>
        <button type="button" onClick={onClose} className="text-white/70">
          закрыть
        </button>
      </div>
      <div className="space-y-1 mb-3">
        <div>mode: {chatService.getModeHint()}</div>
        <div>runtime: {runtime.profile} • FPS {runtime.fpsTarget} • RAM {runtime.memoryMb ?? '?'} MB • temp {runtime.cpuTemperatureC ?? '?'}°C</div>
        <div className="flex gap-1 pt-1">
          {(['performance','balanced','powersave'] as PerformanceProfile[]).map(p => (
            <button key={p} type="button" onClick={() => runtimeGovernor.setProfile(p)} className={`px-2 py-1 border rounded ${runtime.profile === p ? 'border-[#00FF94] text-[#00FF94]' : 'border-white/20 text-white/60'}`}>{p}</button>
          ))}
          <button type="button" onClick={() => runtimeGovernor.setProfile(null)} className="px-2 py-1 border border-white/20 rounded text-white/60">auto</button>
        </div>
        <div>
          power: {power.mode} bat={power.battery != null ? Math.round(power.battery * 100) + '%' : '?'}
        </div>
        <div>
          tokens: {tok.providerName} {tok.used}/{tok.limit}
        </div>
        <div>
          neuro emo H{emo.happiness.toFixed(2)} C{emo.curiosity.toFixed(2)} Ir{emo.irritation.toFixed(2)}
        </div>
      </div>
      <button
        type="button"
        className="mb-2 px-2 py-1 border border-white/20 rounded"
        onClick={() => {
          const blob = new Blob([logger.export()], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'kurisu-logs.json';
          a.click();
        }}
      >
        Export logs
      </button>
      <button type="button" className="mb-2 ml-2 px-2 py-1 border border-white/20 rounded" onClick={() => { logger.clear(); setLogs([]); }}>
        Clear
      </button>
      <div className="space-y-1">
        {logs.map((l, i) => (
          <div key={i} className={l.level === 'ERROR' ? 'text-red-300' : 'text-white/60'}>
            [{l.level}] {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
};
