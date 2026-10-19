/** Shared deterministic execution primitives used by the core execution runtimes. */
export const clamp = (x: number): number => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export const goalVectorFallback = (goals: any[], state: any): number[] => {
  const active = goals
    .filter((goal: any) => goal?.status === 'active' || goal?.status === 'candidate')
    .sort((a: any, b: any) => Number(b?.priority ?? 0) - Number(a?.priority ?? 0))[0];
  return Array.from({ length: 8 }, (_, index) => clamp(Number(active?.vector?.[index] ?? (index === 0 ? state.needs.goalPressure : 0.5))));
};
