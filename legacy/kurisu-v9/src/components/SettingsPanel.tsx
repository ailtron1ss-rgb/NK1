/**
 * Comprehensive Settings Panel Component for Kurisu AI Companion.
 * 100% Russian UI for Voice, Avatar, Memory Export/Import, AI Plugins,
 * Privacy, Theme, and Font customization.
 */

import React, { useState } from 'react';
import { AppState, VoiceSettings, AvatarSettings, PluginConfig } from '../types';
import { Volume2, Sliders, UserCheck, Download, Upload, Key, Palette, Type, Shield, HardDrive, Cpu } from 'lucide-react';
import { neuralLocalEngine } from '../services/neuralLocalEngine';
import { LOCAL_MODELS, getActiveLocalModelId } from '../brain/modelManager';
import { brain } from '../brain/BrainOrchestrator';

interface SettingsPanelProps {
  appState: AppState;
  onUpdateVoice: (voice: Partial<VoiceSettings>) => void;
  onUpdateAvatar: (avatar: Partial<AvatarSettings>) => void;
  onUpdateAppState: (state: Partial<AppState>) => void;
  onExportMemory: () => void;
  onImportMemory: (jsonStr: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  appState,
  onUpdateVoice,
  onUpdateAvatar,
  onUpdateAppState,
  onExportMemory,
  onImportMemory
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'avatar' | 'memory' | 'plugins' | 'theme'>('voice');
  const [importJsonInput, setImportJsonInput] = useState('');
  const [neuralStatus, setNeuralStatus] = useState(neuralLocalEngine.getStatus());

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onImportMemory(reader.result);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="pb-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#FF3B30]" />
            Панель Настроек Companion (Параметры ИИ)
          </h3>
        </div>
        <p className="text-xs text-white/70 mt-0.5">Управление голосом, 3D аватаром, памятью и плагинами ИИ</p>

        {/* Phase Implementation Roadmap Status */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="bg-[#00FF94]/10 border border-[#00FF94]/30 p-2 rounded-lg text-[#00FF94]">
            <div className="font-bold flex items-center justify-between">
              <span>ФАЗА 1 (MVP)</span>
              <span>100%</span>
            </div>
            <p className="text-[9px] text-white/70 mt-1">Compose UI • ONNX Neural Offline • Persona • Room LTM</p>
          </div>

          <div className="bg-[#5AC8FA]/10 border border-[#5AC8FA]/30 p-2 rounded-lg text-[#5AC8FA]">
            <div className="font-bold flex items-center justify-between">
              <span>ФАЗА 2 (ENHANCED)</span>
              <span>90%</span>
            </div>
            <p className="text-[9px] text-white/70 mt-1">RAG Поиск • СМС • Экспорт / Импорт State</p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 p-2 rounded-lg text-purple-300">
            <div className="font-bold flex items-center justify-between">
              <span>ФАЗА 3 (ADVANCED)</span>
              <span>ПЛАН</span>
            </div>
            <p className="text-[9px] text-white/70 mt-1">3D SceneForm • Внешняя Модульная Система</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 my-4 overflow-x-auto no-scrollbar pb-2 text-xs font-mono">
        {[
          { id: 'voice', label: 'Голос и Синтез', icon: Volume2 },
          { id: 'avatar', label: '3D Аватар', icon: UserCheck },
          { id: 'autonomous', label: 'Автономия и СМС', icon: Shield },
          { id: 'memory', label: 'Память и Бэкап', icon: HardDrive },
          { id: 'plugins', label: 'Плагины ИИ', icon: Key },
          { id: 'theme', label: 'Тема и Шрифты', icon: Palette }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#FF3B30] text-white shadow-[0_0_10px_rgba(255,59,48,0.4)] font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
        {/* 1. VOICE TAB */}
        {activeTab === 'voice' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div>
                <label className="block text-white/80 font-medium mb-1">Высота голоса (Pitch: {appState.voice.pitch}x)</label>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={appState.voice.pitch}
                  onChange={(e) => onUpdateVoice({ pitch: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF3B30]"
                />
                <span className="text-[10px] text-white/40">Рекомендуется 1.1x (+5% к тону Курису)</span>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-1">Скорость речи (Speed: {appState.voice.speed}x)</label>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={appState.voice.speed}
                  onChange={(e) => onUpdateVoice({ speed: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF3B30]"
                />
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-1">Громкость (Volume: {Math.round(appState.voice.volume * 100)}%)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={appState.voice.volume}
                  onChange={(e) => onUpdateVoice({ volume: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF3B30]"
                />
              </div>

              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-white/80 font-sans">
                  <input
                    type="checkbox"
                    checked={appState.voice.wakeWordEnabled}
                    onChange={(e) => onUpdateVoice({ wakeWordEnabled: e.target.checked })}
                    className="accent-[#FF3B30]"
                  />
                  <span>Активация по кодовому слову "Крис" (Wake Word)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-white/80 font-sans">
                  <input
                    type="checkbox"
                    checked={appState.voice.autoSpeak}
                    onChange={(e) => onUpdateVoice({ autoSpeak: e.target.checked })}
                    className="accent-[#FF3B30]"
                  />
                  <span>Автоматическая озвучка всех ответов Курису</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 2. AVATAR TAB */}
        {activeTab === 'avatar' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div>
                <label className="block text-white/80 font-medium mb-1">Костюм Курису (Outfit)</label>
                <select
                  value={appState.avatar.outfit}
                  onChange={(e) => onUpdateAvatar({ outfit: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2.5 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="lab_coat" className="bg-[#0A0A12]">Белый лабораторный халат (Лаборатория #004)</option>
                  <option value="casual_uniform" className="bg-[#0A0A12]">Повседневная форма школьницы</option>
                  <option value="summer_dress" className="bg-[#0A0A12]">Летнее платье</option>
                  <option value="mayqueen_maid" className="bg-[#0A0A12]">Форма MayQueen NyanNyan</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-1">Очки (Glasses Frame)</label>
                <select
                  value={appState.avatar.glasses}
                  onChange={(e) => onUpdateAvatar({ glasses: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2.5 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="red_frame" className="bg-[#0A0A12]">Красная оправа (Каноничная)</option>
                  <option value="black_frame" className="bg-[#0A0A12]">Черная строгая оправа</option>
                  <option value="none" className="bg-[#0A0A12]">Без очков</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-1">3D Локация (Environment Background)</label>
                <select
                  value={appState.avatar.background}
                  onChange={(e) => onUpdateAvatar({ background: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2.5 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="lab" className="bg-[#0A0A12]">Лаборатория гаджетов будущего (Lab #004)</option>
                  <option value="seminar_room" className="bg-[#0A0A12]">Зал семинаров института Виктор Кондрия</option>
                  <option value="cafe" className="bg-[#0A0A12]">Кафе MayQueen Nyan Nyan</option>
                  <option value="time_machine" className="bg-[#0A0A12]">Кабина машины времени FG204</option>
                  <option value="starship" className="bg-[#0A0A12]">Космический мостик Amadeus</option>
                </select>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-white/80 font-sans">
                  <input
                    type="checkbox"
                    checked={appState.avatar.lipSyncEnabled}
                    onChange={(e) => onUpdateAvatar({ lipSyncEnabled: e.target.checked })}
                    className="accent-[#FF3B30]"
                  />
                  <span>Синхронизация губ с речью (Dynamic Lip-Sync)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-white/80 font-sans">
                  <input
                    type="checkbox"
                    checked={appState.avatar.eyeTrackingEnabled}
                    onChange={(e) => onUpdateAvatar({ eyeTrackingEnabled: e.target.checked })}
                    className="accent-[#FF3B30]"
                  />
                  <span>Отслеживание взгляда и лица курсора (Eye Tracking)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 2b. AUTONOMOUS & SMS TAB */}
        {activeTab === ('autonomous' as any) && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-1">Свобода Действий и Самостоятельная Инициатива</h4>
                <p className="text-[11px] text-white/50 mb-3">
                  Курису не просто ждет ваших команд. Она может сама инициировать разговор, делиться научными вопросами, комментировать споры на @channel или присылать СМС-уведомления, если вы давно не заходили в приложение.
                </p>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-white/90 font-medium">
                    <input
                      type="checkbox"
                      checked={appState.autonomous?.enabled ?? true}
                      onChange={(e) =>
                        onUpdateAppState({
                          autonomous: { ...(appState.autonomous || { idleIntervalMinutes: 2, allowBrowserNotifications: true, autoSendSMS: true }), enabled: e.target.checked }
                        })
                      }
                      className="accent-[#FF3B30] w-4 h-4"
                    />
                    <span>Включить автономную инициативу диалога</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-white/90 font-medium">
                    <input
                      type="checkbox"
                      checked={appState.autonomous?.allowBrowserNotifications ?? true}
                      onChange={(e) =>
                        onUpdateAppState({
                          autonomous: { ...(appState.autonomous || { enabled: true, idleIntervalMinutes: 2, autoSendSMS: true }), allowBrowserNotifications: e.target.checked }
                        })
                      }
                      className="accent-[#FF3B30] w-4 h-4"
                    />
                    <span>Разрешить системные Push-уведомления браузера</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-white/90 font-medium">
                    <input
                      type="checkbox"
                      checked={appState.autonomous?.autoSendSMS ?? true}
                      onChange={(e) =>
                        onUpdateAppState({
                          autonomous: { ...(appState.autonomous || { enabled: true, idleIntervalMinutes: 2, allowBrowserNotifications: true }), autoSendSMS: e.target.checked }
                        })
                      }
                      className="accent-[#FF3B30] w-4 h-4"
                    />
                    <span>Симулировать приход СМС от Курису в шторку уведомлений</span>
                  </label>

                  <div className="pt-2">
                    <label className="block text-white/80 font-medium mb-1">
                      Интервал автономной активности (Idle Interval: {appState.autonomous?.idleIntervalMinutes ?? 2} мин)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={appState.autonomous?.idleIntervalMinutes ?? 2}
                      onChange={(e) =>
                        onUpdateAppState({
                          autonomous: {
                            ...(appState.autonomous || { enabled: true, allowBrowserNotifications: true, autoSendSMS: true }),
                            idleIntervalMinutes: parseInt(e.target.value)
                          }
                        })
                      }
                      className="w-full accent-[#FF3B30]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-1">Экспорт состояния ИИ (Full State Export)</h4>
                <p className="text-[11px] text-white/50 mb-2">Сохранить всю память, эмоции и настройки в JSON файл.</p>
                <button
                  onClick={onExportMemory}
                  className="px-4 py-2 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white text-xs font-mono rounded-lg flex items-center gap-2 shadow-[0_0_10px_rgba(255,59,48,0.4)]"
                >
                  <Download className="w-4 h-4" /> Экспортировать в JSON
                </button>
              </div>

              <div className="pt-3 border-t border-white/5">
                <h4 className="font-semibold text-white mb-1">Импорт состояния из JSON</h4>
                <p className="text-[11px] text-white/50 mb-2">Восстановить память и этап отношений из файла backup.</p>
                <label className="cursor-pointer px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded-lg inline-flex items-center gap-2 border border-white/10">
                  <Upload className="w-4 h-4 text-[#00FF94]" /> Выбрать JSON файл
                  <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 4. PLUGINS TAB */}
        {activeTab === 'plugins' && (
          <div className="space-y-4">
            {/* On-Device TFLite Engine Box */}
            <div className="bg-[#00FF94]/5 p-4 rounded-xl border border-[#00FF94]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-[#00FF94] font-mono flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#00FF94]" /> On-Device Neural LLM
                  </h4>
                  <p className="text-[11px] text-white/60 mt-1">
                    Реальная компактная ONNX языковая модель запускается прямо в браузере телефона через Transformers.js. WebGPU используется при наличии, иначе WASM. Модель загружается только после включения — это экономит память и трафик на среднем Android.
                  </p>
                </div>
                <span className="text-[10px] text-[#00FF94] bg-[#00FF94]/20 px-2.5 py-1 rounded-lg border border-[#00FF94]/40 font-mono font-bold">
                  {neuralStatus.enabled ? (neuralStatus.loaded ? 'ЗАГРУЖЕНА' : 'ВКЛЮЧЕНА • ОЖИДАЕТ ЗАГРУЗКИ') : 'ВЫКЛЮЧЕНА'}
                </span>
              </div>

              <button
                onClick={() => {
                  neuralLocalEngine.setEnabled(!neuralStatus.enabled);
                  setNeuralStatus(neuralLocalEngine.getStatus());
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-mono text-[11px]"
              >
                {neuralStatus.enabled ? 'Отключить локальную нейросеть' : 'Включить локальную нейросеть (скачает выбранную модель)'}
              </button>

              <div className="space-y-2">
                <div className="text-[10px] text-white/50 font-mono uppercase">Локальные модели (одна активна)</div>
                {LOCAL_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      neuralLocalEngine.selectModel(m.id);
                      setNeuralStatus(neuralLocalEngine.getStatus());
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border font-mono text-[11px] ${
                      getActiveLocalModelId() === m.id
                        ? 'border-[#00FF94]/50 bg-[#00FF94]/10 text-[#00FF94]'
                        : 'border-white/10 bg-white/5 text-white/80'
                    }`}
                  >
                    <div className="font-bold">{m.name} · ~{m.approxMB} МБ</div>
                    <div className="text-[10px] text-white/50">{m.ramHint} · Q{m.quality}/S{m.speed} · {m.notes}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  const r = brain.consolidateMemory();
                  alert(r.detail);
                }}
                className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 font-mono text-[11px]"
              >
                Консолидация памяти (очистка шума)
              </button>
              <button
                onClick={() => {
                  const r = brain.sleep();
                  alert(`Сон\n${r.daySummary}\n\n${r.morningQuestion}`);
                }}
                className="w-full py-2 rounded-xl bg-[#5AC8FA]/10 border border-[#5AC8FA]/30 text-[#5AC8FA] font-mono text-[11px]"
              >
                Режим сна (ночная консолидация)
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                  <span className="text-white/40 block text-[9px]">БЭКЕНД ИСПОЛНЕНИЯ</span>
                  <span className="text-white font-bold">{neuralStatus.device}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                  <span className="text-white/40 block text-[9px]">КВАНТОВАНИЕ ВЕСОВ</span>
                  <span className="text-[#00FF94] font-bold">ONNX Q4 / Q4F16</span>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                  <span className="text-white/40 block text-[9px]">ЗАДЕРЖКА ТЕНЗОРОВ</span>
                  <span className="text-amber-300 font-bold">{neuralStatus.loaded ? 'Модель готова' : 'Зависит от телефона'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <h4 className="font-semibold text-white">Подключенные модели ИИ</h4>
              <p className="text-[11px] text-white/50">
                Курису использует выбранную облачную модель при наличии API ключей, с автоматическим переключением на локальную ONNX-нейросеть, если она включена.
              </p>

              {appState.plugins.map((plugin) => (
                <div key={plugin.id} className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[#FF3B30] font-medium">{plugin.name}</span>
                    <span className="text-[10px] text-white/40 block font-mono">Провайдер: {plugin.provider}</span>
                  </div>
                  <span className="text-[10px] text-[#00FF94] bg-[#00FF94]/10 px-2 py-0.5 rounded border border-[#00FF94]/30 font-mono">
                    Активен
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. THEME TAB */}
        {activeTab === 'theme' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div>
                <label className="block text-white/80 font-medium mb-1">Стиль шрифта (Font Style)</label>
                <select
                  value={appState.fontStyle}
                  onChange={(e) => onUpdateAppState({ fontStyle: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2.5 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="system" className="bg-[#0A0A12]">Системный (System Default)</option>
                  <option value="serif" className="bg-[#0A0A12]">Научный сердитый (Serif Academic)</option>
                  <option value="monospace" className="bg-[#0A0A12]">Технологический (Monospace Sci-Fi)</option>
                  <option value="handwriting" className="bg-[#0A0A12]">Рукописный аниме (Cute Handwriting)</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 font-medium mb-1">Размер шрифта UI</label>
                <select
                  value={appState.fontSize}
                  onChange={(e) => onUpdateAppState({ fontSize: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-2.5 focus:outline-none focus:border-[#FF3B30]"
                >
                  <option value="small" className="bg-[#0A0A12]">Маленький (Compact)</option>
                  <option value="medium" className="bg-[#0A0A12]">Средний (Standard)</option>
                  <option value="large" className="bg-[#0A0A12]">Большой (Large)</option>
                  <option value="xlarge" className="bg-[#0A0A12]">Очень большой (Extra Large)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
