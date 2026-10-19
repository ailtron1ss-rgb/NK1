/**
 * Desire queue + Promise tracker + fact confidence
 */

export interface DesireItem {
  id: string;
  text: string;
  priority: number; // 0..1
  source: 'self' | 'conversation' | 'goal';
  createdAt: number;
  active: boolean;
}

export interface PromiseItem {
  id: string;
  text: string;
  from: 'kurisu' | 'user';
  createdAt: number;
  dueAt?: number;
  status: 'open' | 'kept' | 'broken' | 'forgotten';
}

export interface FactBelief {
  id: string;
  subject: 'user' | 'self' | 'world';
  text: string;
  confidence: number; // 0..1
  evidenceCount: number;
  lastConfirmAt: number;
}

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export class DesireAndPromiseStore {
  private desires: DesireItem[] = [];
  private promises: PromiseItem[] = [];
  private beliefs: FactBelief[] = [];

  addDesire(text: string, priority = 0.5, source: DesireItem['source'] = 'self') {
    this.desires.unshift({
      id: uid('des'),
      text,
      priority,
      source,
      createdAt: Date.now(),
      active: true
    });
    this.desires = this.desires.slice(0, 30);
  }

  topDesire(): DesireItem | null {
    const active = this.desires.filter((d) => d.active).sort((a, b) => b.priority - a.priority);
    return active[0] || null;
  }

  listDesires() {
    return [...this.desires];
  }

  addPromise(text: string, from: 'kurisu' | 'user', dueAt?: number) {
    this.promises.unshift({
      id: uid('prm'),
      text,
      from,
      createdAt: Date.now(),
      dueAt,
      status: 'open'
    });
    this.promises = this.promises.slice(0, 40);
  }

  resolvePromise(id: string, status: PromiseItem['status']) {
    const p = this.promises.find((x) => x.id === id);
    if (p) p.status = status;
  }

  openPromises() {
    return this.promises.filter((p) => p.status === 'open');
  }

  upsertBelief(subject: FactBelief['subject'], text: string, confirm = true) {
    const existing = this.beliefs.find((b) => b.subject === subject && b.text === text);
    if (existing) {
      existing.evidenceCount += 1;
      existing.confidence = Math.min(0.95, existing.confidence + (confirm ? 0.08 : -0.1));
      existing.lastConfirmAt = Date.now();
      return existing;
    }
    const b: FactBelief = {
      id: uid('bel'),
      subject,
      text,
      confidence: confirm ? 0.55 : 0.3,
      evidenceCount: 1,
      lastConfirmAt: Date.now()
    };
    this.beliefs.unshift(b);
    this.beliefs = this.beliefs.slice(0, 80);
    return b;
  }

  beliefsForPrompt(minConfidence = 0.5): string[] {
    return this.beliefs
      .filter((b) => b.confidence >= minConfidence)
      .slice(0, 12)
      .map((b) => `(${b.confidence.toFixed(2)}) ${b.text}`);
  }

  /** Nightly-style compression stub */
  consolidate(dayNotes: string[]): string {
    const open = this.openPromises();
    const top = this.topDesire();
    const strong = this.beliefs.filter((b) => b.confidence >= 0.7).slice(0, 5);
    return [
      '=== consolidation ===',
      dayNotes.slice(0, 5).map((n) => `• ${n}`).join('\n') || '• нет заметок',
      top ? `Желание: ${top.text}` : 'Желание: —',
      open.length ? `Открытые обещания: ${open.map((p) => p.text).join('; ')}` : 'Обещания: чисто',
      strong.length ? `Устойчивые факты: ${strong.map((b) => b.text).join('; ')}` : 'Фактов мало'
    ].join('\n');
  }
}

export const desireAndPromiseStore = new DesireAndPromiseStore();
