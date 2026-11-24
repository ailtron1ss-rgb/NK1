import React, { useState } from 'react';
import { moduleManager, BrainModule } from '../brain/ModuleManager';
import { nfhSelfImprove } from '../brain/NfhSelfImprove';
import { brainHub } from '../brain/BrainHub';

export const ModuleManagerPanel: React.FC = () => {
  const [list, setList] = useState<BrainModule[]>(() => moduleManager.list());
  const [report, setReport] = useState('');
  const status = brainHub.status();

  return (
    <div className="space-y-3 p-3 rounded-xl bg-[#5AC8FA]/5 border border-[#5AC8FA]/25">
      <div className="text-[11px] font-mono text-[#5AC8FA] font-bold uppercase">
        Модульный мозг (Hub)
      </div>
      <div className="text-[10px] text-white/50 font-mono">
        ACE: P{status.ace.persona} E{status.ace.episodic} W{status.ace.working} M{status.ace.micro}
      </div>
      {list.map(m => (
        <label
          key={m.id}
          className="flex items-start gap-2 p-2 rounded-lg bg-black/30 border border-white/10"
        >
          <input
            type="checkbox"
            checked={m.enabled}
            disabled={m.core}
            onChange={e => {
              moduleManager.setEnabled(m.id, e.target.checked);
              setList(moduleManager.list());
            }}
          />
          <span className="text-[11px] font-mono text-white">
            <b>{m.name}</b>
            <span className="block text-[9px] text-white/45">{m.description}</span>
          </span>
        </label>
      ))}
      <button
        type="button"
        className="w-full py-2 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-[11px]"
        onClick={async () => {
          const r = await nfhSelfImprove.cycle();
          setReport(
            [...r.generatorNotes, ...r.evaluatorNotes, `score=${r.evaluatorScore}`].join('\n')
          );
        }}
      >
        NFH: цикл самоанализа (без авто-правки кода)
      </button>
      {report && (
        <pre className="text-[9px] text-white/70 whitespace-pre-wrap bg-black/40 p-2 rounded max-h-40 overflow-y-auto">
          {report}
        </pre>
      )}
    </div>
  );
};
