import { FOODS, defaultAmount } from '../nutrition/catalog.js';
import { buildRecord, totals } from '../nutrition/engine.js';

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

const round1 = n => Math.round(Number(n || 0) * 10) / 10;
const between = (rng, min, max) => min + (max - min) * rng();
const pick = (rng, list) => list.length ? list[Math.floor(rng() * list.length)] : null;

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const FOOD_NAMES = Object.freeze({
  breakfast: ['白米','納豆','全卵(M)','ゆで卵','ヨーグルト','食パン(6枚切)'],
  lunch: ['白米','鶏むね(皮なし)','鶏もも(皮なし)','豚ヒレ','ローストビーフ'],
  dinner: ['白米','サバ(生)','鮭(焼き)','鶏もも(皮あり)','木綿豆腐'],
  snack: ['ヨーグルト','無脂肪ヨーグルト','プロテイン','はちみつ','バナナ'],
  alcohol: ['ビール(350)','ビール(500)','ハイボール','レモンサワー','生ビール(中)']
});

function foodByName(name) {
  return FOODS.find(food => food.name === name) || null;
}

function pool(kind) {
  return (FOOD_NAMES[kind] || []).map(foodByName).filter(Boolean);
}

function amountFor(food, rng) {
  const d = defaultAmount(food);
  const unit = d.unit;
  const name = food.name;
  if (unit === 'g') {
    if (/白米|玄米|ご飯/.test(name)) return { amount: Math.round(between(rng, 100, 260) / 10) * 10, unit };
    if (/鶏|豚|牛|魚|サバ|鮭|ローストビーフ/.test(name)) return { amount: Math.round(between(rng, 100, 220) / 10) * 10, unit };
    if (/ヨーグルト|豆腐/.test(name)) return { amount: Math.round(between(rng, 100, 200) / 10) * 10, unit };
    return { amount: Math.max(10, Math.round(between(rng, 40, 160) / 10) * 10), unit };
  }
  if (unit === 'ml') return { amount: Math.round(between(rng, 150, 450) / 50) * 50, unit };
  return { amount: rng() < 0.82 ? 1 : 2, unit };
}

function makeRecord(food, meal, date, seq, rng) {
  if (!food) return null;
  const qty = amountFor(food, rng);
  const id = date.getTime() + seq;
  const record = buildRecord({ food, amount: qty.amount, unit: qty.unit, meal, id });
  if (!record) return null;
  return {
    ...record,
    isDummy: true,
    _dummy: { generator: 'senior-realistic-v1', date: localDateKey(date) }
  };
}

function addRandom(records, kind, meal, count, date, seqStart, rng) {
  const foods = pool(kind);
  let seq = seqStart;
  for (let i = 0; i < count; i += 1) {
    const record = makeRecord(pick(rng, foods), meal, date, seq++, rng);
    if (record) records.push(record);
  }
  return seq;
}

function historySummary(records) {
  const t = totals(records);
  return { Cal: Math.round(t.kcal), P: round1(t.p), F: round1(t.f), C: round1(t.c), A: round1(t.a) };
}

export function generateRealisticHistory({
  days = 30,
  targetCal = 2000,
  seed = 20260910,
  includeAlcohol = true,
  today = new Date()
} = {}) {
  const rng = mulberry32(seed);
  const rows = [];
  const allFood = [...pool('breakfast'), ...pool('lunch'), ...pool('dinner'), ...pool('snack')];

  for (let offset = 1; offset <= days; offset += 1) {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - offset);
    const pattern = rng();
    const ratio = pattern < 0.10 ? between(rng, 0.72, 0.86)
      : pattern > 0.90 ? between(rng, 1.12, 1.30)
      : between(rng, 0.90, 1.08);
    const desired = Math.max(900, targetCal * ratio);
    const records = [];
    let seq = 1;

    if (rng() > 0.10) seq = addRandom(records, 'breakfast', '朝', rng() < 0.55 ? 2 : 3, date, seq, rng);
    seq = addRandom(records, 'lunch', '昼', rng() < 0.72 ? 2 : 3, date, seq, rng);
    seq = addRandom(records, 'dinner', '晩', rng() < 0.68 ? 2 : 3, date, seq, rng);
    if (rng() < 0.48) seq = addRandom(records, 'snack', '間食', rng() < 0.80 ? 1 : 2, date, seq, rng);

    let current = historySummary(records).Cal;
    let guard = 0;
    while (current < desired * 0.82 && guard < 5 && allFood.length) {
      const food = pick(rng, allFood);
      const record = makeRecord(food, rng() < 0.5 ? '間食' : '晩', date, seq++, rng);
      if (record) records.push(record);
      current = historySummary(records).Cal;
      guard += 1;
    }

    if (includeAlcohol && rng() < 0.18) {
      const record = makeRecord(pick(rng, pool('alcohol')), '晩', date, seq++, rng);
      if (record) records.push(record);
    }

    rows.push({ d: localDateKey(date), s: historySummary(records), l: records, isDummy: true });
  }

  return rows.sort((a, b) => String(b.d).localeCompare(String(a.d)));
}

export function generateRealisticBody({
  days = 90,
  seed = 20260910,
  startWeight = 72,
  startFat = 22,
  today = new Date()
} = {}) {
  const rng = mulberry32(seed ^ 0x9E3779B9);
  const rows = [];
  let trendWeight = Number(startWeight) || 72;
  let trendFat = Number(startFat) || 22;
  let plateauDays = 0;

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - offset);

    if (plateauDays <= 0 && rng() < 0.07) plateauDays = 5 + Math.floor(rng() * 10);
    if (plateauDays > 0) plateauDays -= 1;
    else {
      trendWeight -= between(rng, 0.01, 0.035);
      trendFat -= between(rng, 0.005, 0.02);
    }

    const weight = trendWeight + between(rng, -0.7, 0.7);
    const fat = Math.max(5, trendFat + between(rng, -0.45, 0.45));
    const waist = weight * 1.08 + between(rng, -0.8, 0.8);
    rows.push({
      id: date.getTime(),
      date: localDateKey(date),
      weight: round1(weight),
      fat: round1(fat),
      waist: round1(waist),
      isDummy: true
    });
  }
  return rows;
}

export function isDummyHistoryRow(row) {
  if (row?.isDummy) return true;
  return Array.isArray(row?.l) && row.l.length > 0 && row.l.every(record => record?.isDummy === true);
}
