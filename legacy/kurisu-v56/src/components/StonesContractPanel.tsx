import React, { useMemo, useState } from 'react';
import { kurisuStones } from '../brain/kurisuStones';
import { worldlineContract } from '../brain/worldlineContract';

export const StonesContractPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  const stones = useMemo(() => kurisuStones.list(), [tick]);
  const contract = useMemo(() => worldlineContract.get(), [tick]);
  const [stoneText, setStoneText] = useState('');
  const [kind, setKind] = useState<'user' | 'us' | 'rule'>('user');
  const [cWho, setCWho] = useState(contract.whoYouAreToMe);
  const [cMe, setCMe] = useState(contract.whoIAmToYou);
  const [cBound, setCBound] = useState(contract.boundaries);
  const [cGoal, setCGoal] = useState(contract.sharedGoal);

  const refresh = () => setTick(x => x + 1);

  return (
    <div className="p-3 space-y-4 text-[11px] font-mono text-white/80 max-h-[70vh] overflow-y-auto">
      <div>
        <div className="text-[#FF3B30] font-bold mb-1">Камни (неизменное)</div>
        <p className="text-white/50 mb-2">Факты о нас, которые не должны смываться summary.</p>
        <ul className="space-y-1 mb-2">
          {stones.map(s => (
            <li key={s.id} className="border border-white/10 rounded px-2 py-1 flex justify-between gap-2">
              <span>
                <span className="text-[#5AC8FA]">({s.kind})</span> {s.text}
              </span>
              {!s.locked && (
                <button
                  type="button"
                  className="text-[#FF3B30] shrink-0"
                  onClick={() => {
                    kurisuStones.remove(s.id);
                    refresh();
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1 items-center">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as any)}
            className="bg-black/40 border border-white/20 rounded px-1 py-0.5"
          >
            <option value="user">user</option>
            <option value="us">us</option>
            <option value="rule">rule</option>
          </select>
          <input
            value={stoneText}
            onChange={e => setStoneText(e.target.value)}
            placeholder="Новый камень…"
            className="flex-1 min-w-[120px] bg-black/40 border border-white/20 rounded px-2 py-0.5"
          />
          <button
            type="button"
            className="px-2 py-0.5 border border-[#00FF94]/40 text-[#00FF94] rounded"
            onClick={() => {
              if (!stoneText.trim()) return;
              kurisuStones.add(kind, stoneText.trim());
              setStoneText('');
              refresh();
            }}
          >
            +
          </button>
        </div>
      </div>

      <div>
        <div className="text-[#FF9F0A] font-bold mb-1">Контракт линии</div>
        <label className="block text-white/50">Ты для меня</label>
        <textarea
          value={cWho}
          onChange={e => setCWho(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded p-1 mb-1 min-h-[48px]"
        />
        <label className="block text-white/50">Я для тебя</label>
        <textarea
          value={cMe}
          onChange={e => setCMe(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded p-1 mb-1 min-h-[48px]"
        />
        <label className="block text-white/50">Границы</label>
        <textarea
          value={cBound}
          onChange={e => setCBound(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded p-1 mb-1 min-h-[48px]"
        />
        <label className="block text-white/50">Общая цель</label>
        <textarea
          value={cGoal}
          onChange={e => setCGoal(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded p-1 mb-1 min-h-[48px]"
        />
        <button
          type="button"
          className="px-2 py-1 border border-[#FF9F0A]/40 text-[#FF9F0A] rounded"
          onClick={() => {
            worldlineContract.update({
              whoYouAreToMe: cWho,
              whoIAmToYou: cMe,
              boundaries: cBound,
              sharedGoal: cGoal
            });
            refresh();
          }}
        >
          Сохранить контракт
        </button>
      </div>
    </div>
  );
};
