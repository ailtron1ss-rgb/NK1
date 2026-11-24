import { DEEP_MEMORY_SEEDS } from '../data/kurisuDeepMemory';
import { KURISU_DEEP_MEMORIES } from '../data/kurisuDeepCanonSeed';
import { KURISU_OFFICIAL_MEMORIES } from '../data/kurisuOfficialProfile';
/**
 * Multi-Tiered Memory Architecture Engine for Kurisu AI Companion.
 * Standardizes Short-Term Memory (STM), Categorized Long-Term Memory (LTM), and Episodic Memory.
 */

import { MemoryItem, ReflectionLog, EmotionalState } from '../types';
import { embedText, cosine } from '../brain/embeddings';
import { ensureV17Genesis } from '../cognitive/GenesisMigration';
import { writeJson, readJson } from '../cognitive/StateVault';
import { continuumMemory } from '../cognitive/ContinuumMemory';
import { memoryAssociator } from '../cognitive/MemoryAssociator';

const MEMORY_STORAGE_KEY = 'kurisu_ltm_memory_db';
const STM_STORAGE_KEY = 'kurisu_stm_memory_db';
const REFLECTIONS_STORAGE_KEY = 'kurisu_reflections_db';

export class MemoryEngine {
  private ltm: MemoryItem[] = [];
  private stm: MemoryItem[] = [];
  private reflections: ReflectionLog[] = [];

  constructor() {
    ensureV17Genesis();
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
    // Fresh installation: no invented relationship history.
    // Canonical memories belong to Kurisu; user-specific memories begin only
    // after real interaction.
    this.reflections = [];
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
      retentionPriority: 'standard',
      lastAccessedAt: Date.now(),
      emotionalValence: 0,
      meaning: content.slice(0, 180),
      actions: []
    };

