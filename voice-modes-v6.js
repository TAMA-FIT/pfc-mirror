// PFC Mirror Voice UX V6
// Reliability pass for senior-friendly voice logging.
// Shared speech capture for all modes, immediate local memo, conservative defaults,
// preserved drafts on AI failure, and a persistent build label.
(() => {
  'use strict';

  const VERSION = '6.0.0';
  const BUILD_LABEL = 'V39 VOICE';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  const MODEL = 'gemini-3.5-flash-lite';
  const MODE_KEY = 'tf_voice_mode_v5';
  const MODAL_ID = 'pfc-voice-v6-modal';
  const STYLE_ID = 'pfc-voice-v6-style';
  const MODES = ['fast', 'conversation', 'hybrid'];
  const SILENCE_MS = 3000;
  const AI_TIMEOUT_MS = 45000;

  const state = {
    mode: 'hybrid',
    busy: false,
    listening: false,
    recognition: null,
    manualStop: false,
    restartCount: 0,
    finalBuffer: '',
    interimBuffer: '',
    silenceTimer: null,
    hardTimer: null,
    speaking: false,
    speechTimer: null,
    items: [],
    history: [],
    ready: false,
    reply: '食べたものを話してください。',
    lastTranscript: '',
    requestSerial: 0,
    correctionMode: false,
    aiFailed: false
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const round1 = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };
  const rows = () => {
    try { return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : []; }
    catch (_) { return []; }
  };
  const storage = () => window.mirrorStorage || window.localStorage;

  const FOOD_HINTS = [
    { key: 'chicken', name: '鶏むね', re: /(鶏\s*むね肉?|鶏胸肉?)/, unit: 'g' },
    { key: 'natto', name: '納豆', re: /納豆/, defaultAmount: 1, defaultUnit: 'パック' },
    { key: 'miso', name: '味噌汁', re: /(味噌汁|みそ汁)/, defaultAmount: 1, defaultUnit: '杯' },
    { key: 'rice', name: '白米', re: /(白米|ご飯|ごはん|米(?!粉))/, unit: 'g' },
    { key: 'egg', name: '卵', re: /(ゆで卵|茹で卵|卵|たまご)/, defaultAmount: 1, defaultUnit: '個' },
    { key: 'oat', name: 'オートミール', re: /オートミール/, unit: 'g' },
    { key: 'pasta', name: 'パスタ', re: /(パスタ|スパゲッティ)/, unit: 'g' },
    { key: 'protein', name: 'プロテイン', re: /プロテイン/, unit: 'g' },
    { key: 'yogurt', name: 'ヨーグルト', re: /ヨーグルト/ },
    { key: 'banana', name: 'バナナ', re: /バナナ/, defaultAmount: 1, defaultUnit: '本' },
    { key: 'apple', name: 'りんご', re: /(りんご|リンゴ)/, defaultAmount: 1, defaultUnit: '個' },
    { key: 'salmon', name: '鮭', re: /(鮭|サーモン)/, unit: 'g' }
  ];

  const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      ready: { type: 'boolean' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number' },
            unit: { type: 'string' },
            meal: { type: 'string', enum: ['朝','昼','晩','間食'] },
            p: { type: 'number' },
            f: { type: 'number' },
            c: { type: 'number' },
            a: { type: 'number' },
            kcal: { type: 'number' },
            nutritionSource: { type: 'string', enum: ['user','estimate'] },
            confidence: { type: 'number' }
          },
          required: ['name','amount','unit','meal']
        }
      }
    },
    required: ['reply','ready','items']
  };

  function autoMeal() {
    try {
      if (typeof getAutoTime === 'function') {
        const v = getAutoTime();
        if (['朝','昼','晩','間食'].includes(v)) return v;
      }
    } catch (_) {}
    const h = new Date().getHours();
    if (h < 11) return '朝';
    if (h < 16) return '昼';
    if (h < 22) return '晩';
    return '間食';
  }

  function loadMode() {
    const saved = String(storage().getItem(MODE_KEY) || '');
    state.mode = MODES.includes(saved) ? saved : 'hybrid';
  }

  function setMode(mode, fromModal = false) {
    state.mode = MODES.includes(mode) ? mode : 'hybrid';
    storage().setItem(MODE_KEY, state.mode);
    renderModeButtons();
    if (fromModal && state.mode === 'conversation' && !state.busy && !state.listening) {
      const msg = state.items.length ? nextQuestion() : '食べたものを教えてください。';
      state.reply = msg;
      render();
      speakAndListen(msg);
    }
  }

  function modeHelp(mode = state.mode) {
    if (mode === 'fast') return '食べたものを話して記録します。';
    if (mode === 'conversation') return 'AIと話しながら食事メモを完成させます。';
    return 'まず音声入力。必要な時だけAIが聞き返します。';
  }

  function normalizeName(s) {
    return String(s || '').replace(/\s+/g, '').replace(/[（）()]/g, '').toLowerCase();
  }

  function sameFood(a, b) {
    const x = normalizeName(a), y = normalizeName(b);
    if (!x || !y) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    const aliases = [
      ['鶏むね','鶏胸','鶏むね肉','鶏胸肉'],
      ['白米','ご飯','ごはん','米'],
      ['味噌汁','みそ汁'],
      ['卵','たまご','ゆで卵','茹で卵'],
      ['鮭','サーモン']
    ];
    return aliases.some(group => group.some(v => x.includes(v)) && group.some(v => y.includes(v)));
  }

  function normalizeUnit(unit) {
    const u = String(unit || '').trim();
    if (/^(g|グラム)$/i.test(u)) return 'g';
    if (/^(kg|キロ)$/i.test(u)) return 'kg';
    if (/^(ml|mL|ミリ|ミリリットル)$/i.test(u)) return 'ml';
    return u;
  }

  function normalizeItem(raw) {
    if (!raw || !String(raw.name || '').trim()) return null;
    let amount = Number(raw.amount);
    let unit = normalizeUnit(raw.unit);
    if (unit === 'kg' && amount > 0) { amount *= 1000; unit = 'g'; }
    return {
      name: String(raw.name || '').trim(),
      amount: Number.isFinite(amount) && amount > 0 ? round1(amount) : 0,
      unit,
      meal: ['朝','昼','晩','間食'].includes(raw.meal) ? raw.meal : autoMeal(),
      p: Math.max(0, Number(raw.p) || 0),
      f: Math.max(0, Number(raw.f) || 0),
      c: Math.max(0, Number(raw.c) || 0),
      a: Math.max(0, Number(raw.a) || 0),
      kcal: Math.max(0, Math.round(Number(raw.kcal) || 0)),
      nutritionSource: raw.nutritionSource === 'user' ? 'user' : 'estimate',
      confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? .7) || .7)),
      _aiConfirmed: Boolean(raw._aiConfirmed),
      _local: Boolean(raw._local)
    };
  }

  function parseQty(segment, fallbackUnit = '') {
    const s = String(segment || '').replace(/，/g, ',');
    const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|キロ|g|グラム|ml|mL|ミリリットル|ミリ|個|杯|パック|本|枚|切れ|食|人前)/i);
    if (m) {
      let amount = Number(m[1]);
      let unit = normalizeUnit(m[2]);
      if (unit === 'kg') { amount *= 1000; unit = 'g'; }
      return { amount: round1(amount), unit };
    }
    const jp = [
      [/([一1])\s*パック/, 1, 'パック'], [/([一1])\s*杯/, 1, '杯'], [/([一1])\s*個/, 1, '個'],
      [/([二2])\s*パック/, 2, 'パック'], [/([二2])\s*杯/, 2, '杯'], [/([二2])\s*個/, 2, '個'],
      [/([三3])\s*パック/, 3, 'パック'], [/([三3])\s*杯/, 3, '杯'], [/([三3])\s*個/, 3, '個']
    ];
    for (const [re, amount, unit] of jp) if (re.test(s)) return { amount, unit };
    if (/茶碗\s*(?:一|1)?\s*杯/.test(s)) return { amount: 1, unit: '杯' };
    const bare = s.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(?:ぐらい|くらい|程度))?(?:\s|$)/);
    if (bare && fallbackUnit) return { amount: Number(bare[1]), unit: fallbackUnit };
    return null;
  }

  function extractLocalItems(text) {
    const source = String(text || '');
    const pieces = source.split(/[、,。]|(?:\s+と\s*)|(?:と)|(?:や)|(?:あと)/).map(x => x.trim()).filter(Boolean);
    const out = [];
    for (const hint of FOOD_HINTS) {
      if (!hint.re.test(source)) continue;
      hint.re.lastIndex = 0;
      const segment = pieces.find(p => {
        hint.re.lastIndex = 0;
        return hint.re.test(p);
      }) || source;
      hint.re.lastIndex = 0;
      const qty = parseQty(segment, hint.unit || '');
      out.push(normalizeItem({
        name: hint.name,
        amount: qty?.amount || hint.defaultAmount || 0,
        unit: qty?.unit || hint.defaultUnit || '',
        meal: autoMeal(),
        _local: true
      }));
    }
    return out.filter(Boolean);
  }

  function removalIntent(text) {
    return /(食べてない|食べなかった|いらない|消して|削除|抜いて|なしにして)/.test(String(text || ''));
  }

  function applySimpleRemoval(text) {
    if (!removalIntent(text)) return false;
    const before = state.items.length;
    state.items = state.items.filter(item => !sameFood(item.name, text));
    if (state.items.length === before) {
      for (const hint of FOOD_HINTS) {
        hint.re.lastIndex = 0;
        if (hint.re.test(text)) state.items = state.items.filter(item => !sameFood(item.name, hint.name));
      }
    }
    return state.items.length !== before;
  }

  function mergeLocalItem(item) {
    const at = state.items.findIndex(x => sameFood(x.name, item.name));
    if (at < 0) {
      state.items.push(item);
      return;
    }
    const current = state.items[at];
    state.items[at] = {
      ...current,
      name: item.name || current.name,
      amount: item.amount > 0 ? item.amount : current.amount,
      unit: item.unit || current.unit,
      meal: item.meal || current.meal,
      _local: true
    };
  }

  function inferPendingAmount(text) {
    const pending = state.items.filter(x => !(x.amount > 0 && x.unit));
    if (pending.length !== 1) return false;
    const item = pending[0];
    let fallback = '';
    if (/(鶏|肉|魚|鮭|サーモン|白米|ご飯|ごはん|オートミール|パスタ|プロテイン)/.test(item.name)) fallback = 'g';
    const qty = parseQty(String(text || '').trim(), fallback);
    if (!qty) return false;
    item.amount = qty.amount;
    item.unit = qty.unit;
    item._local = true;
    return true;
  }

  function applySkinHint(text) {
    const t = String(text || '');
    if (!/(皮なし|皮無し|皮あり|皮有り)/.test(t)) return;
    const item = state.items.find(x => sameFood(x.name, '鶏むね'));
    if (!item) return;
    if (/(皮なし|皮無し)/.test(t)) item.name = '鶏むね皮なし';
    if (/(皮あり|皮有り)/.test(t)) item.name = '鶏むね皮あり';
  }

  function prefillFromSpeech(text) {
    applySimpleRemoval(text);
    const extracted = extractLocalItems(text);
    extracted.forEach(mergeLocalItem);
    inferPendingAmount(text);
    applySkinHint(text);
    state.ready = localTrustedReady();
    state.aiFailed = false;
    state.reply = state.items.length ? nextQuestion() : '食べたものを話してください。';
    render();
  }

  function practicalComplete(items = state.items) {
    return items.length > 0 && items.every(x => x.amount > 0 && String(x.unit || '').trim());
  }

  function canResolveFood(item) {
    const engine = window.__PFC_MEAL_ENGINE_V50__;
    if (!engine?.safeResolveFood) return false;
    try {
      const r = engine.safeResolveFood(item.name);
      return Number.isFinite(Number(r?.index));
    } catch (_) { return false; }
  }

  function localTrustedReady() {
    return practicalComplete() && state.items.every(canResolveFood);
  }

  function nextQuestion() {
    if (!state.items.length) return '食べたものを話してください。';
    const pending = state.items.find(x => !(x.amount > 0 && x.unit));
    if (!pending) return '内容を確認してください。';
    if (/(白米|ご飯|ごはん)/.test(pending.name)) return 'ご飯はどれくらいでしたか？ 例：茶碗1杯、200g';
    if (/(鶏|肉|魚|鮭|サーモン)/.test(pending.name)) return `${pending.name}はどれくらい食べましたか？ だいたいで大丈夫です。`;
    return `${pending.name}はどれくらいでしたか？`;
  }

  function promptFor(text) {
    const current = state.items.map(x => ({ name:x.name, amount:x.amount, unit:x.unit, meal:x.meal }));
    return `食事記録の聞き取り係です。ユーザーの発話を現在のメモへ反映し、毎回メモの完全版をitemsで返してください。

重要ルール:
- 既存itemsは、ユーザーが明示的に削除・訂正しない限り絶対に落とさない。
- 納豆は量指定がなければ1パック、味噌汁は1杯、卵は1個としてよい。これらを毎回確認しない。
- 食品ごとに全部質問しない。登録結果へ大きく影響する不足情報だけ、1回に1つ質問する。
- 鶏むね・肉・魚・ご飯など量で差が大きい食品は、量が無ければ量を優先して聞く。
- 皮あり/なし、ブランド、細かな種類などは、量が分かっていれば原則として登録を止める質問にしない。後から修正できる前提でよい。
- 「150くらい」のように単位が省略され、直前に量を聞いた食品が肉・魚・ご飯等ならgとして解釈してよい。
- 実用的な量と単位が全食品で揃えばready=true。標準単位の仮置きも十分な情報として扱う。
- replyは短く。ready=falseなら次に必要な質問を具体的に1つだけ。曖昧な「もう少し教えてください」は禁止。
- P/F/C/A/kcalは分かる場合だけ推定してよい。Food Masterが保存時の正本なので、知らない食品を別食品へ置換しない。
- JSON以外を返さない。

現在メモ: ${JSON.stringify(current)}
最近の会話: ${JSON.stringify(state.history.slice(-6))}
今回の発話: ${JSON.stringify(text)}
推奨食事区分: ${autoMeal()}`;
  }

  async function callAI(text) {
    const payload = {
      taskType: 'voice',
      modelPreference: MODEL,
      contents: [{ parts: [{ text: promptFor(text) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      let raw = Array.isArray(parts) ? parts.map(p => String(p?.text || '')).join('').trim() : String(data?.text || '').trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try { return JSON.parse(raw); }
      catch (_) {
        const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Error('AI JSON parse failed');
        return JSON.parse(raw.slice(a, b + 1));
      }
    } finally { clearTimeout(timer); }
  }

  function mergeAIResult(resultItems, spokenText) {
    const next = (Array.isArray(resultItems) ? resultItems : []).map(x => normalizeItem({ ...x, _aiConfirmed:true })).filter(Boolean);
    if (!next.length) return;
    if (removalIntent(spokenText)) {
      state.items = next;
      return;
    }
    if (next.length >= state.items.length) {
      state.items = next;
      return;
    }
    const merged = next.slice();
    state.items.forEach(old => {
      if (!merged.some(x => sameFood(x.name, old.name))) merged.push(old);
    });
    state.items = merged;
  }

  async function processUtterance(text) {
    const value = String(text || '').trim();
    if (!value || state.busy) return;
    stopSpeech();
    state.lastTranscript = value;
    state.history.push({ role:'user', text:value });
    prefillFromSpeech(value);

    const serial = ++state.requestSerial;
    state.busy = true;
    render();
    try {
      const result = await callAI(value);
      if (serial !== state.requestSerial) return;
      mergeAIResult(result?.items, value);
      const complete = practicalComplete();
      state.ready = complete && (Boolean(result?.ready) || complete);
      state.reply = state.ready
        ? '内容を確認してください。'
        : String(result?.reply || nextQuestion()).trim();
      if (!state.ready && (!state.reply || /もう少し/.test(state.reply))) state.reply = nextQuestion();
      state.history.push({ role:'assistant', text:state.reply });
      state.aiFailed = false;
    } catch (e) {
      console.error('[PFC Voice V6] AI parse failed', e);
      if (serial !== state.requestSerial) return;
      state.aiFailed = true;
      state.ready = localTrustedReady();
      state.reply = state.ready
        ? 'メモは残っています。この内容で登録できます。'
        : nextQuestion();
      if (!state.items.length) state.reply = '聞き取った内容は残っています。もう一度マイクを押して続けてください。';
    } finally {
      if (serial === state.requestSerial) state.busy = false;
      render();
    }

    if (!document.getElementById(MODAL_ID)) return;
    if (state.mode === 'conversation') {
      if (state.ready) speakOnly('内容が揃いました。画面を確認してください。');
      else speakAndListen(state.reply);
    } else if (state.mode === 'hybrid' && !state.ready) {
      speakAndListen(state.reply);
    }
  }

  function clearListenTimers() {
    clearTimeout(state.silenceTimer);
    clearTimeout(state.hardTimer);
    state.silenceTimer = null;
    state.hardTimer = null;
  }

  function scheduleSilenceFinish() {
    clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(() => finishListening(true), SILENCE_MS);
  }

  function currentSpeechText() {
    const final = String(state.finalBuffer || '').trim();
    const interim = String(state.interimBuffer || '').trim();
    return final || interim;
  }

  function launchRecognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    const rec = new SR();
    state.recognition = rec;
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) state.finalBuffer += part;
        else interim += part;
      }
      state.interimBuffer = interim;
      const status = $('#vm6-status');
      if (status) status.textContent = currentSpeechText() || '聞いています…';
      scheduleSilenceFinish();
    };

    rec.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        state.manualStop = true;
        state.listening = false;
        clearListenTimers();
        state.reply = 'マイクの許可が必要です。';
        render();
      }
    };

    rec.onend = () => {
      state.recognition = null;
      if (!state.listening) return;
      if (state.manualStop) return;
      if (state.restartCount < 3) {
        state.restartCount += 1;
        setTimeout(() => {
          if (state.listening && !state.recognition && !state.manualStop) launchRecognizer();
        }, 140);
      } else if (currentSpeechText()) {
        finishListening(true);
      } else {
        state.listening = false;
        clearListenTimers();
        renderStatus();
      }
    };

    try { rec.start(); return true; }
    catch (_) { state.recognition = null; return false; }
  }

  function startListening() {
    if (state.listening || state.speaking || state.busy) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      state.reply = 'このブラウザではマイク入力が使えません。文字入力を使ってください。';
      render();
      $('#vm6-text')?.focus();
      return;
    }
    stopSpeech();
    clearListenTimers();
    state.manualStop = false;
    state.restartCount = 0;
    state.finalBuffer = '';
    state.interimBuffer = '';
    state.listening = true;
    state.hardTimer = setTimeout(() => finishListening(true), 30000);
    if (!launchRecognizer()) {
      state.listening = false;
      state.reply = 'マイクを開始できませんでした。もう一度押してください。';
    }
    renderStatus();
  }

  function finishListening(submit = true) {
    if (!state.listening && !state.recognition) return;
    state.manualStop = true;
    const text = currentSpeechText();
    state.listening = false;
    clearListenTimers();
    const rec = state.recognition;
    state.recognition = null;
    try { rec?.stop(); } catch (_) {}
    renderStatus();
    if (submit && text) {
      state.finalBuffer = '';
      state.interimBuffer = '';
      processUtterance(text);
    }
  }

  function stopSpeech() {
    clearTimeout(state.speechTimer);
    state.speechTimer = null;
    state.speaking = false;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }

  function speakOnly(text) {
    stopSpeech();
    if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.98;
    state.speaking = true;
    renderStatus();
    u.onend = u.onerror = () => { state.speaking = false; renderStatus(); };
    try { window.speechSynthesis.speak(u); } catch (_) { state.speaking = false; }
  }

  function speakAndListen(text) {
    stopSpeech();
    if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      state.speechTimer = setTimeout(startListening, 300);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.98;
    state.speaking = true;
    renderStatus();
    const next = () => {
      state.speaking = false;
      renderStatus();
      state.speechTimer = setTimeout(startListening, 350);
    };
    u.onend = next;
    u.onerror = next;
    try { window.speechSynthesis.speak(u); } catch (_) { next(); }
  }

  function buildTrustedRecord(item) {
    const engine = window.__PFC_MEAL_ENGINE_V50__;
    if (!engine?.safeResolveFood || !engine?.buildTrustedRecord || item.nutritionSource === 'user') return null;
    const resolved = engine.safeResolveFood(item.name);
    const index = Number(resolved?.index);
    if (!Number.isFinite(index) || !(item.amount > 0)) return null;
    try {
      const record = engine.buildTrustedRecord(index, item.amount, item.unit, item.meal);
      const check = engine.validateTrustedRecord?.(record);
      if (!record || check?.ok === false) return null;
      record._voiceV6 = { version:VERSION, mode:state.mode, source:'Food Master', amount:item.amount, unit:item.unit, at:Date.now() };
      return record;
    } catch (_) { return null; }
  }

  function fallbackRecord(item, offset) {
    return {
      id: Date.now() + offset + Math.floor(Math.random() * 1000),
      N: '🤖 ' + item.name,
      P: round1(item.p), F: round1(item.f), C: round1(item.c), A: round1(item.a),
      Cal: Math.round(item.kcal || (item.p*4 + item.f*9 + item.c*4 + item.a*7)),
      U: 'AI', time: item.meal,
      _voiceV6: { version:VERSION, mode:state.mode, source:item.nutritionSource, amount:item.amount, unit:item.unit, at:Date.now() }
    };
  }

  function persist() {
    try {
      if (typeof sv === 'function') sv();
      else storage().setItem('tf_dat', JSON.stringify(rows()));
      if (typeof ren === 'function') ren();
      if (typeof upd === 'function') upd();
    } catch (e) { console.error('[PFC Voice V6] persist failed', e); }
  }

  function commitDraft() {
    if (!state.ready || !state.items.length || state.busy) return;
    const accepted = [];
    state.items.forEach((item, i) => {
      const record = buildTrustedRecord(item) || fallbackRecord(item, i*17);
      rows().push(record);
      accepted.push(record);
    });
    persist();
    closeVoice();
    if (typeof window.showToast === 'function') window.showToast(`${accepted.length}件を記録しました`);
  }

  function resetDraft() {
    finishListening(false);
    stopSpeech();
    state.requestSerial += 1;
    state.busy = false;
    state.items = [];
    state.history = [];
    state.ready = false;
    state.reply = '食べたものを話してください。';
    state.lastTranscript = '';
    state.correctionMode = false;
    state.aiFailed = false;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .vm6-mode-switch{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;background:#edf4f0;border:1px solid #d9e6df;border-radius:15px}
      .vm6-mode-switch button{min-height:49px!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#52645b!important;font-size:13px!important;font-weight:900!important;padding:7px 4px!important;box-shadow:none!important}
      .vm6-mode-switch button.active{background:#fff!important;color:#146b48!important;box-shadow:0 2px 10px rgba(16,72,47,.10)!important}
      .vm6-mode-switch small{display:block;font-size:9px;margin-top:2px;color:#7a8981;font-weight:700}
      .senior-home-modes{margin-top:-3px}
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483646;background:#f4f8f6;color:#18251f;font-family:inherit;overflow:auto;-webkit-overflow-scrolling:touch}
      .vm6-shell{width:min(680px,100%);min-height:100%;margin:0 auto;background:#fff;display:flex;flex-direction:column}
      .vm6-head{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.97);border-bottom:1px solid #e4ebe7;display:flex;align-items:center;justify-content:space-between;padding:12px 14px}
      .vm6-head button{width:46px;height:46px;border:0;border-radius:13px;background:#eef4f1;color:#41554a;font-size:24px}.vm6-head strong{font-size:20px}.vm6-head span{width:46px}
      .vm6-body{padding:15px;display:grid;gap:12px;align-content:start;flex:1}.vm6-help{text-align:center;color:#65766d;font-size:12px}
      .vm6-prompt{background:#eff8f3;border:1px solid #d9eadf;border-radius:17px;padding:14px 15px;font-size:18px;font-weight:900;line-height:1.48}.vm6-prompt small{display:block;font-size:11px;color:#65746d;font-weight:700;margin-top:4px}
      .vm6-status{text-align:center;color:#187a51;min-height:24px;font-size:14px;font-weight:900;line-height:1.4}
      .vm6-mic{width:116px;height:116px;border:0;border-radius:50%;margin:0 auto;background:linear-gradient(145deg,#27a96f,#14784f);color:#fff;font-size:53px;box-shadow:0 8px 28px rgba(24,122,81,.27)}
      .vm6-mic.listening{animation:vm6pulse 1.2s infinite}.vm6-mic:disabled{opacity:.5}@keyframes vm6pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,160,107,.25),0 8px 28px rgba(24,122,81,.27)}50%{box-shadow:0 0 0 18px rgba(34,160,107,0),0 8px 28px rgba(24,122,81,.27)}}
      .vm6-last{text-align:center;color:#55675e;font-size:13px;min-height:19px}.vm6-last b{color:#20342a}.vm6-processing{display:none;text-align:center;font-size:12px;color:#6d7c74}.vm6-processing.on{display:block}
      .vm6-memo{border:1px solid #dce8e1;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 3px 13px rgba(12,52,34,.05)}.vm6-memo-head{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:#f6faf8}.vm6-memo-head strong{font-size:15px}.vm6-memo-head span{font-size:10px;color:#187a51;font-weight:900}
      .vm6-empty{padding:22px;text-align:center;color:#7a8981;font-size:14px;line-height:1.6}.vm6-food{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:13px 14px;border-top:1px solid #edf2ef}.vm6-food:first-child{border-top:0}.vm6-food-name{font-size:17px;font-weight:900}.vm6-food-meta{font-size:11px;color:#74837b;margin-top:3px}.vm6-food-qty{font-size:17px;font-weight:900}.vm6-food.pending .vm6-food-qty{font-size:12px;color:#ad7100}
      .vm6-text details{border:1px solid #e1e8e4;border-radius:13px;padding:10px 12px}.vm6-text summary{cursor:pointer;color:#65766d;font-size:13px;font-weight:800}.vm6-text-row{display:flex;gap:7px;margin-top:9px}.vm6-text-row input{flex:1;min-width:0;border:1px solid #d5e1db;border-radius:12px;padding:11px;font-size:16px}.vm6-text-row button{border:0;border-radius:12px;padding:0 15px;background:#e8f3ed;color:#176c49;font-weight:900}
      .vm6-actions{position:sticky;bottom:0;background:rgba(255,255,255,.98);border-top:1px solid #e4ebe7;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:grid;gap:8px}.vm6-actions button{min-height:55px;border-radius:14px;border:1px solid #d9e3de;background:#fff;color:#33473d;font-size:15px;font-weight:900}.vm6-actions .primary{background:#187a51;color:#fff;border:0;font-size:18px}.vm6-actions .primary:disabled{background:#acb8b2}
      @media(min-width:760px){.vm6-shell{min-height:calc(100% - 32px);margin:16px auto;border-radius:24px;overflow:hidden;box-shadow:0 12px 45px rgba(0,0,0,.12)}}
    `;
    document.head.appendChild(style);
  }

  function modeSwitchHtml() {
    return `<div class="vm6-mode-switch">
      <button type="button" data-vm6-mode="fast"><b>音声入力</b><small>食べたものを話す</small></button>
      <button type="button" data-vm6-mode="conversation"><b>会話</b><small>AIと話しながら</small></button>
      <button type="button" data-vm6-mode="hybrid"><b>おまかせ</b><small>必要な時だけ会話</small></button>
    </div>`;
  }

  function bindModeButtons(root = document, fromModal = false) {
    root.querySelectorAll('[data-vm6-mode]').forEach(btn => {
      btn.onclick = e => { e.preventDefault(); setMode(btn.dataset.vm6Mode, fromModal); };
    });
    renderModeButtons();
  }

  function renderModeButtons() {
    document.querySelectorAll('[data-vm6-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.vm6Mode === state.mode));
    const help = $('#vm6-help');
    if (help) help.textContent = modeHelp();
  }

  function renderStatus() {
    const status = $('#vm6-status');
    const mic = $('#vm6-mic');
    if (status) {
      if (state.speaking) status.textContent = 'AIが話しています…';
      else if (state.listening) status.textContent = currentSpeechText() || '聞いています… 話し終わるまで待ちます';
      else if (state.busy) status.textContent = 'メモは残したまま内容を整理しています…';
      else if (!state.ready && state.items.length) status.textContent = '続けてマイクを押して答えてください';
      else status.textContent = 'マイクを押して話してください';
    }
    if (mic) {
      mic.classList.toggle('listening', state.listening);
      mic.disabled = state.busy || state.speaking;
      mic.setAttribute('aria-label', state.listening ? '話し終わる' : 'マイク');
    }
    $('#vm6-processing')?.classList.toggle('on', state.busy);
  }

  function render() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const prompt = $('#vm6-prompt');
    if (prompt) prompt.innerHTML = `${esc(state.reply)}<small>${state.ready ? '内容が合っていれば「これで登録する」を押してください。' : 'だいたいで大丈夫です。間違いは後から直せます。'}</small>`;
    const last = $('#vm6-last');
    if (last) last.innerHTML = state.lastTranscript ? `あなた：<b>${esc(state.lastTranscript)}</b>` : '';
    const memo = $('#vm6-memo-list');
    if (memo) {
      memo.innerHTML = state.items.length ? state.items.map(item => {
        const done = item.amount > 0 && item.unit;
        const qty = done ? `${Number.isInteger(item.amount) ? item.amount : round1(item.amount)}${esc(item.unit)}` : '量を確認中';
        return `<div class="vm6-food ${done ? '' : 'pending'}"><div><div class="vm6-food-name">${esc(item.name)}</div><div class="vm6-food-meta">${esc(item.meal)}</div></div><div class="vm6-food-qty">${qty}</div></div>`;
      }).join('') : '<div class="vm6-empty">まだメモはありません。<br>食べたものをそのまま話してください。</div>';
    }
    const reg = $('#vm6-register');
    if (reg) reg.disabled = state.busy || !state.ready;
    renderModeButtons();
    renderStatus();
  }

  function openVoice() {
    ensureStyle();
    resetDraft();
    document.getElementById('pfc-senior-voice-modal')?.remove();
    document.getElementById('pfc-voice-v5-modal')?.remove();
    document.getElementById(MODAL_ID)?.remove();

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `<div class="vm6-shell">
      <div class="vm6-head"><button type="button" id="vm6-close" aria-label="閉じる">‹</button><strong>話して記録</strong><span></span></div>
      <div class="vm6-body">
        ${modeSwitchHtml()}
        <div class="vm6-help" id="vm6-help"></div>
        <div class="vm6-prompt" id="vm6-prompt"></div>
        <div class="vm6-status" id="vm6-status"></div>
        <button type="button" class="vm6-mic" id="vm6-mic" aria-label="マイク">🎙</button>
        <div class="vm6-last" id="vm6-last"></div>
        <div class="vm6-processing" id="vm6-processing">内容を整理しています。話した内容とメモは消えません。</div>
        <div class="vm6-memo"><div class="vm6-memo-head"><strong>今日の食事メモ</strong><span>聞き取った内容</span></div><div id="vm6-memo-list"></div></div>
        <div class="vm6-text"><details><summary>文字で入力する</summary><div class="vm6-text-row"><input id="vm6-text" type="text" placeholder="例：鶏むね150g"><button type="button" id="vm6-send">送る</button></div></details></div>
      </div>
      <div class="vm6-actions"><button type="button" class="primary" id="vm6-register" disabled>これで登録する</button><button type="button" id="vm6-correct">修正する</button></div>
    </div>`;
    document.body.appendChild(modal);
    bindModeButtons(modal, true);
    $('#vm6-close').onclick = closeVoice;
    $('#vm6-mic').onclick = () => {
      stopSpeech();
      if (state.listening) finishListening(true); else startListening();
    };
    $('#vm6-register').onclick = commitDraft;
    $('#vm6-correct').onclick = () => {
      stopSpeech();
      state.correctionMode = true;
      state.ready = false;
      state.reply = state.items.length ? '直したいところを話してください。今のメモは消えません。' : '食べたものを話してください。';
      render();
      if (state.mode === 'fast') startListening(); else speakAndListen(state.reply);
    };
    $('#vm6-send').onclick = sendText;
    $('#vm6-text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) sendText(); });
    render();
    if (state.mode === 'conversation') setTimeout(() => speakAndListen('食べたものを教えてください。'), 220);
  }

  function sendText() {
    const input = $('#vm6-text');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    processUtterance(text);
  }

  function closeVoice() {
    finishListening(false);
    stopSpeech();
    state.requestSerial += 1;
    document.getElementById(MODAL_ID)?.remove();
  }

  function installHome() {
    const talk = document.getElementById('senior-talk-record');
    if (!talk) return false;
    if (talk.dataset.vm6Bound !== '1') {
      const clone = talk.cloneNode(true);
      clone.dataset.vm6Bound = '1';
      talk.replaceWith(clone);
      clone.addEventListener('click', openVoice);
    }
    let wrap = document.querySelector('.senior-home-modes');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'senior-home-modes';
      document.getElementById('senior-talk-record')?.insertAdjacentElement('afterend', wrap);
    }
    if (!wrap.querySelector('[data-vm6-mode]')) wrap.innerHTML = modeSwitchHtml();
    bindModeButtons(wrap, false);
    return true;
  }

  function forceVersionForever() {
    const apply = () => {
      document.querySelectorAll('.app-build-version').forEach(el => {
        if (el.textContent !== BUILD_LABEL) el.textContent = BUILD_LABEL;
      });
    };
    apply();
    const root = document.body || document.documentElement;
    if (root) {
      const observer = new MutationObserver(apply);
      observer.observe(root, { childList:true, subtree:true, characterData:true });
    }
    window.addEventListener('pageshow', () => setTimeout(apply, 0));
    window.addEventListener('focus', () => setTimeout(apply, 0));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(apply, 0); });
    document.addEventListener('click', e => {
      const node = e.target?.closest?.('button,a');
      if (!node) return;
      const label = `${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.title || ''}`;
      if (/(reload|refresh|リロード|更新|再読込|↻|⟳)/i.test(label)) {
        setTimeout(apply, 0); setTimeout(apply, 500); setTimeout(apply, 1800);
      }
    }, true);
    setInterval(apply, 3000);
  }

  function install() {
    ensureStyle();
    loadMode();
    forceVersionForever();
    let tries = 0;
    const bind = () => {
      if (installHome()) return;
      if (++tries < 60) setTimeout(bind, 150);
    };
    setTimeout(bind, 80);

    window.openVoiceModesV6 = openVoice;
    window.__PFC_VOICE_MODES_V6__ = {
      version: VERSION,
      active: true,
      mode: () => state.mode,
      setMode,
      open: openVoice,
      parseModel: MODEL,
      silenceMs: SILENCE_MS,
      liveTransport: false,
      browserSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      state: () => ({ mode:state.mode, busy:state.busy, listening:state.listening, ready:state.ready, items:state.items.map(x => ({...x})) }),
      selfTest() {
        return { ok:Boolean(document.querySelector('.senior-main-actions')) && Boolean(window.__PFC_AI_V2__), checks:{ home:Boolean(document.querySelector('.senior-main-actions')), aiV2:Boolean(window.__PFC_AI_V2__), foodMaster:Boolean(window.__PFC_MEAL_ENGINE_V50__), browserSpeech:Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), mode:MODES.includes(state.mode) } };
      }
    };
    console.info(`[PFC Voice V6] active ${VERSION} / mode=${state.mode} / parse=${MODEL}`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
