export const CALORIE_PRESETS = Object.freeze([
  { cal: 1200, label: '女性小食' },
  { cal: 1600, label: '女性減量' },
  { cal: 2000, label: '男性減量' },
  { cal: 2400, label: '活動・増量' }
]);

export const PFC_MODES = Object.freeze({
  std: Object.freeze({ label: '標準', pRatio: 0.30, fRatio: 0.20 }),
  lowfat: Object.freeze({ label: 'ローファット', pRatio: 0.30, fRatio: 0.10 }),
  muscle: Object.freeze({ label: '筋肥大', pRatio: 0.40, fRatio: 0.20 }),
  keto: Object.freeze({ label: 'ケト', pRatio: 0.30, fRatio: 0.60 })
});

const round1 = n => Math.round(Number(n || 0) * 10) / 10;

export function calculateTarget(calories, mode = 'std') {
  const cal = Math.max(1, Number(calories) || 2000);
  const cfg = PFC_MODES[mode] || PFC_MODES.std;
  const p = (cal * cfg.pRatio) / 4;
  const f = (cal * cfg.fRatio) / 9;
  const c = Math.max(0, cal - p * 4 - f * 9) / 4;
  return {
    cal: Math.round(cal),
    p: round1(p),
    f: round1(f),
    c: round1(c),
    mode,
    label: cfg.label
  };
}

export function inferMode(target) {
  const cal = Number(target?.cal) || 0;
  if (cal <= 0) return 'std';
  const p = Number(target?.p) || 0;
  const f = Number(target?.f) || 0;
  let best = 'std';
  let bestError = Infinity;
  for (const [key, cfg] of Object.entries(PFC_MODES)) {
    const expectedP = cal * cfg.pRatio / 4;
    const expectedF = cal * cfg.fRatio / 9;
    const error = Math.abs(p - expectedP) + Math.abs(f - expectedF);
    if (error < bestError) {
      best = key;
      bestError = error;
    }
  }
  return best;
}

export function targetLabel(target) {
  const mode = inferMode(target);
  return `${Math.round(Number(target?.cal) || 0).toLocaleString()} kcal・${PFC_MODES[mode].label}`;
}
