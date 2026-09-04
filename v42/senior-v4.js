// PFC Mirror Senior Voice UX V4
// Voice-first meal logging with a simple memo-style confirmation flow.
// Keeps the existing PFC dashboard, Food Master, manual entry and AI V2 intact.
(() => {
  'use strict';

  const VERSION = '4.0.0';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  const PARSE_MODEL = 'gemini-3.5-flash-lite';
  const MODAL_ID = 'pfc-senior-voice-modal';
  const FIX_ID = 'pfc-senior-fix-modal';
  const STYLE_ID = 'pfc-senior-v4-style';

  const state = {
    busy: false,
    listening: false,
    recognition: null,
    items: [],
    history: [],
    ready: false,
    reply: '食べたものを、そのまま話してください。',
    lastTranscript: '',
    lastDeleted: null,
    lastDeletedIndex: -1,
    undoTimer: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const rows = () => {
    try { return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : []; }
    catch (_) { return []; }
  };
  const storage = () => window.mirrorStorage || window.localStorage;
  const round1 = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function autoMeal() {
    try {
      if (typeof getAutoTime === 'function') {
        const value = getAutoTime();
        if (['朝', '昼', '晩', '間食'].includes(value)) return value;
      }
    } catch (_) {}
    const h = new Date().getHours();
    if (h < 11) return '朝';
    if (h < 16) return '昼';
    if (h < 22) return '晩';
    return '間食';
  }

  function persist() {
    try {
      if (typeof sv === 'function') sv();
      else storage().setItem('tf_dat', JSON.stringify(rows()));
      if (typeof ren === 'function') ren();
      if (typeof upd === 'function') upd();
    } catch (e) {
      console.error('[PFC Senior V4] persist failed', e);
    }
  }

  function stripName(name) {
    const engine = window.__PFC_MEAL_ENGINE_V50__;
    if (engine?.stripRecordName) return engine.stripRecordName(name);
    return String(name || '').replace(/^🤖\s*/, '').replace(/[（(][^()（）]*[0-9][^()（）]*[)）]\s*$/, '').trim();
  }

  function recordAmount(record) {
    const amount = Number(record?._dbv3?.amount);
    const unit = String(record?._dbv3?.unit || '').trim();
    if (amount > 0) return `${Number.isInteger(amount) ? amount : round1(amount)}${unit}`;
    const qty = record?._qty;
    if (Number(qty?.amount) > 0) return `${round1(qty.amount)}${qty.unit || ''}`;
    return '';
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.pfc-senior-v4{--sv-green:#187a51;--sv-green2:#22a06b;--sv-ink:#18251f;--sv-muted:#65746d;--sv-line:#dce7e1;--sv-soft:#eff8f3;--sv-blue:#1769c2;--sv-red:#c83a35}
      body.pfc-senior-v4 .premium-ticket-wrap,body.pfc-senior-v4 #cheat-panel,body.pfc-senior-v4 .main-actions,body.pfc-senior-v4 #tama-chat-btn{display:none!important}
      body.pfc-senior-v4 .dash{border-radius:20px;padding:16px;box-shadow:0 5px 20px rgba(17,65,44,.08);border:1px solid #e1ebe6}
      body.pfc-senior-v4 .cal-caption{font-size:13px!important}.pfc-senior-v4 .cal-value{font-size:34px!important}.pfc-senior-v4 .cal-rem{font-size:30px!important}
      body.pfc-senior-v4 .macro-name{font-size:12px!important}.pfc-senior-v4 .macro-value{font-size:23px!important}
      .senior-pfc-legend{margin:10px 2px 0;padding:9px 10px;border-radius:12px;background:#f7faf8;color:#596961;font-size:12px;line-height:1.55;text-align:center}
      .senior-pfc-legend b{color:#273831}.senior-pfc-legend .p{color:#188a4d}.senior-pfc-legend .f{color:#d67500}.senior-pfc-legend .c{color:#246fc0}
      .senior-main-actions{display:grid;gap:10px;margin:14px 0 18px}
      .senior-main-actions button{font-family:inherit;cursor:pointer;min-height:62px;border-radius:17px;border:1px solid var(--sv-line);font-weight:900}
      .senior-talk-btn{min-height:100px!important;background:linear-gradient(135deg,var(--sv-green2),var(--sv-green));color:#fff;border:0!important;box-shadow:0 7px 20px rgba(24,122,81,.24);display:flex;align-items:center;justify-content:flex-start;gap:16px;padding:17px 20px;text-align:left}
      .senior-talk-btn .mic{font-size:46px;line-height:1}.senior-talk-btn strong{display:block;font-size:25px}.senior-talk-btn small{display:block;margin-top:3px;font-size:13px;font-weight:700;opacity:.9}
      .senior-fix-btn{background:#fff;color:var(--sv-ink);display:flex;align-items:center;gap:12px;padding:12px 17px;text-align:left}
      .senior-fix-btn .pen{font-size:28px}.senior-fix-btn strong{font-size:19px;display:block}.senior-fix-btn small{font-size:12px;color:var(--sv-muted);font-weight:700}
      .senior-manual-link{border:0!important;background:transparent!important;color:#64756d!important;min-height:42px!important;font-size:13px!important;text-decoration:underline}
      #${MODAL_ID},#${FIX_ID}{position:fixed;inset:0;z-index:2147483600;background:#f4f8f6;color:var(--sv-ink);font-family:inherit;overflow:auto;-webkit-overflow-scrolling:touch}
      .sv4-shell{width:min(680px,100%);min-height:100%;margin:0 auto;background:#fff;display:flex;flex-direction:column}
      .sv4-header{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:13px 15px;background:rgba(255,255,255,.96);border-bottom:1px solid #e5ece8;backdrop-filter:blur(10px)}
      .sv4-header button{width:46px;height:46px;border:0;border-radius:14px;background:#eef4f1;font-size:24px;color:#42554b}.sv4-header strong{font-size:20px}.sv4-header .spacer{width:46px}
      .sv4-body{padding:16px;display:grid;gap:14px;flex:1;align-content:start}
      .sv4-prompt{padding:15px 16px;border-radius:17px;background:var(--sv-soft);font-size:18px;font-weight:850;line-height:1.5;border:1px solid #d9eadf}
      .sv4-prompt small{display:block;font-size:12px;color:var(--sv-muted);font-weight:650;margin-top:5px}
      .sv4-listen-status{text-align:center;color:var(--sv-green);font-weight:900;font-size:15px;min-height:22px}
      .sv4-mic{width:116px;height:116px;border-radius:50%;border:0;margin:0 auto;background:linear-gradient(145deg,#27a96f,#14784f);color:#fff;font-size:54px;box-shadow:0 8px 28px rgba(24,122,81,.28);cursor:pointer}
      .sv4-mic.listening{animation:sv4pulse 1.25s infinite}.sv4-mic:disabled{opacity:.55}
      @keyframes sv4pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,160,107,.25),0 8px 28px rgba(24,122,81,.28)}50%{box-shadow:0 0 0 18px rgba(34,160,107,0),0 8px 28px rgba(24,122,81,.28)}}
      .sv4-last{font-size:13px;color:#52645b;text-align:center;min-height:20px}.sv4-last b{color:#23352c}
      .sv4-memo{border:1px solid #dce8e1;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 3px 14px rgba(12,52,34,.06)}
      .sv4-memo-head{padding:12px 15px;background:#f5faf7;display:flex;align-items:center;justify-content:space-between}.sv4-memo-head strong{font-size:15px}.sv4-memo-head span{font-size:11px;color:#187a51;font-weight:900}
      .sv4-empty{padding:22px;text-align:center;color:#7b8982;font-size:14px}
      .sv4-food{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:14px 15px;border-top:1px solid #edf2ef}.sv4-food:first-child{border-top:0}
      .sv4-food-name{font-size:17px;font-weight:900}.sv4-food-meta{font-size:12px;color:#718078;margin-top:3px}.sv4-food-qty{font-size:17px;font-weight:900;color:#20342a;white-space:nowrap}.sv4-food.pending .sv4-food-qty{color:#b47400;font-size:13px}
      .sv4-actions{position:sticky;bottom:0;background:rgba(255,255,255,.98);border-top:1px solid #e4ebe7;padding:11px 14px calc(11px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .sv4-actions button{min-height:56px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:900;border:1px solid #d9e3de;background:#fff;color:#33473d}
      .sv4-actions .primary{grid-column:1/-1;background:var(--sv-green);color:#fff;border:0;font-size:18px}.sv4-actions .primary:disabled{background:#aab8b1}
      .sv4-text-row{display:flex;gap:8px}.sv4-text-row input{flex:1;min-width:0;border:1px solid #d4e0da;border-radius:13px;padding:13px;font-size:16px}.sv4-text-row button{border:0;border-radius:13px;background:#e8f3ed;color:#176c49;font-weight:900;padding:0 16px}
      .sv4-busy{display:none;position:absolute;inset:0;background:rgba(255,255,255,.78);z-index:6;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:#187a51}.sv4-shell.busy .sv4-busy{display:flex}
      .sv4-fix-intro{padding:14px;border-radius:16px;background:#f0f7f3;color:#40564a;font-size:14px;line-height:1.55}
      .sv4-voice-fix{width:100%;min-height:70px;border:0;border-radius:16px;background:#eaf3ff;color:#135da9;font-size:18px;font-weight:900;display:flex;gap:12px;align-items:center;justify-content:center}
      .sv4-records{display:grid;gap:9px}.sv4-record{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid #dde7e2;border-radius:15px;padding:12px;background:#fff}.sv4-record strong{font-size:16px}.sv4-record small{display:block;color:#718078;margin-top:3px}.sv4-record-buttons{display:flex;gap:6px}.sv4-record-buttons button{min-width:52px;height:46px;border-radius:12px;border:1px solid #d7e2dc;background:#f7faf8;font-weight:900;color:#315144}.sv4-record-buttons .del{color:#b62e2a;background:#fff6f5;border-color:#f0c6c3}
      .sv4-fix-empty{text-align:center;padding:34px;color:#718078}
      .sv4-undo{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#1e2c25;color:#fff;border-radius:14px;padding:11px 13px;display:flex;gap:13px;align-items:center;box-shadow:0 8px 28px rgba(0,0,0,.25);font-size:13px}.sv4-undo button{border:0;border-radius:9px;background:#fff;color:#187a51;padding:8px 11px;font-weight:900}
      @media(min-width:760px){.sv4-shell{min-height:calc(100% - 32px);margin:16px auto;border-radius:24px;overflow:hidden;box-shadow:0 12px 45px rgba(0,0,0,.12)}}
    `;
    document.head.appendChild(style);
  }

  function installHome() {
    if (document.querySelector('.senior-main-actions')) return;
    const mainActions = document.querySelector('.main-actions');
    if (!mainActions?.parentNode) return;

    const legend = document.createElement('div');
    legend.className = 'senior-pfc-legend';
    legend.innerHTML = `<b>PFCを少しずつ覚えましょう</b><br><span class="p">P＝たんぱく質</span> ・ <span class="f">F＝脂質</span> ・ <span class="c">C＝炭水化物</span>`;

    const actions = document.createElement('div');
    actions.className = 'senior-main-actions';
    actions.innerHTML = `
      <button type="button" class="senior-talk-btn" id="senior-talk-record">
        <span class="mic">🎙</span><span><strong>話して記録</strong><small>食べたものを話すだけ</small></span>
      </button>
      <button type="button" class="senior-fix-btn" id="senior-fix-record">
        <span class="pen">✏️</span><span><strong>記録を直す</strong><small>声でも、手でも修正・削除できます</small></span>
      </button>
      <button type="button" class="senior-manual-link" id="senior-manual-entry">手入力で記録する</button>`;

    const dash = document.querySelector('.dash');
    if (dash) dash.insertAdjacentElement('afterend', legend);
    mainActions.parentNode.insertBefore(actions, mainActions);

    $('#senior-talk-record')?.addEventListener('click', () => openVoice());
    $('#senior-fix-record')?.addEventListener('click', () => openFixHub());
    $('#senior-manual-entry')?.addEventListener('click', () => {
      try { if (typeof toggleManualPanel === 'function') toggleManualPanel(); }
      catch (_) {}
      document.getElementById('manual-inp-sec')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function resetDraft() {
    state.items = [];
    state.history = [];
    state.ready = false;
    state.reply = '食べたものを、そのまま話してください。';
    state.lastTranscript = '';
  }

  function draftPrompt(utterance) {
    const current = state.items.map(x => ({
      name: x.name, amount: x.amount, unit: x.unit, meal: x.meal,
      p: x.p, f: x.f, c: x.c, a: x.a, kcal: x.kcal,
      nutritionSource: x.nutritionSource, confidence: x.confidence
    }));
    const history = state.history.slice(-8);
    return `あなたはシニア向けPFC食事記録アプリで、利用者の目の前でメモを取りながら聞き取りをするトレーナーです。
利用者は自然な日本語・言い淀み・言い直しを含めて話します。現在の候補メモを更新し、JSONだけを返してください。

目的:
- 一回の発話に複数食品があっても全部拾う。
- 「あ、納豆も」「米は一杯」「鶏むねは150くらい」のような追加・訂正を会話の流れとして反映する。
- 食品名と量・単位が十分に分かれば ready=true。
- 重要な情報が足りなければ ready=false とし、replyで一度に答えやすい短い質問を1つだけする。
- 鶏むね等で皮あり/なしが栄養値に大きく影響する場合は、会話で判明していなければ必要に応じて確認する。
- 味噌汁1杯、納豆1パックなど一般的で無理のない単位は、利用者が量を明示しなくても標準1単位を仮置きしてよい。
- 白米の「茶碗一杯」は amount=1, unit="杯" としてよい。グラムを勝手に表示用へ変換しない。
- 「納豆はやっぱなし」「味噌汁消して」などは候補から外す。
- P/F/C/A/kcalは実際の量の概算値。後段のFood Masterに一致する食品はアプリ側で公式値に置き換えるため、ここでは自然な推定でよい。
- nutritionSourceは user|estimate のどちらか。
- mealは 朝|昼|晩|間食。指定がなければ ${autoMeal()}。
- Markdown禁止。説明文禁止。JSON以外を出力しない。

現在の候補メモ: ${JSON.stringify(current)}
直近会話: ${JSON.stringify(history)}
今回の利用者発言: ${JSON.stringify(String(utterance || ''))}

出力形式:
{
  "reply":"利用者への短い質問または確認文",
  "ready":true,
  "items":[
    {"name":"食品名","amount":150,"unit":"g","meal":"昼","p":0,"f":0,"c":0,"a":0,"kcal":0,"nutritionSource":"estimate","confidence":0.9}
  ]
}`;
  }

  async function callDraftAI(utterance) {
    const payload = {
      taskType: 'voice',
      modelPreference: PARSE_MODEL,
      contents: [{ parts: [{ text: draftPrompt(utterance) }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      let text = Array.isArray(parts) ? parts.map(p => String(p?.text || '')).join('').trim() : String(data?.text || '').trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (_) {
        const a = text.indexOf('{'), b = text.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Error('AI JSON parse failed');
        parsed = JSON.parse(text.slice(a, b + 1));
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeDraftItem(raw) {
    if (!raw || !String(raw.name || '').trim()) return null;
    const amount = Number(raw.amount);
    const item = {
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
    return item;
  }

  async function processUtterance(text) {
    const utterance = String(text || '').trim();
    if (!utterance || state.busy) return;
    state.busy = true;
    state.lastTranscript = utterance;
    state.history.push({ role: 'user', text: utterance });
    renderVoice();
    try {
      const result = await callDraftAI(utterance);
      const next = (Array.isArray(result?.items) ? result.items : []).map(normalizeDraftItem).filter(Boolean);
      state.items = next;
      state.ready = Boolean(result?.ready) && next.length > 0 && next.every(x => x.amount > 0 && x.unit);
      state.reply = String(result?.reply || (state.ready ? '内容を確認して、よければ登録してください。' : 'もう少し教えてください。')).trim();
      state.history.push({ role: 'assistant', text: state.reply });
    } catch (e) {
      console.error('[PFC Senior V4] draft parse failed', e);
      state.reply = e?.name === 'AbortError' ? '少し時間がかかりました。短く分けて、もう一度話してください。' : 'うまく聞き取れませんでした。もう一度話してください。';
      state.ready = false;
    } finally {
      state.busy = false;
      renderVoice();
    }
  }

  function openVoice() {
    ensureStyle();
    resetDraft();
    closeFixHub();
    document.getElementById(MODAL_ID)?.remove();
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="sv4-shell">
        <div class="sv4-busy">内容を整理しています…</div>
        <div class="sv4-header"><button type="button" id="sv4-close" aria-label="閉じる">‹</button><strong>話して記録</strong><span class="spacer"></span></div>
        <div class="sv4-body">
          <div class="sv4-prompt" id="sv4-prompt"></div>
          <div class="sv4-listen-status" id="sv4-listen-status">マイクを押して話してください</div>
          <button type="button" class="sv4-mic" id="sv4-mic" aria-label="話す">🎙</button>
          <div class="sv4-last" id="sv4-last"></div>
          <div class="sv4-memo">
            <div class="sv4-memo-head"><strong>今日の食事メモ</strong><span>AIがメモしています</span></div>
            <div id="sv4-memo-list"></div>
          </div>
          <div class="sv4-text-row"><input id="sv4-text" type="text" placeholder="文字でも入力できます"><button id="sv4-text-send" type="button">送る</button></div>
        </div>
        <div class="sv4-actions">
          <button type="button" class="primary" id="sv4-register" disabled>これで登録する</button>
          <button type="button" id="sv4-restart">言い直す</button>
          <button type="button" id="sv4-correct">修正する</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    $('#sv4-close', modal).onclick = closeVoice;
    $('#sv4-mic', modal).onclick = () => startListening(text => processUtterance(text));
    $('#sv4-text-send', modal).onclick = () => sendTextFromVoice();
    $('#sv4-text', modal).addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) sendTextFromVoice(); });
    $('#sv4-register', modal).onclick = commitDraft;
    $('#sv4-restart', modal).onclick = () => { resetDraft(); renderVoice(); };
    $('#sv4-correct', modal).onclick = () => {
      state.reply = state.items.length ? '変更したいところを、そのまま話してください。' : '食べたものをもう一度話してください。';
      state.ready = false;
      renderVoice();
      startListening(text => processUtterance(text));
    };
    renderVoice();
  }

  function closeVoice() {
    stopListening();
    document.getElementById(MODAL_ID)?.remove();
  }

  function renderVoice() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    $('.sv4-shell', modal)?.classList.toggle('busy', state.busy);
    const prompt = $('#sv4-prompt', modal);
    if (prompt) prompt.innerHTML = `${esc(state.reply)}<small>${state.ready ? '内容が合っていれば、下の「これで登録する」を押してください。' : 'だいたいで大丈夫です。分かる範囲で答えてください。'}</small>`;
    const last = $('#sv4-last', modal);
    if (last) last.innerHTML = state.lastTranscript ? `あなた：<b>${esc(state.lastTranscript)}</b>` : '';
    const list = $('#sv4-memo-list', modal);
    if (list) {
      if (!state.items.length) list.innerHTML = '<div class="sv4-empty">まだメモはありません。<br>食べたものをまとめて話して大丈夫です。</div>';
      else list.innerHTML = state.items.map(item => {
        const ready = item.amount > 0 && item.unit;
        const qty = ready ? `${Number.isInteger(item.amount) ? item.amount : round1(item.amount)}${esc(item.unit)}` : '量を確認中';
        return `<div class="sv4-food ${ready ? '' : 'pending'}"><div><div class="sv4-food-name">${esc(item.name)}</div><div class="sv4-food-meta">${esc(item.meal)}</div></div><div class="sv4-food-qty">${qty}</div></div>`;
      }).join('');
    }
    const register = $('#sv4-register', modal);
    if (register) register.disabled = state.busy || !state.ready;
    const mic = $('#sv4-mic', modal);
    if (mic) mic.disabled = state.busy;
  }

  function sendTextFromVoice() {
    const input = $('#sv4-text');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    processUtterance(text);
  }

  function startListening(onFinal) {
    if (state.busy || state.listening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      state.reply = 'このブラウザではマイク入力が使えません。下の文字入力を使ってください。';
      renderVoice();
      $('#sv4-text')?.focus();
      return;
    }
    stopListening();
    const rec = new SR();
    state.recognition = rec;
    state.listening = true;
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = false;
    const modal = document.getElementById(MODAL_ID) || document.getElementById(FIX_ID);
    const status = modal?.querySelector('.sv4-listen-status');
    const mic = modal?.querySelector('.sv4-mic');
    if (status) status.textContent = '聞いています…';
    mic?.classList.add('listening');
    let finalText = '';
    rec.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      if (status) status.textContent = finalText || interim || '聞いています…';
    };
    rec.onerror = event => {
      console.warn('[PFC Senior V4] speech recognition', event.error);
      if (status) status.textContent = event.error === 'not-allowed' ? 'マイクの許可が必要です' : 'もう一度マイクを押してください';
    };
    rec.onend = () => {
      state.listening = false;
      state.recognition = null;
      mic?.classList.remove('listening');
      if (status && !finalText) status.textContent = 'マイクを押して話してください';
      if (finalText.trim()) onFinal(finalText.trim());
    };
    try { rec.start(); }
    catch (e) {
      state.listening = false;
      state.recognition = null;
      mic?.classList.remove('listening');
      if (status) status.textContent = 'もう一度マイクを押してください';
    }
  }

  function stopListening() {
    if (state.recognition) {
      try { state.recognition.stop(); } catch (_) {}
    }
    state.recognition = null;
    state.listening = false;
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
      record._seniorV4 = { version: VERSION, source: 'Food Master', amount: item.amount, unit: item.unit, at: Date.now() };
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
      _seniorV4: { version: VERSION, source: item.nutritionSource, amount: item.amount, unit: item.unit, at: Date.now() }
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

  function openFixHub() {
    ensureStyle();
    closeVoice();
    document.getElementById(FIX_ID)?.remove();
    const modal = document.createElement('div');
    modal.id = FIX_ID;
    modal.innerHTML = `
      <div class="sv4-shell">
        <div class="sv4-header"><button type="button" id="sv4-fix-close" aria-label="閉じる">‹</button><strong>記録を直す</strong><span class="spacer"></span></div>
        <div class="sv4-body">
          <div class="sv4-fix-intro">後から気づいた変更も大丈夫です。<br><b>声でまとめて直す</b>か、下の記録を選んで<b>手で直す</b>ことができます。</div>
          <button type="button" class="sv4-voice-fix" id="sv4-voice-fix">🎙 声でまとめて直す</button>
          <div class="sv4-listen-status" id="sv4-fix-status"></div>
          <div class="sv4-text-row"><input id="sv4-fix-text" type="text" placeholder="例：さっきの白米を250gにして"><button id="sv4-fix-send" type="button">送る</button></div>
          <div><strong style="font-size:16px">今日の記録</strong></div>
          <div class="sv4-records" id="sv4-records"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    $('#sv4-fix-close', modal).onclick = closeFixHub;
    $('#sv4-voice-fix', modal).onclick = () => startFixListening();
    $('#sv4-fix-send', modal).onclick = sendFixText;
    $('#sv4-fix-text', modal).addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) sendFixText(); });
    renderFixRecords();
  }

  function closeFixHub() {
    stopListening();
    document.getElementById(FIX_ID)?.remove();
  }

  function renderFixRecords() {
    const box = $('#sv4-records');
    if (!box) return;
    if (!rows().length) {
      box.innerHTML = '<div class="sv4-fix-empty">今日の記録はまだありません。</div>';
      return;
    }
    box.innerHTML = rows().map((record, index) => {
      const qty = recordAmount(record);
      return `<div class="sv4-record"><div><strong>${esc(stripName(record.N))}</strong><small>${esc(record.time || '')}${qty ? ` ・ ${esc(qty)}` : ''} ・ ${Math.round(Number(record.Cal)||0)}kcal</small></div><div class="sv4-record-buttons"><button type="button" data-edit="${index}">直す</button><button type="button" class="del" data-delete="${index}" aria-label="削除">削除</button></div></div>`;
    }).join('');
    box.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const index = Number(btn.dataset.edit);
      if (typeof window.ed === 'function') window.ed(index);
    }));
    box.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteRecord(Number(btn.dataset.delete))));
  }

  function deleteRecord(index) {
    const record = rows()[index];
    if (!record) return;
    if (!window.confirm(`${stripName(record.N)} を削除しますか？`)) return;
    clearTimeout(state.undoTimer);
    state.lastDeleted = record;
    state.lastDeletedIndex = index;
    rows().splice(index, 1);
    persist();
    renderFixRecords();
    showUndo();
  }

  function showUndo() {
    document.querySelector('.sv4-undo')?.remove();
    const bar = document.createElement('div');
    bar.className = 'sv4-undo';
    bar.innerHTML = '<span>削除しました</span><button type="button">元に戻す</button>';
    document.body.appendChild(bar);
    bar.querySelector('button').onclick = () => {
      if (!state.lastDeleted) return;
      const at = Math.max(0, Math.min(rows().length, state.lastDeletedIndex));
      rows().splice(at, 0, state.lastDeleted);
      state.lastDeleted = null;
      persist();
      renderFixRecords();
      bar.remove();
    };
    state.undoTimer = setTimeout(() => { state.lastDeleted = null; bar.remove(); }, 10000);
  }

  function startFixListening() {
    const modal = document.getElementById(FIX_ID);
    if (!modal) return;
    let mic = modal.querySelector('.sv4-mic');
    if (!mic) {
      mic = document.createElement('button');
      mic.className = 'sv4-mic';
      mic.style.display = 'none';
      modal.appendChild(mic);
    }
    const status = $('#sv4-fix-status', modal);
    status?.classList.add('sv4-listen-status');
    startListening(text => applyVoiceCorrection(text));
  }

  function sendFixText() {
    const input = $('#sv4-fix-text');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    applyVoiceCorrection(text);
  }

  async function applyVoiceCorrection(text) {
    const status = $('#sv4-fix-status');
    if (status) status.textContent = `「${text}」を修正しています…`;
    const hiddenInput = document.getElementById('v-chat-input');
    if (!hiddenInput || typeof window.sendVoiceChat !== 'function') {
      if (status) status.textContent = '音声修正を起動できませんでした。下の「直す」を使ってください。';
      return;
    }
    hiddenInput.value = text;
    try {
      await window.sendVoiceChat();
      if (status) status.textContent = '修正内容を反映しました。下の一覧で確認できます。';
      renderFixRecords();
    } catch (e) {
      if (status) status.textContent = '修正できませんでした。もう一度試してください。';
    }
  }

  function markVersion() {
    const version = document.querySelector('.app-build-version');
    if (version) version.textContent = 'V37 Senior';
  }

  function install() {
    ensureStyle();
    document.body.classList.add('pfc-senior-v4');
    installHome();
    markVersion();

    window.openSeniorVoiceUI = openVoice;
    window.openSeniorFixHub = openFixHub;
    window.__PFC_SENIOR_V4__ = {
      version: VERSION,
      active: true,
      parseModel: PARSE_MODEL,
      openVoice,
      openFixHub,
      state: () => ({ ready: state.ready, items: state.items.map(x => ({ ...x })), busy: state.busy }),
      selfTest() {
        const checks = {
          rowsArray: Array.isArray(rows()),
          foodMaster: Boolean(window.__PFC_MEAL_ENGINE_V50__),
          aiV2: Boolean(window.__PFC_AI_V2__),
          homeActions: Boolean(document.querySelector('.senior-main-actions')),
          browserSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
        };
        return { ok: checks.rowsArray && checks.aiV2 && checks.homeActions, checks };
      }
    };
    console.info(`[PFC Senior V4] active ${VERSION} / parse=${PARSE_MODEL}`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
