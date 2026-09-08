import { getFood, resolveFood, searchFoods, defaultAmount } from '../nutrition/catalog.js';
import { autoMeal } from '../storage.js';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const MODEL = 'gemini-3.5-flash-lite';
const MAX_CANDIDATES = 30;

function cleanJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(raw); } catch (_) {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(raw.slice(s, e + 1));
    throw new Error('AI JSON parse failed');
  }
}

async function gas(prompt, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = {
      taskType: 'voice',
      modelPreference: MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map(x => String(x?.text || '')).join('').trim() : String(data?.text || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeName(value) {
  let raw = String(value || '').normalize('NFKC').trim();
  if (!raw) return '';

  if (/^(米|ライス|ご飯|ごはん|白ご飯|白ごはん)$/.test(raw)) return '白米';
  if (/^(みそ汁|みそしる)$/.test(raw)) return '味噌汁';

  if (/(鶏|鳥|とり).*(胸|むね)|^(胸肉)$/.test(raw)) {
    if (/皮\s*(あり|有り|付き|つき)|皮付き|皮つき/.test(raw)) return '鶏むね(皮あり)';
    if (/皮\s*(なし|無し)|皮なし|皮無し|皮を?(取|除|外)/.test(raw)) return '鶏むね(皮なし)';
    return '鶏むね';
  }

  return raw
    .replace(/米飯/g, '白米')
    .replace(/みそ汁/g, '味噌汁');
}

function familyName(value) {
  return normalizeName(value)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/皮あり|皮なし|皮付き|皮つき|皮無し/g, '')
    .trim();
}

function addCandidate(map, food) {
  if (!food?.id || map.has(food.id) || map.size >= MAX_CANDIDATES) return;
  map.set(food.id, food);
}

function extractQueries(text) {
  const raw = String(text || '').normalize('NFKC');
  const split = raw
    .replace(/(?:それと|それから|あと|そして|じゃあ|いや|訂正|変更)/g, '|')
    .replace(/[、。,.]/g, '|')
    .replace(/\s+(?:と|や)\s+/g, '|')
    .split('|')
    .map(x => x
      .replace(/\d+(?:\.\d+)?\s*(?:kg|g|グラム|ml|mL|杯|個|パック|P|本|枚|切れ|食|人前|皿|袋|缶)?/gi, ' ')
      .replace(/(?:食べた|食べました|食いました|お願い|お願いします|くらい|ぐらい|ほど)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(x => x.length >= 1);
  return [...new Set(split)].slice(0, 12);
}

function trustedCandidates(text, current) {
  const map = new Map();

  for (const item of current || []) {
    addCandidate(map, getFood(item.foodId));
    const family = familyName(item.name);
    if (family) searchFoods(family, 8).forEach(food => addCandidate(map, food));
  }

  for (const q of extractQueries(text)) {
    const normalized = normalizeName(q);
    addCandidate(map, resolveFood(normalized));
    searchFoods(normalized, 6).forEach(food => addCandidate(map, food));
  }

  // Contextual variant families. These are candidate offers only; AI still has to
  // choose one and the app validates the chosen ID before nutrition can flow.
  if (/(鶏|鳥|とり).*(胸|むね)|皮あり|皮なし|皮付き|皮つき/.test(String(text || '')) ||
      (current || []).some(x => /鶏むね/.test(String(x.name || '')))) {
    searchFoods('鶏むね', 8).forEach(food => addCandidate(map, food));
  }
  if (/(米|ご飯|ごはん|ライス)/.test(String(text || '')) ||
      (current || []).some(x => /白米/.test(String(x.name || '')))) {
    addCandidate(map, resolveFood('白米'));
  }

  return [...map.values()].map(food => ({ foodId: food.id, name: food.name }));
}

function prompt(text, current, mode, candidates) {
  const compact = (current || []).map(x => ({
    key: x.key,
    foodId: x.foodId || null,
    name: x.name,
    amount: x.amount,
    unit: x.unit,
    meal: x.meal,
    unresolved: !!x.unresolved,
    needsAmount: !!x.needsAmount,
    assumed: !!x.assumed
  }));

  return `あなたは食事記録アプリの会話理解エンジンです。普通の会話AIと同じように、文脈・省略・訂正・言い直しを柔軟に理解してください。
ただし、栄養値の計算はあなたの仕事ではありません。P/F/C/kcal等の栄養値は絶対に生成・推定しないでください。最終的な栄養値はアプリがFood MasterのfoodIdから機械計算します。

最重要の考え方:
- currentMemoは確定事実ではなく、直前までの作業メモです。今回のユーザー発言が訂正しているなら、以前の仮定より今回の発言を優先してください。
- 例: currentMemoが「鶏むね(皮なし)」でも、ユーザーが「いや皮ありで」「皮付きの方」と訂正したら、皮あり候補へ変更してください。
- 「それ」「そのやつ」「さっきの」などの参照表現はcurrentMemoとの会話文脈から解釈してください。
- 量の回答も文脈で対応付けてください。例: 「皮ありのやつ200、米は150」なら、対応する2食品へそれぞれ量を反映します。
- ユーザーが明示していない情報を新しく作らない。ただし納豆1パック、卵1個などアプリが既に仮置きした標準量は、ユーザーが訂正しない限り維持してよいです。

Food ID契約:
- trustedFoodCandidatesに候補がある場合、会話上もっとも適切なfoodIdをその候補から選べます。
- 選んだfoodIdは必ずtrustedFoodCandidates内のものだけにしてください。
- 候補に適切な食品がなければfoodIdは空文字にし、nameにはユーザーが意味した食品名を正確に書いてください。アプリ側が厳密照合します。
- foodIdを選ぶことは許可しますが、栄養値を出力することは禁止です。
- 既存項目を訂正する時は、可能な限り同じkeyを維持してください。

会話ルール:
- 返すitemsはcurrentMemoを今回の発言で更新した完全版です。
- 食品の追加・削除・訂正・量変更を自然に処理してください。
- 量で栄養が大きく変わる食品は、量不明なら勝手にg数を決めずneedsAmount相当として残してください。
- questionは登録に必要な不足がある時だけ、次に聞く質問を1つだけ返してください。不足がなければ空文字。
- replyは短い状態説明。Markdown禁止。JSONのみ。

interactionMode: ${mode}
recommendedMeal: ${autoMeal()}
currentMemo: ${JSON.stringify(compact)}
trustedFoodCandidates: ${JSON.stringify(candidates)}
user: ${text}

出力:
{"items":[{"key":"既存keyを優先","foodId":"候補IDまたは空文字","name":"食品名","amount":150,"unit":"g","meal":"朝|昼|晩|間食","confidence":0.9}],"question":"必要な時だけ1つ","reply":"短い説明"}`;
}

function itemFromAi(x, fallbackMeal, allowedIds) {
  const requestedId = String(x?.foodId || '').trim();
  const allowedFood = requestedId && allowedIds.has(requestedId) ? getFood(requestedId) : null;
  const name = normalizeName(x?.name || x?.food || allowedFood?.name || '');
  if (!name && !allowedFood) return null;

  const exactFood = name ? resolveFood(name) : null;
  const food = allowedFood || exactFood;
  const suggested = food ? defaultAmount(food) : { amount: null, unit: '' };
  const rawAmount = Number(x?.amount);
  const hasAmount = Number.isFinite(rawAmount) && rawAmount > 0;
  let amount = hasAmount ? rawAmount : null;
  let unit = String(x?.unit || '').trim();
  if (!unit && amount != null && food) unit = suggested.unit;

  const canAssume = !!food && !food.criticalAmount && amount == null;
  if (canAssume) {
    amount = suggested.amount;
    unit = suggested.unit;
  }

  return {
    key: String(x?.key || crypto.randomUUID()),
    name: food?.name || name,
    query: name,
    foodId: food?.id || null,
    amount,
    unit: unit || (food ? suggested.unit : ''),
    meal: ['朝', '昼', '晩', '間食'].includes(x?.meal) ? x.meal : fallbackMeal,
    unresolved: !food,
    needsAmount: !!food && amount == null && food.criticalAmount,
    assumed: canAssume,
    confidence: Number.isFinite(Number(x?.confidence)) ? Number(x.confidence) : 0.7
  };
}

function mergeStableKeys(current, incoming) {
  const used = new Set();
  return incoming.map(item => {
    let idx = -1;

    if (item.key) idx = current.findIndex((x, i) => !used.has(i) && String(x.key) === String(item.key));
    if (idx < 0) idx = current.findIndex((x, i) => !used.has(i) && x.foodId && item.foodId && x.foodId === item.foodId);
    if (idx < 0) idx = current.findIndex((x, i) => !used.has(i) && x.name === item.name);

    // Variant correction (e.g. chicken breast skinless -> skin-on) should replace
    // the existing memo row, not create a duplicate row.
    if (idx < 0) {
      const family = familyName(item.name);
      if (family) {
        const familyMatches = current
          .map((x, i) => ({ x, i }))
          .filter(({ x, i }) => !used.has(i) && familyName(x.name) === family);
        if (familyMatches.length === 1) idx = familyMatches[0].i;
      }
    }

    if (idx < 0) return item;
    used.add(idx);
    return { ...item, key: current[idx].key || item.key };
  });
}

function isQuantityOnlyTurn(raw) {
  const text = String(raw || '').normalize('NFKC').trim();
  return /^\d+(?:\.\d+)?\s*(?:kg|g|グラム|ml|mL|杯|個|パック|P|本|枚|切れ|食|人前|皿|袋|缶)?\s*(?:くらい|ぐらい|ほど|程度)?$/i.test(text);
}

export async function parseMealTurn(text, current = [], mode = 'voice') {
  const localFollowUps = (current || []).filter(x => x.localQuantityFollowUp);
  const allReady = (current || []).length > 0 && (current || []).every(x =>
    x.foodId && !x.unresolved && !x.needsAmount && Number(x.amount) > 0
  );

  if (isQuantityOnlyTurn(text) && localFollowUps.length === 1 && allReady) {
    return {
      items: current.map(({ localQuantityFollowUp, ...item }) => item),
      question: '',
      reply: '',
      source: 'local-trusted-quantity-followup'
    };
  }

  const candidates = trustedCandidates(text, current);
  const allowedIds = new Set(candidates.map(x => x.foodId));
  const raw = await gas(prompt(text, current, mode, candidates));
  const parsed = cleanJson(raw);
  const fallbackMeal = autoMeal();
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(x => itemFromAi(x, fallbackMeal, allowedIds)).filter(Boolean)
    : [];

  return {
    items: mergeStableKeys(current, items),
    question: String(parsed.question || '').trim(),
    reply: String(parsed.reply || '').trim(),
    source: 'ai-contextual-food-id'
  };
}

export const AI_INFO = Object.freeze({
  model: MODEL,
  endpoint: 'GAS',
  live: false,
  interpretation: 'contextual conversation + validated Food ID',
  nutritionAuthority: 'Food Master ID only'
});
