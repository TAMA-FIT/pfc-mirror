// PFC Mirror Voice Modes V5
// Adds three selectable voice UX modes on top of Senior V4 without changing
// the trusted Food Master, AI V2 correction path, storage keys, or GAS URL.
(() => {
  'use strict';

  const VERSION = '5.0.0';
  const BUILD_LABEL = 'V38 3MODE';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  const MODEL = 'gemini-3.5-flash-lite';
  const MODE_KEY = 'tf_voice_mode_v5';
  const MODAL_ID = 'pfc-voice-v5-modal';
  const STYLE_ID = 'pfc-voice-v5-style';
  const MODES = ['fast', 'conversation', 'hybrid'];

  const state = {
    mode: 'hybrid',
    busy: false,
    listening: false,
    recognition: null,
    speaking: false,
    items: [],
    history: [],
    ready: false,
    reply: '食べたものを、そのまま話してください。',
    lastTranscript: '',
    turn: 0,
    autoListenTimer: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const rows = () => {
    try { return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : []; }
    catch (_) { return []; }
  };
  const storage = () => window.mirrorStorage || window.localStorage;
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const round1 = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };

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
            meal: { type: 'string', enum: ['朝', '昼', '晩', '間食'] },
            p: { type: 'number' },
            f: { type: 'number' },
            c: { type: 'number' },
            a: { type: 'number' },
            kcal: { type: 'number' },
            nutritionSource: { type: 'string', enum: ['user', 'estimate'] },
            confidence: { type: 'number' }
          },
          required: ['name','amount','unit','meal','p','f','c','a','kcal','nutritionSource','confidence']
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
    const saved = String(storage().getItem(MODE_KEY) || '').trim();
    state.mode = MODES.includes(saved) ? saved : 'hybrid';
    return state.mode;
  }

  function setMode(mode, fromModal = false) {
    state.mode = MODES.includes(mode) ? mode : 'hybrid';
    storage().setItem(MODE_KEY, state.mode);
    renderModeButtons();
    if (fromModal && state.mode === 'conversation' && !state.busy && !state.listening) {
      stopSpeech();
      state.reply = state.items.length
        ? '続けて変更したい内容を話してください。'
        : '食べたものを教えてください。';
      render();
      setTimeout(() => speakAndMaybeListen(state.reply, true), 120);
    }
  }

  function modeHelp(mode = state.mode) {
    if (mode === 'fast') return 'まとめて話す → 内容を確認 → 登録。AIは必要以上に話しません。';
    if (mode === 'conversation') return 'AIが足りない情報を声で聞きながら、メモを完成させます。';
    return 'まず高速入力。情報が足りない時だけAIが自動で聞き返します。';
  }

  function normalizeItem(raw) {
    if (!raw || !String(raw.name || '').trim()) return null;
    const amount = Number(raw.amount);
    return {
      name: String(raw.name || '').trim(),
      amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      unit: String(raw.unit || '').trim(),
      meal: ['朝','昼','晩','間食'].includes(raw.meal) ? raw.meal : autoMeal(),
      p: Math.max(0, Number(raw.p) || 0),
      f: Math.max(0, Number(raw.f) || 0),
      c: Math.max(0, Number(raw.c) || 0),
      a: Math.max(0, Number(raw.a) || 0),
      kcal: Math.max(0, Math.round(Number(raw.kcal) || 0)),
      nutritionSource: raw.nutritionSource === 'user' ? 'user' : 'estimate',
      confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? .7) || .7))
    };
  }

  function promptFor(text) {
    const current = state.items.map(x => ({
      name: x.name, amount: x.amount, unit: x.unit, meal: x.meal
    }));
    const history = state.history.slice(-8);
    return `あなたは食事記録アプリで、目の前の利用者から食事を聞き取りながらメモするトレーナーです。
高齢者でも使いやすいように、一度に質問することは原則1つだけ。短い日本語で聞いてください。

目的:
- ユーザーの発話から、食べた食品・量・単位・食事区分を整理する。
- 現在の候補メモを維持し、追加・訂正・言い直しを反映した「候補一覧の完全版」を毎回itemsで返す。
- 量や食品の種類が不足していて登録精度に影響する場合は ready=false にして、replyで最重要の不足情報を1つだけ質問する。
- 「茶碗1杯」「1パック」「1個」「普通盛り」など日常的な単位はそのまま扱ってよい。過剰に細かく聞かない。
- 「鶏むね」などで皮あり/なしが栄養値に大きく影響し、文脈から決められない時は質問してよい。
- 情報が十分なら ready=true。replyは「内容が揃いました。確認してください。」程度で短くする。
- P/F/C/A/kcalは実際に食べた量の合計推定値。ユーザーが明示した栄養値はnutritionSource="user"、それ以外は"estimate"。
- Food Master照合は保存時にアプリ側で行うため、知らない食品を勝手に別食品へ置き換えない。
- JSON以外は出力しない。

現在時刻からの推奨食事区分: ${autoMeal()}
現在の候補メモ: ${JSON.stringify(current)}
最近の会話: ${JSON.stringify(history)}
今回の発話: ${text}

出力は reply, ready, items のJSON。`;
  }

  async function callAI(text) {
    const payload = {
      taskType: 'voice',
      modelPreference: MODEL,
      contents: [{ parts: [{ text: promptFor(text) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA
      }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
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
      let raw = Array.isArray(parts)
        ? parts.map(p => String(p?.text || '')).join('').trim()
        : String(data?.text || '').trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try { return JSON.parse(raw); }
      catch (_) {
        const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Error('AI JSON parse failed');
        return JSON.parse(raw.slice(a, b + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  function stopSpeech() {
    clearTimeout(state.autoListenTimer);
    state.autoListenTimer = null;
    state.speaking = false;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }

  function speakAndMaybeListen(text, autoListen) {
    stopSpeech();
    if (!text) {
      if (autoListen) setTimeout(() => startListening(), 120);
      return;
    }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      if (autoListen) setTimeout(() => startListening(), 250);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = 1.02;
    state.speaking = true;
    renderStatus();
    utter.onend = () => {
      state.speaking = false;
      renderStatus();
      if (autoListen && document.getElementById(MODAL_ID)) {
        state.autoListenTimer = setTimeout(() => startListening(), 180);
      }
    };
    utter.onerror = () => {
      state.speaking = false;
      renderStatus();
      if (autoListen && document.getElementById(MODAL_ID)) {
        state.autoListenTimer = setTimeout(() => startListening(), 250);
      }
    };
    try { window.speechSynthesis.speak(utter); }
    catch (_) {
      state.speaking = false;
      if (autoListen) setTimeout(() => startListening(), 250);
    }
  }

  async function processUtterance(text) {
    const value = String(text || '').trim();
    if (!value || state.busy) return;
    stopListening();
    stopSpeech();
    state.busy = true;
    state.lastTranscript = value;
    state.turn += 1;
    state.history.push({ role: 'user', text: value });
    render();
    try {
      const result = await callAI(value);
      state.items = (Array.isArray(result?.items) ? result.items : [])
        .map(normalizeItem).filter(Boolean);
      state.ready = Boolean(result?.ready) &&
        state.items.length > 0 &&
        state.items.every(x => x.amount > 0 && x.unit);
      state.reply = String(result?.reply ||
        (state.ready ? '内容が揃いました。確認してください。' : 'もう少し教えてください。')).trim();
      state.history.push({ role: 'assistant', text: state.reply });
    } catch (e) {
      console.error('[PFC Voice Modes V5] parse failed', e);
      state.ready = false;
      state.reply = e?.name === 'AbortError'
        ? '少し時間がかかりました。短く分けて、もう一度話してください。'
        : 'うまく整理できませんでした。もう一度話してください。';
    } finally {
      state.busy = false;
      render();
    }

    if (!document.getElementById(MODAL_ID)) return;
    if (state.mode === 'conversation') {
      if (state.ready) {
        speakAndMaybeListen('内容が揃いました。画面を確認して、これで登録するを押してください。', false);
      } else {
        speakAndMaybeListen(state.reply, true);
      }
    } else if (state.mode === 'hybrid' && !state.ready) {
      speakAndMaybeListen(state.reply, true);
    }
  }

  function startListening() {
    if (state.busy || state.listening || state.speaking) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      state.reply = 'このブラウザではマイク入力が使えません。下の文字入力を使ってください。';
      render();
      $('#vm5-text')?.focus();
      return;
    }
    stopListening();
    const rec = new SR();
    state.recognition = rec;
    state.listening = true;
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      const status = $('#vm5-status');
      if (status) status.textContent = finalText || interim || '聞いています…';
    };
    rec.onerror = event => {
      const status = $('#vm5-status');
      if (status) status.textContent = event.error === 'not-allowed'
        ? 'マイクの許可が必要です'
        : 'もう一度マイクを押してください';
    };
    rec.onend = () => {
      state.listening = false;
      state.recognition = null;
      renderStatus();
      if (finalText.trim()) processUtterance(finalText.trim());
    };
    try { rec.start(); renderStatus(); }
    catch (_) {
      state.listening = false;
      state.recognition = null;
      renderStatus();
    }
  }

  function stopListening() {
    clearTimeout(state.autoListenTimer);
    state.autoListenTimer = null;
    if (state.recognition) {
      try { state.recognition.stop(); } catch (_) {}
    }
    state.recognition = null;
    state.listening = false;
  }

  function persist() {
    try {
      if (typeof sv === 'function') sv();
      else storage().setItem('tf_dat', JSON.stringify(rows()));
      if (typeof ren === 'function') ren();
      if (typeof upd === 'function') upd();
    } catch (e) {
      console.error('[PFC Voice Modes V5] persist failed', e);
    }
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
      record._voiceV5 = {
        version: VERSION,
        mode: state.mode,
        source: 'Food Master',
        amount: item.amount,
        unit: item.unit,
        at: Date.now()
      };
      return record;
    } catch (_) { return null; }
  }

  function fallbackRecord(item, offset) {
    return {
      id: Date.now() + offset + Math.floor(Math.random() * 1000),
      N: '🤖 ' + item.name,
      P: round1(item.p), F: round1(item.f), C: round1(item.c), A: round1(item.a),
      Cal: Math.round(item.kcal || (item.p * 4 + item.f * 9 + item.c * 4 + item.a * 7)),
      U: 'AI', time: item.meal,
      _voiceV5: {
        version: VERSION,
        mode: state.mode,
        source: item.nutritionSource,
        amount: item.amount,
        unit: item.unit,
        at: Date.now()
      }
    };
  }

  function commitDraft() {
    if (!state.ready || !state.items.length || state.busy) return;
    const accepted = [];
    state.items.forEach((item, i) => {
      const record = buildTrustedRecord(item) || fallbackRecord(item, i * 17);
      rows().push(record);
      accepted.push(record);
    });
    persist();
    closeVoice();
    if (typeof window.showToast === 'function') window.showToast(`${accepted.length}件を記録しました`);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  }

  function resetDraft() {
    stopListening();
    stopSpeech();
    state.busy = false;
    state.items = [];
    state.history = [];
    state.ready = false;
    state.reply = '食べたものを、そのまま話してください。';
    state.lastTranscript = '';
    state.turn = 0;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .voice-mode-switch{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;background:#edf4f0;border:1px solid #d9e6df;border-radius:15px}
      .voice-mode-switch button{min-height:48px!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#52645b!important;font-size:13px!important;font-weight:900!important;box-shadow:none!important;padding:7px 5px!important}
      .voice-mode-switch button.active{background:#fff!important;color:#146b48!important;box-shadow:0 2px 10px rgba(16,72,47,.10)!important}
      .voice-mode-switch small{display:block;font-size:9px;font-weight:700;margin-top:2px;color:#7a8981}
      .senior-home-modes{margin-top:-3px}
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483642;background:#f4f8f6;color:#18251f;font-family:inherit;overflow:auto;-webkit-overflow-scrolling:touch}
      .vm5-shell{width:min(680px,100%);min-height:100%;margin:0 auto;background:#fff;display:flex;flex-direction:column}
      .vm5-head{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.97);border-bottom:1px solid #e4ebe7;display:flex;align-items:center;justify-content:space-between;padding:12px 14px}
      .vm5-head button{width:46px;height:46px;border:0;border-radius:13px;background:#eef4f1;color:#41554a;font-size:24px}.vm5-head strong{font-size:20px}.vm5-head span{width:46px}
      .vm5-body{padding:15px;display:grid;gap:13px;align-content:start;flex:1}
      .vm5-mode-help{font-size:12px;line-height:1.5;color:#64756d;text-align:center;padding:0 7px}
      .vm5-prompt{background:#eff8f3;border:1px solid #d9eadf;border-radius:17px;padding:14px 15px;font-size:18px;font-weight:900;line-height:1.5}
      .vm5-prompt small{display:block;margin-top:5px;color:#65746d;font-size:11px;font-weight:700}
      .vm5-status{text-align:center;color:#187a51;min-height:23px;font-size:14px;font-weight:900}
      .vm5-mic{width:116px;height:116px;border:0;border-radius:50%;margin:0 auto;background:linear-gradient(145deg,#27a96f,#14784f);color:#fff;font-size:53px;box-shadow:0 8px 28px rgba(24,122,81,.27)}
      .vm5-mic.listening{animation:vm5pulse 1.2s infinite}.vm5-mic:disabled{opacity:.52}
      @keyframes vm5pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,160,107,.25),0 8px 28px rgba(24,122,81,.27)}50%{box-shadow:0 0 0 18px rgba(34,160,107,0),0 8px 28px rgba(24,122,81,.27)}}
      .vm5-last{text-align:center;color:#55675e;font-size:13px;min-height:19px}.vm5-last b{color:#20342a}
      .vm5-memo{border:1px solid #dce8e1;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 3px 13px rgba(12,52,34,.05)}
      .vm5-memo-head{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:#f6faf8}.vm5-memo-head strong{font-size:15px}.vm5-memo-head span{font-size:10px;color:#187a51;font-weight:900}
      .vm5-empty{padding:22px;text-align:center;color:#7a8981;font-size:14px;line-height:1.6}
      .vm5-food{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:13px 14px;border-top:1px solid #edf2ef}.vm5-food:first-child{border-top:0}
      .vm5-food-name{font-size:17px;font-weight:900}.vm5-food-meta{font-size:11px;color:#74837b;margin-top:3px}.vm5-food-qty{font-size:17px;font-weight:900;white-space:nowrap}.vm5-food.pending .vm5-food-qty{font-size:12px;color:#ad7100}
      .vm5-text-row{display:flex;gap:7px}.vm5-text-row input{flex:1;min-width:0;border:1px solid #d5e1db;border-radius:13px;padding:12px;font-size:16px}.vm5-text-row button{border:0;border-radius:13px;padding:0 16px;background:#e8f3ed;color:#176c49;font-weight:900}
      .vm5-actions{position:sticky;bottom:0;background:rgba(255,255,255,.98);border-top:1px solid #e4ebe7;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .vm5-actions button{min-height:55px;border-radius:14px;border:1px solid #d9e3de;background:#fff;color:#33473d;font-size:15px;font-weight:900}
      .vm5-actions .primary{grid-column:1/-1;background:#187a51;color:#fff;border:0;font-size:18px}.vm5-actions .primary:disabled{background:#acb8b2}
      .vm5-busy{display:none;position:absolute;inset:0;z-index:9;background:rgba(255,255,255,.76);align-items:center;justify-content:center;color:#187a51;font-size:17px;font-weight:900}.vm5-shell.busy .vm5-busy{display:flex}
      @media(min-width:760px){.vm5-shell{min-height:calc(100% - 32px);margin:16px auto;border-radius:24px;overflow:hidden;box-shadow:0 12px 45px rgba(0,0,0,.12)}}
    `;
    document.head.appendChild(style);
  }

  function modeSwitchHtml(extraClass = '') {
    return `<div class="voice-mode-switch ${extraClass}">
      <button type="button" data-vm5-mode="fast"><b>高速入力</b><small>1回でまとめて</small></button>
      <button type="button" data-vm5-mode="conversation"><b>会話</b><small>AIが聞き取り</small></button>
      <button type="button" data-vm5-mode="hybrid"><b>おまかせ</b><small>必要時だけ会話</small></button>
    </div>`;
  }

  function bindModeButtons(root = document, fromModal = false) {
    root.querySelectorAll('[data-vm5-mode]').forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        setMode(btn.dataset.vm5Mode, fromModal);
      };
    });
    renderModeButtons();
  }

  function renderModeButtons() {
    document.querySelectorAll('[data-vm5-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vm5Mode === state.mode);
    });
    const help = $('#vm5-mode-help');
    if (help) help.textContent = modeHelp();
  }

  function renderStatus() {
    const status = $('#vm5-status');
    const mic = $('#vm5-mic');
    if (status) {
      if (state.speaking) status.textContent = 'AIが話しています…';
      else if (state.listening) status.textContent = '聞いています…';
      else if (state.busy) status.textContent = '内容を整理しています…';
      else status.textContent = 'マイクを押して話してください';
    }
    if (mic) {
      mic.classList.toggle('listening', state.listening);
      mic.disabled = state.busy || state.speaking;
    }
  }

  function render() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    $('.vm5-shell', modal)?.classList.toggle('busy', state.busy);
    const prompt = $('#vm5-prompt');
    if (prompt) {
      prompt.innerHTML = `${esc(state.reply)}<small>${state.ready
        ? '内容が合っていれば「これで登録する」を押してください。'
        : 'だいたいで大丈夫です。分かる範囲で答えてください。'}</small>`;
    }
    const last = $('#vm5-last');
    if (last) last.innerHTML = state.lastTranscript ? `あなた：<b>${esc(state.lastTranscript)}</b>` : '';
    const memo = $('#vm5-memo-list');
    if (memo) {
      memo.innerHTML = state.items.length
        ? state.items.map(item => {
            const done = item.amount > 0 && item.unit;
            const qty = done
              ? `${Number.isInteger(item.amount) ? item.amount : round1(item.amount)}${esc(item.unit)}`
              : '量を確認中';
            return `<div class="vm5-food ${done ? '' : 'pending'}">
              <div><div class="vm5-food-name">${esc(item.name)}</div><div class="vm5-food-meta">${esc(item.meal)}</div></div>
              <div class="vm5-food-qty">${qty}</div>
            </div>`;
          }).join('')
        : '<div class="vm5-empty">まだメモはありません。<br>食べたものをまとめて話して大丈夫です。</div>';
    }
    const reg = $('#vm5-register');
    if (reg) reg.disabled = state.busy || !state.ready;
    renderModeButtons();
    renderStatus();
  }

  function openVoice() {
    ensureStyle();
    resetDraft();
    document.getElementById('pfc-senior-voice-modal')?.remove();
    document.getElementById(MODAL_ID)?.remove();

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `<div class="vm5-shell">
      <div class="vm5-busy">内容を整理しています…</div>
      <div class="vm5-head"><button type="button" id="vm5-close" aria-label="閉じる">‹</button><strong>話して記録</strong><span></span></div>
      <div class="vm5-body">
        ${modeSwitchHtml()}
        <div class="vm5-mode-help" id="vm5-mode-help"></div>
        <div class="vm5-prompt" id="vm5-prompt"></div>
        <div class="vm5-status" id="vm5-status"></div>
        <button type="button" class="vm5-mic" id="vm5-mic" aria-label="マイク">🎙</button>
        <div class="vm5-last" id="vm5-last"></div>
        <div class="vm5-memo">
          <div class="vm5-memo-head"><strong>今日の食事メモ</strong><span>AIがメモしています</span></div>
          <div id="vm5-memo-list"></div>
        </div>
        <div class="vm5-text-row"><input id="vm5-text" type="text" placeholder="文字でも入力できます"><button type="button" id="vm5-send">送る</button></div>
      </div>
      <div class="vm5-actions">
        <button type="button" class="primary" id="vm5-register" disabled>これで登録する</button>
        <button type="button" id="vm5-restart">言い直す</button>
        <button type="button" id="vm5-correct">修正する</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    bindModeButtons(modal, true);
    $('#vm5-close').onclick = closeVoice;
    $('#vm5-mic').onclick = () => {
      stopSpeech();
      state.listening ? stopListening() : startListening();
      renderStatus();
    };
    $('#vm5-send').onclick = sendText;
    $('#vm5-text').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) sendText();
    });
    $('#vm5-register').onclick = commitDraft;
    $('#vm5-restart').onclick = () => {
      resetDraft();
      render();
      if (state.mode === 'conversation') {
        setTimeout(() => speakAndMaybeListen('食べたものを教えてください。', true), 150);
      }
    };
    $('#vm5-correct').onclick = () => {
      stopSpeech();
      state.ready = false;
      state.reply = state.items.length
        ? '変更したいところを、そのまま話してください。'
        : '食べたものをもう一度話してください。';
      render();
      if (state.mode === 'fast') startListening();
      else speakAndMaybeListen(state.reply, true);
    };
    render();

    if (state.mode === 'conversation') {
      setTimeout(() => speakAndMaybeListen('食べたものを教えてください。', true), 220);
    }
  }

  function sendText() {
    const input = $('#vm5-text');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    processUtterance(text);
  }

  function closeVoice() {
    stopListening();
    stopSpeech();
    document.getElementById(MODAL_ID)?.remove();
  }

  function installHomeModes() {
    const talk = document.getElementById('senior-talk-record');
    if (!talk || talk.dataset.vm5Bound === '1') return false;

    const clone = talk.cloneNode(true);
    clone.dataset.vm5Bound = '1';
    talk.replaceWith(clone);
    clone.addEventListener('click', openVoice);

    const existing = document.querySelector('.senior-home-modes');
    if (!existing) {
      const wrap = document.createElement('div');
      wrap.className = 'senior-home-modes';
      wrap.innerHTML = modeSwitchHtml();
      clone.insertAdjacentElement('afterend', wrap);
      bindModeButtons(wrap, false);
    }
    return true;
  }

  function forceVersion() {
    const apply = () => {
      const version = document.querySelector('.app-build-version');
      if (version && version.textContent !== BUILD_LABEL) version.textContent = BUILD_LABEL;
    };
    apply();
    const target = document.querySelector('.app-build-version');
    if (target) {
      const obs = new MutationObserver(apply);
      obs.observe(target, { childList: true, characterData: true, subtree: true });
    }
    let count = 0;
    const timer = setInterval(() => {
      apply();
      if (++count >= 20) clearInterval(timer);
    }, 500);
  }

  function install() {
    ensureStyle();
    loadMode();
    forceVersion();

    let tries = 0;
    const bind = () => {
      if (installHomeModes()) return;
      if (++tries < 40) setTimeout(bind, 150);
    };
    bind();

    window.openVoiceModesV5 = openVoice;
    window.__PFC_VOICE_MODES_V5__ = {
      version: VERSION,
      active: true,
      mode: () => state.mode,
      setMode,
      open: openVoice,
      parseModel: MODEL,
      liveTransport: false,
      browserSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      selfTest() {
        return {
          ok: Boolean(document.querySelector('.senior-main-actions')) && Boolean(window.__PFC_AI_V2__),
          checks: {
            home: Boolean(document.querySelector('.senior-main-actions')),
            aiV2: Boolean(window.__PFC_AI_V2__),
            foodMaster: Boolean(window.__PFC_MEAL_ENGINE_V50__),
            mode: MODES.includes(state.mode),
            browserSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
          }
        };
      }
    };
    console.info(`[PFC Voice Modes V5] active ${VERSION} / mode=${state.mode} / parse=${MODEL}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
