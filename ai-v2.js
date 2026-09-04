// PFC Mirror AI V2 - clean recorder + read-only trainer
// Loaded after the legacy runtime. It replaces only AI entry points and keeps
// database/search/favorites/history/backup/localStorage behavior untouched.
(() => {
  'use strict';

  const VERSION = '2.0.0';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  const MODEL_KEY = 'tf_ai_model_preference';
  const DEFAULT_MODEL = 'gemini-3.6-flash';
  const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  const trainerHistory = [];
  let recorderBusy = false;
  let trainerBusy = false;

  const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'replace', 'delete'] },
            targetId: { type: 'integer' },
            name: { type: 'string' },
            amount: { type: 'number' },
            unit: { type: 'string' },
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'] },
            p: { type: 'number' },
            f: { type: 'number' },
            c: { type: 'number' },
            a: { type: 'number' },
            kcal: { type: 'number' },
            nutritionSource: { type: 'string', enum: ['user', 'database', 'estimate'] },
            confidence: { type: 'number' }
          },
          required: [
            'action', 'targetId', 'name', 'amount', 'unit', 'meal',
            'p', 'f', 'c', 'a', 'kcal', 'nutritionSource', 'confidence'
          ]
        }
      }
    },
    required: ['reply', 'records']
  };

  const storage = () => window.mirrorStorage || window.localStorage;

  function rows() {
    try {
      return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : [];
    } catch (_) {
      return [];
    }
  }

  function targets() {
    try {
      return (typeof TG !== 'undefined' && TG)
        ? { kcal: Number(TG.cal || 0), p: Number(TG.p || 0), f: Number(TG.f || 0), c: Number(TG.c || 0) }
        : null;
    } catch (_) {
      return null;
    }
  }

  function totals() {
    return rows().reduce((acc, r) => {
      acc.kcal += Number(r.Cal || 0);
      acc.p += Number(r.P || 0);
      acc.f += Number(r.F || 0);
      acc.c += Number(r.C || 0);
      acc.a += Number(r.A || 0);
      return acc;
    }, { kcal: 0, p: 0, f: 0, c: 0, a: 0 });
  }

  function autoMeal() {
    try {
      if (typeof getAutoTime === 'function') {
        const t = getAutoTime();
        if (['朝', '昼', '晩', '間食'].includes(t)) return t;
      }
    } catch (_) {}
    const h = new Date().getHours();
    if (h < 11) return '朝';
    if (h < 16) return '昼';
    if (h < 22) return '晩';
    return '間食';
  }

  function recentRows(limit = 12) {
    return rows().slice(-limit).map(r => ({
      id: Number(r.id),
      meal: r.time,
      name: String(r.N || '').replace(/^🤖\s*/, ''),
      p: round1(r.P),
      f: round1(r.F),
      c: round1(r.C),
      a: round1(r.A),
      kcal: Math.round(Number(r.Cal || 0))
    }));
  }

  function round1(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  }

  function normalizeText(v) {
    return String(v || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　]+/g, '')
      .replace(/[()（）［］\[\]・,，.。]/g, '');
  }

  function dbRows() {
    try {
      return (typeof DB !== 'undefined' && Array.isArray(DB)) ? DB : [];
    } catch (_) {
      return [];
    }
  }

  // Exact/alias-only lookup. No fuzzy replacement: an unrelated DB item must
  // never overwrite a reasonable model estimate.
  function findExactDbFood(name) {
    const key = normalizeText(name);
    if (!key) return null;
    for (const item of dbRows()) {
      const canonical = normalizeText(item?.[1]);
      if (canonical && canonical === key) return item;
      const aliases = String(item?.[2] || '').split(/\s+/).map(normalizeText).filter(Boolean);
      if (aliases.includes(key)) return item;
    }
    return null;
  }

  function parseUnitSpec(raw) {
    const s = String(raw || '').normalize('NFKC').trim();
    const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|ml|個|枚|本|杯|缶|袋|パック|P|人前|食)?/i);
    return {
      amount: m ? Number(m[1]) : 1,
      unit: m?.[2] || (s.replace(/[0-9.\s]/g, '') || '')
    };
  }

  function scaleDb(item, amount, unit) {
    if (!item) return null;
    const spec = parseUnitSpec(item[3]);
    const baseAmount = Number(spec.amount) || 1;
    const inputAmount = Number(amount);
    if (!Number.isFinite(inputAmount) || inputAmount <= 0) return null;

    const baseUnit = normalizeText(spec.unit);
    const inputUnit = normalizeText(unit);
    const compatible =
      (!baseUnit && !inputUnit) ||
      (baseUnit === inputUnit) ||
      (baseUnit === 'g' && inputUnit === 'g') ||
      (baseUnit === 'ml' && inputUnit === 'ml');

    if (!compatible) return null;
    const mul = inputAmount / baseAmount;
    const p = Number(item[4] || 0) * mul;
    const f = Number(item[5] || 0) * mul;
    const c = Number(item[6] || 0) * mul;
    const storedCal = Number(item[7] || 0) * mul;
    let a = Number(item[8] || 0) * mul;

    // Legacy DB rows may omit alcohol grams while calories include alcohol.
    if (!a && /(酒|ビール|ワイン|サワー|ハイボール|焼酎|日本酒|梅酒|ウイスキー)/.test(String(item[1] || ''))) {
      const macroCal = p * 4 + f * 9 + c * 4;
      a = Math.max(0, (storedCal - macroCal) / 7);
    }
    return {
      name: String(item[1] || ''),
      p: round1(p),
      f: round1(f),
      c: round1(c),
      a: round1(a),
      kcal: Math.round(storedCal || (p * 4 + f * 9 + c * 4 + a * 7))
    };
  }

  function modelForRequest() {
    const saved = String(storage().getItem(MODEL_KEY) || '').trim();
    if (/^gemini-3\.(?:5|6|7|8)-/i.test(saved)) return saved;
    storage().setItem(MODEL_KEY, DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }

  function configureModelUI() {
    const select = document.getElementById('ai-model-select');
    if (!select) return;
    const options = [
      [DEFAULT_MODEL, '3.6 Flash（推奨）'],
      [FALLBACK_MODEL, '3.5 Flash Lite（高速）'],
      ['gemini-3.1-flash-lite', '3.1 Flash Lite（互換）']
    ];
    select.innerHTML = '';
    for (const [value, label] of options) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      select.appendChild(o);
    }
    select.value = modelForRequest();
    window.setAIModelPreference = value => {
      const next = options.some(([v]) => v === value) ? value : DEFAULT_MODEL;
      storage().setItem(MODEL_KEY, next);
      select.value = next;
      if (typeof window.showToast === 'function') {
        const label = options.find(([v]) => v === next)?.[1] || next;
        window.showToast(`AIモデル: ${label}`);
      }
    };
  }

  function recorderPrompt(userText) {
    const recent = recentRows(12);
    return `あなたは食事記録アプリの「入力理解エンジン」です。
ユーザーが自然な日本語で話した食事内容を理解し、食事記録操作だけをJSONで返してください。
ユーザーは雑に話します。音声認識の軽い誤変換は文脈から自然に補正してください。

重要:
- 食品名・量・PFC・カロリーを自然に推定する能力を使ってください。不要なルール推測や独自タグは使いません。
- p/f/c/a/kcal は「実際に食べた量の合計値」です。100gあたりの値ではありません。
- ユーザー自身がカロリー/PFCを明示した場合は、その明示値を最優先し nutritionSource="user"。
- 一般的な単品食品や料理は、一般的な日本の食品成分・標準的な一食量から妥当な値を推定して構いません。
- 店名・商品名の正確な公式値に確信がなければ、標準的な推定値として扱い nutritionSource="estimate"、confidenceを少し下げます。
- 量が「普通盛り」「一杯」「一皿」などでも、日常的に妥当な量として推定して構いません。極端に保守的にならないでください。
- 朝/昼/晩/間食が明示されていなければ推奨時間帯を使います。
- 訂正・削除の場合、下記の直近記録IDだけを参照してください。存在しないIDを作らないでください。
- 「さっきの卵2個じゃなく3個」などは replace。
- 「さっきの消して」などは delete。
- 新しい食事は add。
- 食事記録操作でない発言なら records=[] とし、replyで短く案内してください。
- [DATA] や [REPLACE] など旧形式は絶対に出力しません。
- Markdownは禁止。JSON以外の文字を出力しません。

推奨時間帯: ${autoMeal()}
直近記録: ${JSON.stringify(recent)}
ユーザー発言: ${userText}

出力:
{
  "reply": "ユーザーに見せる短い日本語",
  "records": [
    {
      "action": "add|replace|delete",
      "targetId": 0,
      "name": "食品名",
      "amount": 1,
      "unit": "g/個/杯/人前など",
      "meal": "朝|昼|晩|間食",
      "p": 0,
      "f": 0,
      "c": 0,
      "a": 0,
      "kcal": 0,
      "nutritionSource": "user|database|estimate",
      "confidence": 0.0
    }
  ]
}`;
  }

  function trainerPrompt(userText) {
    return `あなたはパーソナルジム「たまフィット」のTrainer AIです。
日本語の丁寧な標準語で、栄養、PFC、減量、筋肥大、食事、トレーニングの相談に専門家として自然に答えてください。

このチャットは完全にread-onlyです。食事記録の追加・変更・削除は絶対に実行しません。
相談内容に対して普通の優秀なAIアシスタントとして考え、簡潔ですが必要な理由と具体策を答えてください。
過剰なキャラクター演技、独自コマンド、[DATA]等の機械用タグは禁止です。
数値に不確実性がある場合は妥当な目安として示してください。

目標: ${JSON.stringify(targets())}
今日の摂取合計: ${JSON.stringify(totals())}
今日の直近記録: ${JSON.stringify(recentRows(20))}
最近の会話: ${JSON.stringify(trainerHistory.slice(-8))}
ユーザー: ${userText}`;
  }

  async function fetchGemini(prompt, taskType, wantJson) {
    const basePayload = {
      taskType,
      modelPreference: modelForRequest(),
      contents: [{ parts: [{ text: prompt }] }]
    };

    const attempts = [];
    if (wantJson) {
      attempts.push({
        ...basePayload,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      });
    }
    attempts.push(basePayload);

    let lastError = null;
    for (const payload of attempts) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) {
          lastError = new Error(`AI HTTP ${response.status}`);
          continue;
        }
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts)
          ? parts.map(p => String(p?.text || '')).join('').trim()
          : String(data?.text || '').trim();
        if (text) return text;
        lastError = new Error('AI response empty');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('AI request failed');
  }

  function parseJsonResponse(text) {
    let raw = String(text || '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(raw);
    } catch (_) {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
      throw new Error('AI JSON parse failed');
    }
  }

  function saneNumber(v, max) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  }

  function validateRecord(op) {
    if (!op || !['add', 'replace', 'delete'].includes(op.action)) return null;
    const targetId = Number(op.targetId || 0);
    if (op.action === 'delete') {
      return { action: 'delete', targetId: Number.isFinite(targetId) ? targetId : 0 };
    }

    const name = String(op.name || '').trim();
    if (!name) return null;

    const p = saneNumber(op.p, 350);
    const f = saneNumber(op.f, 350);
    const c = saneNumber(op.c, 700);
    const a = saneNumber(op.a, 300);
    const kcal = saneNumber(op.kcal, 4500);
    if ([p, f, c, a, kcal].some(v => v === null)) return null;

    const meal = ['朝', '昼', '晩', '間食'].includes(op.meal) ? op.meal : autoMeal();
    const confidence = Math.max(0, Math.min(1, Number(op.confidence ?? 0.7) || 0.7));
    return {
      action: op.action,
      targetId: Number.isFinite(targetId) ? targetId : 0,
      name,
      amount: Number(op.amount) > 0 ? Number(op.amount) : 1,
      unit: String(op.unit || '').trim(),
      meal,
      p: round1(p),
      f: round1(f),
      c: round1(c),
      a: round1(a),
      kcal: Math.round(kcal),
      nutritionSource: ['user', 'database', 'estimate'].includes(op.nutritionSource) ? op.nutritionSource : 'estimate',
      confidence
    };
  }

  function nutritionFor(op) {
    // User-stated nutrition always wins.
    if (op.nutritionSource === 'user') return op;

    const db = findExactDbFood(op.name);
    const scaled = db ? scaleDb(db, op.amount, op.unit) : null;
    if (!scaled) return op;

    return {
      ...op,
      name: scaled.name || op.name,
      p: scaled.p,
      f: scaled.f,
      c: scaled.c,
      a: scaled.a,
      kcal: scaled.kcal,
      nutritionSource: 'database',
      confidence: Math.max(op.confidence, 0.98)
    };
  }

  // Prefer the recovered V6 Food Master for recognized foods.
  // Gemini still understands the user's natural language; nutrition truth comes from Food Master.
  function buildFoodMasterItem(op, forcedId) {
    if (op?.nutritionSource === 'user') return null;
    const e = window.__PFC_MEAL_ENGINE_V50__;
    if (!e?.safeResolveFood || !e?.buildTrustedRecord) return null;
    const resolved = e.safeResolveFood(String(op?.name || '').trim());
    const index = Number(resolved?.index);
    const amount = Number(op?.amount);
    if (!Number.isFinite(index) || !(amount > 0)) return null;
    try {
      const record = e.buildTrustedRecord(index, amount, String(op?.unit || '').trim(), op?.meal, forcedId || undefined);
      const check = e.validateTrustedRecord?.(record);
      if (!record || check?.ok === false) return null;
      record._aiV2 = {
        version: VERSION,
        nutritionSource: 'Food Master',
        model: modelForRequest(),
        amount,
        unit: String(op?.unit || '').trim(),
        at: Date.now()
      };
      return record;
    } catch (_) {
      return null;
    }
  }

  function persistRows() {
    try {
      storage().setItem('tf_dat', JSON.stringify(rows()));
      if (typeof ren === 'function') ren();
      if (typeof upd === 'function') upd();
    } catch (e) {
      console.error('[PFC AI V2] persist failed', e);
    }
  }

  function applyOperations(rawRecords) {
    const list = Array.isArray(rawRecords) ? rawRecords : [];
    const accepted = [];
    const rejected = [];
    let changed = false;

    for (const raw of list) {
      let op = validateRecord(raw);
      if (!op) {
        rejected.push(raw);
        continue;
      }

      if (op.action === 'delete') {
        const idx = rows().findIndex(r => Number(r.id) === Number(op.targetId));
        if (idx < 0) {
          rejected.push(raw);
          continue;
        }
        const removed = rows()[idx];
        rows().splice(idx, 1);
        accepted.push({ action: 'delete', item: removed });
        changed = true;
        continue;
      }

      op = nutritionFor(op);
      if (op.confidence < 0.35) {
        rejected.push(raw);
        continue;
      }

      const item = buildFoodMasterItem(op, op.action === 'replace' && op.targetId ? op.targetId : null) || {
        id: op.action === 'replace' && op.targetId ? op.targetId : Date.now() + Math.floor(Math.random() * 10000),
        N: '🤖 ' + op.name,
        P: op.p,
        F: op.f,
        C: op.c,
        A: op.a,
        Cal: op.kcal,
        U: 'AI',
        time: op.meal
      };

      if (op.action === 'replace') {
        const idx = rows().findIndex(r => Number(r.id) === Number(op.targetId));
        if (idx < 0) {
          rejected.push(raw);
          continue;
        }
        // Preserve meal when a correction did not intentionally change it.
        item.time = op.meal || rows()[idx].time || autoMeal();
        rows()[idx] = item;
      } else {
        rows().push(item);
      }
      accepted.push({ action: op.action, item, source: item?._mealEngine?.nutritionSource || op.nutritionSource, confidence: op.confidence });
      changed = true;
    }

    if (changed) persistRows();
    return { accepted, rejected };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function message(channel, role, text) {
    const boxId = channel === 'voice' ? 'v-chat-messages' : 'chat-messages';
    const box = document.getElementById(boxId);
    if (!box) return null;
    const id = `ai2-${channel}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `msg ${role}`;

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.innerHTML = role === 'bot'
      ? '<div class="trainer-ai-icon" aria-label="Trainer AI">AI</div>'
      : '<div class="user-chat-icon">YOU</div>';

    const body = document.createElement('div');
    body.className = 'text';
    body.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');

    if (role === 'bot') div.append(icon, body);
    else div.append(body, icon);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
  }

  function removeMessage(id) {
    if (id) document.getElementById(id)?.remove();
  }

  function resultSummary(accepted, fallbackReply) {
    if (!accepted.length) return fallbackReply || '記録する内容を特定できませんでした。もう少し具体的に話してください。';
    const adds = accepted.filter(x => x.action === 'add').length;
    const reps = accepted.filter(x => x.action === 'replace').length;
    const dels = accepted.filter(x => x.action === 'delete').length;
    const lines = [];
    if (adds) lines.push(`${adds}件追加しました。`);
    if (reps) lines.push(`${reps}件修正しました。`);
    if (dels) lines.push(`${dels}件削除しました。`);
    accepted.filter(x => x.item && x.action !== 'delete').forEach(x => {
      const r = x.item;
      lines.push(`${String(r.N || '').replace(/^🤖\s*/, '')}：${Math.round(r.Cal)}kcal / P${round1(r.P)} F${round1(r.F)} C${round1(r.C)}`);
    });
    return lines.join('\n');
  }

  async function sendVoiceV2() {
    const input = document.getElementById('v-chat-input');
    const text = String(input?.value || '').trim();
    if (!text || recorderBusy) return;

    recorderBusy = true;
    if (input) {
      input.value = '';
      input.disabled = true;
    }
    const status = document.getElementById('v-status-text');
    if (status) status.textContent = 'AI解析中';
    message('voice', 'user', text);
    const loadingId = message('voice', 'bot', '食事内容を整理しています…');

    try {
      const raw = await fetchGemini(recorderPrompt(text), 'voice', true);
      const result = parseJsonResponse(raw);
      const applied = applyOperations(result.records);
      removeMessage(loadingId);
      const reply = resultSummary(applied.accepted, String(result.reply || '').trim());
      message('voice', 'bot', reply);
      if (applied.rejected.length && !applied.accepted.length && typeof window.showToast === 'function') {
        window.showToast('数値または対象を確認できなかったため登録を止めました。');
      }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
    } catch (e) {
      console.error('[PFC AI V2] recorder failed', e);
      removeMessage(loadingId);
      message('voice', 'bot', e?.name === 'AbortError'
        ? '処理が長引きました。内容を少し分けてもう一度送ってください。'
        : 'AI解析に失敗しました。もう一度送ってください。');
    } finally {
      recorderBusy = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (status) status.textContent = 'マイクOFF';
    }
  }

  async function sendTrainerV2() {
    const input = document.getElementById('chat-input');
    const text = String(input?.value || '').trim();
    if (!text || trainerBusy) return;

    trainerBusy = true;
    message('trainer', 'user', text);
    if (input) {
      input.value = '';
      input.disabled = true;
    }
    const loadingId = message('trainer', 'bot', '回答を考えています…');
    try {
      const reply = await fetchGemini(trainerPrompt(text), 'chat', false);
      removeMessage(loadingId);
      const clean = String(reply || '')
        .replace(/^```(?:text)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/\[(?:DATA|DATA2|REPLACE|REPLACE2|DELETE|UNKNOWN)\][^\n]*/g, '')
        .trim();
      const visible = clean || 'うまく回答できませんでした。もう一度聞いてください。';
      message('trainer', 'bot', visible);
      trainerHistory.push({ role: 'user', text }, { role: 'assistant', text: visible });
      if (trainerHistory.length > 16) trainerHistory.splice(0, trainerHistory.length - 16);
    } catch (e) {
      console.error('[PFC AI V2] trainer failed', e);
      removeMessage(loadingId);
      message('trainer', 'bot', '回答の取得に失敗しました。もう一度送ってください。');
    } finally {
      trainerBusy = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
    }
  }

  function markUi() {
    const version = document.querySelector('.app-build-version');
    if (version) version.textContent = 'V36 AI2';
    const voiceStatus = document.getElementById('v-status-text');
    if (voiceStatus && !/マイクON|AI解析中/.test(voiceStatus.textContent || '')) voiceStatus.textContent = 'マイクOFF';
  }

  function install() {
    configureModelUI();
    markUi();

    // Replace only the two AI entry points.
    window.sendVoiceChat = sendVoiceV2;
    window.sendTamaChat = sendTrainerV2;
    window.sendTrainerChat = sendTrainerV2;

    // Expose diagnostics without exposing prompts or credentials.
    window.__PFC_AI_V2__ = {
      version: VERSION,
      active: true,
      model: () => modelForRequest(),
      totals,
      recentRows,
      findExactDbFood: name => {
        const x = findExactDbFood(name);
        return x ? { name: x[1], unit: x[3] } : null;
      },
      selfTest() {
        const checks = {
          rowsArray: Array.isArray(rows()),
          modelValid: /^gemini-/.test(modelForRequest()),
          autoMealValid: ['朝', '昼', '晩', '間食'].includes(autoMeal()),
          dbAccessible: Array.isArray(dbRows()),
          voiceHook: window.sendVoiceChat === sendVoiceV2,
          trainerHook: window.sendTamaChat === sendTrainerV2
        };
        return { ok: Object.values(checks).every(Boolean), checks };
      }
    };

    console.info(`[PFC AI V2] active ${VERSION} / ${modelForRequest()}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
