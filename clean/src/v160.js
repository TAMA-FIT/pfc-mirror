import { readState, writeHistory, writeBody, writeRecords, writeTargets } from './storage.js';
import { CALORIE_PRESETS, PFC_MODES, calculateTarget, inferMode, targetLabel } from './features/targets-v160.js';
import { generateRealisticHistory, generateRealisticBody } from './dev/manager-v160.js';

const VERSION = 'v1.6.1';
const $ = s => document.querySelector(s);
let devTapCount = 0;
let devTapTimer = null;
let managerVisible = false;
let patchQueued = false;

function safeRead(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function currentTargets() {
  const state = readState();
  return state.targets;
}

function isDummyHistoryRow(row) {
  if (row?.isDummy === true) return true;
  return Array.isArray(row?.l) && row.l.length > 0 && row.l.every(record => record?.isDummy === true);
}

function pfcPresetHtml() {
  const target = currentTargets();
  const mode = inferMode(target);
  return `
    <section class="v160-target-panel" aria-label="目標プリセット">
      <div class="v160-panel-head">
        <div><span>目標設定</span><strong>${targetLabel(target)}</strong></div>
        <small>選ぶだけでPFCを自動計算</small>
      </div>
      <div class="v160-cal-presets">
        ${CALORIE_PRESETS.map(p => `
          <button type="button" class="v160-cal-btn ${Number(target.cal)===p.cal?'is-selected':''}" data-v160-cal="${p.cal}">
            <span>${p.label}</span><strong>${p.cal}</strong><small>kcal</small>
          </button>`).join('')}
      </div>
      <div class="v160-mode-title">PFCバランス</div>
      <div class="v160-mode-presets">
        ${Object.entries(PFC_MODES).map(([key,cfg]) => `
          <button type="button" class="v160-mode-btn ${mode===key?'is-selected':''}" data-v160-mode="${key}">
            ${cfg.label}
          </button>`).join('')}
      </div>
      <form class="v160-custom" id="v160-custom-form">
        <label>自由に設定する場合
          <span><input id="v160-custom-cal" inputmode="numeric" value="${Math.round(Number(target.cal)||2000)}"><b>kcal</b></span>
        </label>
        <button type="submit">このkcalにする</button>
      </form>
    </section>`;
}

function applyTarget(cal, mode) {
  const state = readState();
  const next = calculateTarget(cal, mode);
  writeTargets({ ...state.targets, ...next });
  location.reload();
}

function patchSettings() {
  const view = $('#view-settings');
  if (!view || view.hidden) return;

  const old = $('#target-form');
  if (old && !view.querySelector('.v160-target-panel')) {
    old.insertAdjacentHTML('beforebegin', pfcPresetHtml());
  }
  if (old && !old.hidden) old.hidden = true;

  const runtime = view.querySelector('.runtime-panel');
  if (runtime) {
    runtime.classList.add('v160-version-tap');
    const p = runtime.querySelector('p');
    if (p) {
      const current = p.innerHTML;
      const next = current.replace(/v1\.5\.1|v1\.6\.0/g, VERSION);
      if (next !== current) p.innerHTML = next;
    }
    if (managerVisible && !view.querySelector('.v160-manager')) {
      runtime.insertAdjacentHTML('afterend', managerHtml());
    }
  }
}

function patchHome() {
  const view = $('#view-home');
  if (!view || view.hidden) return;
  const targets = currentTargets();
  const label = view.querySelector('.tgt-value');
  const nextLabel = targetLabel(targets);
  if (label && label.textContent !== nextLabel) label.textContent = nextLabel;

  const records = safeRead('tf_dat', []);
  const alcohol = records.reduce((s, x) => s + Math.max(0, Number(x?.A)||0), 0);
  const grid = view.querySelector('.pfc-mini-grid');
  if (!grid) return;

  const existing = view.querySelector('.v160-alcohol-card');
  if (!(alcohol > 0.01)) {
    existing?.remove();
    return;
  }

  const rounded = Math.round(alcohol * 10) / 10;
  if (existing?.dataset.alcohol === String(rounded)) return;
  existing?.remove();
  grid.insertAdjacentHTML('afterend', `
    <div class="v160-alcohol-card" data-alcohol="${rounded}">
      <div><span>A</span><strong>アルコール</strong></div>
      <b>${rounded}<small>g</small></b>
      <p>純アルコール量・約 ${Math.round(alcohol*7)} kcal相当</p>
    </div>`);
}

function patchHistory() {
  const view = $('#view-history');
  if (!view || view.hidden) return;
  const today = safeRead('tf_dat', []);
  const history = safeRead('tf_hist', []);
  const datasets = [
    today.reduce((s,x)=>s+Math.max(0,Number(x?.A)||0),0),
    ...history.map(h => Number(h?.s?.A ?? h?.s?.a) || (h?.l||[]).reduce((s,x)=>s+Math.max(0,Number(x?.A)||0),0))
  ];
  view.querySelectorAll('.history-day').forEach((card, i) => {
    const a = datasets[i] || 0;
    const existing = card.querySelector('.v160-history-a');
    if (!(a > 0.01)) {
      existing?.remove();
      return;
    }

    const rounded = Math.round(a * 10) / 10;
    if (existing?.dataset.alcohol === String(rounded)) return;
    existing?.remove();
    const details = card.querySelector('details');
    const html = `<div class="v160-history-a" data-alcohol="${rounded}">A ${rounded}g <span>純アルコール</span></div>`;
    if (details) details.insertAdjacentHTML('beforebegin', html);
    else card.insertAdjacentHTML('beforeend', html);
  });
}

function managerHtml() {
  return `
    <section class="panel v160-manager">
      <h2>Developer Manager</h2>
      <p>開発確認用。生成データには <code>isDummy:true</code> を付けます。</p>
      <div class="v160-manager-actions">
        <button type="button" data-v160-manager="30">30日デコイ</button>
        <button type="button" data-v160-manager="90">90日デコイ</button>
        <button type="button" class="danger" data-v160-manager="clear">ダミーだけ削除</button>
      </div>
      <small>履歴・アルコール・体組成の長期表示確認に使用</small>
    </section>`;
}

function patchAll() {
  patchQueued = false;
  patchSettings();
  patchHome();
  patchHistory();
}

function queuePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(patchAll);
}