    this.stm.push(item);
    continuumMemory.push(content, 'working', 0.35);
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
    emotionalWeight: number = 5,
    metadata: { meaning?: string; actions?: string[]; confidence?: number } = {}
  ): MemoryItem {
    // Check if topic exists
    const existing = this.ltm.find(m => m.topicName && topicName && m.topicName.toLowerCase() === topicName.toLowerCase());
    
    if (existing) {
      existing.accessCount += 1;
      existing.content = `${existing.content} | ${content}`;
      existing.timestamp = Date.now();
      existing.emotionalWeight = Math.max(existing.emotionalWeight, emotionalWeight);
      existing.lastAccessedAt = Date.now();
      existing.confidence = Math.min(1, Math.max(existing.confidence ?? 0.55, metadata.confidence ?? 0.55) + 0.01);
      existing.emotionalValence = Math.max(-1, Math.min(1, (existing.emotionalWeight - 5) / 5));
      if (metadata.meaning) existing.meaning = metadata.meaning;
      if (metadata.actions?.length) existing.actions = Array.from(new Set([...(existing.actions || []), ...metadata.actions])).slice(0, 8);
      
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
      retentionPriority: 'standard',
      lastAccessedAt: Date.now(),
      emotionalValence: Math.max(-1, Math.min(1, (emotionalWeight - 5) / 5)),
      meaning: metadata.meaning || content.slice(0, 180),
      actions: metadata.actions || [],
      confidence: Math.max(0.05, Math.min(1, metadata.confidence ?? 0.55))
    };

    this.ltm.push(newItem);
    memoryAssociator.linkRelated(newItem, this.ltm.slice(-24), 4);
    const band = category === 'self' || category === 'world' || category === 'topic' ? 'semantic' : category === 'relationship' || category === 'user' ? 'identity' : 'episodic';
    continuumMemory.push(content, band, Math.max(0.2, emotionalWeight / 10), newItem.id);
    this.saveToStorage();
    return newItem;
  }

  /** Store one experience as Facts + Emotion + Meaning + Actions. */
  public addStructuredMemory(input: { category: MemoryItem['category']; fact: string; emotion?: number; meaning?: string; actions?: string[]; confidence?: number; topicName?: string }) {
    const emotionalWeight = Math.max(1, Math.min(10, input.emotion ?? 5));
    return this.addLongTermMemory(input.category, input.fact, input.topicName, emotionalWeight, {
      meaning: input.meaning,
      actions: input.actions,
      confidence: input.confidence
    });
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
      const ageHours = Math.max(0, (now - (m.lastAccessedAt || m.timestamp)) / 3600000);
      // Ebbinghaus-style retention: repeated access and emotional intensity slow forgetting.
      const stability = 18 + Math.min(72, (m.accessCount || 0) * 2.5) + Math.min(36, (m.emotionalWeight || 5) * 3);
      const forgetting = Math.exp(-ageHours / stability);
      const recency = Math.exp(-ageHours / 96);
      const emotion = Math.min(1, (m.emotionalWeight || 5) / 10);
      const priority = m.retentionPriority === 'neural_pathway' ? 1 : m.retentionPriority === 'frequent' ? 0.7 : 0.4;
      const access = Math.min(1, (m.accessCount || 0) / 20);
      const confidence = Math.max(0.15, Math.min(1, m.confidence ?? 0.55));
      const score = semantic * 0.44 + forgetting * 0.18 + recency * 0.08 + emotion * 0.12 + priority * 0.08 + access * 0.05 + confidence * 0.05;
      return { m, score };
    });
    const continuum = continuumMemory.retrieve(query, ['working', 'episodic', 'semantic', 'identity'], Math.max(2, Math.ceil(topK / 2)));
    const continuumIds = new Set(continuum.map(x => x.d.parentId).filter(Boolean));
    scored.forEach(s => { if (continuumIds.has(s.m.id)) s.score += 0.08; });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 0.05).slice(0, topK).map(s => s.m);
    top.forEach(m => {
      m.accessCount = (m.accessCount || 0) + 1;
      m.lastAccessedAt = now;
      m.confidence = Math.min(1, (m.confidence ?? 0.55) + 0.015);
    });
    if (top.length) {
      writeJson('kurisu_memory_recalls_v1', readJson<number>('kurisu_memory_recalls_v1', 0) + top.length);
      this.saveToStorage();
    }
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
    const now = Date.now();
    // Ebbinghaus-inspired retention: important/repeated memories decay more slowly.
    for (const m of this.ltm) {
      const last = m.lastAccessedAt || m.timestamp;
      const days = Math.max(0, (now - last) / 86_400_000);
      const accessBoost = Math.min(0.012, (m.accessCount || 0) * 0.00025);
      const emotionalBoost = Math.min(0.012, (m.emotionalWeight || 5) * 0.0012);
      const base = m.retentionPriority === 'neural_pathway' ? 0.995 : m.retentionPriority === 'frequent' ? 0.99 : 0.98;
      const retention = Math.pow(Math.min(0.999, base + accessBoost + emotionalBoost), days);
      m.confidence = Math.max(0.05, Math.min(1, (m.confidence ?? 0.55) * retention));
    }
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
    const pruneNow = Date.now();
    const before = this.ltm.length;
    this.ltm = this.ltm.filter(m => {
      if (m.retentionPriority === 'neural_pathway') return true;
      if ((m.emotionalWeight || 0) >= 8) return true;
      const ageDays = (pruneNow - m.timestamp) / 86400000;
      if (ageDays > 21 && (m.accessCount || 0) < 2 && (m.emotionalWeight || 0) < 4) return false;
      return true;
    });
    // Cap LTM size for mobile localStorage
    if (this.ltm.length > 400) {
      this.ltm.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));
      this.ltm = this.ltm.slice(0, 400);
    }
    continuumMemory.consolidate(this.ltm);
    writeJson('kurisu_memory_review_at_v1', Date.now());
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


  public seedDeepCanonOnce(): void {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('kurisu_deep_seed_v3') === '1') return;
      try {
        for (const s of DEEP_MEMORY_SEEDS) {
          this.addLongTermMemory(s.category as any, s.content, s.topicName, s.emotionalWeight);
        }
      } catch { /* optional old seeds */ }
      for (const m of KURISU_DEEP_MEMORIES) {
        this.addLongTermMemory(m.category as any, m.content, m.topic, m.weight);
      }
      for (const m of KURISU_OFFICIAL_MEMORIES) {
        this.addLongTermMemory(m.category as any, m.content, m.topic, m.weight);
      }
      localStorage.setItem('kurisu_deep_seed_v3', '1');
    } catch (e) {
      console.warn('deep seed', e);
    }
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

if (typeof window !== 'undefined') {
  (window as any).__kurisuMemoryEngine = memoryEngine;
  try { memoryEngine.seedDeepCanonOnce(); } catch { /* */ }
}
