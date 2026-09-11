export const APP_VERSION = 'v1.7.15';
export const MEAL_ORDER = Object.freeze(['朝', '昼', '晩', '間食']);

const MEAL_LABELS = Object.freeze({
  朝: '朝食',
  昼: '昼食',
  晩: '夕食',
  間食: '間食'
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round1(value) {
  return Math.round(num(value) * 10) / 10;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

export function mealKeyForRecord(record, fallbackText = '') {
  const direct = String(record?.time || '').trim();
  if (MEAL_ORDER.includes(direct)) return direct;
  const match = String(fallbackText || '').trim().match(/^(朝|昼|晩|間食)(?:・|\s|$)/);
  return match?.[1] || '間食';
}

export function mealTotals(records = []) {
  return records.reduce((sum, record) => ({
    kcal: sum.kcal + num(record?.Cal ?? record?.kcal),
    p: sum.p + num(record?.P ?? record?.p),
    f: sum.f + num(record?.F ?? record?.f),
    c: sum.c + num(record?.C ?? record?.c)
  }), { kcal: 0, p: 0, f: 0, c: 0 });
}

function loadCss() {
  if (typeof document === 'undefined' || document.getElementById('pfc-ui-polish-v1715-css')) return;
  const link = document.createElement('link');
  link.id = 'pfc-ui-polish-v1715-css';
  link.rel = 'stylesheet';
  link.href = new URL('../assets/ui-polish-v1715.css?v=1.7.15', import.meta.url).href;
  document.head.appendChild(link);
}

function readTodayRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem('tf_dat') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordFromCard(card) {
  const macroText = card.querySelector('.record-macros')?.textContent || '';
  const kcalText = card.querySelector('.record-main > b')?.textContent || '';
  const find = letter => Number(macroText.match(new RegExp(`${letter}\\s*([0-9.]+)`))?.[1] || 0);
  return {
    Cal: Number(kcalText.replace(/[^0-9.-]/g, '')) || 0,
    P: find('P'),
    F: find('F'),
    C: find('C')
  };
}

function patchVersion() {
  // Build/version ownership belongs to the current app/Live runtime.
  // This legacy v1.7.15 UI module must never overwrite the current badge.
}

function patchTalkButton() {
  const talk = document.querySelector('#view-home .senior-talk-btn');
  if (!talk) return;
  const icon = talk.querySelector('.live-icon');
  if (icon) icon.classList.add('mic');
}

function cleanCardMealPrefix(card) {
  const subtitle = card.querySelector('.record-main span');
  if (!subtitle) return;
  subtitle.textContent = subtitle.textContent.replace(/^(朝|昼|晩|間食)・/, '');
}

function buildGroup(meal, entries) {
  const records = entries.map(entry => entry.record || recordFromCard(entry.card));
  const total = mealTotals(records);
  const wrapper = document.createElement('div');
  wrapper.className = 'meal-record-group';
  wrapper.dataset.meal = meal;
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', MEAL_LABELS[meal]);
  wrapper.innerHTML = `
    <div class="meal-record-group-head">
      <div class="meal-record-group-title"><strong>${esc(MEAL_LABELS[meal])}</strong><span>${entries.length}件</span></div>
      <div class="meal-record-group-kcal"><strong>${Math.round(total.kcal)}</strong><small>kcal</small></div>
    </div>
    <div class="meal-record-group-macros">P ${round1(total.p)}g ・ F ${round1(total.f)}g ・ C ${round1(total.c)}g</div>
    <div class="meal-record-group-items"></div>`;
  const items = wrapper.querySelector('.meal-record-group-items');
  for (const entry of entries) {
    cleanCardMealPrefix(entry.card);
    items.appendChild(entry.card);
  }
  return wrapper;
}

function groupTodayRecords() {
  const section = document.querySelector('#view-home #today-records');
  if (!section || section.dataset.mealGrouped === '1') return;

  const cards = [...section.querySelectorAll(':scope > .record-card')];
  if (!cards.length) return;

  section.dataset.mealGrouped = '1';
  const records = readTodayRecords();
  const byId = new Map(records.map(record => [String(record?.id ?? ''), record]));
  const groups = new Map(MEAL_ORDER.map(meal => [meal, []]));

  for (const card of cards) {
    const id = String(card.dataset.id || '');
    const record = byId.get(id) || null;
    const subtitle = card.querySelector('.record-main span')?.textContent || '';
    const meal = mealKeyForRecord(record, subtitle);
    groups.get(meal).push({ card, record });
  }

  const fragment = document.createDocumentFragment();
  for (const meal of MEAL_ORDER) {
    const entries = groups.get(meal);
    if (entries?.length) fragment.appendChild(buildGroup(meal, entries));
  }
  section.appendChild(fragment);
}

let patchQueued = false;
function queuePatch() {
  if (patchQueued || typeof document === 'undefined') return;
  patchQueued = true;
  requestAnimationFrame(() => {
    patchQueued = false;
    loadCss();
    patchVersion();
    patchTalkButton();
    groupTodayRecords();
  });
}

if (typeof document !== 'undefined') {
  const start = () => {
    loadCss();
    queuePatch();
    const observer = new MutationObserver(queuePatch);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
