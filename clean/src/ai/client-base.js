import { getFood, resolveFood, defaultAmount } from '../nutrition/catalog.js';
import { autoMeal } from '../storage.js';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const MODEL = 'gemini-3.5-flash-lite';

function cleanJson(text) {
  let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try { return JSON.parse(raw); } catch (_) {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(raw.slice(s,e+1));
    throw new Error('AI JSON parse failed');
  }
}

async function gas(prompt, taskType='voice', timeoutMs=25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = {
      taskType,
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
  } finally { clearTimeout(timer); }
}

function normalizeName(name) {
  const raw = String(name || '').normalize('NFKC').trim();
  const exact = new Map([
    ['米','白米'], ['ライス','白米'], ['ご飯','白米'], ['ごはん','白米'], ['白ご飯','白米'], ['白ごはん','白米'],
    ['鶏胸','鶏むね'], ['鳥胸','鶏むね'], ['鶏胸肉','鶏むね'], ['鳥胸肉','鶏むね'], ['とりむね','鶏むね'], ['とりむね肉','鶏むね'],
    ['みそ汁','味噌汁'], ['みそしる','味噌汁']
  ]);
  if (exact.has(raw)) return exact.get(raw);
  return raw
    .replace(/鶏胸肉|鳥胸肉|とりむね肉|鶏むね肉/g,'鶏むね')
    .replace(/米飯/g,'白米')
    .replace(/みそ汁/g,'味噌汁');
}

function resolveCandidate(name) {
  return resolveFood(normalizeName(name));
}

function itemFromAi(x, fallbackMeal) {
  const name = normalizeName(x?.name || x?.food || '');
  if (!name) return null;
  const food = resolveCandidate(name);
  const suggested = food ? defaultAmount(food) : { amount: null, unit: '' };
  const rawAmount = Number(x?.amount);
  const hasAmount = Number.isFinite(rawAmount) && rawAmount > 0;
  let amount = hasAmount ? rawAmount : null;
  let unit = String(x?.unit || '').trim();
  if (!unit && amount != null && food) unit = suggested.unit;

  const canAssume = food && !food.criticalAmount && amount == null;
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
    meal: ['朝','昼','晩','間食'].includes(x?.meal) ? x.meal : fallbackMeal,
    unresolved: !food,
    needsAmount: !!food && amount == null && food.criticalAmount,
    assumed: canAssume,
    confidence: Number.isFinite(Number(x?.confidence)) ? Number(x.confidence) : 0.7
  };
}

function prompt(text, current, mode) {
  const compact = (current || []).map(x => ({
    name:x.name, amount:x.amount, unit:x.unit, meal:x.meal,
    foodId:x.foodId || null, unresolved:x.unresolved, needsAmount:x.needsAmount
  }));
  return `あなたは食事記録アプリの「自然言語理解」だけを担当します。栄養値は絶対に生成・推定しません。
食品名・量・単位・食事区分だけを整理してください。最終的なPFC/kcalはアプリ内Food Masterが食品IDから機械計算します。

重要:
- 食品名を勝手に別の食品へ置き換えない。
- 曖昧な食品は曖昧なまま返してよい。アプリ側がFood Masterで解決できなければ登録を止める。
- 「米」「ご飯」「ごはん」「ライス」は食事文脈では「白米」。
- 「鶏胸」「鶏胸肉」「とりむね」は「鶏むね」。皮の指定がなければアプリ側で「鶏むね(皮なし)」へ解決する。
- 「みそ汁」は「味噌汁」。
- p/f/c/kcal等の栄養値は出力しない。

目的: ユーザーが食べた物を「今日の食事メモ」に残し、必要なところだけ聞き返す。

ルール:
- 返す items は現在のメモを反映した完全版。今回の発言だけの差分ではない。
- ユーザーが「追加」「訂正」「消して」と言ったら currentMemo を自然に更新する。
- 納豆、味噌汁、卵、個包装など通常1単位が自然な食品は、量の指定がなければ1パック/1杯/1個などを仮定してよい。
- 鶏肉・肉・魚・白米・パスタ・オートミールなど量で栄養が大きく変わるものは、量不明のまま残す。勝手にg数を決めない。
- 「150g」のように食品名を省略した回答は、currentMemoで量が未確定の食品が1つならそこへ適用する。
- すべての項目を確認しない。聞き返しは登録に必要な重要情報だけ。
- 食品名を聞き取れたら量未確定でも items に必ず残す。
- question は次に1つだけ聞く質問。質問不要なら空文字。
- reply は短い状態説明。会話モードでも長話しない。
- Markdown禁止。JSONのみ。

currentMemo: ${JSON.stringify(compact)}
interactionMode: ${mode}
recommendedMeal: ${autoMeal()}
user: ${text}

出力:
{"items":[{"key":"既存なら維持、なければ短いID","name":"食品名","amount":150,"unit":"g","meal":"朝|昼|晩|間食","confidence":0.9}],"question":"必要な時だけ1つ","reply":"短い説明"}`;
}

