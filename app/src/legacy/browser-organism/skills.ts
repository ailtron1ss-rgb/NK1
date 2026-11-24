import type { Skill } from "./types";
import { clamp01, id } from "./math";
import { tokenize } from "./encoder";

/** Capability forge: skills are patterns that actually fired and got a return. */
export class SkillForge {
  skills: Skill[] = [];

  observe(text: string, success: number, tick: number) {
    const tokens = tokenize(text).slice(0, 5);
    if (tokens.length < 2) return;
    const pattern = tokens.slice(0, 3).join(" ");
    const existing = this.skills.find((s) => s.pattern === pattern);
    if (existing) {
      existing.uses += 1;
      existing.success = existing.success * 0.85 + success * 0.15;
      existing.lastTick = tick;
      return;
    }
    if (this.skills.length >= 40) {
      this.skills.sort((a, b) => a.success * a.uses - b.success * b.uses);
      this.skills.shift();
    }
    this.skills.push({
      id: id(),
      name: pattern,
      pattern,
      uses: 1,
      success,
      coalition: tokens,
      lastTick: tick,
    });
  }

  compose(): Skill | null {
    const active = this.skills.filter((s) => s.uses >= 2 && s.success > 0.45);
    if (active.length < 2) return null;
    active.sort((a, b) => b.success - a.success);
    const a = active[0];
    const b = active[1];
    const name = `${a.name} + ${b.name}`;
    if (this.skills.some((s) => s.name === name)) return null;
    const skill: Skill = {
      id: id(),
      name,
      pattern: `${a.pattern} | ${b.pattern}`,
      uses: 1,
      success: (a.success + b.success) / 2,
      coalition: [...a.coalition, ...b.coalition],
      lastTick: Math.max(a.lastTick, b.lastTick),
    };
    this.skills.push(skill);
    return skill;
  }

  top(n = 6) {
    return [...this.skills].sort((a, b) => b.success * Math.log(1 + b.uses) - a.success * Math.log(1 + a.uses)).slice(0, n);
  }

  restore(raw?: Skill[]) {
    this.skills = Array.isArray(raw) ? raw.slice(0, 40) : [];
  }
}

export function skillHint(skills: Skill[]): string {
  const top = [...skills]
    .sort((a, b) => b.success - a.success)
    .slice(0, 4)
    .map((s) => `${s.name} (${(s.success * 100).toFixed(0)}%)`);
  return top.length ? top.join("; ") : "none yet";
}

export { clamp01 };
