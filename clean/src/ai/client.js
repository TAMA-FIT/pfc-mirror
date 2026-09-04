import { FOODS, resolveFood, searchFoods, defaultAmount } from '../nutrition/catalog.js';
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
  const raw = String(name || '').trim();
  const aliases = [
    [/鶏胸肉|鳥胸肉|とりむね肉|鶏むね肉/g,'鶏むね'],
    [/ご飯|ごはん|米飯/g,'白米'],
    [/みそ汁/g,'味噌汁']
  ];
  return aliases.reduce((s,[re,v]) => s.replace(re,v), raw);
}

function resolveCandidate(name) {
  const n = normalizeName(name);
  let food = resolveFood(n);
  if (!food && n === '鶏むね') {
    food = resolveFood('鶏むね(皮なし)');
  }
  return food;
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
  const compact = (current || []).map(x => ({ name:x.name, amount:x.amount, unit:x.unit, meal:x.meal, unresolved:x.unresolved, needsAmount:x.needsAmount }));
  return `あなたは食事記録アプリの会話メモ整理エンジンです。栄養値は生成しません。食品名・量・単位・食事区分だけを整理してください。

目的: ユーザーが食べた物を「今日の食事メモ」に残し、必要なところだけ聞き返す。

ルール:
- 返す items は現在のメモを反映した完全版。今回の発言だけの差分ではない。
- ユーザーが「追加」「訂正」「消して」と言ったら currentMemo を自然に更新する。
- 納豆、味噌汁、卵、個包装など通常1単位が自然な食品は、量の指定がなければ1パック/1杯/1個などを仮定してよい。
- 鶏肉・肉・魚・白米・パスタ・オートミールなど量で栄養が大きく変わるものは、量不明のまま残す。勝手にg数を決めない。
- 「150g」のように食品名を省略した回答は、currentMemoで量が未確定の食品が1つならそこへ適用する。
- 鶏むねは皮あり/なしが明示されなければ一般的な食事記録として「鶏むね(皮なし)」を候補にしてよい。必要なら後で修正できる。
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
    .replace(/(?:と|や|それと|あと)/g,'|')
    .split('|')
    .map(x => x.trim())
    .filter(Boolean);
}

export function optimisticDraft(text, current = []) {
  const parts = phraseCandidates(text);
  const next = current.map(x => ({...x}));
  const seen = new Set(next.map(x => x.foodId || x.name));
  for (const part of parts) {
    const preferred = resolveFood(part);
    let hits = preferred ? [preferred] : searchFoods(part, 3);
    if (!hits.length) {
      // Scan contained canonical names for fast common multi-food utterances.
      hits = FOODS.filter(f => f.name.length >= 2 && part.includes(f.name.replace(/\([^)]*\)/,''))).slice(0,3);
    }
    const food = hits[0];
    if (!food || seen.has(food.id)) continue;
    const def = defaultAmount(food);
    next.push({
      key: crypto.randomUUID(), name: food.name, query: part, foodId: food.id,
      amount: food.criticalAmount ? null : def.amount,
      unit: def.unit, meal: autoMeal(), unresolved:false, needsAmount:food.criticalAmount,
      assumed: !food.criticalAmount, confidence:0.55, optimistic:true
    });
    seen.add(food.id);
  }
  return next;
}

export async function trainerReply(text, context) {
  const p = `あなたはパーソナルジム「たまフィット」の栄養・トレーニング相談AIです。日本語で簡潔に答えてください。食事記録は変更しません。\n目標:${JSON.stringify(context.targets)}\n今日:${JSON.stringify(context.totals)}\nユーザー:${text}\nJSONで {"reply":"回答"} のみ返してください。`;
  const raw = await gas(p, 'chat');
  const parsed = cleanJson(raw);
  return String(parsed.reply || '').trim();
}

export const AI_INFO = Object.freeze({ model: MODEL, endpoint: 'GAS', live: false });
