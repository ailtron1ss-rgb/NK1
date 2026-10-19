import type { InnerWorldSnap } from "./types";
import { clamp, clamp01 } from "./math";

type Vec = [number, number];

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function dist(a: Vec, b: Vec) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1]];
}

function nearestIndex(pos: Vec, pts: Vec[]) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = dist(pos, pts[i]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Compact 2D lab from NeuroCore/Deepcode: collect, avoid, waypoint. */
export class InnerWorld {
  pos: Vec = [0, 0];
  vel: Vec = [0, 0];
  energy = 0.72;
  resources: Vec[] = [
    [0.4, 0.3],
    [-0.5, 0.2],
    [0.1, -0.6],
  ];
  danger: Vec = [0.7, -0.4];
  waypoint: Vec = [-0.3, 0.6];
  collected = 0;
  task = 0;
  t = 0;
  lastReward = 0;
  trail: Vec[] = [];

  reset() {
    this.pos = [rnd(-0.5, 0.5), rnd(-0.5, 0.5)];
    this.vel = [0, 0];
    this.energy = 0.72;
    this.resources = Array.from({ length: 3 }, () => [rnd(-0.85, 0.85), rnd(-0.85, 0.85)] as Vec);
    this.danger = [rnd(-0.85, 0.85), rnd(-0.85, 0.85)];
    this.waypoint = [rnd(-0.85, 0.85), rnd(-0.85, 0.85)];
    this.collected = 0;
    this.task = 0;
    this.t = 0;
    this.lastReward = 0;
    this.trail = [this.pos];
  }

  observeText(): string {
    const nr = Math.min(...this.resources.map((r) => dist(this.pos, r)));
    const nd = dist(this.pos, this.danger);
    const wd = dist(this.pos, this.waypoint);
    const task = ["forage", "avoid", "waypoint"][this.task];
    return `lab ${task} pos=${this.pos[0].toFixed(2)},${this.pos[1].toFixed(2)} resource=${nr.toFixed(2)} danger=${nd.toFixed(2)} way=${wd.toFixed(2)} E=${this.energy.toFixed(2)}`;
  }

  snap(): InnerWorldSnap {
    return {
      pos: [...this.pos],
      energy: this.energy,
      collected: this.collected,
      nearestResource: Math.min(...this.resources.map((r) => dist(this.pos, r))),
      nearestDanger: dist(this.pos, this.danger),
      waypointDist: dist(this.pos, this.waypoint),
      task: this.task,
      lastReward: this.lastReward,
      resources: this.resources.map((r) => [...r] as [number, number]),
      danger: [...this.danger],
      waypoint: [...this.waypoint],
      trail: this.trail.map((p) => [...p] as [number, number]),
    };
  }

  step(action: number): number {
    this.t += 1;
    const dirs: Vec[] = [
      [0, 0.1],
      [0, -0.1],
      [-0.1, 0],
      [0.1, 0],
    ];
    const beforeRes = Math.min(...this.resources.map((r) => dist(this.pos, r)));
    const beforeWay = dist(this.pos, this.waypoint);
    if (action < 4) {
      this.vel = [this.vel[0] * 0.35 + dirs[action][0] * 0.65, this.vel[1] * 0.35 + dirs[action][1] * 0.65];
      this.pos = add(this.pos, this.vel);
      this.pos = [clamp(this.pos[0], -1, 1), clamp(this.pos[1], -1, 1)];
      this.energy -= 0.02;
    } else if (action === 4) {
      this.vel = [this.vel[0] * 0.2, this.vel[1] * 0.2];
      this.energy += 0.045;
    } else {
      this.energy -= 0.006;
    }

    if (this.t % 4 === 0) {
      this.danger = [
        clamp(this.danger[0] + rnd(-0.05, 0.05), -1, 1),
        clamp(this.danger[1] + rnd(-0.05, 0.05), -1, 1),
      ];
    }

    let ig = 0;
    const ni = nearestIndex(this.pos, this.resources);
    const nn = dist(this.pos, this.resources[ni]);
    if (action === 5 && nn < 0.15) {
      ig = 0.3;
      this.energy += ig;
      this.collected += 1;
      this.resources[ni] = [rnd(-0.9, 0.9), rnd(-0.9, 0.9)];
    }
    const nd = dist(this.pos, this.danger);
    const dp = nd < 0.2 ? -0.35 : nd < 0.35 ? -0.08 : 0;
    if (this.t % 90 === 0) this.task = (this.task + 1) % 3;
    this.energy = clamp(this.energy, 0.05, 1);

    const progress = beforeRes - nn;
    let taskReward = 0;
    if (this.task === 0) taskReward = 2 * ig + 0.4 * progress;
    else if (this.task === 1) taskReward = -dp + 0.04 * nd;
    else {
      const wd = dist(this.pos, this.waypoint);
      taskReward = 0.5 * (beforeWay - wd);
      if (wd < 0.15) {
        taskReward += 1;
        this.waypoint = [rnd(-0.9, 0.9), rnd(-0.9, 0.9)];
      }
    }
    const homeo = 0.1 * (1 - Math.min(1, Math.abs(this.energy - 0.72)));
    const r = taskReward + homeo - 0.004 + dp;
    this.lastReward = r;
    this.trail.push([...this.pos]);
    if (this.trail.length > 80) this.trail.shift();
    return r;
  }

  restore(s?: Partial<InnerWorldSnap>) {
    if (!s) return;
    if (s.pos) this.pos = [s.pos[0], s.pos[1]];
    if (typeof s.energy === "number") this.energy = s.energy;
    if (typeof s.collected === "number") this.collected = s.collected;
    if (typeof s.task === "number") this.task = s.task;
    if (typeof s.lastReward === "number") this.lastReward = s.lastReward;
    if (s.resources?.length) this.resources = s.resources.map((r) => [r[0], r[1]]);
    if (s.danger) this.danger = [s.danger[0], s.danger[1]];
    if (s.waypoint) this.waypoint = [s.waypoint[0], s.waypoint[1]];
    if (s.trail) this.trail = s.trail.map((p) => [p[0], p[1]]);
  }
}

function moveTowards(from: Vec, to: Vec): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 3 : 2;
  return dy >= 0 ? 0 : 1;
}

