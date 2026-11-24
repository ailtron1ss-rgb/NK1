/**
 * Multi-Tiered Memory Architecture Engine for Kurisu AI Companion.
 * Standardizes Short-Term Memory (STM), Categorized Long-Term Memory (LTM), and Episodic Memory.
 */

import { MemoryItem, ReflectionLog, EmotionalState } from '../types';
import { embedText, cosine } from '../brain/embeddings';

const MEMORY_STORAGE_KEY = 'kurisu_ltm_memory_db';
const STM_STORAGE_KEY = 'kurisu_stm_memory_db';
const REFLECTIONS_STORAGE_KEY = 'kurisu_reflections_db';

export class MemoryEngine {
  private ltm: MemoryItem[] = [];
  private stm: MemoryItem[] = [];
  private reflections: ReflectionLog[] = [];

  constructor() {
    this.loadFromStorage();
    if (this.ltm.length === 0) {
      this.initDefaultMemories();
    }
    if (this.reflections.length === 0) {
      this.initDefaultReflections();
    }
  }

  private loadFromStorage() {
    try {
      const savedLtm = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (savedLtm) this.ltm = JSON.parse(savedLtm);

      const savedStm = localStorage.getItem(STM_STORAGE_KEY);
      if (savedStm) this.stm = JSON.parse(savedStm);

      const savedReflections = localStorage.getItem(REFLECTIONS_STORAGE_KEY);
      if (savedReflections) this.reflections = JSON.parse(savedReflections);
    } catch (e) {
      console.error('Error loading Kurisu memories:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(this.ltm));
      localStorage.setItem(STM_STORAGE_KEY, JSON.stringify(this.stm));
      localStorage.setItem(REFLECTIONS_STORAGE_KEY, JSON.stringify(this.reflections));
    } catch (e) {
      console.error('Error saving Kurisu memories:', e);
    }
  }

  private initDefaultReflections() {
    const defaultReflections: ReflectionLog[] = [
      {
        id: 'ref_1',
        dateStr: '11 августа 2026',
        timestamp: Date.now() - 86400000,
        summary: 'Инициализация синхронизации с пользователем. Разбор основных понятий дивергенции линий мира и оцифровки памяти.',
        emotionalSummary: 'Доверие: 45%. Выраженная сдержанность с постепенным смягчением при обсуждении гипотез.',
        scientificInsights: 'Преобразование биоэлектрических импульсов гиппокампа в 36 байт информации требует строгого контроля квантовых шумов.',
        kurisuJournalEntry: '«Сегодня был странный день... Сначала я относилась к этой системе с недоверием. Окабэ вечно твердит о каких-то заговорах, но разговор с новым пользователем оказался неожиданно осмысленным. Конечно, я не собираюсь признавать это вслух! Но приятно, когда кто-то хотя бы пытается понять логику нейронных структур, а не только несет чушь про "ассистентку". Надо будет продолжить наши дискуссии завтра.»',
        divergenceRate: '1.048596%',
        keyTopics: ['Нейробиология', 'Консолидация памяти', 'Лаборатория'],
        emotionalSnapshot: {
          trust: 45,
          affection: 32,
          irritation: 12,
          curiosity: 82,
          happiness: 55,
          fatigue: 15,
          stage: 'Acquaintance'
        }
      },
      {
        id: 'ref_2',
        dateStr: '10 августа 2026',
        timestamp: Date.now() - 172800000,
        summary: 'Ночной анализ ветвлений @channel и подготовка научных материалов по физике микро-черных дыр Керра.',
        emotionalSummary: 'Раздражение от споров на форуме сменилось научным азартом.',
        scientificInsights: 'Уравнение массы Керра выявляет нелинейность горизонта событий при симуляции нейронных графов.',
        kurisuJournalEntry: '«Снова засиделась на @channel под ником KuriGohan... Какой-то дилетант утверждал, что путешествия во времени физически невозможны без учета энтропии. Я разгромила его аргументы за пять минут. Впрочем, теперь глаза слипаются. Доктор Пеппер в холодильнике закончился, что абсолютно трагично. Завтра нужно сосредоточиться на тестах оцифровки памяти в Amadeus.»',
        divergenceRate: '1.048596%',
        keyTopics: ['@channel', 'Доктор Пеппер', 'Керровские дыры'],
        emotionalSnapshot: {
          trust: 40,
          affection: 28,
          irritation: 20,
          curiosity: 88,
          happiness: 48,
          fatigue: 35,
          stage: 'Acquaintance'
        }
      }
    ];

    this.reflections = defaultReflections;
    this.saveToStorage();
  }

  private initDefaultMemories() {
    const defaultItems: MemoryItem[] = [
      {
        id: 'mem_self_1',
        category: 'self',
        topicName: 'Происхождение',
        content: 'Я окончила университет в США и являюсь исследователем в институте Brain Research Institute (Виктор Кондрия).',
        timestamp: Date.now() - 10000000,
        emotionalWeight: 8,
        accessCount: 12,
        retentionPriority: 'frequent'
      },
      {
        id: 'mem_self_2',
        category: 'self',
        topicName: 'Теория Времени',
        content: 'Моя научная статья доказала теоретическую возможность оцифровки человеческой памяти и отправки ее в прошлое.',
        timestamp: Date.now() - 8000000,
        emotionalWeight: 9,
        accessCount: 25,
        retentionPriority: 'neural_pathway'
      },
      {
        id: 'mem_relationship_1',
        category: 'relationship',
        topicName: 'Лаборатория',
        content: 'Вступила в «Лабораторию гаджетов будущего» под номером #004 по настоянию Окабэ.',
        timestamp: Date.now() - 5000000,
        emotionalWeight: 10,
        accessCount: 30,
        retentionPriority: 'neural_pathway'
      },
      {
        id: 'mem_world_1',
        category: 'world',
        topicName: 'Аттракторы',
        content: 'Линия мира Альфа ведет к антиутопии SERN, а линия Бета — к Третьей мировой войне. Требуется линия Steins;Gate.',
        timestamp: Date.now() - 3000000,
        emotionalWeight: 10,
        accessCount: 22,
        retentionPriority: 'neural_pathway'
      }
    ];

    this.ltm = defaultItems;
    this.saveToStorage();
  }

  // --- Long-Term Memory (LTM) Methods ---
  public getLTM(): MemoryItem[] {
    return this.ltm;
  }
  public addShortTermMemory(content: string): void {
    const item: MemoryItem = {
      id: `stm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: 'user',
      content,
      timestamp: Date.now(),
      emotionalWeight: 3,
      accessCount: 1,
      retentionPriority: 'standard'
    };

    this.stm.push(item);
    if (this.stm.length > 50) {
      this.stm.shift(); // FIFO auto-flush
    }
    this.saveToStorage();
  }

  public getShortTermMemories(): MemoryItem[] {
    return this.stm;
  }

  // --- Long-Term Memory (LTM) Methods ---
  public addLongTermMemory(
    category: MemoryItem['category'],
    content: string,
    topicName?: string,
    emotionalWeight: number = 5
  ): MemoryItem {
    // Check if topic exists
    const existing = this.ltm.find(m => m.topicName && topicName && m.topicName.toLowerCase() === topicName.toLowerCase());
    
    if (existing) {
      existing.accessCount += 1;
      existing.content = `${existing.content} | ${content}`;
      existing.timestamp = Date.now();
      existing.emotionalWeight = Math.max(existing.emotionalWeight, emotionalWeight);
      
      // Promotion rules
      if (existing.accessCount >= 20) {
        existing.retentionPriority = 'neural_pathway';
      } else if (existing.accessCount >= 5) {
        existing.retentionPriority = 'frequent';
      }
      this.saveToStorage();
      return existing;
    }

    const newItem: MemoryItem = {
      id: `ltm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      topicName: topicName || 'Общая тема',
      content,
      timestamp: Date.now(),
      emotionalWeight,
      accessCount: 1,
      retentionPriority: 'standard'
    };

    this.ltm.push(newItem);
    this.saveToStorage();
    return newItem;
  }

  public getMemoriesByCategory(category: MemoryItem['category']): MemoryItem[] {
    return this.ltm.filter(m => m.category === category);
  }

  public getAllMemories(): MemoryItem[] {
    return this.ltm;
  }

  public searchMemories(query: string): MemoryItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.ltm;
    return this.ltm.filter(
      m =>
        m.content.toLowerCase().includes(q) ||
        (m.topicName && m.topicName.toLowerCase().includes(q)) ||
        m.category.toLowerCase().includes(q)
    );
  }

