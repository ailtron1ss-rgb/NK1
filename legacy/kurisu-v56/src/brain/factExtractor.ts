/**
 * Lightweight fact extraction from user lines → user model notes + world info.
 * Rule-based (no extra LLM) — mobile-safe, like MemoryBank storage step lite.
 */

import { userModel } from './userModel';
import { kurisuStones } from './kurisuStones';
import { allWorldInfo, saveCustomWorldInfo, WorldInfoEntry } from './worldInfo';

const FACT_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /меня зовут\s+([А-Яа-яA-Za-zёЁ\-]{2,30})/i, label: 'name' },
  { re: /я\s+(живу|из)\s+([^.!?,]{3,40})/i, label: 'place' },
  { re: /мне\s+(\d{1,2})\s*(лет|год)/i, label: 'age' },
  { re: /я\s+(люблю|ненавижу|предпочитаю)\s+([^.!?]{3,50})/i, label: 'pref' },
  { re: /мой\s+(кот|пёс|собака|друг|брат|сестра)\s+([^.!?]{2,40})/i, label: 'relation' },
  { re: /работаю\s+(?:в|над)?\s*([^.!?]{3,50})/i, label: 'work' }
];

export function extractFactsFromUser(text: string): string[] {
  const found: string[] = [];
  const memCmd = text.match(/(?:запомни|запомнить)\s*[:\-–]?\s*(.+)/i);
  if (memCmd && memCmd[1]) {
    const fact = memCmd[1].trim().slice(0, 200);
    kurisuStones.add('user', fact, false);
    found.push('stone: ' + fact);
  }

  for (const { re, label } of FACT_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const fact = m[0].slice(0, 80);
      found.push(`${label}: ${fact}`);
    }
  }
  if (!found.length) return [];

  // merge into user model notes
  try {
    const m = userModel.get();
    const notes = (m.notes || '').split('\n').filter(Boolean);
    for (const f of found) {
      if (!notes.some(n => n.includes(f.slice(0, 20)))) notes.unshift(f);
    }
    const next = { ...m, notes: notes.slice(0, 20).join('\n') };
    localStorage.setItem('kurisu_user_model_v1', JSON.stringify(next));
  } catch {
    /* */
  }

  // optional world-info custom entry for strong facts
  try {
    const custom = allWorldInfo().filter(e => e.id.startsWith('user_fact_'));
    const entries: WorldInfoEntry[] = [...custom];
    for (const f of found) {
      const id = `user_fact_${f.slice(0, 12).replace(/\s/g, '_')}`;
      if (entries.some(e => e.id === id)) continue;
      entries.unshift({
        id,
        keys: f.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 4),
        content: `Факт о пользователе: ${f}`,
        priority: 60,
        enabled: true,
        category: 'user'
      });
    }
    saveCustomWorldInfo(entries.filter(e => e.id.startsWith('user_fact_')).slice(0, 30));
  } catch {
    /* */
  }

  return found;
}