function moveAway(from: Vec, to: Vec): number {
  return moveTowards(from, [from[0] - (to[0] - from[0]), from[1] - (to[1] - from[1])]);
}

export function optionToInnerAction(option: string, snap: InnerWorldSnap): number {
  const pos = snap.pos;
  if (option === "rest" || option === "wait" || option === "reflect") return 4;
  if (option === "verify") {
    if (snap.nearestDanger < 0.3) return moveAway(pos, snap.danger);
    if (snap.nearestResource < 0.16) return 5;
    return moveTowards(pos, snap.waypoint);
  }
  if (option === "explore") {
    if (snap.task === 0) {
      if (snap.nearestResource < 0.15) return 5;
      const target = snap.resources.length
        ? snap.resources.reduce((best, r) => (dist(pos, r) < dist(pos, best) ? r : best), snap.resources[0])
        : snap.waypoint;
      return moveTowards(pos, target);
    }
    if (snap.task === 1) return moveAway(pos, snap.danger);
    if (snap.waypointDist < 0.15) return 5;
    return moveTowards(pos, snap.waypoint);
  }
  return Math.floor(Math.random() * 4);
}

export function innerFeature(snap: InnerWorldSnap): Float32Array {
  const f = new Float32Array(32);
  f[0] = snap.pos[0];
  f[1] = snap.pos[1];
  f[2] = snap.energy;
  f[3] = clamp01(snap.nearestResource);
  f[4] = clamp01(snap.nearestDanger);
  f[5] = clamp01(snap.waypointDist);
  f[6] = snap.task / 2;
  f[7] = clamp(snap.lastReward, -2, 2) / 2;
  f[8] = clamp01(snap.collected / 8);
  if (snap.danger) {
    f[9] = snap.danger[0];
    f[10] = snap.danger[1];
  }
  if (snap.waypoint) {
    f[11] = snap.waypoint[0];
    f[12] = snap.waypoint[1];
  }
  return f;
}
