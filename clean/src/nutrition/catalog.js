import { BASE_FOOD_ROWS, MEXT_ENTRIES, FOOD_DATA_META } from '../data/foods.js';

const MEXT_BY_NAME = new Map(MEXT_ENTRIES.map(x => [normalize(x.name), x]));

const SAFE_SERVING_OVERRIDES = Object.freeze({
  '白米': { unit: 'g', amount: 150, choices: [100,150,200,250,300,400], conversions: { '杯': 150 } },
  '玄米': { unit: 'g', amount: 150, choices: [100,150,200,250,300,400], conversions: { '杯': 150 } },
  '雑穀米': { unit: 'g', amount: 150, choices: [100,150,200,250,300,400], conversions: { '杯': 150 } },
  '麦ご飯': { unit: 'g', amount: 150, choices: [100,150,200,250,300,400], conversions: { '杯': 150 } },
  '納豆': { unit: 'パック', amount: 1 },
  '味噌汁': { unit: '杯', amount: 1 },
  '全卵(M)': { unit: '個', amount: 1 },
  '全卵(L)': { unit: '個', amount: 1 },
  'ゆで卵': { unit: '個', amount: 1 },
  'プロテイン': { unit: 'スクープ', amount: 1 }
});

const CRITICAL_MASS_RE = /(鶏|豚|牛|肉|魚|サバ|アジ|鮭|マグロ|白米|玄米|雑穀|麦ご飯|パスタ|オートミール|さつまいも|じゃがいも)/;

// Explicit product aliases are allowed to be opinionated because they are part of
// the application contract, not a fuzzy search guess.
// In particular, plain 「米」 must never resolve to 「米みそ」.
const QUERY_DEFAULTS = Object.freeze({
  '味噌汁': '味噌汁(豆腐わかめ)',
  'みそ汁': '味噌汁(豆腐わかめ)',
  'みそしる': '味噌汁(豆腐わかめ)',
  '鶏むね': '鶏むね(皮なし)',
  '鶏胸': '鶏むね(皮なし)',
  '鶏胸肉': '鶏むね(皮なし)',
  '鶏むね肉': '鶏むね(皮なし)',
  '鳥胸': '鶏むね(皮なし)',
  '鳥胸肉': '鶏むね(皮なし)',
  'とりむね': '鶏むね(皮なし)',
  'とりむね肉': '鶏むね(皮なし)',
  'ご飯': '白米',
  'ごはん': '白米',
  '白ご飯': '白米',
  '白ごはん': '白米',
  '米': '白米',
  'ライス': '白米',
  '卵': '全卵(M)',
  'たまご': '全卵(M)'
});

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[・･\s]/g, '')
    .replace(/[()（）]/g, '')
    .trim();
}

