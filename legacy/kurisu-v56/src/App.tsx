/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  AppState,
  ChatMessage,
  EmotionalState,
  AvatarExpression,
  VoiceSettings,
  AvatarSettings,
  SelfOptimizationReport
} from './types';
import { INITIAL_EMOTIONAL_STATE } from './data/kurisuCanon';
import { memoryEngine } from './services/memoryEngine';
import { ttsEngine } from './services/ttsEngine';
import { embodimentBus } from './services/embodimentBus';;

// Components
import { Avatar2D } from './components/Avatar2D';
import { LiveAvatar, OutfitPicker } from './components/LiveAvatar';
import { Live2DAvatar } from './components/Live2DAvatar';
import { ConsciousnessHUD } from './components/ConsciousnessHUD';
import { emotionAffect } from './psyche/EmotionAffectSystem';
import { FeelingsHUD } from './components/FeelingsHUD';
import { NeuralLatticePanel } from './components/NeuralLatticePanel';
import { HierarchyMindPanel } from './components/HierarchyMindPanel';
import { TraitsPanel } from './components/TraitsPanel';
import { multiLayerConsciousness } from './cognitive/MultiLayerConsciousness';
import { thinkingDelayMs } from './cognitive/NeuroEngine';
import { logger } from './services/logger';
import { DevPanel } from './components/DevPanel';
import { powerGovernor } from './services/powerGovernor';
import { runtimeGovernor } from './services/runtimeGovernor';
import { synergyOrchestrator } from './synergy/SynergyOrchestrator';
import { PromiseStrip } from './components/PromiseStrip';
import { DailyPlanStrip } from './components/DailyPlanStrip';
import { SpriteGallery } from './components/SpriteGallery';
import { SocialContractPanel } from './components/SocialContractPanel';
import { StonesContractPanel } from './components/StonesContractPanel';
import { narrativeLog } from './brain/narrativeLog';
import { followUpEngine } from './brain/followUpEngine';
import { goldStyleStore } from './brain/goldStyleStore';
import { attentionEconomy } from './brain/attentionEconomy';
import { eventBus } from './brain/eventBus';
import { checkUserContradiction } from './brain/contradictionGuard';
import { maybeMicroDream } from './brain/microDream';
import { buildWakeMessage } from './brain/continuityHandshake';
import { innerMonologue } from './brain/innerMonologue';
import { curiosityDrive } from './brain/curiosityDrive';
import { userModel } from './brain/userModel';
import { dailyPlan } from './brain/dailyPlan';
import { emotionAffect } from './psyche/EmotionAffectSystem';
import { neuralPathways } from './psyche/NeuralPathwayGraph';
import { perceptionModel } from './psyche/PerceptionModel';
import { personalityCore } from './psyche/PersonalityCore';
import { OutfitId } from './avatar/outfitCatalog';
import { ChatView } from './components/ChatView';
import { EmotionalStatePanel } from './components/EmotionalStatePanel';
import { MemoryInspector } from './components/MemoryInspector';
import { MultimodalCamera } from './components/MultimodalCamera';
import { SettingsPanel } from './components/SettingsPanel';
import { SelfOptimizationModal } from './components/SelfOptimizationModal';
import { AndroidCodeExportModal } from './components/AndroidCodeExportModal';
import { ReflectionJournal } from './components/ReflectionJournal';
import { PersonalityMapPanel } from './components/PersonalityMapPanel';

// Services
import { notificationEngine, SMSNotification } from './services/notificationEngine';
import { chatService } from './services/chatService';
import { speechOnlyForTTS } from './services/responseHygiene';
import { tokenMeter } from './services/tokenMeter';
import { TokenStatusBar } from './components/TokenStatusBar';
import { VoiceControls } from './components/VoiceControls';
import { localLLMEngine } from './services/localLLMEngine';
import { autonomousEngine } from './services/autonomousEngine';
import { autonomyDrives } from './cognitive/AutonomyDrives';
import { selfImprovementEngine } from './cognitive/SelfImprovementEngine';
import { neuralLocalEngine } from './services/neuralLocalEngine';
import { presenceAndIdle, ThoughtBubble } from './cognitive/PresenceAndIdle';
import { ThoughtBubbleOverlay } from './components/ThoughtBubbleOverlay';
import { SearchPermissionModal } from './components/SearchPermissionModal';
import { BrainMonitorPanel } from './components/BrainMonitorPanel';
import { classifyIntent } from './brain/intentRouter';
import { createSearchRequest, isSearchCurrentlyAllowed, type SearchRequest } from './tools/webSearch';

// Icons
import {
  MessageSquare,
  Brain,
  Eye,
  Sliders,
  Cpu,
  Smartphone,
  Sparkles,
  Layout,
  RefreshCw,
  BookOpen,
  UserCheck,
  Bell,
  Phone
} from 'lucide-react';

