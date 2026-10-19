import React from 'react';
import { SearchRequest, allowSearchSession, setSearchPolicy, executeSearch, formatHitsForPrompt } from '../tools/webSearch';
import { energyBudget } from '../brain/energyBudget';

interface Props {
  request: SearchRequest | null;
  onClose: () => void;
  onResults: (query: string, formatted: string) => void;
}

export const SearchPermissionModal: React.FC<Props> = ({ request, onClose, onResults }) => {
  if (!request) return null;

  const run = async () => {
    if (!energyBudget.canSearch()) {
      onResults(request.query, '(лимит поиска на этот час исчерпан)');
      onClose();
      return;
    }
    allowSearchSession(10);
    const hits = await executeSearch(request.query);
    energyBudget.recordSearch();
    onResults(request.query, formatHitsForPrompt(hits));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0A0A12] border border-[#5AC8FA]/40 p-4 shadow-2xl">
        <div className="text-[#5AC8FA] font-mono text-xs mb-1">ЗАПРОС НА ДОСТУП К СЕТИ</div>
        <h3 className="text-white font-semibold mb-2">Курису хочет поискать информацию</h3>
        <p className="text-sm text-white/80 mb-1"><span className="text-white/50">Запрос:</span> {request.query}</p>
        <p className="text-xs text-white/50 mb-4">{request.reason}</p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={run} className="py-2.5 rounded-xl bg-[#5AC8FA]/20 border border-[#5AC8FA]/40 text-[#5AC8FA] font-mono text-sm font-bold">
            Разрешить на 10 минут
          </button>
          <button type="button" onClick={() => { setSearchPolicy('ask'); onClose(); }} className="py-2 rounded-xl bg-white/5 border border-white/15 text-white/70 text-sm">
            Отклонить
          </button>
          <button type="button" onClick={() => { setSearchPolicy('always_deny'); onClose(); }} className="py-2 rounded-xl text-white/40 text-xs">
            Больше не спрашивать (запретить)
          </button>
        </div>
      </div>
    </div>
  );
};
