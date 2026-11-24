/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RelationshipStage = 
  | 'Stranger' // Незнакомец
  | 'Acquaintance' // Знакомый
  | 'Friend' // Друг
  | 'CloseFriend' // Близкий друг
  | 'TrustedCompanion'; // Надежный спутник

export interface EmotionalState {
  trust: number; // 0 - 100
  affection: number; // 0 - 100
  irritation: number; // 0 - 100
  curiosity: number; // 0 - 100
  happiness: number; // 0 - 100
  fatigue: number; // 0 - 100
  stage: RelationshipStage;
}

export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'embarrassed'
  | 'thinking'
  | 'surprised'
  | 'flustered'
  | 'smug'
  | 'focused'
  | 'sarcastic'
  | 'tender'
  | 'looking_away'
  | 'dr_pepper_break'
  | 'whiteboard_explain'
  | 'tired'
  | 'objection_shout'
  | 'channel_lurker'
  | 'chin_rest'
  | 'steeple_hands'
  | 'face_cover_gasp'
  | 'reach_out'
  | 'phone_texting'
  | 'head_on_desk'
  | 'happy_open_arms'
  | 'over_shoulder'
  | 'confident_crossed'
  | 'passionate_shout'
  | 'sunset_melancholy'
  | 'dark_steeple'
  | 'pout'
  | 'shocked'
  | 'sleepy'
  | 'embarrassed_hide'
  | 'laughing'
  | 'sad_rain'
  | 'smug_genius'
  | 'tsundere_denial'
  | 'reading_paper'
  | 'time_travel_panic'
  | 'tender_glance'
  | 'drinking_coffee'
  | 'lab_lurker';

export interface MemoryItem {
  id: string;
  category: 'self' | 'user' | 'relationship' | 'world' | 'topic' | 'episodic' | 'reflection';
  topicName?: string;
  content: string;
  timestamp: number;
  emotionalWeight: number; // 1 - 10
  accessCount: number;
  retentionPriority: 'standard' | 'frequent' | 'neural_pathway';
}

export interface ReflectionLog {
  id: string;
  dateStr: string;
  timestamp: number;
  summary: string; // Краткое резюме событий за день
  emotionalSummary: string; // Эмоциональное состояние и динамика
  scientificInsights: string; // Научные выводы и новые знания
  kurisuJournalEntry: string; // Личная запись в дневнике от имени Курису
  divergenceRate: string; // Линия мира, напр. "1.048596%"
  keyTopics: string[]; // Ключевые темы
  emotionalSnapshot: EmotionalState;
}

export interface AutonomousSettings {
  enabled: boolean;
  idleIntervalMinutes: number;
  allowBrowserNotifications: boolean;
  autoSendSMS: boolean;
  lastInitiatedTimestamp?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'kurisu';
  text: string;
  timestamp: number;
  expression?: AvatarExpression;
  audioUrl?: string;
  imageData?: string;
  emotionalShift?: Partial<EmotionalState>;
}

export interface VoiceSettings {
  pitch: number; // 0.5 - 1.5
  speed: number; // 0.5 - 1.5
  volume: number; // 0 - 1
  wakeWordEnabled: boolean;
  wakeWord: string;
  autoSpeak: boolean;
  voiceName?: string;
}

export interface AvatarSettings {
  outfit: 'lab_coat' | 'casual' | 'hoodie' | 'formal' | 'nightwear' | 'summer' | 'casual_uniform' | 'summer_dress' | 'mayqueen_maid';
  glasses: 'red_frame' | 'black_frame' | 'none';
  hairstyle: 'classic_twintails' | 'loose' | 'ponytail';
  background: 'lab' | 'seminar_room' | 'cafe' | 'time_machine' | 'starship';
  lodQuality: 'low' | 'medium' | 'high';
  lipSyncEnabled: boolean;
  eyeTrackingEnabled: boolean;
}

export interface SelfOptimizationReport {
  timestamp: number;
  category: 'Performance' | 'Intelligence' | 'Features' | 'Architecture';
  title: string;
  whatWillChange: string;
  whyBetter: string;
  potentialRisks: string;
  rollbackPlan: string;
  benchmarks: {
    latencyReduction: string;
    memoryEfficiency: string;
    accuracyBoost: string;
  };
  approved: boolean;
}

export interface PluginConfig {
  id: string;
  name: string;
  provider: 'Gemini' | 'Claude' | 'GPT' | 'LocalLLM';
  apiKey?: string;
  endpoint?: string;
  enabled: boolean;
}

export interface AppState {
  emotions: EmotionalState;
  voice: VoiceSettings;
  avatar: AvatarSettings;
  autonomous: AutonomousSettings;
  plugins: PluginConfig[];
  fontStyle: 'system' | 'serif' | 'monospace' | 'handwriting';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  themeAccent: string;
  layoutMode: 'split' | 'chat_focused' | 'avatar_focused';
}
