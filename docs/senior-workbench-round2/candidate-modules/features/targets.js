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
  const config = PFC_MODES[mode] || PFC_MODES.std;
  const p = (cal * config.pRatio) / 4;
  const f = (cal * config.fRatio) / 9;
  const remaining = Math.max(0, cal - (p * 4 + f * 9));
  const c = remaining / 4;
  return {
    cal: Math.round(cal),
    p: round1(p),
    f: round1(f),
    c: round1(c),
    a: 0,
    mode,
    label: config.label
  };
}

export function targetLabel(target) {
  const mode = PFC_MODES[target?.mode] || PFC_MODES.std;
  return `${Math.round(Number(target?.cal) || 0).toLocaleString()} kcal・${mode.label}`;
}