const observer = new MutationObserver(queuePatch);
for (const id of ['view-home','view-history','view-settings']) {
  const el = document.getElementById(id);
  if (el) observer.observe(el, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
}
queuePatch();

addEventListener('click', e => {
  const cal = e.target.closest('[data-v160-cal]');
  if (cal) {
    const mode = inferMode(currentTargets());
    applyTarget(Number(cal.dataset.v160Cal), mode);
    return;
  }

  const modeBtn = e.target.closest('[data-v160-mode]');
  if (modeBtn) {
    applyTarget(Number(currentTargets().cal)||2000, modeBtn.dataset.v160Mode);
    return;
  }

  const runtime = e.target.closest('.v160-version-tap');
  if (runtime) {
    clearTimeout(devTapTimer);
    devTapCount += 1;
    devTapTimer = setTimeout(() => { devTapCount = 0; }, 4000);
    if (devTapCount >= 7) {
      managerVisible = !managerVisible;
      devTapCount = 0;
      queuePatch();
      if (!managerVisible) $('.v160-manager')?.remove();
    }
  }

  const manager = e.target.closest('[data-v160-manager]');
  if (manager) {
    const action = manager.dataset.v160Manager;
    const state = readState();
    if (action === 'clear') {
      writeHistory(state.history.filter(x => !isDummyHistoryRow(x)));
      writeBody(state.body.filter(x => x?.isDummy !== true));
      writeRecords(state.records.filter(x => x?.isDummy !== true));
      location.reload();
      return;
    }
    const days = Number(action);
    if (days === 30 || days === 90) {
      const realHistory = state.history.filter(x => !isDummyHistoryRow(x));
      const realBody = state.body.filter(x => x?.isDummy !== true);
      const generatedHistory = generateRealisticHistory({ days, targetCal:Number(state.targets.cal)||2000 });
      const lastBody = [...realBody].reverse().find(x => Number(x?.weight ?? x?.w) > 0);
      const latestWeight = Number(lastBody?.weight ?? lastBody?.w) || 70;
      const latestFat = Number(lastBody?.fat ?? lastBody?.bf) || 22;
      const generatedBody = generateRealisticBody({
        days,
        startWeight: latestWeight + days * 0.018,
        startFat: latestFat + days * 0.010
      });
      const combinedHistory = [...generatedHistory, ...realHistory].sort((a,b)=>String(b?.d||'').localeCompare(String(a?.d||'')));
      const combinedBody = [...realBody, ...generatedBody].sort((a,b)=>String(a?.date||a?.d||'').localeCompare(String(b?.date||b?.d||'')));
      writeHistory(combinedHistory);
      writeBody(combinedBody);
      location.reload();
    }
  }
});

addEventListener('submit', e => {
  if (e.target.id !== 'v160-custom-form') return;
  e.preventDefault();
  const cal = Number($('#v160-custom-cal')?.value);
  if (!(cal >= 800 && cal <= 5000)) return;
  applyTarget(cal, inferMode(currentTargets()));
});

console.info('[PFC v1.6 extension]', { version: VERSION });
