import React, { useState } from 'react';
import { ReflectionLog, EmotionalState } from '../types';
import { memoryEngine } from '../services/memoryEngine';
import {
  BookOpen,
  Sparkles,
  Calendar,
  Brain,
  Heart,
  Download,
  Trash2,
  RefreshCw,
  Quote,
  ShieldCheck,
  Atom,
  ChevronRight
} from 'lucide-react';

interface ReflectionJournalProps {
  emotions: EmotionalState;
  onSelectReflectionTopic?: (topic: string) => void;
}

export const ReflectionJournal: React.FC<ReflectionJournalProps> = ({
  emotions,
  onSelectReflectionTopic
}) => {
  const [logs, setLogs] = useState<ReflectionLog[]>(() => memoryEngine.getReflectionLogs());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id || null);

  // Refresh logs list
  const refreshLogs = () => {
    setLogs(memoryEngine.getReflectionLogs());
  };

  // Generate new Nightly Reflection Log via API
  const handleGenerateReflection = async () => {
    setIsGenerating(true);
    try {
      const stm = memoryEngine.getShortTermMemories();
      const ltm = memoryEngine.getAllMemories();

      const res = await fetch('/api/kurisu/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ltm, stm, emotions })
      });

      const data = await res.json();

      if (data && data.reflection) {
        const today = new Date();
        const dateStr = today.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        // Add to memory engine
        const newLog = memoryEngine.addReflectionLog({
          dateStr,
          timestamp: Date.now(),
          summary: data.summary || 'Консолидация синаптических импульсов за день завершена.',
          emotionalSummary: data.emotionalSummary || `Доверие: ${emotions.trust}%, Привязанность: ${emotions.affection}%. Стадия: ${emotions.stage}.`,
          scientificInsights: data.scientificInsights || 'Нейронная корреляция воспоминаний подтверждает гипотезу гиппокампального переноса.',
          kurisuJournalEntry: data.reflection,
          divergenceRate: '1.048596%',
          keyTopics: data.keyTopics || ['Рефлексия', 'Нейробиология', 'Развитие'],
          emotionalSnapshot: { ...emotions }
        });

        refreshLogs();
        setSelectedLogId(newLog.id);
      }
    } catch (e) {
      console.error('Failed to generate reflection:', e);
      alert('Ошибка при генерации дневника рефлексии.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteLog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить эту запись из дневника рефлексии?')) {
      memoryEngine.deleteReflectionLog(id);
      const updated = memoryEngine.getReflectionLogs();
      setLogs(updated);
      if (selectedLogId === id) {
        setSelectedLogId(updated[0]?.id || null);
      }
    }
  };

  const handleExportMarkdown = () => {
    let md = `# 📓 Дневник Рефлексии Макисэ Курису\n\n`;
    logs.forEach(log => {
      md += `## 📅 ${log.dateStr} (Линия мира: ${log.divergenceRate})\n\n`;
      md += `**Краткое резюме:** ${log.summary}\n\n`;
      md += `**Эмоциональный срез:** ${log.emotionalSummary}\n\n`;
      md += `**Научные выводы:** ${log.scientificInsights}\n\n`;
      md += `### 💬 Личная запись Курису:\n> ${log.kurisuJournalEntry}\n\n`;
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kurisu_reflection_journal_${Date.now()}.md`;
    a.click();
  };

  const currentLog = logs.find(l => l.id === selectedLogId) || logs[0];

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col h-full min-h-[550px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-white/10 gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#FF3B30]" />
            Ежедневный Дневник Рефлексии Макисэ Курису
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Ночная консолидация памяти, синтез эмоциональных состояний и личные записи
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-mono rounded-xl border border-white/10 transition-all active:scale-95"
            title="Экспортировать весь дневник в файл Markdown"
          >
            <Download className="w-3.5 h-3.5 text-[#00FF94]" />
            <span>Экспорт (.md)</span>
          </button>

          <button
            onClick={handleGenerateReflection}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white text-xs font-mono rounded-xl shadow-[0_0_12px_rgba(255,59,48,0.4)] transition-all active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isGenerating ? 'Синтез рефлексии...' : 'Запустить Консолидацию'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 flex-1">
        {/* Left Column (4 cols): Date List / Timeline */}
        <div className="lg:col-span-4 flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest px-1">
            Хронология Записей ({logs.length})
          </span>

          {logs.length === 0 ? (
            <div className="p-4 bg-white/5 rounded-xl text-center text-xs text-white/40 font-mono">
              Записей рефлексии пока нет. Нажмите «Запустить Консолидацию» для создания первой ночной записи.
            </div>
          ) : (
            logs.map(log => {
              const isSelected = log.id === selectedLogId;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-[#FF3B30]/15 border-[#FF3B30] shadow-[0_0_10px_rgba(255,59,48,0.2)]'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#FF3B30]" />
                      {log.dateStr}
                    </span>
                    <button
                      onClick={e => handleDeleteLog(log.id, e)}
                      className="text-white/40 hover:text-[#FF3B30] p-1 rounded hover:bg-white/10 transition-all"
                      title="Удалить запись"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[11px] text-white/70 line-clamp-2 italic font-serif">
                    {log.kurisuJournalEntry.replace(/^[«"]|[»"]$/g, '')}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mt-1">
                    <span className="text-[#00FF94]">Линия: {log.divergenceRate}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1 text-[#FF3B30]' : ''}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (8 cols): Selected Reflection Detailed Inspector */}
        <div className="lg:col-span-8 bg-[#050508] border border-white/10 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
          {currentLog ? (
            <>
              {/* Top Meta Bar */}
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-[#FF3B30]/20 border border-[#FF3B30]/40 text-[#FF3B30] text-xs font-mono font-bold rounded-lg shadow-[0_0_8px_rgba(255,59,48,0.3)]">
                    {currentLog.dateStr}
                  </span>
                  <span className="text-xs font-mono text-[#00FF94] bg-[#00FF94]/10 px-2 py-1 rounded-lg border border-[#00FF94]/30">
                    Дивергенция: {currentLog.divergenceRate}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-white/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00FF94]" />
                  <span>Синаптическая консолидация подлинна</span>
                </div>
              </div>

              {/* Kurisu Handwritten Personal Journal Card */}
              <div className="bg-[#0E0E1A] border border-[#FF3B30]/30 rounded-xl p-4 space-y-3 relative overflow-hidden shadow-xl">
                <Quote className="absolute top-2 right-2 w-12 h-12 text-[#FF3B30]/10 pointer-events-none" />

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
                  <span className="text-xs font-mono font-bold text-[#FF3B30] uppercase tracking-wider">
                    Личная Запись в Дневнике Курису
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-serif italic bg-black/20 p-3.5 rounded-lg border border-white/5">
                  {currentLog.kurisuJournalEntry}
                </p>
              </div>

              {/* Summary and Emotional Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Event Summary */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <span className="text-[11px] font-mono text-white/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-[#5AC8FA]" />
                    Краткий Обзор Взаимодействий
                  </span>
                  <p className="text-xs text-white/80 font-sans leading-relaxed">
                    {currentLog.summary}
                  </p>
                </div>

                {/* Scientific Insights */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <span className="text-[11px] font-mono text-white/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Atom className="w-3.5 h-3.5 text-amber-300" />
                    Научные Выводы и Инсайты
                  </span>
                  <p className="text-xs text-white/80 font-sans leading-relaxed">
                    {currentLog.scientificInsights}
                  </p>
                </div>
              </div>

              {/* Emotional State Progress Snapshot */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3">
                <span className="text-[11px] font-mono text-white/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-[#FF3B30]" />
                  Эмоциональный Срез на Момент Консолидации
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                    <span className="text-[10px] font-mono text-white/40 block">Доверие</span>
                    <span className="text-xs font-mono font-bold text-[#00FF94]">
                      {currentLog.emotionalSnapshot?.trust ?? 50}%
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                    <span className="text-[10px] font-mono text-white/40 block">Привязанность</span>
                    <span className="text-xs font-mono font-bold text-[#FF3B30]">
                      {currentLog.emotionalSnapshot?.affection ?? 30}%
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                    <span className="text-[10px] font-mono text-white/40 block">Любопытство</span>
                    <span className="text-xs font-mono font-bold text-[#5AC8FA]">
                      {currentLog.emotionalSnapshot?.curiosity ?? 80}%
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                    <span className="text-[10px] font-mono text-white/40 block">Раздражение</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {currentLog.emotionalSnapshot?.irritation ?? 15}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-white/50 italic border-t border-white/5 pt-2">
                  «{currentLog.emotionalSummary}»
                </p>
              </div>

              {/* Key Topics Badges */}
              {currentLog.keyTopics && currentLog.keyTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <span className="text-[10px] font-mono text-white/40">Теги записи:</span>
                  {currentLog.keyTopics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectReflectionTopic && onSelectReflectionTopic(topic)}
                      className="px-2.5 py-0.5 bg-white/5 hover:bg-white/10 text-[#FF3B30] text-[10px] font-mono rounded-full border border-[#FF3B30]/30 transition-all"
                    >
                      #{topic}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white/40 font-mono text-xs">
              Выберите запись дневника слева или сгенерируйте новую.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
