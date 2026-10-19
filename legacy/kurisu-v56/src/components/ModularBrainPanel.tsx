/**
 * UI: module toggles + NFH self-improve + ACE counts
 */
import React, { useState } from 'react';
import { moduleManager } from '../brain/ModuleManager';
import { nfhSelfImprove } from '../brain/NfhSelfImprove';
import { aceMemory } from '../brain/AceMemory';
import { selfImproveLoop } from '../modular/SelfImproveLoop';

export const ModularBrainPanel: React.FC = () => {
  const [mods, setMods] = useState(() => moduleManager.list());
  const [report, setReport] = useState('');
  const [props, setProps] = useState(() => selfImproveLoop.list());
  const counts = aceMemory.snapshotCounts?.() || {};

  const refresh = () => {
    setMods(moduleManager.list());
    setProps(selfImproveLoop.list());
  };

  return (
    <div className="space-y-3 p-3 rounded-xl bg-[#5AC8FA]/5 border border-[#5AC8FA]/25 text-[11px] font-mono">
      <div className="text-[#5AC8FA] font-bold uppercase">Модульный мозг (Hub)</div>
      <div className="text-white/50 text-[10px]">
        Включай/выключай «отделы». ACE: {JSON.stringify(counts)}
      </div>
      <div className="space-y-1">
        {mods.map(m => (
          <label key={m.id} className="flex items-center justify-between gap-2 py-1 border-b border-white/5">
            <span className="text-white/80">
              {m.name}
              <span className="text-white/40 block text-[9px]">{m.description}</span>
            </span>
            <input
              type="checkbox"
              checked={m.enabled}
              disabled={m.core}
              onChange={e => {
                moduleManager.setEnabled(m.id, e.target.checked);
                refresh();
              }}
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        className="w-full py-2 rounded-lg bg-white/10 border border-white/15 text-white/90"
        onClick={async () => {
          try {
            const r = await nfhSelfImprove.cycle();
            setReport(
              `score=${r.evaluatorScore.toFixed(2)}\n` +
                r.generatorNotes.join('\n') +
                '\n' +
                r.evaluatorNotes.join('\n')
            );
          } catch (e: any) {
            setReport(String(e?.message || e));
          }
          const extra = selfImproveLoop.runGenerator();
          setProps(selfImproveLoop.list());
          setReport(prev => prev + `\n+${extra.length} trait proposals`);
        }}
      >
        Цикл самоанализа (NFH)
      </button>
      {report && (
        <pre className="text-[9px] text-white/60 whitespace-pre-wrap bg-black/30 p-2 rounded max-h-32 overflow-y-auto">
          {report}
        </pre>
      )}

      <div className="text-[#FFB020] font-bold text-[10px]">Предложения (нужно одобрение)</div>
      {props.filter(p => p.status === 'pending').length === 0 && (
        <div className="text-white/40 text-[10px]">Нет pending — запусти цикл</div>
      )}
      {props
        .filter(p => p.status === 'pending')
        .map(p => (
          <div key={p.id} className="p-2 rounded bg-black/30 border border-white/10 space-y-1">
            <div className="text-white font-bold">{p.title}</div>
            <div className="text-white/60 text-[10px]">{p.explanationRu}</div>
            <div className="text-red-300/80 text-[9px]">Риск: {p.riskRu}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-1 rounded bg-[#00FF94]/15 text-[#00FF94]"
                onClick={() => {
                  selfImproveLoop.approve(p.id);
                  refresh();
                }}
              >
                Одобрить
              </button>
              <button
                type="button"
                className="flex-1 py-1 rounded bg-white/10 text-white/70"
                onClick={() => {
                  selfImproveLoop.reject(p.id);
                  refresh();
                }}
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      <button
        type="button"
        className="w-full py-1.5 rounded border border-[#FF3B30]/40 text-[#FF3B30]"
        onClick={() => {
          const r = selfImproveLoop.rollbackLast();
          alert(r.msg);
          refresh();
        }}
      >
        Rollback последнего снимка traits
      </button>
    </div>
  );
};