function parseNumber(value) {
  const raw = String(value || '').trim();
  if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(raw)) {
    const [a,b] = raw.split('/').map(Number);
    return b ? a / b : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parseBasis(raw, name = '') {
  const value = String(raw || '').normalize('NFKC').trim();
  let m = value.match(/^([0-9.]+)g$/i);
  if (m) return { amount: Number(m[1]), unit: 'g', type: 'mass', raw: value };
  m = value.match(/^([0-9.]+)ml$/i);
  if (m) return { amount: Number(m[1]), unit: 'ml', type: 'volume', raw: value };
  m = value.match(/^(大さじ|小さじ)([0-9./]+)$/);
  if (m) return { amount: parseNumber(m[2]), unit: m[1], type: 'cooking', raw: value };
  m = value.match(/^([0-9.]+(?:\/[0-9.]+)?)(個分|小袋|人前|切れ|パック|スクープ|個|本|枚|切|粒|玉|束|缶|袋|杯|皿|食|箱|P|舟|かけ|片|尾|貫|合)$/i);
  if (m) {
    const map = { P: 'パック', p: 'パック' };
    return { amount: parseNumber(m[1]), unit: map[m[2]] || m[2], type: /パック|缶|袋|箱|小袋/.test(m[2]) ? 'package' : /杯|皿|食|人前|舟|合/.test(m[2]) ? 'portion' : 'count', raw: value };
  }
  if (/^(S|M|L|並|小|大|特盛|メガ)$/i.test(value)) return { amount: 1, unit: '食', type: 'portion', raw: value, variant: value };
  return { amount: 1, unit: value || (/汁|スープ/.test(name) ? '杯' : '食'), type: 'portion', raw: value || '1食' };
}

function mextNutrition(name, legacyNutrition) {
  const hit = MEXT_BY_NAME.get(normalize(name));
  if (!hit) return { nutrition: legacyNutrition, source: { kind: 'catalog', label: 'PFC Food Master base' }, canonicalId: null };
  return {
    nutrition: { ...hit.source.per100g },
    source: {
      kind: 'mext',
      label: hit.source.label,
      itemNo: hit.source.itemNo,
      officialName: hit.source.officialName,
      verifiedAt: hit.source.verifiedAt,
      datasetSha256: hit.source.datasetSha256
    },
    canonicalId: hit.canonicalId
  };
}

function buildFood(row, index) {
  const [legacyCategory, name, aliasesRaw, unitRaw, p, f, c, kcal, a = 0] = row;
  const basis = parseBasis(unitRaw, name);
  const legacyNutrition = { p: Number(p)||0, f: Number(f)||0, c: Number(c)||0, a: Number(a)||0, kcal: Number(kcal)||0 };
  const official = mextNutrition(name, legacyNutrition);
  let nutrition = official.nutrition;
  let nutritionBasis = basis;
  if (official.source.kind === 'mext') {
    nutritionBasis = { amount: 100, unit: 'g', type: 'mass', raw: '100g' };
  }
  const override = SAFE_SERVING_OVERRIDES[name] || null;
  const defaultUnit = override?.unit || nutritionBasis.unit;
  const defaultAmount = override?.amount || nutritionBasis.amount || 1;
  const aliases = String(aliasesRaw || '').split(/\s+/).filter(Boolean);
  return {
    id: official.canonicalId || `food:${index}`,
    index,
    name,
    category: String(legacyCategory || ''),
    aliases,
    searchText: normalize([name, ...aliases].join(' ')),
    nutrition,
    nutritionBasis,
    source: official.source,
    canonicalId: official.canonicalId,
    defaultUnit,
    defaultAmount,
    conversions: override?.conversions || {},
    choices: override?.choices || null,
    criticalAmount: nutritionBasis.type === 'mass' && CRITICAL_MASS_RE.test(name)
  };
}

const BASE_FOODS = BASE_FOOD_ROWS.map(buildFood);
const EXISTING = new Set(BASE_FOODS.map(x => normalize(x.name)));
const MEXT_ONLY = MEXT_ENTRIES
  .filter(x => !EXISTING.has(normalize(x.name)))
  .map((entry, offset) => ({
    id: entry.canonicalId,
    index: BASE_FOODS.length + offset,
    name: entry.name,
    category: 'MEXT',
    aliases: [entry.source.officialName],
    searchText: normalize(`${entry.name} ${entry.source.officialName}`),
    nutrition: { ...entry.source.per100g },
    nutritionBasis: { amount: 100, unit: 'g', type: 'mass', raw: '100g' },
    source: { ...entry.source },
    canonicalId: entry.canonicalId,
    defaultUnit: 'g',
    defaultAmount: 100,
    conversions: {},
    choices: null,
    criticalAmount: CRITICAL_MASS_RE.test(entry.name)
  }));

export const FOODS = Object.freeze([...BASE_FOODS, ...MEXT_ONLY]);
const BY_ID = new Map(FOODS.map(x => [x.id, x]));
const BY_NAME = new Map(FOODS.map(x => [normalize(x.name), x]));
const DEFAULT_BY_QUERY = new Map(
  Object.entries(QUERY_DEFAULTS).map(([query, name]) => [normalize(query), name])
);

// Alias strings in the legacy database include intentionally broad tokens such as
// 「米」「肉」「魚」. They may only auto-resolve when the exact alias belongs to
// one food. Ambiguous aliases remain unresolved and are left for AI/user confirmation.
const ALIAS_BUCKETS = new Map();
for (const food of FOODS) {
  for (const alias of food.aliases || []) {
    const key = normalize(alias);
    if (!key) continue;
    const bucket = ALIAS_BUCKETS.get(key) || [];
    if (!bucket.some(x => x.id === food.id)) bucket.push(food);
    ALIAS_BUCKETS.set(key, bucket);
  }
}

export function getFood(idOrIndex) {
  if (typeof idOrIndex === 'number') return FOODS[idOrIndex] || null;
  return BY_ID.get(String(idOrIndex)) || null;
}

function score(food, q) {
  const nq = normalize(q);
  if (!nq) return 0;
  const nn = normalize(food.name);
  if (nn === nq) return 1000;
  if (nn.startsWith(nq)) return 750;
  if (food.searchText.includes(nq)) return 500;
  if (nq.includes(nn) && nn.length >= 2) return 350;
  return 0;
}

// Fuzzy search is UI-only. It may offer candidates, but it must never be used as
// the nutrition truth selector.
export function searchFoods(query, limit = 12) {
  const q = String(query || '').trim();
  if (!q) return [];
  return FOODS.map(food => ({ food, score: score(food, q) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'ja'))
    .slice(0, limit)
    .map(x => x.food);
}

// Trusted automatic resolver.
// No prefix/substring winner is accepted here. Nutrition is allowed to flow only
// after an explicit app alias, exact canonical name, or unique exact DB alias.
export function resolveFood(query) {
  const key = normalize(query);
  if (!key) return null;

  const preferredName = DEFAULT_BY_QUERY.get(key);
  if (preferredName) {
    const preferred = BY_NAME.get(normalize(preferredName));
    if (preferred) return preferred;
  }

  const exact = BY_NAME.get(key);
  if (exact) return exact;

  const aliases = ALIAS_BUCKETS.get(key) || [];
  if (aliases.length === 1) return aliases[0];

  return null;
}

export const resolveTrustedFood = resolveFood;

export function defaultAmount(food) {
  return { amount: food?.defaultAmount || 1, unit: food?.defaultUnit || '食' };
}

export function amountChoices(food) {
  if (!food) return [];
  if (food.choices) return food.choices;
  const base = Number(food.defaultAmount || food.nutritionBasis.amount || 1);
  const type = food.nutritionBasis.type;
  if (type === 'mass') {
    if (base <= 30) return [Math.max(5,base/2), base, base*1.5, base*2].map(v => Math.round(v));
    return [...new Set([50,100,150,200,250,300].filter(v => v >= Math.min(50, base/2)))];
  }
  if (type === 'volume') return [100,200,300,500];
  if (type === 'count' || type === 'package') return [1,2,3,4];
  return [0.5,1,1.5,2];
}

export function catalogInfo() {
  return { foods: FOODS.length, ...FOOD_DATA_META, resolver: 'trusted-exact-v2' };
}
