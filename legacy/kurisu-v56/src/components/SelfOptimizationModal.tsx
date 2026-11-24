/**
 * Self-Optimization Framework & Code Diagnostic Modal.
 * Kurisu analyzes her codebase, visualizes her Cognitive Load (Memory vs Inference balance),
 * generates performance improvement reports in Russian, requires explicit user consent, and supports one-tap rollbacks.
 */

import React, { useState } from 'react';
import { SelfOptimizationReport } from '../types';
import { 
  Cpu, 
  ShieldAlert, 
  CheckCircle, 
  RotateCcw, 
  Activity, 
  FileText,
  Brain,
  Zap,
  Database,
  Gauge,
  Sliders,
  BarChart3,
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';

interface SelfOptimizationModalProps {
  report: SelfOptimizationReport | null;
  onApprove: () => void;
  onRollback: () => void;
  onClose: () => void;
  onGenerateReport: () => void;
  isLoading: boolean;
}

export const SelfOptimizationModal: React.FC<SelfOptimizationModalProps> = ({
  report,
  onApprove,
  onRollback,
  onClose,
  onGenerateReport,
  isLoading
}) => {
  const [approved, setApproved] = useState(report?.approved || false);
  const [activeTab, setActiveTab] = useState<'cognitive_load' | 'report_details'>('cognitive_load');
  const [allocationProfile, setAllocationProfile] = useState<'balanced' | 'fast_inference' | 'deep_memory'>('balanced');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);

  const handleApprove = () => {
    setApproved(true);
    onApprove();
  };

  const handleRunStressTest = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setSimulationCount(prev => prev + 1);
    }, 1200);
  };

  // Base metrics calculated dynamically
  const profileMultipliers = {
    balanced: { mem: 1.0, lat: 1.0, speed: 1.0, stress: 1.0 },
    fast_inference: { mem: 1.25, lat: 0.65, speed: 1.5, stress: 0.8 },
    deep_memory: { mem: 0.6, lat: 1.3, speed: 0.85, stress: 1.15 }
  };

  const mult = profileMultipliers[allocationProfile];

  // Base values
  const currentMemoryLoad = Math.round(78 * mult.mem);
  const currentLatency = Math.round(85 * mult.lat);
  const currentSpeedTps = Math.round(48 * mult.speed);
  const currentStress = Math.min(98, Math.round(72 * mult.stress));

  // Projected values post-optimization
  const optimizedMemoryLoad = Math.round(currentMemoryLoad * 0.58);
  const optimizedLatency = Math.max(12, Math.round(currentLatency * 0.52));
  const optimizedSpeedTps = Math.round(currentSpeedTps * 1.6);
  const optimizedStress = Math.round(currentStress * 0.45);

  return (
    <div className="fixed inset-0 bg-[#050508]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0A0A12] border border-[#FF3B30]/30 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-[0_0_50px_rgba(255,59,48,0.15)] space-y-5 text-slate-100 font-sans my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FF3B30]/20 border border-[#FF3B30]/40 text-[#FF3B30] shadow-[0_0_12px_rgba(255,59,48,0.3)]">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono text-white tracking-wide">
                  Фреймворк Самооптимизации и Когнитивной Нагрузки
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40 font-bold uppercase">
                  Amadeus OS
                </span>
              </div>
              <p className="text-xs text-white/60">Диагностический аудит синаптической памяти и скорости вывода</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-xs font-mono px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all cursor-pointer"
          >
            ✕ Закрыть
          </button>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-xl font-mono text-xs">
          <button
            onClick={() => setActiveTab('cognitive_load')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all cursor-pointer ${
              activeTab === 'cognitive_load'
                ? 'bg-[#FF3B30]/20 border border-[#FF3B30]/50 text-white shadow-[0_0_10px_rgba(255,59,48,0.2)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span>Карта Нагрузки (Cognitive Load)</span>
          </button>

          <button
            onClick={() => setActiveTab('report_details')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all cursor-pointer ${
              activeTab === 'report_details'
                ? 'bg-[#00FF94]/20 border border-[#00FF94]/50 text-white shadow-[0_0_10px_rgba(0,255,148,0.2)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#00FF94]" />
            <span>Отчет и Аудит ({report ? '1 Доступен' : 'Пусто'})</span>
          </button>
        </div>

        {/* TAB 1: COGNITIVE LOAD DIAGNOSTIC VIEW */}
        {activeTab === 'cognitive_load' && (
          <div className="space-y-4">
            {/* Top Balance Summary Card */}
            <div className="bg-gradient-to-br from-white/5 to-[#0A0A12] border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#FF3B30] animate-pulse" />
                  <span className="font-bold text-white uppercase tracking-wider">
                    Баланс Вывода и Памяти (Inference / Memory Trade-off)
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  currentStress > 80 ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                  currentStress > 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  'bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40'
                }`}>
                  {approved ? 'Оптимизировано' : currentStress > 70 ? 'Высокая Нагрузка' : 'Умеренный Баланс'}
                </span>
              </div>

              {/* Cognitive Stress Multi-Bar Visualizer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Current Cognitive Load */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white/60 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[#5AC8FA]" /> Загрузка ОЗУ Памяти:
                    </span>
                    <span className="font-bold text-[#5AC8FA]">
                      {approved ? optimizedMemoryLoad : currentMemoryLoad}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#5AC8FA] h-full transition-all duration-700 shadow-[0_0_8px_#5AC8FA]"
                      style={{ width: `${approved ? optimizedMemoryLoad : currentMemoryLoad}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 font-mono">
                    {approved ? 'Векторные индексы сжаты INT8' : 'Емкость LTM: 128/150 синапсов активны'}
                  </p>
                </div>

                {/* Inference Speed & Latency */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white/60 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#00FF94]" /> Скорость Вывода (Inference):
                    </span>
                    <span className="font-bold text-[#00FF94]">
                      {approved ? optimizedSpeedTps : currentSpeedTps} токенов/сек
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#00FF94] h-full transition-all duration-700 shadow-[0_0_8px_#00FF94]"
                      style={{ width: `${Math.min(100, (approved ? optimizedSpeedTps : currentSpeedTps) * 1.2)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 font-mono">
                    Задержка: <span className="text-white font-bold">{approved ? optimizedLatency : currentLatency} ms</span> ({approved ? 'WASM Direct Threading' : 'Стандартный WebGL'})
                  </p>
                </div>
              </div>

              {/* Kurisu Commentary Quote */}
              <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl p-3 text-xs space-y-1 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-[#FF3B30] font-mono font-bold text-[11px] uppercase flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Аналитический комментарий Курису:
                  </span>
                  <span className="text-[10px] font-mono text-white/40">Amadeus Core v2.4</span>
                </div>
                <p className="text-white/90 italic leading-relaxed text-[11px]">
                  {approved 
                    ? '«Отлично! Синаптическая задержка снизилась почти вдвое, а буфер памяти больше не испытывает квантового переполнения. Теперь я могу обрабатывать твои запросы без задержек!»'
                    : currentStress > 70 
                    ? '«Слушай... Когда количество активных контекстных гипотез превышает норму, моя задержка отклика растет. Если мы применим квантование вектора памяти, нагрузка снизится на 42% без потери точности!»'
                    : '«Текущая когнитивная нагрузка в норме, однако профиль можно оптимизировать под еще более быстрый отклик.»'}
                </p>
              </div>
            </div>

            {/* Allocation Profiles Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-white/70 font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#FF3B30]" /> Профиль Балансировки Нейросети:
                </span>
                <span className="text-[10px] text-white/40">Интерактивная пренастройка</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAllocationProfile('balanced')}
                  className={`p-2.5 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    allocationProfile === 'balanced'
                      ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-white shadow-[0_0_12px_rgba(255,59,48,0.25)]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>⚖️ Баланс Amadeus</span>
                  </div>
                  <div className="text-[9px] text-white/50 mt-1">
                    50% Память / 50% Скорость
                  </div>
                </button>

                <button
                  onClick={() => setAllocationProfile('fast_inference')}
                  className={`p-2.5 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    allocationProfile === 'fast_inference'
                      ? 'bg-[#00FF94]/20 border-[#00FF94] text-white shadow-[0_0_12px_rgba(0,255,148,0.25)]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>⚡ Ультра-Скорость</span>
                  </div>
                  <div className="text-[9px] text-white/50 mt-1">
                    Минимальная задержка (&lt;20ms)
                  </div>
                </button>

                <button
                  onClick={() => setAllocationProfile('deep_memory')}
                  className={`p-2.5 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    allocationProfile === 'deep_memory'
                      ? 'bg-[#5AC8FA]/20 border-[#5AC8FA] text-white shadow-[0_0_12px_rgba(90,200,250,0.25)]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>🧠 Глубокая Память</span>
                  </div>
                  <div className="text-[9px] text-white/50 mt-1">
                    Максимум LTM гипотез
                  </div>
                </button>
              </div>
            </div>

            {/* Live Diagnostic Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-center">
                <span className="text-[10px] text-white/40 block">Индекс Стресса</span>
                <span className={`font-bold text-sm ${approved ? 'text-[#00FF94]' : 'text-[#FF3B30]'}`}>
                  {approved ? optimizedStress : currentStress}%
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-center">
                <span className="text-[10px] text-white/40 block">Кеш Векторов</span>
                <span className="font-bold text-sm text-[#5AC8FA]">
                  {approved ? '99.4%' : '68.2%'}
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-center">
                <span className="text-[10px] text-white/40 block">WASM Потоки</span>
                <span className="font-bold text-sm text-amber-300">
                  {approved ? '4 Active (SIMD)' : '1 Thread'}
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-center">
                <span className="text-[10px] text-white/40 block">Тестов пройдено</span>
                <span className="font-bold text-sm text-white">
                  {simulationCount}
                </span>
              </div>
            </div>

            {/* Actions for Cognitive Load Tab */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={handleRunStressTest}
                disabled={isSimulating}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-mono text-xs rounded-xl border border-white/10 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#5AC8FA] ${isSimulating ? 'animate-spin' : ''}`} />
                <span>{isSimulating ? 'Тестирование импульсов...' : 'Запустить Тест Нагрузки'}</span>
              </button>

              {!report ? (
                <button
                  onClick={() => {
                    onGenerateReport();
                    setActiveTab('report_details');
                  }}
                  disabled={isLoading}
                  className="px-5 py-2 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white font-mono font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(255,59,48,0.4)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Генерация отчета...' : 'Сгенерировать Отчет Оптимизации'}
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('report_details')}
                  className="px-5 py-2 bg-[#00FF94] hover:bg-[#00FF94]/90 text-slate-950 font-mono font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(0,255,148,0.4)] transition-all active:scale-95 cursor-pointer"
                >
                  Перейти к Отчету Оптимизации →
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REPORT DETAILS & CONSENT AUDIT */}
        {activeTab === 'report_details' && (
          <div>
            {!report ? (
              <div className="text-center py-10 space-y-4">
                <BarChart3 className="w-10 h-10 text-white/30 mx-auto animate-bounce" />
                <p className="text-xs text-white/60 max-w-md mx-auto">
                  Курису проведет подробный аудит своего нейронного кода, проанализирует алгоритмы запросов к памяти и составит официальный отчет с предложением оптимизации.
                </p>
                <button
                  onClick={onGenerateReport}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-[#FF3B30] hover:bg-[#FF3B30]/90 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl shadow-[0_0_16px_rgba(255,59,48,0.4)] transition-all active:scale-95 cursor-pointer"
                >
                  {isLoading ? 'Анализ синапсов ИИ...' : 'Сгенерировать Отчет Оптимизации'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Title & Category Header */}
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-[#FF3B30] font-bold uppercase tracking-wider">{report.category}</span>
                    <span className="text-white/40">{new Date(report.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-semibold text-white text-sm font-sans">{report.title}</h4>
                </div>

                {/* Benchmarks Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 text-center">
                    <span className="text-[10px] text-white/40 block font-mono">Снижение задержки</span>
                    <span className="font-mono text-[#00FF94] font-bold text-sm shadow-[0_0_6px_#00FF94]">
                      {report.benchmarks.latencyReduction}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 text-center">
                    <span className="text-[10px] text-white/40 block font-mono">Эффективность памяти</span>
                    <span className="font-mono text-[#5AC8FA] font-bold text-sm shadow-[0_0_6px_#5AC8FA]">
                      {report.benchmarks.memoryEfficiency}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 text-center">
                    <span className="text-[10px] text-white/40 block font-mono">Точность отклика</span>
                    <span className="font-mono text-amber-300 font-bold text-sm">
                      {report.benchmarks.accuracyBoost}
                    </span>
                  </div>
                </div>

                {/* Mobile Architecture Optimization Banners */}
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="bg-gradient-to-r from-[#FF3B30]/20 to-[#00FF94]/20 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#00FF94]" />
                      <span>Мобильный Профиль: INT8 Квантование для Смартфонов</span>
                    </div>
                    <span className="text-[#00FF94] font-bold">100% ARM Совместимость</span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#5AC8FA]" />
                      <span>On-Device Исполнение: ONNX Neural + WASM/WebGPU</span>
                    </div>
                    <span className="text-[#5AC8FA] font-bold">Офлайн 0ms Задержка</span>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-center gap-2 text-[10px] text-amber-200">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Защитный барьер: Рекомендации формируются в естественном языке. Автоматическое переписывание кода без согласия пользователя строго запрещено.
                    </span>
                  </div>
                </div>

                {/* Report Details Narrative */}
                <div className="space-y-2.5 bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div>
                    <span className="font-mono text-[#FF3B30] font-medium">Что изменится:</span>
                    <p className="text-white/80 mt-0.5 leading-relaxed">{report.whatWillChange}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[#00FF94] font-medium">Почему станет лучше:</span>
                    <p className="text-white/80 mt-0.5 leading-relaxed">{report.whyBetter}</p>
                  </div>

                  <div>
                    <span className="font-mono text-amber-300 font-medium">Потенциальные риски:</span>
                    <p className="text-white/80 mt-0.5 leading-relaxed">{report.potentialRisks}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[#5AC8FA] font-medium">План отката (Rollback):</span>
                    <p className="text-white/80 mt-0.5 leading-relaxed">{report.rollbackPlan}</p>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                  {approved ? (
                    <div className="flex items-center gap-2 text-[#00FF94] font-mono text-xs shadow-[0_0_6px_#00FF94]">
                      <CheckCircle className="w-4 h-4" />
                      <span>Оптимизация успешно применена!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-300 font-mono text-[11px]">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Требуется явное согласие пользователя</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onRollback}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg font-mono flex items-center gap-1 border border-white/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Откат
                    </button>

                    {!approved && (
                      <button
                        onClick={handleApprove}
                        className="px-4 py-1.5 bg-[#00FF94] hover:bg-[#00FF94]/90 text-slate-950 font-bold text-xs rounded-lg shadow-[0_0_10px_#00FF94] font-mono cursor-pointer"
                      >
                        Подтвердить и Применить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