function mergeStableKeys(current, incoming) {
  const used = new Set();
  return incoming.map(item => {
    const match = current.find((x,i) => !used.has(i) && (x.foodId && item.foodId ? x.foodId === item.foodId : x.name === item.name));
    if (!match) return item;
    const idx = current.indexOf(match); used.add(idx);
    return { ...item, key: match.key };
  });
}

export async function parseMealTurn(text, current = [], mode = 'voice') {
  // If the user was answering the app's single pending amount question, the
  // trusted local resolver has already applied that number to the known Food ID.
  // Do not spend a network round trip asking AI to rediscover the same fact.
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

  const raw = await gas(prompt(text, current, mode), 'voice');
  const parsed = cleanJson(raw);
  const fallbackMeal = autoMeal();
  const items = Array.isArray(parsed.items) ? parsed.items.map(x => itemFromAi(x, fallbackMeal)).filter(Boolean) : [];
  return {
    items: mergeStableKeys(current, items),
    question: String(parsed.question || '').trim(),
    reply: String(parsed.reply || '').trim(),
    source: 'ai'
  };
}

function phraseCandidates(text) {
  return String(text || '')
    .replace(/[、。,.]/g,'|')
    .replace(/(?:それと|それから|あと|そして)/g,'|')
    .replace(/(kg|g|グラム|ml|mL|ミリリットル|杯|個|パック|P|本|枚|切れ|食|人前|皿|袋|缶)\s*(?:と|や)\s*/gi,'$1|')
    .split('|')
    .map(x => x.trim())
    .filter(Boolean);
}

function parseSpokenQuantity(raw) {
  const text = String(raw || '').normalize('NFKC');
  const m = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|グラム|ml|mL|ミリリットル|杯|個|パック|P|本|枚|切れ|食|人前|皿|袋|缶)(?:\s|$)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(kg|g|グラム|ml|mL|ミリリットル|杯|個|パック|P|本|枚|切れ|食|人前|皿|袋|缶)/i);
  if (!m) return null;
  let amount = Number(m[1]);
  let unit = String(m[2] || '');
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/^kg$/i.test(unit)) { amount *= 1000; unit = 'g'; }
  if (unit === 'グラム') unit = 'g';
  if (/^(ml|mL|ミリリットル)$/i.test(unit)) unit = 'ml';
  if (/^(P|パック)$/i.test(unit)) unit = 'パック';
  return { amount, unit, matched: m[0], nameText: text.replace(m[0], ' ').replace(/\s+/g,' ').trim() };
}