export default function App() {
  // App State
  const [appState, setAppState] = useState<AppState>(() => ({
    emotions: INITIAL_EMOTIONAL_STATE,
    voice: {
      pitch: 1.1,
      speed: 0.95,
      volume: 1.0,
      wakeWordEnabled: true,
      wakeWord: 'Крис',
      autoSpeak: true
    },
    avatar: {
      outfit: 'lab_coat',
      glasses: 'red_frame',
      hairstyle: 'classic_twintails',
      background: 'lab',
      lodQuality: 'high',
      lipSyncEnabled: true,
      eyeTrackingEnabled: true
    },
    plugins: [
      { id: 'p1', name: 'Gemini Flash Engine', provider: 'Gemini', enabled: true }
    ],
    fontStyle: 'system',
    fontSize: 'medium',
    themeAccent: '#e11d48',
    layoutMode: 'split',
    autonomous: {
      enabled: true,
      idleIntervalMinutes: 15,
      allowBrowserNotifications: true,
      autoSendSMS: true
    }
  }));

  // Expression & Speech State
  const [expression, setExpression] = useState<AvatarExpression>('neutral');
  const [outfitId, setOutfitId] = useState<OutfitId>('lab_coat');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('kurisu_focus') === '1');
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('kurisu_voice_on') !== '0');
  const [thoughtsOn, setThoughtsOn] = useState(() => localStorage.getItem('kurisu_thoughts_on') !== '0');
  const [tokenSnap, setTokenSnap] = useState(() => tokenMeter.snapshot());
  const [switchNote, setSwitchNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Active Tab View
  const [activeTab, setActiveTab] = useState<'chat' | 'sms' | 'journal' | 'personality' | 'memory' | 'vision' | 'settings' | 'brain' | 'gallery' | 'contract'>('chat');

  // Notifications State
  const [notifications, setNotifications] = useState<SMSNotification[]>([]);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // On-Device local neural/fallback inference state
  const [forceOffline, setForceOffline] = useState(false);
  const [thoughtBubbles, setThoughtBubbles] = useState<ThoughtBubble[]>([]);
  const [showFirstRunTip, setShowFirstRunTip] = useState(() => localStorage.getItem('kurisu_firstrun_done') !== '1');
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [inferenceInfo, setInferenceInfo] = useState<{
    mode: string;
    performanceMs: number;
    backendInfo?: string;
  }>({
    mode: 'local-fallback',
    performanceMs: 12.4,
    backendInfo: 'Lightweight fallback'
  });

  // Modals
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [optimizationReport, setOptimizationReport] = useState<SelfOptimizationReport | null>(null);
  const [showAndroidExportModal, setShowAndroidExportModal] = useState(false);

  // Last User Activity Timestamp for Autonomous Initiations
  const lastUserActivityRef = React.useRef<number>(Date.now());

  // Subscribe to Proactive Thoughts from Autonomous Engine
  useEffect(() => {
    const unsubProactive = autonomousEngine.onProactiveThought((thought) => {
      const proactiveMsg: ChatMessage = {
        id: `proactive_${thought.id}`,
        sender: 'kurisu',
        text: `💭 [Проактивная мысль • ${thought.timeOfDayLabel}]: ${thought.text}`,
        timestamp: thought.timestamp,
        expression: thought.expression
      };
      setMessages(prev => [...prev, proactiveMsg]);
      setExpression(thought.expression);
      memoryEngine.addShortTermMemory(`курису_проактивно: ${thought.text}`);

      if (appState.voice.autoSpeak) {
        setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {};
        if (voiceEnabled) ttsEngine.speak(speechOnlyForTTS(thought.text), appState.voice, () => { setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {} }, () => { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {} });
      }
    });

    return () => {
      unsubProactive();
    };
  }, [appState.voice]);

  // Autonomous Initiative & Proactive Thought Loop
  useEffect(() => {
    const checkIntervalMs = 5 * 60 * 1000; // Battery-friendly check every 5 min
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const settings = appState.autonomous;
      if (!settings?.enabled || !runtimeGovernor.shouldRunBackgroundWork()) return;

      // 1. Evaluate Proactive Thought based on Emotional State + Time of Day
      autonomousEngine.evaluateProactiveThought(appState.emotions);

      // 2. Check Idle Timeout Fallback
      const idleTimeMs = Date.now() - lastUserActivityRef.current;
      const thresholdMs = (settings.idleIntervalMinutes || 2) * 60 * 1000;

      if (idleTimeMs >= thresholdMs) {
        // Trigger autonomous message from Kurisu!
        lastUserActivityRef.current = Date.now(); // Reset timer
        try {
          // Drive-based fast initiative (from 2-main AutonomyEngine ideas)
          const driveLine = autonomyDrives.checkInitiative(Math.floor(idleTimeMs / 1000));
          if (driveLine) {
            const driveMsg: ChatMessage = {
              id: `drive_${Date.now()}`,
              sender: 'kurisu',
              text: driveLine,
              timestamp: Date.now(),
              expression: 'thinking'
            };
            setMessages(prev => [...prev, driveMsg]);
            setExpression('thinking');
            memoryEngine.addShortTermMemory(`курису_драйв: ${driveLine}`);
            return;
          }
          let data: { title?: string; text: string; expression?: AvatarExpression } | null = null;
          if (!forceOffline) {
            try {
              const res = await fetch('/api/kurisu/autonomous', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  emotions: appState.emotions,
                  ltm: memoryEngine.getLTM()
                })
              });
              if (res.ok) {
                data = await res.json();
              }
            } catch (netErr) {
              // Seamless network fallback to local LLM
            }
          }

          if (!data || !data.text) {
            data = localLLMEngine.generateAutonomousThought(appState.emotions);
          }

          if (data && data.text) {
            const newExpression = (data.expression as AvatarExpression) || 'thinking';
            setExpression(newExpression);

            // Add Chat Message
            const autoMsg: ChatMessage = {
              id: `auto_${Date.now()}`,
              sender: 'kurisu',
              text: data.text,
              timestamp: Date.now(),
              expression: newExpression
            };
            setMessages(prev => [...prev, autoMsg]);
            memoryEngine.addShortTermMemory(`курису_автономно: ${data.text}`);

            // Send Push / SMS Notification
            if (settings.allowBrowserNotifications) {
              const sms = notificationEngine.sendSMS(
                data.title || 'СМС от Курису',
                data.text,
                newExpression
              );
              setNotifications(prev => [sms, ...prev]);
            }

            // Speak if autoSpeak is enabled
            if (appState.voice.autoSpeak) {
              setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {};
              voiceEnabled && ttsEngine.speak(speechOnlyForTTS(String(data.text)), appState.voice, () => { setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {} }, () => { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {} });
            }
          }
        } catch (err) {
          // Silent catch for background timer safety
        }
      }
    }, checkIntervalMs);

    return () => clearInterval(timer);
  }, [appState.autonomous, appState.emotions, appState.voice]);

  useEffect(() => {
    synergyOrchestrator.startStreamingLoop();
    try { memoryEngine.seedDeepCanonOnce(); } catch { /* */ }
  }, []);

  useEffect(() => {
    const onNeuro = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.thoughts || !thoughtsOn) return;
      const lines = (d.thoughts as string[]).slice(0, 4);
      setThoughtBubbles(prev => [
        ...prev.slice(-2),
        ...lines.map((text, i) => ({
          id: `neuro_${Date.now()}_${i}`,
          text,
          createdAt: Date.now()
        } as any))
      ]);
      try {
        const expr = (window as any).__kurisuNeuro?.expressionHint;
        if (expr) setExpression(expr as any);
      } catch { /* */ }
    };
    window.addEventListener('kurisu-neuro-thought', onNeuro as any);
    return () => window.removeEventListener('kurisu-neuro-thought', onNeuro as any);
  }, [thoughtsOn]);

  useEffect(() => {
    const onSw = (e: Event) => {
      const msg = (e as CustomEvent).detail?.msg || '';
      setSwitchNote(msg);
      setTokenSnap(tokenMeter.snapshot());
    };
    window.addEventListener('kurisu-model-switch', onSw as any);
    const onPow = (e: Event) => {
      const n = (e as CustomEvent).detail?.note;
      if (n) setSwitchNote(n);
    };
    window.addEventListener('kurisu-power', onPow as any);

    /* neuro thoughts wired below */
    const id = setInterval(() => setTokenSnap(tokenMeter.snapshot()), 4000);
    return () => { window.removeEventListener('kurisu-model-switch', onSw as any); window.removeEventListener('kurisu-power', onPow as any); clearInterval(id); };
  }, []);

  // Presence & idle thought bubbles (every 8s) + optional follow-up
  useEffect(() => {
    const t = setInterval(() => {
      const fu = followUpEngine.poll();
      if (fu) {
        setMessages(prev => [...prev, {
          id: `fu_${Date.now()}`,
          sender: 'kurisu',
          text: fu,
          timestamp: Date.now(),
          expression: 'thinking'
        } as any]);
      }
      presenceAndIdle.tick(Date.now(), {
        curiosity: appState.emotions.curiosity / 100,
        trust: appState.emotions.trust / 100,
        conflict: appState.emotions.irritation / 100
      });
      setThoughtBubbles(presenceAndIdle.getBubbles());
      try {
        const a = emotionAffect.tick();
        (window as any).__kurisuAffect = {
          irritation: a.emotions.anger,
          affection: a.feelings.attachment,
          curiosity: a.feelings.intellectualHunger
        };
      } catch { /* */ }
      try {
        const cq = curiosityDrive.maybeQueue(appState.emotions.curiosity, lastUserActivityRef.current || 0);
        if (cq) {
          setMessages(prev => [...prev, {
            id: `cq_${Date.now()}`,
            sender: 'kurisu',
            text: cq,
            timestamp: Date.now(),
            expression: 'thinking'
          } as any]);
        }
      } catch { /* */ }
      try {
        const dream = maybeMicroDream(appState.emotions.curiosity);
        if (dream) {
          setThoughtBubbles(prev => [
            ...prev.slice(-4),
            { id: `d_${Date.now()}`, text: '…' + dream, createdAt: Date.now() } as any
          ]);
        }
      } catch { /* */ }
    }, 8000);
    return () => clearInterval(t);
  }, [appState.emotions.curiosity, appState.emotions.trust, appState.emotions.irritation]);

  // Chat History
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('kurisu_chat_v1');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length) return arr.slice(-200);
      }
    } catch { /* */ }

    let wake = 'Занимательно... Ты на связи. Я — Макисэ Курису. Не «Кристина» и не ассистент.';
    try {
      const post = localStorage.getItem('kurisu_post_sleep_wake');
      if (post) {
        wake = post;
        localStorage.removeItem('kurisu_post_sleep_wake');
      } else {
        wake = buildWakeMessage();
      }
    } catch { /* */ }
    return [{
      id: 'init_1',
      sender: 'kurisu',
      text: wake,
      timestamp: Date.now(),
      expression: 'neutral'
    }];
  });
  useEffect(() => {
    try { localStorage.setItem('kurisu_chat_v1', JSON.stringify(messages.slice(-200))); } catch {}
  }, [messages]);


  // Handle Send Message
  const handleSendMessage = async (text: string, imageData?: string) => {
    try { (window as any).__kurisuLastUser = text; } catch {}
    if (!text && !imageData) return;

    lastUserActivityRef.current = Date.now(); // Reset idle activity timer

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: text || 'Отправлено изображение',
      imageData,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    presenceAndIdle.noteUserActivity();
    const intent = classifyIntent(text);
    if (intent.needsWeb && !isSearchCurrentlyAllowed()) {
      setPendingUserText(text);
      setSearchRequest(createSearchRequest(text, 'Нужны актуальные данные из сети для точного ответа'));
      return;
    }
    eventBus.emit('user_message', { text: (text || '').slice(0, 200) });
    try { userModel.observeUserMessage(text || ''); } catch { /* */ }
    try {
      emotionAffect.onUserMessage(text || '', { contradiction: false });
      neuralPathways.associate(text || '', 0.6);
      perceptionModel.noteUser(true);
    } catch { /* */ }
    if (attentionEconomy.shouldSilence(text || '', appState.emotions.curiosity)) {
      const silenceMsg: ChatMessage = {
        id: `msg_k_sil_${Date.now()}`,
        sender: 'kurisu',
        text: '…Позже. Внимания почти не осталось — напиши, если это правда важно.',
        expression: 'tired' as any,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, silenceMsg]);
      setExpression('tired' as any);
      return;
    }
    attentionEconomy.spend('chat');
    const contra = checkUserContradiction(text || '');
    memoryEngine.addShortTermMemory(`пользователь: ${text}`);
    if (contra) {
      memoryEngine.addShortTermMemory(`система: ${contra}`);
      try { emotionAffect.onUserMessage(text || '', { contradiction: true }); perceptionModel.onThreat(8); } catch { /* */ }
    }
    try {
      const mono = innerMonologue.react({
        userText: text,
        curiosity: appState.emotions.curiosity,
        irritation: appState.emotions.irritation,
        contradiction: !!contra
      });
      innerMonologue.push(mono, false);
      setThoughtBubbles(prev => [...prev.slice(-3), { id: `im_${Date.now()}`, text: mono, createdAt: Date.now() } as any]);
    } catch { /* */ }
    setIsLoading(true);

    try {
      let kurisuText = '';
      let kurisuExpression: AvatarExpression = 'thinking';
      let trustDelta = 1;
      let affectionDelta = 1;
      let irritationDelta = 0;
      let curiosityDelta = 0;

      if (imageData) {
        // Vision Multimodal request
        const res = await fetch('/api/kurisu/multimodal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageData,
            prompt: text || 'Осмотри это фото и прокомментируй.'
          })
        });
        const data = await res.json();
        kurisuText = data.text || 'Я тщательно изучила это фото. Структура выглядит довольно интересной.';
        kurisuExpression = (data.expression as AvatarExpression) || 'thinking';
      } else {
        // Text Cognition via Unified Chat Service (cloud + optional local neural model)
        const response = await chatService.sendMessage(
          text,
          memoryEngine.getShortTermMemories().map(m => m.content),
          memoryEngine.getAllMemories(),
          appState.emotions
        );

        setInferenceInfo({
          mode: response.inferenceMode,
          performanceMs: response.performanceMs,
          backendInfo: response.backendInfo
        });

        kurisuText = response.text;
        kurisuExpression = response.expression;
        trustDelta = response.trustDelta;
        affectionDelta = response.affectionDelta;
        irritationDelta = response.irritationDelta;
        curiosityDelta = response.curiosityDelta;

        if (response.newTopic) {
          memoryEngine.addLongTermMemory('topic', kurisuText, response.newTopic, 7);
        }
      }

      // Human-like thinking pause
      try {
        const neuro = (window as any).__kurisuNeuro;
        const delay = neuro ? thinkingDelayMs(neuro) : 400;
        setExpression('thinking' as any);
        await new Promise(r => setTimeout(r, Math.min(delay, 1800)));
      } catch { /* */ }

      // Update Kurisu Response
      const kurisuMsg: ChatMessage = {
        id: `msg_k_${Date.now()}`,
        sender: 'kurisu',
        text: kurisuText,
        expression: kurisuExpression,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, kurisuMsg]);
      if (voiceEnabled) {
        try {
          setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {};
          ttsEngine.speak(speechOnlyForTTS(kurisuText || text || ""), appState.voice, undefined, () => { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {} });
        } catch { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {}; }
      }
      setTokenSnap(tokenMeter.snapshot());
      eventBus.emit('kurisu_reply', { text: kurisuText.slice(0, 160) });
      try { multiLayerConsciousness.end(kurisuText); } catch { /* */ }
      try { narrativeLog.add('Ответ: ' + kurisuText.slice(0, 100)); } catch { /* */ }
      try {
        neuralPathways.associate(kurisuText, 0.4);
        if (/не |нет|спор/i.test(kurisuText)) personalityCore.drift({ tsundere: 0.4, pride: 0.3, warmth: -0.2 });
        if (/интерес|почему|гипотез/i.test(kurisuText)) personalityCore.drift({ curiosity: 0.5, rigor: 0.3 });
        personalityCore.reinforceValue('truth', 0.002);
      } catch { /* */ }
      memoryEngine.addShortTermMemory(`курису: ${kurisuText}`);
      setExpression(kurisuExpression);
      followUpEngine.maybeSchedule({
        curiosity: appState.emotions.curiosity,
        lastReply: kurisuText,
        userMessage: text
      });

      // Update Emotional State Calculator
      setAppState(prev => {
        const newTrust = Math.min(100, Math.max(0, prev.emotions.trust + trustDelta));
        const newAffection = Math.min(100, Math.max(0, prev.emotions.affection + affectionDelta));

        let stage = prev.emotions.stage;
        if (newTrust > 85 && newAffection > 80) stage = 'TrustedCompanion';
        else if (newTrust > 65 && newAffection > 60) stage = 'CloseFriend';
        else if (newTrust > 45 && newAffection > 40) stage = 'Friend';

        return {
          ...prev,
          emotions: {
            ...prev.emotions,
            trust: newTrust,
            affection: newAffection,
            fatigue: Math.min(100, prev.emotions.fatigue + 2),
            stage
          }
        };
      });

      // Auto-Speak if enabled
      if (appState.voice.autoSpeak) {
        handlePlayAudio(kurisuText);
      }
    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Play Audio via TTS Engine
  const handlePlayAudio = (text: string) => {
    setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {};
    voiceEnabled && ttsEngine.speak(speechOnlyForTTS(String(text)),
      appState.voice,
      () => { setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {} },
      () => { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {} }
    );
  };

  // Interactive Touch Reaction Handler for 3D Model Body Parts
  const handleTouchBodyPart = (part: 'head' | 'face' | 'coat' | 'hand', partLabel: string) => {
    const trust = appState.emotions.trust;
    let text = '';
    let expr: AvatarExpression = 'flustered';
    let trustDelta = 0;
    let affectionDelta = 1;
    let irritationDelta = 0;

    if (part === 'head') {
      if (trust < 50) {
        text = "Ч-что ты делаешь?! Не гладь меня по голове, я тебе не ребёнок! (*смущенно отворачивается и поправляет челку*)";
        expr = 'flustered';
        irritationDelta = 2;
      } else {
        text = "Ч-что... Зачем ты гладишь меня? *тихо краснеет и поправляет волосы* Ладно, только не делай так при Окабэ, а то он снова начнет глупо шутить...";
        expr = 'embarrassed';
        affectionDelta = 2;
      }
    } else if (part === 'face') {
      text = "Ч-что за глупости?! *краснеет и слегка отталкивает руку* У меня на лице что-то есть, или ты просто проверяешь кинестетическую реакцию?!";
      expr = 'flustered';
      trustDelta = 1;
    } else if (part === 'coat') {
      text = "Эй, осторожнее с галстуком и халатом! Это официальный лабораторный дресс-код исследователя Института Виктор Кондрия.";
      expr = 'sarcastic';
    } else if (part === 'hand') {
      if (trust < 60) {
        text = "Хм? Рука? Ты хочешь проверить мой пульс или просто прикоснуться? *тихо пожимает плечами* Учти, я не привыкла к лишней тактильности!";
        expr = 'thinking';
      } else {
        text = "Твоя рука... довольно теплая. *тихо сжимает пальцы и смотрит в сторону* Не думай ничего лишнего, я просто проверяю кожно-гальваническую реакцию!";
        expr = 'tender';
        affectionDelta = 3;
      }
    }

    if (appState.voice.autoSpeak) {
      handlePlayAudio(text);
    }

    setExpression(expr);
    const kurisuMsg: ChatMessage = {
      id: `msg_k_touch_${Date.now()}`,
      sender: 'kurisu',
      text: `[Тактильный контакт: ${partLabel}] ${text}`,
      expression: expr,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, kurisuMsg]);
    if (voiceEnabled) {
      try {
        setIsSpeaking(true); try { embodimentBus.emit({ speaking: true }); } catch {};
        ttsEngine.speak(speechOnlyForTTS(text), appState.voice, undefined, () => { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {} });
      } catch { setIsSpeaking(false); try { embodimentBus.emit({ speaking: false }); } catch {}; }
    }

    setAppState(prev => ({
      ...prev,
      emotions: {
        ...prev.emotions,
        trust: Math.min(100, Math.max(0, prev.emotions.trust + trustDelta)),
        affection: Math.min(100, Math.max(0, prev.emotions.affection + affectionDelta)),
        irritation: Math.min(100, Math.max(0, prev.emotions.irritation + irritationDelta))
      }
    }));
  };

  // Rest / Recharge Handler
  const handleRest = () => {
    setAppState(prev => ({
      ...prev,
      emotions: {
        ...prev.emotions,
        fatigue: 0,
        happiness: Math.min(100, prev.emotions.happiness + 15),
        curiosity: 90
      }
    }));
    setExpression('tender');
    alert('Курису отдохнула. Ментальная усталость полностью восстановлена!');
  };

  // Self-Optimization Generation
  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const proposals = selfImprovementEngine.generateProposals({
        templateRatio: 0.28,
        memoryItems: memoryEngine.getAllMemories().length,
        pushCountToday: 0,
        conflictLevel: appState.emotions.irritation,
        avgReplyLen: messages.filter(m => m.sender === 'kurisu').slice(-10).reduce((n, m) => n + m.text.length, 0) / Math.max(1, messages.filter(m => m.sender === 'kurisu').slice(-10).length)
      });
      const p = proposals[0];
      if (!p) {
        setOptimizationReport({
          timestamp: Date.now(), category: 'Performance', title: 'Система в норме',
          whatWillChange: 'Ничего: измерения пока не показывают безопасной точки улучшения.',
          whyBetter: 'Стабильность важнее косметических изменений.', potentialRisks: 'Нет.',
          rollbackPlan: 'Не требуется.', benchmarks: { latencyReduction: '0%', memoryEfficiency: '0%', accuracyBoost: '0%' }, approved: false
        });
        return;
      }
      setOptimizationReport({
        timestamp: p.createdAt,
        category: p.category === 'performance' ? 'Performance' : p.category === 'memory' ? 'Intelligence' : 'Features',
        title: p.title, whatWillChange: p.diagnosis, whyBetter: p.benefits.join(' • '),
        potentialRisks: p.risks.join(' • '), rollbackPlan: p.rollbackPlan,
        benchmarks: { latencyReduction: 'измерить после применения', memoryEfficiency: 'измерить после применения', accuracyBoost: 'не обещается без тестов' }, approved: false
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveOptimization = () => {
    const p = selfImprovementEngine.getProposals().find(x => x.status === 'pending');
    if (!p) return;
    const result = selfImprovementEngine.approve(p.id, memoryEngine.exportFullStateJSON());
    if (!result.ok) { alert(result.message); return; }
    setOptimizationReport(prev => prev ? { ...prev, approved: true } : prev);
  };

  const handleRollbackOptimization = () => {
    const snap = selfImprovementEngine.getSnapshots()[0];
    if (!snap) { alert('Снимков для отката нет.'); return; }
    const result = selfImprovementEngine.rollback(snap.id);
    if (result.ok && result.cognitiveJson) memoryEngine.importFullStateJSON(result.cognitiveJson);
    alert(result.message);
  };

  // Export / Import
  const handleExportMemory = () => {
    const jsonStr = memoryEngine.exportFullStateJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kurisu_memory_export_${Date.now()}.json`;
    a.click();
  };

  const handleImportMemory = (jsonStr: string) => {
    const success = memoryEngine.importFullStateJSON(jsonStr);
    if (success) {
      alert('Память и данные Курису успешно импортированы!');
    } else {
      alert('Ошибка при импорте JSON файла.');
    }
  };

  // Font style CSS class builder
  const getFontClass = () => {
    switch (appState.fontStyle) {
      case 'serif': return 'font-serif';
      case 'monospace': return 'font-mono';
      case 'handwriting': return 'font-sans italic';
      default: return 'font-sans';
    }
  };

  return (
    <div className={`min-h-screen bg-[#050508] text-[#E0E0E6] ${getFontClass()} flex flex-col relative overflow-x-hidden selection:bg-[#FF3B30] selection:text-white`}>
      {showFirstRunTip && (
        <div className="z-50 mx-3 mt-3 p-4 rounded-2xl bg-[#0A0A12] border border-[#00FF94]/40 shadow-xl">
          <div className="text-sm font-bold text-[#00FF94] mb-1">Первый запуск — важно</div>
          <p className="text-xs text-white/80 leading-relaxed mb-3">
            Сейчас может работать шаблонный режим. Чтобы Курису думала по-настоящему:
            <br/>1) Settings → включи <b>локальную нейросеть</b> (скачает ~150 МБ один раз)
            <br/>2) или добавь бесплатный API-ключ (Gemini / Groq / OpenRouter)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('settings'); }}
              className="px-3 py-1.5 rounded-lg bg-[#00FF94]/20 border border-[#00FF94]/40 text-[#00FF94] text-xs font-bold"
            >
              Открыть Settings
            </button>
            <button
              onClick={() => {
                localStorage.setItem('kurisu_firstrun_done', '1');
                setShowFirstRunTip(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/70 text-xs"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
      {/* Radial Ambient Glow Background Layer */}
      <div className="absolute inset-0 opacity-25 pointer-events-none bg-radial-ambient" />

      {/* Top Header Navigation */}
      <header className="px-4 py-3 bg-[#08080C]/90 border-b border-white/10 sticky top-0 z-40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-2xl">
        {/* System Active & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#FF3B30] animate-pulse shadow-[0_0_8px_#FF3B30]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60 font-mono">Система: Активна</span>
              <span className="bg-[#FF3B30] text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                Цундэрэ Mode
              </span>
            </div>
            <h1 className="text-lg font-light tracking-tight text-white font-serif flex items-center gap-2">
              Макисэ Курису
              <span className="text-xs text-[#8B8B9E] font-mono">v1.0.4</span>
            </h1>
          </div>
        </div>

        {/* Focus mode */}
        <button
          type="button"
          onClick={() => {
            setFocusMode(v => {
              const n = !v;
              localStorage.setItem('kurisu_focus', n ? '1' : '0');
              if (n) setActiveTab('chat');
              return n;
            });
          }}
          className={`text-[10px] font-mono px-2 py-1 rounded-lg border mb-1 ${
            focusMode ? 'border-[#00FF94]/50 text-[#00FF94] bg-[#00FF94]/10' : 'border-white/15 text-white/50'
          }`}
        >
          {focusMode ? '◎ Фокус: только чат' : '○ Фокус-режим'}
        </button>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-mono backdrop-blur-md overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'chat', label: 'Чат и 3D Аватар', icon: MessageSquare },
            { id: 'sms', label: 'СМС и Звонки', icon: Phone },
            { id: 'journal', label: 'Дневник', icon: BookOpen },
            { id: 'personality', label: 'Личность', icon: UserCheck },
            { id: 'memory', label: 'Память', icon: Brain },
            { id: 'brain', label: 'Мозг', icon: Cpu },
            { id: 'gallery', label: 'Спрайты', icon: Eye },
            { id: 'contract', label: 'Контракт', icon: BookOpen },
            { id: 'vision', label: 'Зрение', icon: Eye },
            { id: 'settings', label: 'Настройки', icon: Sliders }
          ].filter((tab: any) => !focusMode || tab.id === "chat" || tab.id === "settings").map((tab) => {
            const Icon = tab.icon;
            const isSmsTab = tab.id === 'sms';
            const unreadCount = notifications.filter(n => !n.read).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? 'bg-[#FF3B30] text-white font-medium shadow-[0_0_12px_rgba(255,59,48,0.5)]'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="inline">{tab.label}</span>
                {isSmsTab && unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#00FF94] text-black text-[9px] font-bold rounded-full font-mono">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Temporal Status Badge & Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications / SMS Bell Button */}
          <button
            onClick={() => setShowNotificationDrawer(!showNotificationDrawer)}
            className="relative p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/80 hover:text-white transition-all active:scale-95"
            title="СМС и уведомления от Курису"
          >
            <Bell className="w-4 h-4 text-amber-300" />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF3B30] text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center animate-bounce">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Темпоральный статус</span>
            <span className="text-xs font-mono text-[#00FF94] font-bold tracking-wider shadow-[0_0_8px_#00FF94]">1.048596%</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOptimizationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#FF3B30] border border-[#FF3B30]/40 rounded-xl text-xs font-mono transition-all active:scale-95 shadow-md"
              title="Запустить диагностику самооптимизации ИИ"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Оптимизация</span>
            </button>

            <button
              onClick={() => setShowAndroidExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white rounded-xl text-xs font-mono transition-all active:scale-95 shadow-[0_0_10px_rgba(255,59,48,0.4)]"
              title="Просмотр исходного кода нативного Android приложения"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden md:inline">Код APK</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notification Drawer Modal */}
      {showNotificationDrawer && (
        <div className="fixed top-16 right-4 z-50 bg-[#0A0A12] border border-white/10 rounded-2xl p-4 shadow-2xl w-80 max-h-96 overflow-y-auto space-y-3 font-sans backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-mono text-xs text-[#FF3B30] font-bold uppercase flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> СМС от Курису ({notifications.length})
            </span>
            <button
              onClick={() => setShowNotificationDrawer(false)}
              className="text-white/40 hover:text-white text-xs font-mono"
            >
              ✕
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-4 font-mono">Нет новых СМС сообщений.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  notificationEngine.markAsRead(n.id);
                  setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                }}
                className={`p-3 rounded-xl border text-xs space-y-1 cursor-pointer transition-all ${
                  n.read ? 'bg-white/5 border-white/5 opacity-60' : 'bg-[#FF3B30]/10 border-[#FF3B30]/30 shadow-[0_0_8px_rgba(255,59,48,0.2)]'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#FF3B30]">{n.title}</span>
                  <span className="text-[10px] text-white/40">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-white/80">{n.body}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main App Workspace Layout */}
      <main className="flex-1 p-3 sm:p-5 max-w-7xl w-full mx-auto flex flex-col gap-5 z-10">
        {/* TAB 1: CHAT & 3D AVATAR WORKSPACE */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[600px]">
            {/* Left: sticky avatar — always visible while chat scrolls */}
            <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-2 lg:self-start z-20">
              <div className="bg-[#0A0A12]/90 border border-white/10 rounded-2xl overflow-hidden p-2 shadow-2xl relative min-h-[280px] h-[42vh] max-h-[480px] sm:min-h-[340px] flex items-center justify-center backdrop-blur-md sticky top-0 z-20">
                {thoughtsOn && <ThoughtBubbleOverlay bubbles={thoughtBubbles} />}
                <div className="absolute inset-0 z-10">
                  <ConsciousnessHUD />
                  <Live2DAvatar
                    expression={expression}
                    isSpeaking={isSpeaking}
                    onTouchBodyPart={handleTouchBodyPart}
                    onTap={() => {
                      /* generic tap if no zone — soft reaction */
                      setExpression('flustered' as any);
                    }}
                  />
                </div>
              </div>

              {/* Emotional Gauges */}
              <EmotionalStatePanel
                emotions={appState.emotions}
                onRest={handleRest}
              />
              <FeelingsHUD />
              <NeuralLatticePanel lastUserText={(window as any).__kurisuLastUser || ''} />
              <HierarchyMindPanel />
              <TraitsPanel />
            </div>

            {/* Right 7 Cols: Interactive Russian Chat */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
              <div onDoubleClick={() => setShowDevPanel(true)}><TokenStatusBar /></div>
              <DailyPlanStrip />
              <PromiseStrip />
              <VoiceControls
                voiceEnabled={voiceEnabled}
                onToggleVoice={() => setVoiceEnabled(v => !v)}
                thoughtsOn={thoughtsOn}
                onToggleThoughts={() => setThoughtsOn(v => !v)}
                onVoiceText={(text) => {
                  void handleSendMessage(text);
                }}
                onConversationTranscript={async (text) => {
                  await handleSendMessage(text);
                }}
                conversationMode={conversationMode}
                onToggleConversation={() => {
                  setConversationMode(c => {
                    const next = !c;
                    if (next) setVoiceEnabled(true);
                    return next;
                  });
                }}
                isSpeaking={isSpeaking}
              />
              <ChatView
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                onPlayAudio={handlePlayAudio}
                emotions={appState.emotions}
                inferenceInfo={inferenceInfo}
                forceOffline={forceOffline}
                onToggleForceOffline={() => {
                  const next = !forceOffline;
                  setForceOffline(next);
                  chatService.setForceOffline(next);
                }}
                onTriggerProactiveThought={() => {
                  autonomousEngine.evaluateProactiveThought(appState.emotions, true);
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 3: DAILY REFLECTION JOURNAL */}
        {activeTab === 'journal' && (
          <div className="flex-1 max-w-4xl mx-auto w-full">
            <ReflectionJournal emotions={appState.emotions} />
          </div>
        )}

        {/* TAB 3: PERSONALITY MAP & EXPRESSION TESTER */}
        {activeTab === 'personality' && (
          <div className="flex-1 max-w-5xl mx-auto w-full">
            <PersonalityMapPanel
              emotions={appState.emotions}
              onSetExpression={(exp: AvatarExpression) => setExpression(exp)}
            />
          </div>
        )}

        {/* TAB 4: MEMORY ARCHITECTURE INSPECTOR */}
        {activeTab === 'gallery' && (
            <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl overflow-hidden">
              <SpriteGallery />
            </div>
          )}
          {activeTab === 'contract' && (
            <StonesContractPanel />
          )}
          {activeTab === 'brain' && (
            <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl overflow-hidden">
              <BrainMonitorPanel />
            </div>
          )}
          {activeTab === 'memory' && (
          <div className="flex-1 min-h-[550px]">
            <MemoryInspector />
          </div>
        )}

        {/* TAB 3: MULTIMODAL CAMERA & VISION */}
        {activeTab === 'vision' && (
          <div className="flex-1 max-w-3xl mx-auto w-full">
            <MultimodalCamera
              onAnalyzeImage={(base64, prompt) => handleSendMessage(prompt, base64)}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* TAB 4: SETTINGS PANEL */}
        {activeTab === 'settings' && (
          <div className="flex-1 max-w-3xl mx-auto w-full">
            <SettingsPanel
              appState={appState}
              onUpdateVoice={(v) => setAppState(prev => ({ ...prev, voice: { ...prev.voice, ...v } }))}
              onUpdateAvatar={(a) => setAppState(prev => ({ ...prev, avatar: { ...prev.avatar, ...a } }))}
              onUpdateAppState={(s) => setAppState(prev => ({ ...prev, ...s }))}
              onExportMemory={handleExportMemory}
              onImportMemory={handleImportMemory}
            />
          </div>
        )}
      </main>

      {/* Footer Status Line */}
      <footer className="px-5 py-3 border-t border-white/5 bg-[#08080C] text-[11px] font-mono text-white/40 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
          <span>Макисэ Курису AI • Неприкосновенный синаптический протокол Steins;Gate 1.048596%</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{neuralLocalEngine.getStatus().enabled ? 'Local Neural: ON' : 'Local Neural: OFF'}</span><span>El Psy Kongroo</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94] shadow-[0_0_6px_#00FF94]" />
        </div>
      </footer>

      {/* Developer panel / search permission */}
      {showDevPanel && <DevPanel onClose={() => setShowDevPanel(false)} />}
      {searchRequest && (
        <SearchPermissionModal
          request={searchRequest}
          onClose={() => { setSearchRequest(null); setPendingUserText(null); }}
          onResults={(q, formatted) => {
            memoryEngine.addLongTermMemory('world', `Поиск «${q}»: ${formatted.slice(0, 500)}`, 'web_search', 6);
            const follow = pendingUserText || q;
            setSearchRequest(null);
            setPendingUserText(null);
            setTimeout(() => handleSendMessage(follow), 50);
          }}
        />
      )}
      {showOptimizationModal && (
        <SelfOptimizationModal
          report={optimizationReport}
          onApprove={handleApproveOptimization}
          onRollback={handleRollbackOptimization}
          onClose={() => setShowOptimizationModal(false)}
          onGenerateReport={handleGenerateReport}
          isLoading={isLoading}
        />
      )}

      {/* Android Code Exporter Modal */}
      {showAndroidExportModal && (
        <AndroidCodeExportModal onClose={() => setShowAndroidExportModal(false)} />
      )}
    </div>
  );
}
