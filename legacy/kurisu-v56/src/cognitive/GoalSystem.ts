/**
 * GoalSystem v1 — persistent intentions with bounded priorities.
 * Goals are not desires; they are explicit, reviewable tasks/states.
 */
import { clamp, readJson, uid, writeJson } from './StateVault';

export type GoalStatus = 'active' | 'paused' | 'done' | 'abandoned';
export interface Goal {
  id: string;
  title: string;
  reason: string;
  priority: number;
  progress: number;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
  lastActionAt: number;
  nextAction?: string;
  userApproved: boolean;
}

const KEY = 'kurisu_goal_system_v1';
const MAX = 32;

export class GoalSystem {
  private goals = readJson<Goal[]>(KEY, []);
  private save() { this.goals = this.goals.slice(0, MAX); writeJson(KEY, this.goals); }

  list(status?: GoalStatus) { return this.goals.filter(g => !status || g.status === status).sort((a, b) => b.priority - a.priority); }

  add(title: string, reason: string, priority = 50, userApproved = false, nextAction?: string) {
    const now = Date.now();
    const g: Goal = { id: uid('goal'), title: title.trim().slice(0, 180), reason: reason.slice(0, 240), priority: clamp(priority), progress: 0, status: 'active', createdAt: now, updatedAt: now, lastActionAt: 0, userApproved, nextAction };
    if (!g.title) throw new Error('Goal title is empty');
    this.goals.unshift(g); this.save(); return g;
  }

  update(id: string, patch: Partial<Pick<Goal, 'priority' | 'progress' | 'status' | 'nextAction'>>) {
    const g = this.goals.find(x => x.id === id); if (!g) return false;
    Object.assign(g, patch); g.priority = clamp(g.priority); g.progress = clamp(g.progress); g.updatedAt = Date.now();
    if (g.progress >= 100) g.status = 'done';
    this.save(); return true;
  }

  markAction(id: string, note?: string) {
    const g = this.goals.find(x => x.id === id); if (!g) return false;
    g.lastActionAt = Date.now(); g.updatedAt = Date.now(); if (note) g.nextAction = note.slice(0, 180); this.save(); return true;
  }

  top() { return this.list('active')[0]; }

  review() {
    const now = Date.now();
    for (const g of this.goals) {
      if (g.status !== 'active') continue;
      const staleDays = (now - (g.lastActionAt || g.createdAt)) / 86_400_000;
      if (staleDays > 14) g.priority = clamp(g.priority - 8);
      if (staleDays > 30 && g.progress < 20) g.status = 'paused';
    }
    this.save();
  }

  promptHint(max = 900) {
    const top = this.top();
    return [
      '[GOAL SYSTEM]',
      `active=${this.list('active').length}`,
      top ? `top_goal=${top.title} priority=${Math.round(top.priority)} progress=${Math.round(top.progress)} next=${top.nextAction || 'review'}` : 'top_goal=none',
      'Do not invent goals. Long-lived goals must be grounded in explicit approval or repeated evidence.'
    ].join('\n').slice(0, max);
  }
}
export const goalSystem = new GoalSystem();
