/**
 * Multi-Tiered Memory Architecture Inspector Component.
 * Full Russian UI for exploring STM, LTM categories, promotion priority,
 * neural pathways, memory search, manual entry, and consolidation.
 */

import React, { useState, useEffect } from 'react';
import { MemoryItem } from '../types';
import { memoryEngine } from '../services/memoryEngine';
import { Database, Search, Plus, Trash2, Zap, Brain, Layers, Cpu, ShieldCheck } from 'lucide-react';

interface MemoryInspectorProps {
  onMemoryUpdate?: () => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ onMemoryUpdate }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'stm' | 'self' | 'user' | 'relationship' | 'world' | 'topic'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [stmMemories, setStmMemories] = useState<MemoryItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Memory Form State
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('user');
  const [newTopic, setNewTopic] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newWeight, setNewWeight] = useState(5);

  const refreshMemories = () => {
    setMemories(memoryEngine.getAllMemories());
    setStmMemories(memoryEngine.getShortTermMemories());
    if (onMemoryUpdate) onMemoryUpdate();
  };

  useEffect(() => {
    refreshMemories();
  }, []);

  const handleConsolidate = () => {
    const res = memoryEngine.consolidateMemories();
    alert(`Консолидация выполнена успешно!\nОбновлено элементов: ${res.consolidatedCount}\nСоздано новых нейронных путей: ${res.neuralPathwaysCreated}`);
    refreshMemories();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить этот фрагмент памяти Курису?')) {
      memoryEngine.deleteMemory(id);
      refreshMemories();
    }
  };

  const handleAddMemory = () => {
    if (!newContent.trim()) return;
    memoryEngine.addLongTermMemory(newCategory, newContent.trim(), newTopic.trim() || undefined, newWeight);
    setNewTopic('');
    setNewContent('');
    setShowAddModal(false);
    refreshMemories();
  };

  // Filtered List
  const displayedMemories = () => {
    let list: MemoryItem[] = [];
    if (activeCategory === 'stm') {
      list = stmMemories;
    } else if (activeCategory === 'all') {
      list = memories;
    } else {
      list = memoryEngine.getMemoriesByCategory(activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        m =>
          m.content.toLowerCase().includes(q) ||
          (m.topicName && m.topicName.toLowerCase().includes(q))
      );
    }
    return list;
  };

  const categories = [
    { id: 'all', label: 'Вся память' },
    { id: 'stm', label: 'Краткосрочная (STM)' },
    { id: 'self', label: 'О себе (Self)' },
    { id: 'user', label: 'О пользователе (User)' },
    { id: 'relationship', label: 'Отношения' },
    { id: 'world', label: 'Знания о мире' },
    { id: 'topic', label: 'Темы и науки' },
  ];

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col h-full min-h-[500px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#FF3B30]" />
            Многоуровневая Архитектура Памяти ИИ
          </h3>
          <p className="text-xs text-white/70 mt-0.5">
            STM (50 FIFO) • Категоризированная LTM • Нейронные пути
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30]/20 hover:bg-[#FF3B30]/30 text-white text-xs font-mono rounded-lg border border-[#FF3B30]/40 transition-all active:scale-95 shadow-[0_0_8px_rgba(255,59,48,0.3)]"
            title="Консолидировать частые темы в нейронные пути"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Консолидация
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded-lg border border-white/10 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-[#00FF94]" />
            Добавить
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="my-4 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 text-xs rounded-lg font-mono whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-[#FF3B30] text-white shadow-[0_0_8px_rgba(255,59,48,0.4)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по памяти, темам и нейронным узлам..."
            className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-[#FF3B30] font-sans"
          />
        </div>
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {displayedMemories().length === 0 ? (
          <div className="text-center py-10 text-white/40 text-xs font-mono">
            Записей памяти в выбранной категории не найдено.
          </div>
        ) : (
          displayedMemories().map((item) => (
            <div
              key={item.id}
              className="bg-white/5 p-3.5 rounded-xl border border-white/5 hover:border-white/20 transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#FF3B30] font-medium text-[10px] uppercase bg-[#FF3B30]/10 px-2 py-0.5 rounded border border-[#FF3B30]/30">
                    {item.topicName || item.category}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    Обращений: {item.accessCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.retentionPriority === 'neural_pathway' && (
                    <span className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Нейронный путь
                    </span>
                  )}
                  {item.retentionPriority === 'frequent' && (
                    <span className="text-[10px] text-[#00FF94] bg-[#00FF94]/10 px-2 py-0.5 rounded border border-[#00FF94]/30 font-mono">
                      Частая тема
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-white/40 hover:text-[#FF3B30] transition-colors p-1"
                    title="Удалить фрагмент"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-white/90 leading-relaxed font-sans">{item.content}</p>

              <div className="text-[10px] text-white/40 font-mono pt-1 border-t border-white/5 flex items-center justify-between">
                <span>Важность: {item.emotionalWeight}/10</span>
                <span>{new Date(item.timestamp).toLocaleString('ru-RU')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#050508]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A12] border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF3B30]" /> Добавить новую запись в LTM
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-white/60 mb-1">Категория</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="user" className="bg-[#0A0A12]">О пользователе (User)</option>
                  <option value="self" className="bg-[#0A0A12]">О Курису (Self)</option>
                  <option value="relationship" className="bg-[#0A0A12]">Отношения (Relationship)</option>
                  <option value="world" className="bg-[#0A0A12]">Знания о мире (World)</option>
                  <option value="topic" className="bg-[#0A0A12]">Глубокие науки (Topic)</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Название темы</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Например: Любимая музыка, Нейробиология..."
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2 focus:outline-none focus:border-[#FF3B30]"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Содержание памяти</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Запишите факт или воспоминание..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2 focus:outline-none focus:border-[#FF3B30]"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Эмоциональный вес ({newWeight}/10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newWeight}
                  onChange={(e) => setNewWeight(Number(e.target.value))}
                  className="w-full accent-[#FF3B30]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 bg-white/5 text-white/80 text-xs rounded-lg hover:bg-white/10"
              >
                Отмена
              </button>
              <button
                onClick={handleAddMemory}
                className="px-4 py-1.5 bg-[#FF3B30] text-white text-xs font-medium rounded-lg hover:bg-[#FF3B30]/90 shadow-[0_0_8px_rgba(255,59,48,0.4)]"
              >
                Сохранить в LTM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