function parseBareQuantity(raw) {
  const text = String(raw || '').normalize('NFKC').trim();
  const m = text.match(/^(\d+(?:\.\d+)?)\s*(?:くらい|ぐらい|ほど|程度)?$/);
  if (!m) return null;
  const amount = Number(m[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount } : null;
}

function isQuantityOnlyTurn(raw) {
  if (parseBareQuantity(raw)) return true;
  const qty = parseSpokenQuantity(raw);
  return !!qty && !normalizeName(qty.nameText);
}

// Conservative immediate memo. It may only attach a Food Master ID through the
// trusted exact resolver. Fuzzy search remains manual-UI-only.
export function optimisticDraft(text, current = []) {
  const parts = phraseCandidates(text);
  const next = current.map(x => ({...x, localQuantityFollowUp:false}));

  for (const part of parts) {
    const qty = parseSpokenQuantity(part);
    const bareQty = qty ? null : parseBareQuantity(part);
    const pending = next.filter(x => x.needsAmount || x.amount == null);

    // Typical follow-up: app asks 「量は？」 and the user simply answers 「200」.
    // If exactly one Food Master item is awaiting an amount, attach the number
    // deterministically using that food's known/default unit instead of calling AI.
    if (bareQty && pending.length === 1) {
      const target = pending[0];
      const food = getFood(target.foodId) || resolveCandidate(target.name);
      const unit = String(target.unit || (food ? defaultAmount(food).unit : '')).trim();
      if (food && unit) {
        target.foodId = food.id;
        target.name = food.name;
        target.amount = bareQty.amount;
        target.unit = unit;
        target.unresolved = false;
        target.needsAmount = false;
        target.optimistic = true;
        target.localQuantityFollowUp = true;
      }
      continue;
    }

    const nameText = normalizeName(qty?.nameText || part).replace(/(?:くらい|ぐらい|ほど|位)$/,'').trim();
    const food = nameText ? resolveCandidate(nameText) : null;

    if (!food && qty) {
      if (pending.length === 1) {
        const target = pending[0];
        const knownFood = getFood(target.foodId) || resolveCandidate(target.name);
        target.amount = qty.amount;
        target.unit = qty.unit || target.unit || (knownFood ? defaultAmount(knownFood).unit : '');
        target.needsAmount = false;
        target.optimistic = true;
        target.localQuantityFollowUp = isQuantityOnlyTurn(part);
      }
      continue;
    }

    if (!food) continue;

    const existing = next.find(x => x.foodId === food.id || x.name === food.name);
    if (existing) {
      if (qty) {
        existing.amount = qty.amount;
        existing.unit = qty.unit || existing.unit || defaultAmount(food).unit;
        existing.needsAmount = false;
        existing.optimistic = true;
      }
      continue;
    }

    const def = defaultAmount(food);
    const hasQty = !!qty;
    next.push({
      key: crypto.randomUUID(), name: food.name, query: part, foodId: food.id,
      amount: hasQty ? qty.amount : (food.criticalAmount ? null : def.amount),
      unit: hasQty ? (qty.unit || def.unit) : def.unit,
      meal: autoMeal(), unresolved:false, needsAmount:!hasQty && food.criticalAmount,
      assumed: !hasQty && !food.criticalAmount, confidence:0.85, optimistic:true,
      localQuantityFollowUp:false
    });
  }
  return next;
}

export async function trainerReply(text, context) {
  const p = `あなたはパーソナルジム「たまフィット」の栄養・トレーニング相談AIです。日本語で簡潔に答えてください。食事記録は変更しません。\n目標:${JSON.stringify(context.targets)}\n今日:${JSON.stringify(context.totals)}\nユーザー:${text}\nJSONで {"reply":"回答"} のみ返してください。`;
  const raw = await gas(p, 'chat');
  const parsed = cleanJson(raw);
  return String(parsed.reply || '').trim();
}

export const AI_INFO = Object.freeze({
  model: MODEL,
  endpoint: 'GAS',
  live: false,
  nutritionAuthority: 'Food Master ID only',
  resolver: 'trusted exact'
});
