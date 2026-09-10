import { CALORIE_PRESETS, PFC_MODES, calculateTarget, targetLabel } from './features/targets.js';
import { alcoholUiModel } from './features/alcohol.js';
import { generateRealisticHistory, generateRealisticBody, isDummyHistoryRow } from './dev/realistic-decoy.js';

const RELEASE = 'v1.6.0';
const KEYS = Object.freeze({ targets:'tf_tg', records:'tf_dat', history:'tf_hist', body:'tf_body' });
const managerEnabled = new URL(location.href).searchParams.get('manager') === '1';
let stagedTarget = null;
let patchQueued = false;

function safeJson(raw, fallback) {
  try { const value = JSON.parse(raw); return value ?? fallback; }
  catch { return fallback; }
}

function readArray(key) {
  const value = safeJson(localStorage.getItem(key), []);
  return Array.isArray(value) ? value : [];
}

function readTargets() {
  const value = safeJson(localStorage.getItem(KEYS.targets), {});
  return {
    cal: Math.max(1, Number(value?.cal) || 2000),
    p: Math.max(0, Number(value?.p) || 0),
    f: Math.max(0, Number(value?.f) || 0),
    c: Math.max(0, Number(value?.c) || 0),
    a: Math.max(0, Number(value?.a) || 0),
    mode: PFC_MODES[value?.mode] ? value.mode : 'std',
    label: String(value?.label || PFC_MODES[value?.mode]?.label || '標準'),
    ...value
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function writeTarget(next) {
  const previous = safeJson(localStorage.getItem(KEYS.targets), {});
  localStorage.setItem(KEYS.targets, JSON.stringify({ ...previous, ...next }));
}

function patchVersion() {
  const build = document.querySelector('.app-build-version');
  if (build && build.textContent !== RELEASE) build.textContent = RELEASE;
  const runtime = document.querySelector('.runtime-panel p');
  if (runtime && runtime.textContent.includes('v1.5.1')) runtime.innerHTML = runtime.innerHTML.replace(/v1\.5\.1/g, RELEASE);
}

function patchHome() {
  const home = document.querySelector('#view-home');
  if (!home || home.hidden) return;
  const target = readTargets();
  const label = home.querySelector('.tgt-value');
  if (label && label.textContent !== targetLabel(target)) label.textContent = targetLabel(target);

  const old = home.querySelector('.v160-alcohol-strip');
  const model = alcoholUiModel(readArray(KEYS.records));
  if (!model.visible) { old?.remove(); return; }
  if (old) {
    const grams = old.querySelector('[data-a-grams]');
    const kcal = old.querySelector('[data-a-kcal]');
    if (grams) grams.textContent = `${model.grams}g`;
    if (kcal) kcal.textContent = `アルコール由来 約${model.estimatedKcal} kcal相当`;
    return;
  }
  const grid = home.querySelector('.pfc-mini-grid');
  if (!grid) return;
  grid.insertAdjacentHTML('afterend', `<div class="v160-alcohol-strip"><div><span class="v160-a-letter">A</span><span><b>アルコール</b><small data-a-kcal>アルコール由来 約${model.estimatedKcal} kcal相当</small></span></div><strong data-a-grams>${model.grams}g</strong></div>`);
}

function patchHistory() {
  const view = document.querySelector('#view-history');
  if (!view || view.hidden) return;
  const records = readArray(KEYS.records);
  const history = readArray(KEYS.history);
  const rows = [{ l: records, s: { A: records.reduce((n,r)=>n+Number(r?.A||0),0) } }, ...history];
  [...view.querySelectorAll('.history-day')].forEach((card, index) => {
    card.querySelector('.v160-history-a')?.remove();
    const row = rows[index];
    const amount = Number(row?.s?.A ?? row?.s?.a ?? (row?.l || []).reduce((n,r)=>n+Number(r?.A||0),0));
    if (!(amount > 0)) return;
    const head = card.querySelector('.history-head');
    head?.insertAdjacentHTML('afterend', `<div class="v160-history-a">A アルコール ${Math.round(amount * 10) / 10}g</div>`);
  });
}

function targetPanelHtml() {
  const current = stagedTarget || readTargets();
  const preview = calculateTarget(current.cal, current.mode);
  return `<div class="v160-target-panel panel">
    <div class="v160-panel-head"><div><small>かんたん設定</small><h2>1日の目標を選ぶ</h2></div><b>${esc(targetLabel(preview))}</b></div>
    <div class="v160-preset-grid">${CALORIE_PRESETS.map(item => `<button type="button" class="v160-preset ${Number(current.cal)===item.cal?'selected':''}" data-v160-action="cal" data-cal="${item.cal}" aria-pressed="${Number(current.cal)===item.cal}"><small>${esc(item.label)}</small><strong>${item.cal.toLocaleString()}</strong><span>kcal</span></button>`).join('')}</div>
    <label class="v160-custom-cal"><span>その他のカロリー</span><input id="v160-custom-cal" inputmode="numeric" value="${Math.round(Number(current.cal)||2000)}"><small>kcal</small></label>
    <div class="v160-balance-title"><b>PFCバランス</b><small>目的に近いものを選んでください</small></div>
    <div class="v160-mode-grid">${Object.entries(PFC_MODES).map(([key,mode]) => `<button type="button" class="v160-mode ${current.mode===key?'selected':''}" data-v160-action="mode" data-mode="${key}" aria-pressed="${current.mode===key}">${esc(mode.label)}</button>`).join('')}</div>
    <div class="v160-target-preview"><span>P <b>${preview.p}g</b></span><span>F <b>${preview.f}g</b></span><span>C <b>${preview.c}g</b></span></div>
    <button type="button" class="primary-btn wide v160-save-target" data-v160-action="save-target">この目標にする</button>
  </div>`;
}

function managerHtml() {
  if (!managerEnabled) return '';
  return `<div class="panel v160-manager"><div class="v160-panel-head"><div><small>DEVELOPER ONLY</small><h2>Manager Mode</h2></div><b>v1.6</b></div><p>実データを残したまま、履歴と体組成に現実的なデコイを作れます。</p><div class="v160-manager-grid"><button type="button" data-v160-action="dummy" data-days="30">30日分を作成</button><button type="button" data-v160-action="dummy" data-days="90">90日分を作成</button><button type="button" class="danger" data-v160-action="clear-dummy">デコイだけ削除</button></div><div class="v160-manager-note">すべて <code>isDummy: true</code> を付け、通常データとは分離します。</div></div>`;
}

function patchSettings() {
  const view = document.querySelector('#view-settings');
  const legacy = view?.querySelector('#target-form');
  if (!view || view.hidden || !legacy) return;
  legacy.classList.add('v160-legacy-target-form');
  if (!view.querySelector('.v160-target-panel')) {
    stagedTarget = readTargets();
    legacy.insertAdjacentHTML('beforebegin', targetPanelHtml());
  }
  if (managerEnabled && !view.querySelector('.v160-manager')) {
    const runtime = view.querySelector('.runtime-panel');
    (runtime || view.lastElementChild)?.insertAdjacentHTML(runtime ? 'beforebegin' : 'afterend', managerHtml());
  }
}

function renderTargetPanel() {
  const panel = document.querySelector('.v160-target-panel');
  if (panel) panel.outerHTML = targetPanelHtml();
}

function mergeDummy(days) {
  const target = readTargets();
  const oldHistory = readArray(KEYS.history).filter(row => !isDummyHistoryRow(row));
  const dummyHistory = generateRealisticHistory({ days, targetCal: target.cal, seed: 20260910 + days, includeAlcohol: true });
  const history = [...dummyHistory, ...oldHistory].sort((a,b)=>String(b?.d||'').localeCompare(String(a?.d||'')));
  localStorage.setItem(KEYS.history, JSON.stringify(history));

  const oldBody = readArray(KEYS.body).filter(row => row?.isDummy !== true);
  const latestWeight = oldBody.length ? Number(oldBody[oldBody.length - 1]?.weight ?? oldBody[oldBody.length - 1]?.w) : 72;
  const latestFat = oldBody.length ? Number(oldBody[oldBody.length - 1]?.fat ?? oldBody[oldBody.length - 1]?.bf) : 22;
  const dummyBody = generateRealisticBody({ days, seed: 20260910 + days, startWeight: Number.isFinite(latestWeight)?latestWeight:72, startFat: Number.isFinite(latestFat)?latestFat:22 });
  const body = [...oldBody, ...dummyBody].sort((a,b)=>String(a?.date||a?.d||'').localeCompare(String(b?.date||b?.d||'')));
  localStorage.setItem(KEYS.body, JSON.stringify(body));
}

function clearDummy() {
  const history = readArray(KEYS.history).filter(row => !isDummyHistoryRow(row));
  const body = readArray(KEYS.body).filter(row => row?.isDummy !== true);
  localStorage.setItem(KEYS.history, JSON.stringify(history));
  localStorage.setItem(KEYS.body, JSON.stringify(body));
}

function patchAll() {
  patchQueued = false;
  patchVersion();
  patchHome();
  patchHistory();
  patchSettings();
}

function queuePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(patchAll);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-v160-action]');
  if (!button) return;
  const action = button.dataset.v160Action;
  if (action === 'cal') {
    stagedTarget = { ...(stagedTarget || readTargets()), cal: Number(button.dataset.cal) || 2000 };
    renderTargetPanel();
  }
  if (action === 'mode') {
    stagedTarget = { ...(stagedTarget || readTargets()), mode: PFC_MODES[button.dataset.mode] ? button.dataset.mode : 'std' };
    renderTargetPanel();
  }
  if (action === 'save-target') {
    const input = document.querySelector('#v160-custom-cal');
    const cal = Math.max(1, Number(input?.value) || Number(stagedTarget?.cal) || 2000);
    const mode = PFC_MODES[stagedTarget?.mode] ? stagedTarget.mode : 'std';
    writeTarget(calculateTarget(cal, mode));
    location.reload();
  }
  if (action === 'dummy') {
    const days = Number(button.dataset.days) === 90 ? 90 : 30;
    if (!confirm(`${days}日分の開発用デコイを作成します。実データは残します。`)) return;
    mergeDummy(days);
    location.reload();
  }
  if (action === 'clear-dummy') {
    if (!confirm('開発用デコイだけ削除します。実データは残します。')) return;
    clearDummy();
    location.reload();
  }
});

document.addEventListener('input', event => {
  if (event.target.id !== 'v160-custom-cal') return;
  stagedTarget = { ...(stagedTarget || readTargets()), cal: Math.max(1, Number(event.target.value) || 1) };
  const panel = document.querySelector('.v160-target-panel');
  const preview = calculateTarget(stagedTarget.cal, stagedTarget.mode);
  const summary = panel?.querySelector('.v160-panel-head > b');
  const values = panel?.querySelector('.v160-target-preview');
  if (summary) summary.textContent = targetLabel(preview);
  if (values) values.innerHTML = `<span>P <b>${preview.p}g</b></span><span>F <b>${preview.f}g</b></span><span>C <b>${preview.c}g</b></span>`;
  panel?.querySelectorAll('[data-v160-action="cal"]').forEach(btn => btn.classList.toggle('selected', Number(btn.dataset.cal) === Number(stagedTarget.cal)));
});

new MutationObserver(queuePatch).observe(document.body, { childList:true, subtree:true });
queuePatch();
console.info('[PFC Senior]', { release: RELEASE, managerEnabled });
