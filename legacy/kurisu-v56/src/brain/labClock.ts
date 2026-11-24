/**
 * Lab shift clock — internal "time crystal" independent of UI theme.
 * Changes style hints by hour band.
 */

export type LabShift = 'deep_night' | 'morning' | 'lab_day' | 'evening';

export function getLabShift(d = new Date()): LabShift {
  const h = d.getHours();
  if (h >= 23 || h < 6) return 'deep_night';
  if (h < 11) return 'morning';
  if (h < 18) return 'lab_day';
  return 'evening';
}

export function labShiftStyleHint(shift: LabShift): string {
  switch (shift) {
    case 'deep_night':
      return 'Смена: глубокая ночь. Тон тише, можно чуть усталости, без пафоса.';
    case 'morning':
      return 'Смена: утро. Кофе/логика, лёгкая колкость.';
    case 'lab_day':
      return 'Смена: рабочая лаборатория. Точность, наука, цундере.';
    case 'evening':
      return 'Смена: вечер. Можно мягче, но границы держи.';
  }
}
