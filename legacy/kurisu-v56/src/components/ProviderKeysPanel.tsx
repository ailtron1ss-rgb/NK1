import React, { useState } from 'react';
import {
  loadProviders,
  saveProviders,
  ProviderConfig,
  getActiveCloudProvider,
  modelsFor,
  listGeminiModels,
  ProviderId
} from '../services/providerConfig';

export const ProviderKeysPanel: React.FC = () => {
  const [list, setList] = useState<ProviderConfig[]>(() => loadProviders());
  const [testMsg, setTestMsg] = useState('');
  const [listed, setListed] = useState<string[]>([]);

  const update = (id: string, patch: Partial<ProviderConfig> & { _userPickedModel?: boolean }) => {
    const next = list.map(p => (p.id === id ? { ...p, ...patch } : p));
    setList(next);
    saveProviders(next);
  };

  const testActive = async () => {
    const p = getActiveCloudProvider();
    if (!p) {
      setTestMsg('Нет активного облака: включи провайдера и вставь ключ.');
      return;
    }
    setTestMsg(`Проверка ${p.name} / ${p.model}…`);
    try {
      if (p.id === 'gemini') {
        // try selected + fallbacks quickly
        const models = [p.model, ...modelsFor('gemini')].filter((v, i, a) => a.indexOf(v) === i);
        let ok = '';
        let err = '';
        for (const model of models.slice(0, 6)) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${p.apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Ответь одним словом: ок' }] }],
              generationConfig: { maxOutputTokens: 8 }
            })
          });
          if (res.ok) {
            ok = model;
            update('gemini', { model, _userPickedModel: true } as any);
            break;
          }
          err = `${model}: HTTP ${res.status}`;
        }
        if (ok) setTestMsg(`✅ Работает модель: ${ok}`);
        else setTestMsg(`❌ Ни одна модель не ответила. ${err}`);
      } else {
        const res = await fetch(`${p.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p.apiKey}`
          },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: 'user', content: 'Reply: ok' }],
            max_tokens: 8
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
        setTestMsg(`✅ ${p.name} / ${p.model} работает`);
      }
    } catch (e: any) {
      setTestMsg(`❌ ${e?.message || e}`);
    }
  };

  const fetchGeminiList = async () => {
    const g = list.find(p => p.id === 'gemini');
    if (!g?.apiKey) {
      setTestMsg('Сначала вставь Gemini API key');
      return;
    }
    setTestMsg('Запрос списка моделей у Google…');
    try {
      const names = await listGeminiModels(g.apiKey);
      setListed(names);
      setTestMsg(`Доступно моделей: ${names.length}. Выбери из списка ниже.`);
    } catch (e: any) {
      setTestMsg(`❌ listModels: ${e?.message || e}`);
    }
  };

  const active = getActiveCloudProvider();

  return (
    <div className="space-y-3 p-3 rounded-xl bg-[#FF3B30]/5 border border-[#FF3B30]/25">
      <div className="text-[11px] font-mono text-[#FF3B30] font-bold uppercase">
        Облачные нейросети
      </div>
      <div className="text-[10px] text-white/50 font-mono leading-relaxed">
        Активный: {active ? `${active.name} · ${active.model}` : 'НЕТ (template/local)'}. Ключ только на устройстве.
        Новым ключам Gemini часто <b>недоступен 2.5</b> — ставь <b>gemini-2.0-flash</b> или нажми «Проверить» (автоподбор).
      </div>

      {list
        .filter(p => p.id !== 'local')
        .map(p => {
          const catalog = modelsFor(p.id as ProviderId);
          const options = p.id === 'gemini' && listed.length ? listed : catalog;
          return (
            <div key={p.id} className="space-y-1.5 p-2 rounded-lg bg-black/30 border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-white font-bold">{p.name}</span>
                <label className="text-[10px] font-mono text-white/60 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={e => update(p.id, { enabled: e.target.checked })}
                  />
                  вкл
                </label>
              </div>
              <input
                type="password"
                autoComplete="off"
                placeholder={`API key · ${p.freeNote}`}
                value={p.apiKey}
                onChange={e => update(p.id, { apiKey: e.target.value.trim() })}
                className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/15 text-white text-[11px] font-mono"
              />
              <div className="text-[9px] text-white/40 font-mono">Модель</div>
              <select
                value={options.includes(p.model) ? p.model : p.model}
                onChange={e => update(p.id, { model: e.target.value, _userPickedModel: true } as any)}
                className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/15 text-white text-[11px] font-mono"
              >
                {!options.includes(p.model) && (
                  <option value={p.model}>{p.model} (текущая)</option>
                )}
                {options.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={p.model}
                onChange={e => update(p.id, { model: e.target.value, _userPickedModel: true } as any)}
                placeholder="или введи model id вручную"
                className="w-full px-2 py-1 rounded bg-black/30 border border-white/10 text-white/80 text-[10px] font-mono"
              />
            </div>
          );
        })}

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={testActive}
          className="w-full py-2.5 rounded-xl bg-[#00FF94]/15 border border-[#00FF94]/40 text-[#00FF94] font-mono text-[11px] font-bold"
        >
          Проверить ключ (автоподбор модели)
        </button>
        <button
          type="button"
          onClick={fetchGeminiList}
          className="w-full py-2 rounded-xl bg-[#5AC8FA]/10 border border-[#5AC8FA]/30 text-[#5AC8FA] font-mono text-[11px]"
        >
          Запросить список моделей Gemini с сервера
        </button>
      </div>
      {testMsg && (
        <div className="text-[10px] font-mono text-white/80 whitespace-pre-wrap bg-black/40 p-2 rounded">
          {testMsg}
        </div>
      )}
      <div className="text-[9px] text-white/40 font-mono leading-relaxed">
        Gemini key: aistudio.google.com/apikey · Groq: console.groq.com · OpenRouter: openrouter.ai/keys
      </div>
    </div>
  );
};
