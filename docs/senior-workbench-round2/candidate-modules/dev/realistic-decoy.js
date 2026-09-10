function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randBetween(rng, min, max) { return min + (max - min) * rng(); }
function pick(rng, items) { return items[Math.floor(rng() * items.length)]; }
function round1(n) { return Math.round(n * 10) / 10; }
function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const FOOD_POOL = Object.freeze([
  { id:'decoy:rice', N:'白米', P:3.8, F:0.5, C:55.7, A:0, Cal:234, time:'朝' },
  { id:'decoy:chicken', N:'鶏むね(皮なし)', P:34.9, F:2.9, C:0.2, A:0, Cal:158, time:'昼' },
  { id:'decoy:natto', N:'納豆', P:7.4, F:4.5, C:5.4, A:0, Cal:90, time:'朝' },
  { id:'decoy:egg', N:'卵', P:6.2, F:5.2, C:0.2, A:0, Cal:74, time:'朝' },
  { id:'decoy:fish', N:'魚料理', P:22, F:7, C:0, A:0, Cal:155, time:'晩' },
  { id:'decoy:yogurt', N:'ヨーグルト', P:7, F:3, C:10, A:0, Cal:95, time:'間食' },
  { id:'decoy:snack', N:'菓子・間食', P:4, F:12, C:35, A:0, Cal:265, time:'間食' },
  { id:'decoy:beer500', N:'ビール(500)', P:1.5, F:0, C:15, A:19.1, Cal:200, time:'晩' }
]);

function scaledRecord(base, factor, id, dateSeed) {
  return {
    id,
    N: base.N,
    P: round1(base.P * factor),
    F: round1(base.F * factor),
    C: round1(base.C * factor),
    A: round1(base.A * factor),
    Cal: Math.round(base.Cal * factor),
    U: '-',
    time: base.time,
    isDummy: true,
    _decoy: { dateSeed, foodId: base.id }
  };
}

function dayTotals(records) {
  return records.reduce((s, x) => ({
    Cal:s.Cal+x.Cal, P:s.P+x.P, F:s.F+x.F, C:s.C+x.C, A:s.A+x.A
  }), { Cal:0,P:0,F:0,C:0,A:0 });
}

export function generateRealisticHistory({
  days = 30,
  targetCal = 2000,
  seed = 20260908,
  includeAlcohol = true,
  today = new Date()
} = {}) {
  const rng = mulberry32(seed);
  const result = [];

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(date);

    const roll = rng();
    let intakeRatio;
    if (roll < 0.10) intakeRatio = randBetween(rng, 0.72, 0.86);
    else if (roll > 0.90) intakeRatio = randBetween(rng, 1.12, 1.30);
    else intakeRatio = randBetween(rng, 0.90, 1.08);

    const dayTarget = targetCal * intakeRatio;
    const records = [];
    let current = 0;
    let i = 0;

    while (current < dayTarget * 0.86 && i < 10) {
      const available = FOOD_POOL.filter(x => includeAlcohol || x.A === 0);
      let food = pick(rng, available);
      if (food.A > 0 && rng() > 0.18) food = pick(rng, available.filter(x => x.A === 0));
      if (food.N === '菓子・間食' && rng() > 0.35) food = pick(rng, available.filter(x => x.N !== '菓子・間食'));
      const rec = scaledRecord(food, randBetween(rng, 0.75, 1.35), Date.now() + offset * 100 + i, key);
      records.push(rec);
      current += rec.Cal;
      i += 1;
    }

    if (includeAlcohol && rng() < 0.16 && !records.some(x => x.A > 0)) {
      const beer = FOOD_POOL.find(x => x.A > 0);
      records.push(scaledRecord(beer, randBetween(rng, 0.8, 1.2), Date.now() + offset * 100 + 90, key));
    }

    result.push({ d:key, s:dayTotals(records), l:records, isDummy:true });
  }

  return result;
}

export function generateRealisticBody({
  days = 90,
  seed = 20260908,
  startWeight = 72,
  startFat = 22,
  today = new Date()
} = {}) {
  const rng = mulberry32(seed ^ 0x9E3779B9);
  const rows = [];
  let trendWeight = startWeight;
  let trendFat = startFat;
  let plateau = 0;

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    if (plateau <= 0 && rng() < 0.07) plateau = 5 + Math.floor(rng() * 10);
    if (plateau > 0) plateau -= 1;
    else {
      trendWeight -= randBetween(rng, 0.01, 0.035);
      trendFat -= randBetween(rng, 0.005, 0.02);
    }

    rows.push({
      date: localDateKey(date),
      w: round1(trendWeight + randBetween(rng, -0.7, 0.7)),
      f: round1(Math.max(5, trendFat + randBetween(rng, -0.45, 0.45))),
      waist: round1((trendWeight * 1.08) + randBetween(rng, -0.7, 0.7)),
      isDummy:true
    });
  }
  return rows;
}

export function stripDummyRows(rows = []) {
  return rows.filter(row => !row?.isDummy);
}