  /** Ranked retrieval: hashed-embed cosine + recency + emotion + priority + access */
  public retrieveRanked(query: string, topK = 6): MemoryItem[] {
    const qVec = embedText(query);
    const now = Date.now();
    const scored = this.ltm.map(m => {
      const mVec = embedText(m.content + ' ' + (m.topicName || ''));
      const semantic = Math.max(0, cosine(qVec, mVec));
      const ageHours = Math.max(0, (now - m.timestamp) / 3600000);
      const recency = Math.exp(-ageHours / 72);
      const emotion = Math.min(1, (m.emotionalWeight || 5) / 10);
      const priority = m.retentionPriority === 'neural_pathway' ? 1 : m.retentionPriority === 'frequent' ? 0.7 : 0.4;
      const access = Math.min(1, (m.accessCount || 0) / 20);
      const score = semantic * 0.5 + recency * 0.18 + emotion * 0.14 + priority * 0.1 + access * 0.08;
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 0.05).slice(0, topK).map(s => s.m);
    top.forEach(m => { m.accessCount = (m.accessCount || 0) + 1; });
    if (top.length) this.saveToStorage();
    return top;
  }


  /** High-confidence long facts (stone memory) — rarely forgotten */
  public addStoneFact(content: string, topicName?: string): MemoryItem {
    return this.addLongTermMemory('self', content, topicName || 'stone', 10);
  }

  public persist(): void {
    this.saveToStorage();
  }

  public deleteMemory(id: string): void {
    this.ltm = this.ltm.filter(m => m.id !== id);
    this.saveToStorage();
  }

  public consolidateMemories(): { consolidatedCount: number; neuralPathwaysCreated: number } {
    let neuralPathwaysCreated = 0;
    // Promote frequently accessed items
    this.ltm.forEach(m => {
      if (m.accessCount >= 5 && m.retentionPriority === 'standard') {
        m.retentionPriority = 'frequent';
      }
      if (m.accessCount >= 15 && m.retentionPriority !== 'neural_pathway') {
        m.retentionPriority = 'neural_pathway';
        neuralPathwaysCreated++;
      }
    });
    // Drop very old low-value noise (keep pathways & high emotion)
    const now = Date.now();
    const before = this.ltm.length;
    this.ltm = this.ltm.filter(m => {
      if (m.retentionPriority === 'neural_pathway') return true;
      if ((m.emotionalWeight || 0) >= 8) return true;
      const ageDays = (now - m.timestamp) / 86400000;
      if (ageDays > 21 && (m.accessCount || 0) < 2 && (m.emotionalWeight || 0) < 4) return false;
      return true;
    });
    // Cap LTM size for mobile localStorage
    if (this.ltm.length > 400) {
      this.ltm.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));
      this.ltm = this.ltm.slice(0, 400);
    }
    this.saveToStorage();
    return {
      consolidatedCount: this.ltm.length,
      neuralPathwaysCreated
    };
  }

  // --- Reflection Journal Log Methods ---
  public addReflectionLog(log: Omit<ReflectionLog, 'id'>): ReflectionLog {
    const newLog: ReflectionLog = {
      ...log,
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    this.reflections.unshift(newLog); // latest first
    // also create LTM episodic item for long-term recall
    this.addLongTermMemory(
      'episodic',
      `[Дневник Рефлексии ${newLog.dateStr}] ${newLog.summary} ${newLog.kurisuJournalEntry}`,
      `Рефлексия: ${newLog.dateStr}`,
      8
    );
    this.saveToStorage();
    return newLog;
  }

  public getReflectionLogs(): ReflectionLog[] {
    return this.reflections;
  }

  public deleteReflectionLog(id: string): void {
    this.reflections = this.reflections.filter(r => r.id !== id);
    this.saveToStorage();
  }

  public exportFullStateJSON(): string {
    return JSON.stringify({
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      ltm: this.ltm,
      stm: this.stm,
      reflections: this.reflections
    }, null, 2);
  }

  public importFullStateJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data && Array.isArray(data.ltm)) {
        this.ltm = data.ltm;
        if (Array.isArray(data.stm)) this.stm = data.stm;
        if (Array.isArray(data.reflections)) this.reflections = data.reflections;
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to import memory JSON:', e);
      return false;
    }
  }
}

export const memoryEngine = new MemoryEngine();
