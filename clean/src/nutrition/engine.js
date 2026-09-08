import { getFood, resolveFood, defaultAmount } from './catalog.js';
import { autoMeal } from '../storage.js';

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }
function normUnit(u) {
  const raw = String(u || '').normalize('NFKC').trim();
  const map = { 'グラム':'g','ｇ':'g','ミリリットル':'ml','パック':'パック','P':'パック','p':'パック','茶碗':'杯','茶碗一杯':'杯','つ':'個' };
  return map[raw] || raw;
}

function basisAmountFor(food, amount, unit) {
  const n = Number(amount);
  if (!food || !Number.isFinite(n) || n <= 0) return null;
  const requested = normUnit(unit || food.defaultUnit);
  const basis = food.nutritionBasis;
  if (requested === basis.unit) return n;
  if (requested === food.defaultUnit && food.defaultUnit === basis.unit) return n;
  if (food.conversions?.[requested]) {
    const converted = n * Number(food.conversions[requested]);
    if (basis.unit === 'g') return converted;
  }
  if (requested === 'g' && basis.unit === 'g') return n;
  if (requested === 'ml' && basis.unit === 'ml') return n;
  if (requested === '食' && basis.type === 'portion') return n * basis.amount;
  if (requested === '人前' && basis.type === 'portion') return n * basis.amount;
  if (requested === 'パック' && basis.type === 'package') return n * basis.amount;
  if (requested === basis.unit) return n;
  return null;
}

export function scaleFood(foodOrId, amount, unit) {
  const food = typeof foodOrId === 'object' ? foodOrId : getFood(foodOrId);
  if (!food) return null;
  const basisInput = basisAmountFor(food, amount, unit);
  if (!basisInput) return null;
  const factor = basisInput / Number(food.nutritionBasis.amount || 1);
  const n = food.nutrition;
  return {
    p: round1(n.p * factor),
    f: round1(n.f * factor),
    c: round1(n.c * factor),
    a: round1((n.a || 0) * factor),
    kcal: Math.round(n.kcal * factor)
  };
}

export function formatAmount(amount, unit) {
  const n = Number(amount);
  const v = Number.isInteger(n) ? String(n) : String(round1(n));
  if (unit === '大さじ' || unit === '小さじ') return `${unit}${v}`;
  return `${v}${unit || ''}`;
}

function createRecord(resolved, amount, unit, meal, id) {
  if (!resolved) return null;
  const fallback = defaultAmount(resolved);
  const finalAmount = Number(amount) > 0 ? Number(amount) : fallback.amount;
  const finalUnit = String(unit || fallback.unit);
  const nutrition = scaleFood(resolved, finalAmount, finalUnit);
  if (!nutrition) return null;

  return {
    id: Number(id) || Date.now(),
    N: `${resolved.name}(${formatAmount(finalAmount, finalUnit)})`,
    P: nutrition.p,
    F: nutrition.f,
    C: nutrition.c,
    A: nutrition.a,
    Cal: nutrition.kcal,
    U: resolved.nutritionBasis.raw,
    time: ['朝','昼','晩','間食'].includes(meal) ? meal : autoMeal(),
    _clean: {
      schema: 2,
      foodId: resolved.id,
      foodIndex: resolved.index,
      amount: finalAmount,
      unit: finalUnit,
      nutritionSource: resolved.source.kind === 'mext' ? 'MEXT Food Master' : 'Food Master'
    }
  };
}

// Recovered V6 contract in Clean form:
// trusted food ID/index first, deterministic Food Master calculation second.
export function buildTrustedRecord(foodIdOrIndex, amount, unit, meal, id) {
  const food = getFood(foodIdOrIndex);
  if (!food) return null;
  const record = createRecord(food, amount, unit, meal, id);
  return validateTrustedRecord(record).ok ? record : null;
}

export function validateTrustedRecord(record) {
  const foodId = record?._clean?.foodId;
  const foodIndex = Number(record?._clean?.foodIndex);
  const food = getFood(foodId) || (Number.isFinite(foodIndex) ? getFood(foodIndex) : null);
  if (!food) return { ok:false, reason:'unknown-food-id' };

  const amount = Number(record?._clean?.amount);
  const unit = String(record?._clean?.unit || '');
  if (!(amount > 0) || !unit) return { ok:false, reason:'invalid-amount' };

  const expected = scaleFood(food, amount, unit);
  if (!expected) return { ok:false, reason:'invalid-unit' };

  const close = (a, b, tolerance = 0.11) => Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
  if (!close(record.P, expected.p) ||
      !close(record.F, expected.f) ||
      !close(record.C, expected.c) ||
      !close(record.A, expected.a) ||
      Math.abs(Number(record.Cal || 0) - Number(expected.kcal || 0)) > 1) {
    return { ok:false, reason:'nutrition-mismatch' };
  }

  return { ok:true, foodId:food.id, index:food.index };
}

export function buildRecord({ food, foodId, query, amount, unit, meal, id }) {
  const resolved = food || getFood(foodId) || resolveFood(query);
  if (!resolved) return null;
  const record = createRecord(resolved, amount, unit, meal, id);
  return validateTrustedRecord(record).ok ? record : null;
}

export function recalcRecord(record, amount, unit) {
  const foodId = record?._clean?.foodId || record?._dbv3?.id;
  let food = getFood(foodId);
  if (!food) {
    const stripped = String(record?.N || '').replace(/\([^)]*\)\s*$/,'').replace(/^🤖\s*/,'').trim();
    food = resolveFood(stripped);
  }
  if (!food) return null;
  const next = createRecord(
    food,
    Number(amount) > 0 ? Number(amount) : record?._clean?.amount || record?._dbv3?.amount || defaultAmount(food).amount,
    unit || record?._clean?.unit || record?._dbv3?.unit || defaultAmount(food).unit,
    record.time,
    record.id
  );
  return validateTrustedRecord(next).ok ? next : null;
}

export function totals(records) {
  return (records || []).reduce((s, x) => ({
    kcal: s.kcal + Number(x.Cal || 0),
    p: s.p + Number(x.P || 0),
    f: s.f + Number(x.F || 0),
    c: s.c + Number(x.C || 0),
    a: s.a + Number(x.A || 0)
  }), { kcal:0,p:0,f:0,c:0,a:0 });
}
