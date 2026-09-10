import { buildRecord, totals } from '../nutrition/engine.js';

function rngFactory(seed = 20260910) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rnd = (rng, min, max) => min + (max - min) * rng();
const chance = (rng, p) => rng() < p;
const round1 = n => Math.round(Number(n || 0) * 10) / 10;

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function trusted(query, amount, unit, meal, id) {
  const rec = buildRecord({ query, amount, unit, meal, id });
  if (!rec) return null;
  return {
    ...rec,
    isDummy: true,
    _decoy: { schema: 1, generatedBy: 'pfc-v1.6-manager' }
  };
}

function add(list, rec) {
  if (rec) list.push(rec);
}

function generateDay(rng, date, targetCal, idBase) {
  const records = [];
  const lowDay = chance(rng, 0.10);
  const highDay = !lowDay && chance(rng, 0.13);
  const skipBreakfast = chance(rng, 0.12);
  const alcoholDay = chance(rng, 0.18);
  const snackDay = chance(rng, 0.35);

  if (!skipBreakfast) {
    add(records, trusted('白米', Math.round(rnd(rng, 100, 190)), 'g', '朝', idBase + 1));
    if (chance(rng, 0.65)) add(records, trusted('全卵(M)', 1, '個', '朝', idBase + 2));
    if (chance(rng, 0.55)) add(records, trusted('納豆', 1, 'パック', '朝', idBase + 3));
  }

  add(records, trusted('白米', Math.round(rnd(rng, 130, 260)), 'g', '昼', idBase + 10));
  add(records, trusted('鶏むね(皮なし)', Math.round(rnd(rng, 120, 230)), 'g', '昼', idBase + 11));

  add(records, trusted('白米', Math.round(rnd(rng, 100, 230)), 'g', '晩', idBase + 20));
  if (chance(rng, 0.45)) {
    add(records, trusted('サバ(生)', Math.round(rnd(rng, 80, 150)), 'g', '晩', idBase + 21));
  } else {
    add(records, trusted('鶏もも(皮なし)', Math.round(rnd(rng, 120, 220)), 'g', '晩', idBase + 22));
  }

  if (snackDay) {
    if (chance(rng, 0.55)) add(records, trusted('ヨーグルト', Math.round(rnd(rng, 100, 220)), 'g', '間食', idBase + 30));
    else add(records, trusted('オートミール', Math.round(rnd(rng, 25, 60)), 'g', '間食', idBase + 31));
  }

  if (alcoholDay) {
    add(records, trusted('ビール(500)', chance(rng, 0.25) ? 2 : 1, '缶', '晩', idBase + 40));
  }

  let sum = totals(records).kcal;
  const desiredRatio = lowDay ? rnd(rng, 0.72, 0.86) : highDay ? rnd(rng, 1.12, 1.28) : rnd(rng, 0.90, 1.08);
  const desired = targetCal * desiredRatio;

  if (sum < desired - 180) {
    const grams = Math.max(50, Math.min(250, Math.round((desired - sum) / 1.56)));
    add(records, trusted('白米', grams, 'g', chance(rng, 0.5) ? '昼' : '晩', idBase + 50));
    sum = totals(records).kcal;
  }
  if (sum < desired - 120) {
    add(records, trusted('はちみつ', Math.round(rnd(rng, 15, 35)), 'g', '間食', idBase + 51));
  }

  const s = totals(records);
  return {
    d: dayKey(date),
    s: { Cal: Math.round(s.kcal), P: round1(s.p), F: round1(s.f), C: round1(s.c), A: round1(s.a) },
    l: records,
    isDummy: true
  };
}

export function generateRealisticHistory({ days = 30, targetCal = 2000, seed = 20260910, now = new Date() } = {}) {
  const rng = rngFactory(seed);
  const rows = [];
  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    rows.push(generateDay(rng, date, targetCal, Number(`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}000`)));
  }
  return rows;
}

export function generateRealisticBody({ days = 90, startWeight = 70, startFat = 22, seed = 20260910, now = new Date() } = {}) {
  const rng = rngFactory(seed ^ 0x9E3779B9);
  const rows = [];
  let trendW = startWeight;
  let trendF = startFat;
  let plateau = 0;

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);

    if (plateau <= 0 && chance(rng, 0.06)) plateau = 5 + Math.floor(rnd(rng, 0, 10));
    if (plateau > 0) plateau -= 1;
    else {
      trendW -= rnd(rng, 0.008, 0.030);
      trendF -= rnd(rng, 0.004, 0.018);
    }

    rows.push({
      date: dayKey(date),
      weight: round1(trendW + rnd(rng, -0.65, 0.65)),
      fat: round1(Math.max(5, trendF + rnd(rng, -0.45, 0.45))),
      waist: round1(trendW * 1.08 + rnd(rng, -0.8, 0.8)),
      isDummy: true
    });
  }
  return rows;
}

export function removeDummy(history = [], body = [], today = []) {
  return {
    history: history.filter(x => !x?.isDummy),
    body: body.filter(x => !x?.isDummy),
    today: today.filter(x => !x?.isDummy)
  };
}
