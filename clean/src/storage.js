export const STORAGE_KEYS = Object.freeze({
  today: 'tf_dat',
  targets: 'tf_tg',
  favorites: 'tf_fav',
  favoriteSettings: 'tf_fav_settings',
  myFoods: 'tf_my',
  history: 'tf_hist',
  body: 'tf_body',
  legacyDate: 'tf_last_date',
  cleanDay: 'tf_clean_day_v1',
  voiceMode: 'tf_clean_voice_mode_v1',
  ui: 'tf_clean_ui_v1'
});

const DEFAULT_TARGETS = Object.freeze({
  cal: 2000,
  p: 150,
  f: 44,
  c: 250,
  a: 0,
  mode: 'std',
  alcMode: false,
  autoReset: true,
  label: '標準'
});

function safeJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function autoMeal(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return '朝';
  if (h >= 11 && h < 17) return '昼';
  if (h >= 17 && h < 23) return '晩';
  return '間食';
}

export function normalizeRecord(x, i = 0) {
  if (!x || typeof x !== 'object') return null;
  return {
    ...x,
    id: num(x.id, Date.now() + i),
    N: String(x.N ?? x.n ?? '不明な食品'),
    P: Math.max(0, num(x.P ?? x.p)),
    F: Math.max(0, num(x.F ?? x.f)),
    C: Math.max(0, num(x.C ?? x.c)),
    A: Math.max(0, num(x.A ?? x.a)),
    Cal: Math.max(0, Math.round(num(x.Cal ?? x.cal))),
    U: String(x.U ?? x.u ?? '-'),
    time: ['朝','昼','晩','間食'].includes(x.time) ? x.time : autoMeal()
  };
}

export function normalizeHistoryRow(h, i = 0) {
  if (!h || typeof h !== 'object') return null;
  const list = Array.isArray(h.l) ? h.l.map((x, j) => normalizeRecord(x, j)).filter(Boolean) : [];
  const summary = list.reduce((s, x) => ({
    Cal: s.Cal + x.Cal, P: s.P + x.P, F: s.F + x.F, C: s.C + x.C, A: s.A + x.A
  }), { Cal: 0, P: 0, F: 0, C: 0, A: 0 });
  return {
    d: String(h.d || h.date || `過去${i + 1}`),
    s: h.s && typeof h.s === 'object' ? {
      Cal: Math.round(num(h.s.Cal ?? h.s.cal, summary.Cal)),
      P: num(h.s.P ?? h.s.p, summary.P),
      F: num(h.s.F ?? h.s.f, summary.F),
      C: num(h.s.C ?? h.s.c, summary.C),
      A: num(h.s.A ?? h.s.a, summary.A)
    } : summary,
    l: list
  };
}

export function readState() {
  const targetsRaw = safeJson(localStorage.getItem(STORAGE_KEYS.targets), {});
  const targets = { ...DEFAULT_TARGETS, ...(targetsRaw && typeof targetsRaw === 'object' ? targetsRaw : {}) };
  targets.cal = Math.max(1, num(targets.cal, DEFAULT_TARGETS.cal));
  targets.p = Math.max(0, num(targets.p, DEFAULT_TARGETS.p));
  targets.f = Math.max(0, num(targets.f, DEFAULT_TARGETS.f));
  targets.c = Math.max(0, num(targets.c, DEFAULT_TARGETS.c));

  const records = safeJson(localStorage.getItem(STORAGE_KEYS.today), []);
  const history = safeJson(localStorage.getItem(STORAGE_KEYS.history), []);
  const body = safeJson(localStorage.getItem(STORAGE_KEYS.body), []);
  const myFoods = safeJson(localStorage.getItem(STORAGE_KEYS.myFoods), []);

  return {
    records: Array.isArray(records) ? records.map(normalizeRecord).filter(Boolean) : [],
    history: Array.isArray(history) ? history.map(normalizeHistoryRow).filter(Boolean) : [],
    body: Array.isArray(body) ? body.filter(x => x && typeof x === 'object') : [],
    myFoods: Array.isArray(myFoods) ? myFoods : [],
    targets,
    voiceMode: localStorage.getItem(STORAGE_KEYS.voiceMode) || 'voice',
    ui: safeJson(localStorage.getItem(STORAGE_KEYS.ui), {}) || {}
  };
}

export function writeRecords(records) {
  localStorage.setItem(STORAGE_KEYS.today, JSON.stringify(records));
}

export function writeHistory(history) {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

export function writeTargets(targets) {
  localStorage.setItem(STORAGE_KEYS.targets, JSON.stringify(targets));
}

export function writeBody(body) {
  localStorage.setItem(STORAGE_KEYS.body, JSON.stringify(body));
}

export function writeVoiceMode(mode) {
  localStorage.setItem(STORAGE_KEYS.voiceMode, mode);
}

export function writeUi(ui) {
  localStorage.setItem(STORAGE_KEYS.ui, JSON.stringify(ui || {}));
}

export function archiveIfDayChanged(state) {
  const today = localDay();
  const last = localStorage.getItem(STORAGE_KEYS.cleanDay);
  if (!last) {
    localStorage.setItem(STORAGE_KEYS.cleanDay, today);
    return false;
  }
  if (last === today) return false;
  if (state.targets.autoReset !== false && state.records.length) {
    const totals = state.records.reduce((s, x) => ({
      Cal: s.Cal + x.Cal, P: s.P + x.P, F: s.F + x.F, C: s.C + x.C, A: s.A + x.A
    }), { Cal: 0, P: 0, F: 0, C: 0, A: 0 });
    state.history = state.history.filter(h => h.d !== last);
    state.history.unshift({ d: last, s: totals, l: structuredClone(state.records) });
    state.records = [];
    writeHistory(state.history);
    writeRecords(state.records);
  }
  localStorage.setItem(STORAGE_KEYS.cleanDay, today);
  return true;
}

export function exportBackup() {
  const payload = {
    schema: 'pfc-clean-backup-v1',
    exportedAt: new Date().toISOString(),
    dat: localStorage.getItem(STORAGE_KEYS.today),
    tg: localStorage.getItem(STORAGE_KEYS.targets),
    fav: localStorage.getItem(STORAGE_KEYS.favorites),
    favSettings: localStorage.getItem(STORAGE_KEYS.favoriteSettings),
    my: localStorage.getItem(STORAGE_KEYS.myFoods),
    hist: localStorage.getItem(STORAGE_KEYS.history),
    body: localStorage.getItem(STORAGE_KEYS.body)
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupText(text) {
  const data = safeJson(text, null);
  if (!data || typeof data !== 'object') throw new Error('バックアップ形式を確認できません');
  const map = [
    ['dat', STORAGE_KEYS.today], ['tg', STORAGE_KEYS.targets], ['fav', STORAGE_KEYS.favorites],
    ['favSettings', STORAGE_KEYS.favoriteSettings], ['my', STORAGE_KEYS.myFoods],
    ['hist', STORAGE_KEYS.history], ['body', STORAGE_KEYS.body]
  ];
  let count = 0;
  for (const [source, key] of map) {
    if (data[source] == null) continue;
    const value = typeof data[source] === 'string' ? data[source] : JSON.stringify(data[source]);
    localStorage.setItem(key, value);
    count += 1;
  }
  localStorage.setItem(STORAGE_KEYS.cleanDay, localDay());
  return count;
}
