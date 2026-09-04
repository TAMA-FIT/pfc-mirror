
/* ===== pfc-v21.js ===== */
// PFC Mirror V2.1: smarter manual search + curated DB enrichment
(() => {
  'use strict';

  const VERSION = '2.1.0';
  const GENERIC_TOKENS = new Set([
    'こめ','ごはん','らいす','ぱん','めん','にく','とりにく','ぎゅうにく','ぶたにく',
    'さかな','やさい','さらだ','すーぷ','くだもの','ふるーつ','たまご','まめ','だいず',
    'こんびに','おかし','のみもの','さけ','おさけ','あぶら'
  ]);

  const DB_EXTENSIONS = [
    ['🥚卵・乳・大豆','卵白','らんぱく たまごのしろみ 卵の白身 エッグホワイト','1個',3.6,0,0.2,17],
    ['🥚卵・乳・大豆','木綿豆腐','もめんどうふ とうふ 豆腐 木綿','100g',7.0,4.9,1.5,73],
    ['🥚卵・乳・大豆','絹ごし豆腐','きぬごしどうふ きぬとうふ とうふ 豆腐 絹','100g',5.3,3.5,2.0,56],
    ['🥚卵・乳・大豆','無脂肪ヨーグルト','むしぼうよーぐると 脂肪ゼロ ヨーグルト 0脂肪','100g',4.0,0.3,5.7,43],
    ['🥚卵・乳・大豆','カッテージチーズ','かってーじちーず チーズ 高たんぱく','100g',13.3,4.5,1.9,99],
    ['🥚卵・乳・大豆','低脂肪牛乳','ていしぼうぎゅうにゅう ローファットミルク 牛乳 ミルク','200ml',7.6,2.0,11.0,92],
    ['🥚卵・乳・大豆','無調整豆乳','むちょうせいとうにゅう 豆乳 ソイミルク','200ml',7.2,4.0,6.2,92],
    ['🍚炭水化物','鮭おにぎり','さけおにぎり 鮭 おにぎり おむすび','1個',5.0,2.0,39.0,195],
    ['🍚炭水化物','梅おにぎり','うめおにぎり 梅 おにぎり おむすび','1個',4.0,0.5,39.0,180],
    ['🍚炭水化物','ツナマヨおにぎり','つなまよおにぎり ツナマヨ おにぎり おむすび','1個',5.0,7.0,40.0,245],
    ['🍖肉類','唐揚げ','からあげ から揚げ 鶏唐揚げ 鶏の唐揚げ チキン','100g',25.0,18.0,8.0,300],
    ['🍖肉類','とんかつ','豚カツ トンカツ ぶたかつ カツ','1枚',25.0,25.0,20.0,410],
    ['🍽️料理','親子丼','おやこどん 親子どんぶり 鶏卵丼','1杯',25.0,12.0,95.0,600],
    ['🍽️料理','牛丼','ぎゅうどん 牛どんぶり','1杯',22.0,20.0,90.0,640],
    ['🍽️料理','カレーライス','かれーらいす カレー ご飯カレー','1皿',15.0,18.0,105.0,650],
    ['🍽️料理','チャーハン','ちゃーはん 炒飯 焼き飯','1皿',15.0,20.0,90.0,600],
    ['🍽️料理','醤油ラーメン','しょうゆらーめん ラーメン 中華そば','1杯',20.0,15.0,80.0,550],
    ['🍽️料理','たこ焼き','たこやき タコ焼き','8個',12.0,15.0,45.0,360],
    ['🍽️料理','お好み焼き','おこのみやき お好み焼','1枚',20.0,25.0,70.0,600],
    ['🧈油脂類','はちみつ','蜂蜜 ハチミツ ハニー','20g',0,0,16.4,66],
    ['🧈油脂類','マヨネーズ','まよねーず マヨ','15g',0.2,11.3,0.7,100],
    ['🧈油脂類','オリーブオイル','おりーぶおいる オリーブ油 油','10g',0,10.0,0,90]
  ];

  const ALIAS_ENRICHMENTS = {
    '白米': ['しろめし','白ごはん','白ご飯','米飯','炊いた米'],
    '玄米': ['げんまいごはん','玄米ごはん','玄米ご飯'],
    '鶏むね(皮なし)': ['鶏胸','鶏胸肉','鳥胸','鳥胸肉','とりむね','チキンブレスト','皮なし鶏むね'],
    '鶏むね(皮あり)': ['皮あり鶏むね','皮付き鶏むね','鶏胸皮あり','鶏胸肉皮あり'],
    '鶏ささみ': ['鶏ササミ','ささ身','ササミ'],
    'ギリシャ': ['ギリシャヨーグルト','ギリシャヨーグルト無糖','高たんぱくヨーグルト'],
    'オイコス': ['oikos','OIKOS','高たんぱくヨーグルト'],
    '納豆': ['なっとう','納豆1パック','納豆パック'],
    'ブロッコリー': ['ぶろっこり','冷凍ブロッコリー'],
    'バナナ': ['ばなな一本','バナナ一本'],
    'インスタント味噌汁': ['即席味噌汁','即席みそ汁','インスタントみそ汁']
  };

  const preferredGeneric = {
    'こめ': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    'ごはん': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    'ぱん': ['食パン(6枚切)','食パン(8枚切)','ロールパン','ベーグル'],
    'めん': ['うどん(1玉)','そば(1玉)','中華麺','パスタ(ゆで)'],
    'たまご': ['卵','ゆで卵','卵白','だし巻き卵']
  };

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(value) {
    return normalize(value).replace(/[()（）\[\]【】\-_/\s]/g, '');
  }

  function baseName(value) {
    return normalize(value).replace(/[（(].*?[)）]/g, '').trim();
  }

  function enrichDatabase() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return;
    const existing = new Set(DB.map(item => String(item?.[1] || '')));
    for (const row of DB_EXTENSIONS) {
      if (!existing.has(row[1])) {
        DB.push(row.slice());
        existing.add(row[1]);
      }
    }
    for (const item of DB) {
      const name = String(item?.[1] || '');
      const extra = ALIAS_ENRICHMENTS[name];
      if (!extra?.length) continue;
      const tokens = new Set(String(item[2] || '').split(/\s+/).filter(Boolean));
      extra.forEach(token => tokens.add(token));
      item[2] = Array.from(tokens).join(' ');
    }
  }

  let dbIndex = [];
  function rebuildDbIndex() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) {
      dbIndex = [];
      return;
    }
    dbIndex = DB.map((item, index) => {
      const name = String(item?.[1] || '');
      const aliases = String(item?.[2] || '').split(/\s+/).filter(Boolean);
      return {
        source: 'db', index, item, name,
        nName: normalize(name),
        cName: compact(name),
        base: baseName(name),
        aliases: aliases.map(alias => ({ raw: alias, n: normalize(alias), c: compact(alias) }))
      };
    });
  }

  function genericPreferenceBonus(query, name) {
    const order = preferredGeneric[query];
    if (!order) return 0;
    const index = order.indexOf(name);
    return index < 0 ? 0 : Math.max(20, 140 - index * 20);
  }

  function scoreDbEntry(entry, rawQuery) {
    const query = normalize(rawQuery);
    const qCompact = compact(query);
    if (!qCompact) return 0;
    const qBase = baseName(query);
    const isGeneric = GENERIC_TOKENS.has(qCompact) || GENERIC_TOKENS.has(query);
    let score = 0;

    if (entry.nName === query || entry.cName === qCompact) score = 2400;
    else if (entry.base === qBase && qBase.length >= 2) score = 2200;
    else if (entry.nName.startsWith(query) || entry.cName.startsWith(qCompact)) score = 1600;
    else if (qCompact.length >= 2 && (entry.nName.includes(query) || entry.cName.includes(qCompact))) score = 1100;

    for (const alias of entry.aliases) {
      const aliasIsGeneric = GENERIC_TOKENS.has(alias.c) || GENERIC_TOKENS.has(alias.n);
      if (alias.n === query || alias.c === qCompact) {
        score = Math.max(score, aliasIsGeneric || isGeneric ? 420 : 1450);
      } else if (!aliasIsGeneric && qCompact.length >= 2 && (alias.n.startsWith(query) || alias.c.startsWith(qCompact))) {
        score = Math.max(score, 1000);
      } else if (!aliasIsGeneric && qCompact.length >= 2 && (alias.n.includes(query) || alias.c.includes(qCompact))) {
        score = Math.max(score, 650);
      }
    }

    if (isGeneric && score > 0) score += genericPreferenceBonus(qCompact, entry.name);
    return score;
  }

  function buildMyFoodMatches(rawQuery) {
    if (typeof myFoods === 'undefined' || !Array.isArray(myFoods)) return [];
    const query = normalize(rawQuery);
    const qCompact = compact(query);
    if (!qCompact) return [];
    return myFoods.map((item, index) => {
      const name = String(item?.N || item?.name || '');
      const nName = normalize(name);
      const cName = compact(name);
      let score = 0;
      if (nName === query || cName === qCompact) score = 2700;
      else if (nName.startsWith(query) || cName.startsWith(qCompact)) score = 1800;
      else if (qCompact.length >= 2 && (nName.includes(query) || cName.includes(qCompact))) score = 1250;
      if (score && item?.Fav) score += 80;
      if (score) score += Math.min(60, Number(item?.useCount || 0) * 3);
      return score ? { source: 'my', index, item, name, score } : null;
    }).filter(Boolean);
  }

  function searchFoods(rawQuery, limit = 12) {
    const dbMatches = dbIndex
      .map(entry => ({ ...entry, score: scoreDbEntry(entry, rawQuery) }))
      .filter(entry => entry.score > 0);
    const combined = [...buildMyFoodMatches(rawQuery), ...dbMatches]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ja'));

    const seen = new Set();
    const results = [];
    for (const result of combined) {
      const key = `${result.source}:${normalize(result.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
      if (results.length >= limit) break;
    }
    return results;
  }

  function resultMeta(result) {
    if (result.source === 'my') {
      const x = result.item || {};
      return `My食品 · ${Math.round(Number(x.Cal || 0))} kcal`;
    }
    const x = result.item || [];
    const category = String(x[0] || '').replace(/^\S+/, match => match).trim();
    const unit = x[3] || '1人前';
    const kcal = Math.round(Number(x[7] || 0));
    return `${category} · ${unit} · ${kcal} kcal`;
  }

  function clearSearch() {
    const input = document.getElementById('s-inp');
    const result = document.getElementById('s-res');
    if (input) input.value = '';
    if (result) {
      result.innerHTML = '';
      result.style.display = 'none';
    }
    const clear = document.querySelector('.pfc-search-clear');
    if (clear) clear.classList.remove('show');
  }

  function smartFilterF() {
    const input = document.getElementById('s-inp');
    const resultBox = document.getElementById('s-res');
    if (!input || !resultBox) return;
    const rawQuery = input.value.trim();
    resultBox.innerHTML = '';
    const clear = document.querySelector('.pfc-search-clear');
    if (clear) clear.classList.toggle('show', !!rawQuery);

    if (!rawQuery) {
      resultBox.style.display = 'none';
      return;
    }

    const results = searchFoods(rawQuery, 12);
    resultBox.style.display = 'block';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 's-item pfc-search-empty';
      empty.innerHTML = `<strong>「${escapeHtml(rawQuery)}」は見つかりませんでした</strong><small>別の名前で検索するか、My食品に登録できます</small>`;
      resultBox.appendChild(empty);
      return;
    }

    results.forEach((result, order) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 's-item pfc-search-result';
      row.dataset.searchOrder = String(order);
      row.innerHTML = `<span class="pfc-search-main"><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(resultMeta(result))}</small></span><span class="pfc-search-arrow">›</span>`;
      row.onclick = () => {
        if (result.source === 'my' && typeof selMyFd === 'function') selMyFd(result.index);
        else if (result.source === 'db' && typeof selFd === 'function') selFd(result.index);
        clearSearch();
      };
      resultBox.appendChild(row);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function enhanceManualSearchUi() {
    const input = document.getElementById('s-inp');
    const box = input?.closest('.s-box');
    if (!input || !box || box.dataset.pfcV21 === '1') return;
    box.dataset.pfcV21 = '1';
    input.placeholder = '食品名・別名で検索';
    input.autocomplete = 'off';
    input.setAttribute('enterkeyhint', 'search');

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'pfc-search-clear';
    clear.setAttribute('aria-label', '検索をクリア');
    clear.textContent = '×';
    clear.onclick = clearSearch;
    box.appendChild(clear);

    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        clearSearch();
        input.blur();
        return;
      }
      if (event.key === 'Enter' && !event.isComposing) {
        const first = document.querySelector('#s-res .pfc-search-result');
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    });
  }

  function install() {
    enrichDatabase();
    rebuildDbIndex();
    window.filterF = smartFilterF;
    window.__PFC_SEARCH_V21__ = {
      version: VERSION,
      addedDbRows: DB_EXTENSIONS.filter(row => typeof DB !== 'undefined' && DB.some(item => item?.[1] === row[1])).length,
      search: searchFoods,
      rebuild: rebuildDbIndex
    };
    enhanceManualSearchUi();
    document.documentElement.classList.add('pfc-v21');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-v21-search-fix.js ===== */
// PFC Mirror V2.1 search refinement for broad Japanese terms.
(() => {
  'use strict';

  const PREFERRED = {
    '米': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    'こめ': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    'ご飯': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    'ごはん': ['白米','玄米','雑穀米','麦ご飯','パックご飯'],
    '肉': ['鶏むね(皮なし)','鶏ささみ','鶏もも(皮なし)','鶏むね(皮あり)','豚ヒレ','牛モモ(赤身)','豚ロース(脂身無)','牛ヒレ(赤身)'],
    '鶏肉': ['鶏むね(皮なし)','鶏ささみ','鶏もも(皮なし)','鶏むね(皮あり)','鶏もも(皮あり)','鶏ひき肉'],
    '魚': ['鮭(焼き)','サバ缶(水煮)','サバ缶(味噌煮)'],
    '麺': ['うどん(1玉)','そば(1玉)','中華麺','パスタ(ゆで)','パスタ(乾麺)'],
    'めん': ['うどん(1玉)','そば(1玉)','中華麺','パスタ(ゆで)','パスタ(乾麺)'],
    'パン': ['食パン(6枚切)','食パン(8枚切)','ロールパン','ベーグル','フランスパン'],
    'ぱん': ['食パン(6枚切)','食パン(8枚切)','ロールパン','ベーグル','フランスパン']
  };

  function keyOf(value) {
    return String(value || '').normalize('NFKC').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function meta(result) {
    if (result.source === 'my') {
      const item = result.item || {};
      return `My食品 · ${Math.round(Number(item.Cal || 0))} kcal`;
    }
    const item = result.item || [];
    return `${item[0] || ''} · ${item[3] || '1人前'} · ${Math.round(Number(item[7] || 0))} kcal`;
  }

  function renderPreferred(rawQuery, preference) {
    const api = window.__PFC_SEARCH_V21__;
    const input = document.getElementById('s-inp');
    const box = document.getElementById('s-res');
    if (!api?.search || !input || !box) return false;

    const results = api.search(rawQuery, 30);
    if (!results.length) return false;
    const order = new Map(preference.map((name, index) => [name, index]));
    results.sort((a, b) => {
      const ai = order.has(a.name) ? order.get(a.name) : 999;
      const bi = order.has(b.name) ? order.get(b.name) : 999;
      if (ai !== bi) return ai - bi;
      return (b.score || 0) - (a.score || 0);
    });

    box.innerHTML = '';
    box.style.display = 'block';
    results.slice(0, 12).forEach((result, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 's-item pfc-search-result';
      row.dataset.searchOrder = String(index);
      row.innerHTML = `<span class="pfc-search-main"><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(meta(result))}</small></span><span class="pfc-search-arrow">›</span>`;
      row.onclick = () => {
        if (result.source === 'my' && typeof selMyFd === 'function') selMyFd(result.index);
        else if (result.source === 'db' && typeof selFd === 'function') selFd(result.index);
        input.value = '';
        box.innerHTML = '';
        box.style.display = 'none';
        document.querySelector('.pfc-search-clear')?.classList.remove('show');
      };
      box.appendChild(row);
    });
    document.querySelector('.pfc-search-clear')?.classList.add('show');
    return true;
  }

  function install() {
    const original = window.filterF;
    if (typeof original === 'function' && !original.__pfcBroadSearchWrapped) {
      const wrapped = function () {
        const raw = document.getElementById('s-inp')?.value?.trim() || '';
        const preference = PREFERRED[keyOf(raw)];
        if (preference && renderPreferred(raw, preference)) return;
        return original.apply(this, arguments);
      };
      wrapped.__pfcBroadSearchWrapped = true;
      window.filterF = wrapped;
    }
    if (typeof mkCat === 'function') mkCat();
    window.__PFC_SEARCH_V21_BROAD__ = { version: '2.1.1', preferredTerms: Object.keys(PREFERRED) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-dummy-v22.js ===== */
// PFC Mirror V2.2: realistic manager dummy-data simulator
(() => {
  'use strict';

  const VERSION = '2.2.0';

  function hashSeed(text) {
    let h = 2166136261;
    for (const ch of String(text)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
  }

  function chance(rng, probability) {
    return rng() < probability;
  }

  function roundTo(value, step) {
    return Math.max(step, Math.round(value / step) * step);
  }

  function localDateLabel(date) {
    return date.toLocaleDateString();
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getDbRow(name) {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return null;
    return DB.find(row => row?.[1] === name) || null;
  }

  function unitInfo(row) {
    const raw = String(row?.[3] || '1個');
    if (/g/i.test(raw)) return { base: Number(raw.match(/[0-9.]+/)?.[0] || 100), unit: 'g', gram: true };
    const base = Number(raw.match(/[0-9.]+/)?.[0] || 1);
    const unit = raw.replace(/[0-9.\s]/g, '') || '個';
    return { base, unit, gram: false };
  }

  function makeFoodRecord(name, amount, time, id) {
    const row = getDbRow(name);
    if (!row) return null;
    const info = unitInfo(row);
    const multiplier = Number(amount) / info.base;
    const p = Number(row[4] || 0) * multiplier;
    const f = Number(row[5] || 0) * multiplier;
    const c = Number(row[6] || 0) * multiplier;
    const a = Number.isFinite(Number(row[8])) ? Number(row[8]) * multiplier : 0;
    const cal = Math.round(Number(row[7] || 0) * multiplier);
    const amountText = Number.isInteger(Number(amount)) ? String(Number(amount)) : Number(amount).toFixed(1);
    return {
      id,
      N: `${name}(${amountText}${info.unit})`,
      P: Number(p.toFixed(1)),
      F: Number(f.toFixed(1)),
      C: Number(c.toFixed(1)),
      A: Number(a.toFixed(1)),
      Cal: cal,
      U: row[3],
      time,
      isDummy: true,
      dummyVersion: VERSION
    };
  }

  function addFoods(target, definitions, baseId) {
    definitions.forEach((definition, index) => {
      const [name, amount, time] = definition;
      const record = makeFoodRecord(name, amount, time, baseId + index);
      if (record) target.push(record);
    });
  }

  const breakfasts = [
    [['白米', 150, '朝'], ['納豆', 1, '朝'], ['卵', 1, '朝'], ['インスタント味噌汁', 1, '朝']],
    [['オートミール', 45, '朝'], ['ヨーグルト', 150, '朝'], ['バナナ', 1, '朝']],
    [['食パン(6枚切)', 2, '朝'], ['卵', 2, '朝'], ['ヨーグルト', 100, '朝']],
    [['白米', 120, '朝'], ['鮭(焼き)', 1, '朝'], ['インスタント味噌汁', 1, '朝']],
    [['白米', 180, '朝'], ['納豆', 1, '朝'], ['卵白', 2, '朝'], ['卵', 1, '朝']]
  ];

  const weekdayLunches = [
    [['白米', 200, '昼'], ['鶏むね(皮なし)', 180, '昼'], ['ブロッコリー', 100, '昼']],
    [['白米', 180, '昼'], ['サラダチキン', 1, '昼'], ['ゆで卵', 1, '昼'], ['グリーンサラダ', 1, '昼']],
    [['うどん(1玉)', 2, '昼'], ['卵', 1, '昼']],
    [['そば(1玉)', 1, '昼'], ['サラダチキンバー', 1, '昼'], ['ゆで卵', 1, '昼']],
    [['鮭おにぎり', 2, '昼'], ['サラダチキン', 1, '昼']]
  ];

  const dinners = [
    [['白米', 180, '晩'], ['鶏もも(皮なし)', 180, '晩'], ['キャベツ', 100, '晩'], ['インスタント味噌汁', 1, '晩']],
    [['白米', 180, '晩'], ['鮭(焼き)', 2, '晩'], ['木綿豆腐', 150, '晩'], ['ほうれん草', 100, '晩']],
    [['白米', 200, '晩'], ['豚ロース(脂身無)', 180, '晩'], ['キャベツ', 120, '晩']],
    [['白米', 160, '晩'], ['鶏むね(皮なし)', 200, '晩'], ['ブロッコリー', 120, '晩'], ['インスタント味噌汁', 1, '晩']],
    [['白米', 200, '晩'], ['牛モモ(赤身)', 150, '晩'], ['グリーンサラダ', 1, '晩']]
  ];

  const restaurantMeals = [
    [['親子丼', 1, '昼']],
    [['牛丼', 1, '昼']],
    [['カレーライス', 1, '昼']],
    [['醤油ラーメン', 1, '昼'], ['ゆで卵', 1, '昼']],
    [['とんかつ', 1, '晩'], ['白米', 200, '晩']],
    [['唐揚げ', 180, '晩'], ['白米', 200, '晩']]
  ];

  const snacks = [
    [['オイコス', 1, '間食']],
    [['バナナ', 1, '間食']],
    [['プロテインバー(一本)', 1, '間食']],
    [['ナッツ(小掴み)', 20, '間食']],
    [['ヨーグルト', 150, '間食'], ['はちみつ', 15, '間食']]
  ];

  function buildRealisticFoodDay(date, dayOffset, rng) {
    const records = [];
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    const baseId = Date.now() - dayOffset * 100000;

    // A few days are intentionally absent to mimic real-world missed logging.
    if (chance(rng, weekend ? 0.055 : 0.025)) return records;

    const breakfastChance = weekend ? 0.78 : 0.92;
    if (chance(rng, breakfastChance)) addFoods(records, pick(rng, breakfasts), baseId + 100);

    if (weekend && chance(rng, 0.58)) addFoods(records, pick(rng, restaurantMeals), baseId + 200);
    else if (chance(rng, 0.97)) addFoods(records, pick(rng, weekdayLunches), baseId + 200);

    if (chance(rng, weekend ? 0.92 : 0.97)) {
      if (weekend && chance(rng, 0.28)) addFoods(records, pick(rng, restaurantMeals), baseId + 300);
      else addFoods(records, pick(rng, dinners), baseId + 300);
    }

    if (chance(rng, weekend ? 0.55 : 0.38)) addFoods(records, pick(rng, snacks), baseId + 400);

    // Higher-carb / social day every 9-14 days, represented by plausible foods rather than a synthetic PFC block.
    if (dayOffset % (9 + Math.floor(rng() * 6)) === 0 && chance(rng, 0.7)) {
      addFoods(records, [['白米', roundTo(100 + rng() * 100, 25), '晩']], baseId + 500);
    }

    // Alcohol only when alcohol tracking is enabled, with weekend bias.
    if (typeof TG !== 'undefined' && TG?.alcMode && chance(rng, weekend ? 0.38 : 0.10)) {
      const beer = getDbRow('ビール(5%)') ? 'ビール(5%)' : (getDbRow('ビール') ? 'ビール' : null);
      if (beer) addFoods(records, [[beer, weekend ? 2 : 1, '晩']], baseId + 600);
    }

    // Roughly 7% of days look like incomplete logging: one meal disappears.
    if (records.length >= 5 && chance(rng, 0.07)) {
      const mealToDrop = pick(rng, ['朝', '昼', '晩']);
      const filtered = records.filter(record => record.time !== mealToDrop);
      return filtered.length ? filtered : records;
    }

    return records;
  }

  window.mgrGenerateFoodDummy = function mgrGenerateFoodDummyRealistic(months) {
    const nMonths = Math.min(12, Math.max(1, Number(months) || 1));
    if (!confirm(`過去${nMonths}ヶ月分の現実寄り食事シミュレーションを生成しますか？\n\n実際の記録は残し、同期間の旧ダミーだけ置き換えます。`)) return;
    if (typeof hist === 'undefined' || typeof svHist !== 'function') return;

    const today = new Date();
    const days = nMonths * 30;
    let generatedDays = 0;
    let generatedFoods = 0;

    for (let i = 1; i <= days; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const label = localDateLabel(date);
      const rng = mulberry32(hashSeed(`${VERSION}:food:${isoDate(date)}:${nMonths}`));
      const existing = hist.find(h => h.d === label);
      const realRecords = Array.isArray(existing?.l) ? existing.l.filter(item => !item?.isDummy) : [];
      const simulated = buildRealisticFoodDay(date, i, rng);
      const combined = realRecords.concat(simulated);

      if (combined.length) {
        svHist(label, combined);
        if (simulated.length) generatedDays += 1;
        generatedFoods += simulated.length;
      } else if (existing && Array.isArray(existing.l) && existing.l.some(item => item?.isDummy)) {
        hist = hist.filter(h => h.d !== label);
      }
    }

    localStorage.setItem('tf_hist', JSON.stringify(hist));
    if (typeof showToast === 'function') showToast(`${generatedDays}日・${generatedFoods}件の現実寄り食事データを生成しました`);
    if (typeof rHist === 'function') rHist();
    const active = document.querySelector('.g-btn.act');
    if (active && typeof drawGraph === 'function') drawGraph(active.textContent === '週間' ? 'week' : 'month', active);
  };

  function latestRealBodyRecord() {
    if (typeof bodyData === 'undefined' || !Array.isArray(bodyData)) return null;
    return bodyData
      .filter(item => !item?.isDummy && Number(item?.w) > 0)
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .pop() || null;
  }

  window.mgrGenerateBodyDummy = function mgrGenerateBodyDummyRealistic(months) {
    const nMonths = Math.min(12, Math.max(1, Number(months) || 1));
    if (!confirm(`過去${nMonths}ヶ月分の現実寄り体組成シミュレーションを生成しますか？\n\n実際の測定値は上書きしません。`)) return;
    if (typeof bodyData === 'undefined' || !Array.isArray(bodyData)) return;

    const today = new Date();
    const days = nMonths * 30;
    const real = latestRealBodyRecord();
    const endWeight = Number(real?.w) > 0 ? Number(real.w) : 70.0;
    const endFat = Number(real?.f) > 0 ? Number(real.f) : 19.5;
    const endWaist = Number(real?.waist) > 0 ? Number(real.waist) : 82.0;
    const weeklyLoss = 0.32;
    const weeklyFatLoss = 0.12;
    const weeklyWaistLoss = 0.22;
    const weeks = days / 7;
    const startWeight = endWeight + weeklyLoss * weeks;
    const startFat = endFat + weeklyFatLoss * weeks;
    const startWaist = endWaist + weeklyWaistLoss * weeks;
    let previousNoise = 0;
    let count = 0;

    // Replace prior dummy points in range, but never touch real measurements.
    const firstDate = new Date(today);
    firstDate.setDate(today.getDate() - days);
    const firstIso = isoDate(firstDate);
    const todayIso = isoDate(today);
    bodyData = bodyData.filter(item => !item?.isDummy || String(item.date) < firstIso || String(item.date) >= todayIso);

    for (let i = days; i >= 1; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = isoDate(date);
      if (bodyData.some(item => item.date === dateKey && !item?.isDummy)) continue;

      const rng = mulberry32(hashSeed(`${VERSION}:body:${dateKey}:${nMonths}`));
      const dow = date.getDay();
      const weekend = dow === 0 || dow === 6;
      // Real users do not necessarily measure every day.
      if (!chance(rng, weekend ? 0.62 : 0.80)) continue;

      const progress = (days - i) / Math.max(1, days - 1);
      const trendWeight = startWeight + (endWeight - startWeight) * progress;
      const trendFat = startFat + (endFat - startFat) * progress;
      const trendWaist = startWaist + (endWaist - startWaist) * progress;

      // Autocorrelated water noise + weekend sodium/carb bump.
      const dailyShock = (rng() - 0.5) * 0.55;
      previousNoise = previousNoise * 0.55 + dailyShock;
      const weekendBump = (dow === 0 || dow === 1) && chance(rng, 0.45) ? 0.35 + rng() * 0.55 : 0;
      const weight = trendWeight + previousNoise + weekendBump;
      const fat = trendFat + (rng() - 0.5) * 0.55 + weekendBump * 0.12;
      const waist = trendWaist + (rng() - 0.5) * 0.7 + weekendBump * 0.18;

      bodyData.push({
        date: dateKey,
        w: Number(weight.toFixed(1)),
        f: Number(Math.max(4, fat).toFixed(1)),
        waist: Number(Math.max(50, waist).toFixed(1)),
        isDummy: true,
        dummyVersion: VERSION
      });
      count += 1;
    }

    bodyData.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    localStorage.setItem('tf_body', JSON.stringify(bodyData));
    if (typeof showToast === 'function') showToast(`${count}件の現実寄り体組成データを生成しました`);
    if (typeof renderBodyList === 'function') renderBodyList();
    const active = document.querySelector('.b-tog-btn.act');
    if (active && typeof drawBodyGraph === 'function') drawBodyGraph(active.textContent.includes('A') ? 'A' : 'B', active);
  };

  function polishManagerCopy() {
    const foodBtn = document.querySelector('button[onclick*="mgrGenerateFoodDummy"]');
    const bodyBtn = document.querySelector('button[onclick*="mgrGenerateBodyDummy"]');
    if (foodBtn) foodBtn.innerHTML = '🍱 現実寄りの食事履歴を生成';
    if (bodyBtn) bodyBtn.innerHTML = '📉 現実寄りの体組成履歴を生成';
    const section = foodBtn?.parentElement;
    if (section && !section.querySelector('.dummy-sim-note')) {
      const note = document.createElement('div');
      note.className = 'dummy-sim-note';
      note.style.cssText = 'font-size:11px;line-height:1.55;color:#667085;background:#eef8f3;border:1px solid #cdebdc;border-radius:9px;padding:9px 10px;margin:6px 0 2px;';
      note.textContent = '曜日・外食・間食・記録漏れ・日々の体重変動まで含むシミュレーションです。実データは残し、ダミーだけ再生成できます。';
      section.insertBefore(note, foodBtn);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', polishManagerCopy, { once: true });
  else polishManagerCopy();

  window.__PFC_DUMMY_V22__ = { version: VERSION, mode: 'realistic-simulation' };
})();

;

/* ===== pfc-model-selector-bridge-v23.js ===== */
// PFC Mirror V2.3 compatibility bridge: replace legacy fixed model preference helpers.
(() => {
  'use strict';

  const KEY = 'tf_ai_model_preference';
  const LEGACY = {
    'gemini31-lite': 'gemini-3.1-flash-lite',
    'gemini25-lite': 'gemini-2.5-flash-lite',
    'gemma4-26b': 'gemma-4-26b-a4b-it',
    'gemma4-31b': 'gemma-4-31b-it'
  };

  const normalize = value => {
    const raw = String(value || '').trim();
    return LEGACY[raw] || raw;
  };

  const valid = value => /^(gemini|gemma)-[a-z0-9._-]+$/i.test(String(value || ''));

  window.getAIModelPreference = function () {
    const model = normalize(localStorage.getItem(KEY));
    return valid(model) ? model : 'gemini-3.1-flash-lite';
  };

  window.setAIModelPreference = function (value) {
    const model = normalize(value);
    if (!valid(model)) return;
    localStorage.setItem(KEY, model);
    const select = document.getElementById('ai-model-select');
    if (select && select.value !== model) select.value = model;
    const option = select?.selectedOptions?.[0];
    const label = option?.textContent?.trim() || model;
    if (typeof showToast === 'function') showToast(`AIモデル: ${label}`);
  };

  window.__PFC_MODEL_SELECTOR_BRIDGE_V23__ = {
    version: '2.3.0',
    directModelIds: true
  };
})();

;

/* ===== pfc-model-selector-v23.js ===== */
// PFC Mirror V2.3: dynamic model selector backed by GAS models.list.
(() => {
  'use strict';

  const VERSION = '2.3.1';
  const RATE_LIMIT_URL = 'https://aistudio.google.com/rate-limit?timeRange=last-28-days';
  const MODEL_STORAGE_KEY = 'tf_ai_model_preference';
  const LEGACY_MODEL_IDS = {
    'gemini31-lite': 'gemini-3.1-flash-lite',
    'gemini25-lite': 'gemini-2.5-flash-lite',
    'gemma4-26b': 'gemma-4-26b-a4b-it',
    'gemma4-31b': 'gemma-4-31b-it'
  };

  function normalizeStoredModel(value) {
    const raw = String(value || '').trim();
    return LEGACY_MODEL_IDS[raw] || raw;
  }

  function currentStoredModel() {
    return normalizeStoredModel(localStorage.getItem(MODEL_STORAGE_KEY));
  }

  function formatTokens(value) {
    const n = Number(value || 0);
    if (!n) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  }

  function modelLabel(model) {
    const name = String(model.displayName || model.id || '').trim() || model.id;
    const flags = [];
    if (model.preview) flags.push('Preview');
    if (model.thinking) flags.push('Thinking');
    return flags.length ? `${name} · ${flags.join(' / ')}` : name;
  }

  function ensureModelPickerUi(select) {
    const row = select.closest('.alc-toggle') || select.parentElement;
    if (!row) return null;
    row.classList.add('model-picker-row-v23');

    let actions = row.querySelector('.model-picker-actions-v23');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'model-picker-actions-v23';
      select.parentNode.insertBefore(actions, select);
      actions.appendChild(select);
    }

    let meta = row.querySelector('.model-picker-meta-v23');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'model-picker-meta-v23';
      meta.textContent = 'Gemini APIから利用可能モデルを取得します';
      row.appendChild(meta);
    }

    return { row, actions, meta };
  }

  function ensureManagerRateLimitButton() {
    const modal = document.getElementById('manager-modal');
    const box = modal?.querySelector('.modal-box');
    if (!box || box.querySelector('.manager-ai-limit-v23')) return;

    const section = document.createElement('div');
    section.className = 'manager-ai-limit-v23';
    section.style.cssText = 'margin:14px 0 18px;padding:14px;border:1px solid #cfe7dd;border-radius:12px;background:#f4fbf8;';
    section.innerHTML = `
      <div class="manager-ai-limit-title-v23" style="font-size:13px;font-weight:900;color:#176c51;margin-bottom:5px;">AI API 管理</div>
      <div class="manager-ai-limit-note-v23" style="font-size:11px;line-height:1.5;color:#60756d;margin-bottom:10px;">Google AI Studioで、このプロジェクトのRPM / TPM / RPDを確認します。</div>
      <button type="button" class="manager-ai-limit-btn-v23" style="width:100%;border:0;border-radius:9px;padding:10px 12px;background:#22a06b;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">AI StudioのRate Limitを開く</button>
    `;
    const button = section.querySelector('.manager-ai-limit-btn-v23');
    button.onclick = () => window.open(RATE_LIMIT_URL, '_blank', 'noopener,noreferrer');

    const heading = box.querySelector('h3');
    if (heading?.nextSibling) box.insertBefore(section, heading.nextSibling);
    else box.prepend(section);
  }

  async function fetchAvailableModels() {
    if (typeof gasUrl !== 'string' || !gasUrl) throw new Error('GAS URL is unavailable');
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({ taskType: 'listModels' })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || payload.ok !== true || !Array.isArray(payload.models)) {
      throw new Error(payload?.message || 'モデル一覧の形式が不正です');
    }
    return payload.models;
  }

  function populateSelector(select, models, meta) {
    const saved = currentStoredModel();
    select.innerHTML = '';

    const ids = new Set(models.map(model => String(model.id || '')));
    if (saved && !ids.has(saved)) {
      const unavailable = document.createElement('option');
      unavailable.value = saved;
      unavailable.textContent = `現在一覧にないモデル: ${saved}`;
      unavailable.disabled = true;
      unavailable.selected = true;
      select.appendChild(unavailable);
    }

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = modelLabel(model);
      const input = formatTokens(model.inputTokenLimit);
      const output = formatTokens(model.outputTokenLimit);
      option.title = [model.id, input ? `入力 ${input}` : '', output ? `出力 ${output}` : ''].filter(Boolean).join(' / ');
      if (saved && model.id === saved) option.selected = true;
      select.appendChild(option);
    });

    if (!saved && models.length) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'モデルを選択してください';
      placeholder.selected = true;
      placeholder.disabled = true;
      select.insertBefore(placeholder, select.firstChild);
    }

    select.disabled = false;
    if (meta) {
      const unavailableText = saved && !ids.has(saved) ? '・以前の選択は現在利用不可' : '';
      meta.textContent = `利用可能 ${models.length}モデル（models.list）${unavailableText}`;
    }
  }

  function showLoadError(select, meta, error) {
    const saved = currentStoredModel();
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = saved || 'gemini-3.1-flash-lite';
    option.textContent = saved ? `保存済み: ${saved}` : '3.1 Flash Lite（フォールバック）';
    option.selected = true;
    select.appendChild(option);
    select.disabled = false;
    if (meta) meta.textContent = 'モデル一覧を取得できませんでした。再読み込みで再取得します。';
    console.warn('[PFC Model Selector V2.3]', error);
  }

  async function initDynamicModelSelector() {
    const select = document.getElementById('ai-model-select');
    if (!select) return;
    const ui = ensureModelPickerUi(select);
    ensureManagerRateLimitButton();

    select.disabled = true;
    select.innerHTML = '<option>利用可能モデルを取得中...</option>';
    if (ui?.meta) ui.meta.textContent = 'Gemini API models.list を確認中...';

    try {
      const models = await fetchAvailableModels();
      populateSelector(select, models, ui?.meta);
    } catch (error) {
      showLoadError(select, ui?.meta, error);
    }
  }

  document.addEventListener('DOMContentLoaded', initDynamicModelSelector);

  // 旧「上限を見る」ボタンは一般設定画面には表示せず、Manager Modeのみに配置する。
  window.__PFC_MODEL_SELECTOR_V23__ = {
    version: VERSION,
    source: 'models.list',
    selection: 'manual',
    rateLimitLocation: 'manager-mode',
    rateLimitUrl: RATE_LIMIT_URL,
    refresh: initDynamicModelSelector
  };
})();

;

/* ===== pfc-database-v3-verified.js ===== */
// PFC Mirror Database V3: source-verified high-frequency foods.
(() => {
  'use strict';

  const VERSION = '3.4.0';

  // Nutrition source values are MEXT Food Composition Database values.
  // Serving conversions are only applied when an official source gives a defensible relationship.
  const VERIFIED = [
    {
      name: 'こいくち醤油',
      row: ['🧈油脂類','こいくち醤油','しょうゆ 醤油 こいくち 濃口しょうゆ 濃口醤油','大さじ1',1.4,0.0,1.4,14,0.4],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース こいくちしょうゆ', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=17_17007_7', itemNo: '17007', per100g: { p: 7.7, f: 0.0, c: 7.9, kcal: 76, a: 2.1 } },
      serving: { kind: 'maff-recipe-weight', label: '農林水産省 上州きんぴら', url: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/32_10_gunma.html', measure: '大さじ1', grams: 18, exactForEntry: true }
    },
    {
      name: '上白糖',
      row: ['🧈油脂類','上白糖','じょうはくとう 砂糖 さとう 白砂糖 ソフトシュガー','大さじ1',0.0,0.0,8.9,35],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 上白糖', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=03_03003_6', itemNo: '03003', per100g: { p: 0.0, f: 0.0, c: 99.3, kcal: 391, a: 0.0 } },
      serving: { kind: 'maff-recipe-weight', label: '農林水産省 上州きんぴら', url: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/32_10_gunma.html', measure: '大さじ1', grams: 9, exactForEntry: true, derivation: '小さじ2=6g → 小さじ1=3g → 大さじ1=9g' }
    },
    {
      name: '米みそ(淡色辛みそ)',
      row: ['🧈油脂類','米みそ(淡色辛みそ)','みそ 味噌 米みそ 淡色みそ 淡色辛みそ','10g',1.3,0.6,2.2,18],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 米みそ 淡色辛みそ', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=17_17045_7', itemNo: '17045', per100g: { p: 12.5, f: 6.0, c: 21.9, kcal: 182, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '10g', grams: 10, exactForEntry: true, note: '大さじ換算は製品差を考慮して未適用。g入力を正本とする。' }
    },
    {
      name: '本みりん',
      row: ['🧈油脂類','本みりん','ほんみりん みりん 味醂 調味料','大さじ1',0.1,0.0,7.8,43,1.7],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 本みりん', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=16_16025_6', itemNo: '16025', per100g: { p: 0.3, f: 0.0, c: 43.2, kcal: 241, a: 9.5 } },
      serving: { kind: 'maff-recipe-weight', label: '農林水産省 上州きんぴら', url: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/32_10_gunma.html', measure: '大さじ1', grams: 18, exactForEntry: true, derivation: '小さじ1=6g → 大さじ1=18g' }
    },
    {
      name: '豚肩ロース(脂身つき)',
      row: ['🍖肉類','豚肩ロース(脂身つき)','ぶたかたろーす 豚肩ロース 肩ロース ポーク 豚肉','100g',17.1,19.2,0.1,237],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 豚 大型種肉 かたロース 脂身つき 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11119_7', itemNo: '11119', per100g: { p: 17.1, f: 19.2, c: 0.1, kcal: 237, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: '鶏手羽元(皮つき)',
      row: ['🍖肉類','鶏手羽元(皮つき)','とりてばもと 手羽元 てばもと 鶏肉 チキン','100g',18.2,12.8,0.0,175],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 若どり 手羽もと 皮つき 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11286_7', itemNo: '11286', per100g: { p: 18.2, f: 12.8, c: 0.0, kcal: 175, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '骨付きで個体差が大きいため「1本」の自動g換算は行わない。' }
    },
    {
      name: 'サバ(生)',
      row: ['🐟魚介類','サバ(生)','さば サバ 鯖 まさば マサバ 魚 さかな','100g',20.6,16.8,0.3,211],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース まさば 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=10_10154_7', itemNo: '10154', per100g: { p: 20.6, f: 16.8, c: 0.3, kcal: 211, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'アジ(生)',
      row: ['🐟魚介類','アジ(生)','あじ アジ 鯵 まあじ マアジ 魚 さかな','100g',19.7,4.5,0.1,112],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース まあじ 皮つき 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=10_10003_7', itemNo: '10003', per100g: { p: 19.7, f: 4.5, c: 0.1, kcal: 112, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'ピーマン',
      row: ['🥦野菜','ピーマン','ぴーまん ピーマン 青ピーマン やさい 野菜','100g',0.9,0.2,5.1,20],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 青ピーマン 果実 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06245_7', itemNo: '06245', per100g: { p: 0.9, f: 0.2, c: 5.1, kcal: 20, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'なす',
      row: ['🥦野菜','なす','なす ナス 茄子 やさい 野菜','100g',1.1,0.1,5.1,18],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース なす 果実 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06191_7', itemNo: '06191', per100g: { p: 1.1, f: 0.1, c: 5.1, kcal: 18, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: '白菜',
      row: ['🥦野菜','白菜','はくさい 白菜 やさい 野菜','100g',0.8,0.1,3.2,13],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース はくさい 結球葉 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06233_7', itemNo: '06233', per100g: { p: 0.8, f: 0.1, c: 3.2, kcal: 13, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: '小松菜',
      row: ['🥦野菜','小松菜','こまつな 小松菜 やさい 野菜','100g',1.5,0.2,2.4,13],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース こまつな 葉 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06086_7', itemNo: '06086', per100g: { p: 1.5, f: 0.2, c: 2.4, kcal: 13, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'アスパラガス',
      row: ['🥦野菜','アスパラガス','あすぱらがす アスパラ アスパラガス やさい 野菜','100g',2.6,0.2,3.9,21],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース アスパラガス 若茎 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=06_06007_6', itemNo: '06007', per100g: { p: 2.6, f: 0.2, c: 3.9, kcal: 21, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'にんにく',
      row: ['🥦野菜','にんにく','にんにく ニンニク 大蒜 ガーリック やさい 野菜','100g',6.4,0.9,27.5,129],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース にんにく りん茎 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06223_7', itemNo: '06223', per100g: { p: 6.4, f: 0.9, c: 27.5, kcal: 129, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '1片の重量は個体差があるため自動換算しない。' }
    },
    {
      name: '長ねぎ',
      row: ['🥦野菜','長ねぎ','ながねぎ 長ねぎ 根深ねぎ ねぎ ネギ やさい 野菜','100g',1.4,0.1,8.3,35],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース 根深ねぎ 葉 軟白 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06226_7', itemNo: '06226', per100g: { p: 1.4, f: 0.1, c: 8.3, kcal: 35, a: 0.0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    }
  ];

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･\s()（）]/g, '');
  }

  function addVerifiedRows() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return [];
    const added = [];
    VERIFIED.forEach(entry => {
      const key = normalize(entry.name);
      const exists = DB.some(row => normalize(row?.[1]) === key);
      if (exists) return;
      DB.push(entry.row.slice());
      added.push(entry.name);
    });
    return added;
  }

  function install() {
    const added = addVerifiedRows();
    window.__PFC_DB_V3_VERIFIED_SOURCES__ = Object.fromEntries(
      VERIFIED.map(entry => [entry.name, { source: entry.source, serving: entry.serving, confidence: 'high', verifiedVersion: VERSION }])
    );
    window.__PFC_DB_V3_VERIFIED__ = {
      version: VERSION,
      names: VERIFIED.map(x => x.name),
      added,
      sourcePolicy: 'MEXT nutrition + official serving conversion only when defensible'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-verified-b5.js ===== */
// PFC Mirror Database V3 Phase B5: source-verified common fish, vegetables and fruit.
(() => {
  'use strict';

  const VERSION = '3.5.1';
  const VERIFIED = [
    {
      name: 'まだら(生)',
      row: ['🐟魚介類','まだら(生)','まだら マダラ 真鱈 たら タラ 鱈 魚 さかな','100g',17.6,0.2,0.1,72],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース まだら 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=10_10205_7', itemNo: '10205', per100g: { p: 17.6, f: 0.2, c: 0.1, kcal: 72, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '切り身サイズが一定ではないため1切への自動換算は行わない。' }
    },
    {
      name: 'スイートコーン(生)',
      row: ['🥦野菜','スイートコーン(生)','すいーとこーん スイートコーン とうもろこし トウモロコシ 玉蜀黍 コーン 野菜','100g',3.6,1.7,16.8,89],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース スイートコーン 未熟種子 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06175_7', itemNo: '06175', per100g: { p: 3.6, f: 1.7, c: 16.8, kcal: 89, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '廃棄率50%かつ個体差があるため1本への自動換算は行わない。' }
    },
    {
      name: 'ズッキーニ',
      row: ['🥦野菜','ズッキーニ','ずっきーに ズッキーニ 野菜 やさい','100g',1.3,0.1,2.8,16],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース ズッキーニ 果実 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06116_7', itemNo: '06116', per100g: { p: 1.3, f: 0.1, c: 2.8, kcal: 16, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'マンゴー(生)',
      row: ['🍎果物','マンゴー(生)','まんごー マンゴー 果物 くだもの フルーツ','100g',0.6,0.1,16.9,68],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース マンゴー 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=7_07132_7', itemNo: '07132', per100g: { p: 0.6, f: 0.1, c: 16.9, kcal: 68, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '廃棄率35%かつ果実サイズ差があるため1個への自動換算は行わない。' }
    },
    {
      name: 'ブルーベリー(生)',
      row: ['🍎果物','ブルーベリー(生)','ぶるーべりー ブルーベリー 果物 くだもの フルーツ','100g',0.5,0.1,12.9,48],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース ブルーベリー 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=7_07124_7', itemNo: '07124', per100g: { p: 0.5, f: 0.1, c: 12.9, kcal: 48, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true }
    },
    {
      name: 'ネーブルオレンジ(生)',
      row: ['🍎果物','ネーブルオレンジ(生)','ねーぶるおれんじ ネーブルオレンジ オレンジ おれんじ 果物 くだもの フルーツ','100g',0.9,0.1,11.8,48],
      source: { kind: 'mext', label: '文部科学省 食品成分データベース オレンジ ネーブル 砂じょう 生', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=7_07040_7', itemNo: '07040', per100g: { p: 0.9, f: 0.1, c: 11.8, kcal: 48, a: 0 } },
      serving: { kind: 'mass-only', measure: '100g', grams: 100, exactForEntry: true, note: '廃棄率35%かつ果実サイズ差があるため1個への自動換算は行わない。' }
    }
  ];

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･\s()（）]/g, '');
  }

  function install() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return;
    const added = [];
    const sourceMap = window.__PFC_DB_V3_VERIFIED_SOURCES__ || {};
    VERIFIED.forEach(entry => {
      const key = normalize(entry.name);
      if (!DB.some(row => normalize(row?.[1]) === key)) {
        DB.push(entry.row.slice());
        added.push(entry.name);
      }
      sourceMap[entry.name] = {
        source: entry.source,
        serving: entry.serving,
        confidence: 'high',
        verifiedVersion: VERSION
      };
    });
    window.__PFC_DB_V3_VERIFIED_SOURCES__ = sourceMap;
    window.__PFC_DB_V3_VERIFIED_B5__ = {
      version: VERSION,
      names: VERIFIED.map(x => x.name),
      added,
      sourcePolicy: 'MEXT edible-portion 100g; no guessed biological piece conversions'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-mext-promoted.js ===== */
// PFC Mirror Food Master D2: MEXT-backed promotion batch 1.
(() => {
  'use strict';

  const VERSION = '3.8.0';
  const DATASET_SHA256 = '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c';
  const ENTRIES = [
    {
      name: '白米',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01088_7', itemNo: '01088', officialName: 'こめ　［水稲めし］　精白米　うるち米', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 2.5, f: 0.3, c: 37.1, kcal: 156, a: 0 } },
      canonicalId: 'mext:01088'
    },
    {
      name: 'オートミール',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01004_7', itemNo: '01004', officialName: 'えんばく　オートミール', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 13.7, f: 5.7, c: 69.1, kcal: 350, a: 0 } },
      canonicalId: 'mext:01004'
    },
    {
      name: 'パスタ(乾麺)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01063_7', itemNo: '01063', officialName: 'こむぎ　［マカロニ・スパゲッティ類］　マカロニ・スパゲッティ　乾', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 12.9, f: 1.8, c: 73.1, kcal: 347, a: 0 } },
      canonicalId: 'mext:01063'
    },
    {
      name: 'パスタ(ゆで)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01064_7', itemNo: '01064', officialName: 'こむぎ　［マカロニ・スパゲッティ類］　マカロニ・スパゲッティ　ゆで', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 5.8, f: 0.9, c: 32.2, kcal: 150, a: 0 } },
      canonicalId: 'mext:01064'
    },
    {
      name: 'コーンフレーク',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=1_01137_7', itemNo: '01137', officialName: 'とうもろこし　コーンフレーク', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 7.8, f: 1.7, c: 83.6, kcal: 380, a: 0 } },
      canonicalId: 'mext:01137'
    },
    {
      name: '鶏むね(皮なし)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11220_7', itemNo: '11220', officialName: '＜鳥肉類＞　にわとり　［若どり・主品目］　むね　皮なし　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 23.3, f: 1.9, c: 0.1, kcal: 105, a: 0 } },
      canonicalId: 'mext:11220'
    },
    {
      name: '鶏むね(皮あり)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11219_7', itemNo: '11219', officialName: '＜鳥肉類＞　にわとり　［若どり・主品目］　むね　皮つき　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 21.3, f: 5.9, c: 0.1, kcal: 133, a: 0 } },
      canonicalId: 'mext:11219'
    },
    {
      name: '鶏もも(皮なし)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11224_7', itemNo: '11224', officialName: '＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮なし　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 19, f: 5, c: 0, kcal: 113, a: 0 } },
      canonicalId: 'mext:11224'
    },
    {
      name: '鶏もも(皮あり)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11221_7', itemNo: '11221', officialName: '＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮つき　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 16.6, f: 14.2, c: 0, kcal: 190, a: 0 } },
      canonicalId: 'mext:11221'
    },
    {
      name: '砂肝',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11233_7', itemNo: '11233', officialName: '＜鳥肉類＞　にわとり　［副品目］　すなぎも　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 18.3, f: 1.8, c: 0, kcal: 86, a: 0 } },
      canonicalId: 'mext:11233'
    },
    {
      name: 'ローストビーフ',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11104_7', itemNo: '11104', officialName: '＜畜肉類＞　うし　［加工品］　ローストビーフ', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 21.7, f: 11.7, c: 0.9, kcal: 190, a: 0 } },
      canonicalId: 'mext:11104'
    },
    {
      name: '豚ヒレ',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11140_7', itemNo: '11140', officialName: '＜畜肉類＞　ぶた　［大型種肉］　ヒレ　赤肉　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 22.2, f: 3.7, c: 0.3, kcal: 118, a: 0 } },
      canonicalId: 'mext:11140'
    },
    {
      name: '豚ロース(脂身無)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11127_7', itemNo: '11127', officialName: '＜畜肉類＞　ぶた　［大型種肉］　ロース　赤肉　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 22.7, f: 5.6, c: 0.3, kcal: 140, a: 0 } },
      canonicalId: 'mext:11127'
    },
    {
      name: '豚バラ',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11129_7', itemNo: '11129', officialName: '＜畜肉類＞　ぶた　［大型種肉］　ばら　脂身つき　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 14.4, f: 35.4, c: 0.1, kcal: 366, a: 0 } },
      canonicalId: 'mext:11129'
    },
    {
      name: '豚ひき肉',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11163_7', itemNo: '11163', officialName: '＜畜肉類＞　ぶた　［ひき肉］　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 17.7, f: 17.2, c: 0.1, kcal: 209, a: 0 } },
      canonicalId: 'mext:11163'
    },
    {
      name: 'うなぎ(蒲焼)',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=10_10070_7', itemNo: '10070', officialName: '＜魚類＞　うなぎ　かば焼', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 23, f: 21, c: 3.1, kcal: 285, a: 0 } },
      canonicalId: 'mext:10070'
    },
    {
      name: 'きゅうり',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=6_06065_7', itemNo: '06065', officialName: 'きゅうり　果実　生', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 1, f: 0.1, c: 3, kcal: 13, a: 0 } },
      canonicalId: 'mext:06065'
    },
    {
      name: '無脂肪ヨーグルト',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=13_13054_7', itemNo: '13054', officialName: '＜牛乳及び乳製品＞　（発酵乳・乳酸菌飲料）　ヨーグルト　無脂肪無糖', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 4, f: 0.3, c: 5.7, kcal: 37, a: 0 } },
      canonicalId: 'mext:13054'
    },
    {
      name: 'カッテージチーズ',
      source: { kind: 'mext', label: '文部科学省 日本食品標準成分表', url: 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=13_13033_7', itemNo: '13033', officialName: '＜牛乳及び乳製品＞　（チーズ類）　ナチュラルチーズ　カテージ', datasetSha256: '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c', verifiedAt: '2026-08-12', per100g: { p: 13.3, f: 4.5, c: 1.9, kcal: 99, a: 0 } },
      canonicalId: 'mext:13033'
    }
  ];

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･\s()（）]/g, '');
  }

  function parseGramBasis(raw) {
    const match = String(raw || '').normalize('NFKC').trim().match(/^([0-9]+(?:\.[0-9]+)?)g$/i);
    if (!match) return null;
    const grams = Number(match[1]);
    return Number.isFinite(grams) && grams > 0 ? grams : null;
  }

  function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function install() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return;
    const hints = window.__PFC_DB_V3_VERIFIED_SOURCES__ || {};
    const applied = [];
    const skipped = [];

    ENTRIES.forEach(entry => {
      const key = normalize(entry.name);
      const indexes = [];
      DB.forEach((row, index) => {
        if (normalize(row?.[1]) === key) indexes.push(index);
      });
      if (!indexes.length) {
        skipped.push({ name: entry.name, reason: 'missing-db-row' });
        return;
      }

      indexes.forEach(index => {
        const row = DB[index];
        const grams = parseGramBasis(row?.[3]);
        if (!grams) {
          skipped.push({ name: entry.name, index, reason: 'non-gram-basis', basis: row?.[3] });
          return;
        }
        const scale = grams / 100;
        const n = entry.source.per100g;
        row[4] = round(n.p * scale);
        row[5] = round(n.f * scale);
        row[6] = round(n.c * scale);
        row[7] = round(n.kcal * scale);
        row[8] = round((n.a || 0) * scale);
        applied.push({ name: entry.name, index, grams, itemNo: entry.source.itemNo });
      });

      hints[entry.name] = {
        source: { ...entry.source },
        serving: {
          kind: 'mass-basis',
          measure: '100g',
          grams: 100,
          exactForEntry: true,
          note: 'MEXT可食部100g値を既存のg基準量へ比例換算。個数換算は行わない。'
        },
        confidence: 'high',
        canonicalId: entry.canonicalId,
        verifiedAt: entry.source.verifiedAt,
        verifiedVersion: VERSION
      };
    });

    window.__PFC_DB_V3_VERIFIED_SOURCES__ = hints;
    window.__PFC_DB_V3_MEXT_PROMOTED__ = {
      version: VERSION,
      datasetSha256: DATASET_SHA256,
      names: ENTRIES.map(entry => entry.name),
      itemNos: ENTRIES.map(entry => entry.source.itemNo),
      applied,
      skipped
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-food-master-mext-registry.js ===== */
// Food Master V4: central MEXT source-of-truth registry.
// Generated/maintained against the official MEXT main composition workbook.
(() => {
  'use strict';

  const VERSION = '4.0.0';
  const DATASET_SHA256 = '0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c';

  // REGISTRY_DATA_START
  const ENTRIES = [
  {
    "name": "こいくち醤油",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "17007",
      "officialName": "＜調味料類＞　（しょうゆ類）　こいくちしょうゆ",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 7.7,
        "f": 0.0,
        "c": 7.9,
        "kcal": 76.0,
        "a": 2.1
      }
    },
    "canonicalId": "mext:17007"
  },
  {
    "name": "上白糖",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "03003",
      "officialName": "（砂糖類）　車糖　上白糖",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.0,
        "f": 0.0,
        "c": 99.3,
        "kcal": 391.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:03003"
  },
  {
    "name": "米みそ(淡色辛みそ)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "17045",
      "officialName": "＜調味料類＞　（みそ類）　米みそ　淡色辛みそ",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 12.5,
        "f": 6.0,
        "c": 21.9,
        "kcal": 182.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:17045"
  },
  {
    "name": "本みりん",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "16025",
      "officialName": "＜アルコール飲料類＞　（混成酒類）　みりん　本みりん",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.3,
        "f": 0.0,
        "c": 43.2,
        "kcal": 241.0,
        "a": 9.5
      }
    },
    "canonicalId": "mext:16025"
  },
  {
    "name": "豚肩ロース(脂身つき)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11119",
      "officialName": "＜畜肉類＞　ぶた　［大型種肉］　かたロース　脂身つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 17.1,
        "f": 19.2,
        "c": 0.1,
        "kcal": 237.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11119"
  },
  {
    "name": "鶏手羽元(皮つき)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11286",
      "officialName": "＜鳥肉類＞　にわとり　［若どり・副品目］　手羽もと　皮つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 18.2,
        "f": 12.8,
        "c": 0.0,
        "kcal": 175.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11286"
  },
  {
    "name": "サバ(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "10154",
      "officialName": "＜魚類＞　（さば類）　まさば　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 20.6,
        "f": 16.8,
        "c": 0.3,
        "kcal": 211.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:10154"
  },
  {
    "name": "アジ(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "10003",
      "officialName": "＜魚類＞　（あじ類）　まあじ　皮つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 19.7,
        "f": 4.5,
        "c": 0.1,
        "kcal": 112.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:10003"
  },
  {
    "name": "ピーマン",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06245",
      "officialName": "ピーマン　果実　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.9,
        "f": 0.2,
        "c": 5.1,
        "kcal": 20.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06245"
  },
  {
    "name": "なす",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06191",
      "officialName": "なす　果実　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 1.1,
        "f": 0.1,
        "c": 5.1,
        "kcal": 18.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06191"
  },
  {
    "name": "白菜",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06233",
      "officialName": "はくさい　結球葉　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.8,
        "f": 0.1,
        "c": 3.2,
        "kcal": 13.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06233"
  },
  {
    "name": "小松菜",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06086",
      "officialName": "こまつな　葉　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 1.5,
        "f": 0.2,
        "c": 2.4,
        "kcal": 13.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06086"
  },
  {
    "name": "アスパラガス",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06007",
      "officialName": "アスパラガス　若茎　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 2.6,
        "f": 0.2,
        "c": 3.9,
        "kcal": 21.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06007"
  },
  {
    "name": "にんにく",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06223",
      "officialName": "にんにく　りん茎　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 6.4,
        "f": 0.9,
        "c": 27.5,
        "kcal": 129.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06223"
  },
  {
    "name": "長ねぎ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06226",
      "officialName": "根深ねぎ　葉　軟白　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 1.4,
        "f": 0.1,
        "c": 8.3,
        "kcal": 35.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06226"
  },
  {
    "name": "まだら(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "10205",
      "officialName": "＜魚類＞　まだら　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 17.6,
        "f": 0.2,
        "c": 0.1,
        "kcal": 72.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:10205"
  },
  {
    "name": "スイートコーン(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06175",
      "officialName": "スイートコーン　未熟種子　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 3.6,
        "f": 1.7,
        "c": 16.8,
        "kcal": 89.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06175"
  },
  {
    "name": "ズッキーニ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06116",
      "officialName": "ズッキーニ　果実　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 1.3,
        "f": 0.1,
        "c": 2.8,
        "kcal": 16.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06116"
  },
  {
    "name": "マンゴー(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "07132",
      "officialName": "マンゴー　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.6,
        "f": 0.1,
        "c": 16.9,
        "kcal": 68.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:07132"
  },
  {
    "name": "ブルーベリー(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "07124",
      "officialName": "ブルーベリー　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.5,
        "f": 0.1,
        "c": 12.9,
        "kcal": 48.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:07124"
  },
  {
    "name": "ネーブルオレンジ(生)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "07040",
      "officialName": "オレンジ　ネーブル　砂じょう　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.9,
        "f": 0.1,
        "c": 11.8,
        "kcal": 48.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:07040"
  },
  {
    "name": "白米",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01088",
      "officialName": "こめ　［水稲めし］　精白米　うるち米",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 2.5,
        "f": 0.3,
        "c": 37.1,
        "kcal": 156.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01088"
  },
  {
    "name": "オートミール",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01004",
      "officialName": "えんばく　オートミール",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 13.7,
        "f": 5.7,
        "c": 69.1,
        "kcal": 350.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01004"
  },
  {
    "name": "パスタ(乾麺)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01063",
      "officialName": "こむぎ　［マカロニ・スパゲッティ類］　マカロニ・スパゲッティ　乾",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 12.9,
        "f": 1.8,
        "c": 73.1,
        "kcal": 347.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01063"
  },
  {
    "name": "パスタ(ゆで)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01064",
      "officialName": "こむぎ　［マカロニ・スパゲッティ類］　マカロニ・スパゲッティ　ゆで",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 5.8,
        "f": 0.9,
        "c": 32.2,
        "kcal": 150.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01064"
  },
  {
    "name": "コーンフレーク",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01137",
      "officialName": "とうもろこし　コーンフレーク",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 7.8,
        "f": 1.7,
        "c": 83.6,
        "kcal": 380.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01137"
  },
  {
    "name": "鶏むね(皮なし)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11220",
      "officialName": "＜鳥肉類＞　にわとり　［若どり・主品目］　むね　皮なし　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 23.3,
        "f": 1.9,
        "c": 0.1,
        "kcal": 105.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11220"
  },
  {
    "name": "鶏むね(皮あり)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11219",
      "officialName": "＜鳥肉類＞　にわとり　［若どり・主品目］　むね　皮つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 21.3,
        "f": 5.9,
        "c": 0.1,
        "kcal": 133.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11219"
  },
  {
    "name": "鶏もも(皮なし)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11224",
      "officialName": "＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮なし　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 19.0,
        "f": 5.0,
        "c": 0.0,
        "kcal": 113.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11224"
  },
  {
    "name": "鶏もも(皮あり)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11221",
      "officialName": "＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 16.6,
        "f": 14.2,
        "c": 0.0,
        "kcal": 190.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11221"
  },
  {
    "name": "砂肝",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11233",
      "officialName": "＜鳥肉類＞　にわとり　［副品目］　すなぎも　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 18.3,
        "f": 1.8,
        "c": 0.0,
        "kcal": 86.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11233"
  },
  {
    "name": "ローストビーフ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11104",
      "officialName": "＜畜肉類＞　うし　［加工品］　ローストビーフ",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 21.7,
        "f": 11.7,
        "c": 0.9,
        "kcal": 190.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11104"
  },
  {
    "name": "豚ヒレ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11140",
      "officialName": "＜畜肉類＞　ぶた　［大型種肉］　ヒレ　赤肉　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 22.2,
        "f": 3.7,
        "c": 0.3,
        "kcal": 118.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11140"
  },
  {
    "name": "豚ロース(脂身無)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11127",
      "officialName": "＜畜肉類＞　ぶた　［大型種肉］　ロース　赤肉　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 22.7,
        "f": 5.6,
        "c": 0.3,
        "kcal": 140.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11127"
  },
  {
    "name": "豚バラ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11129",
      "officialName": "＜畜肉類＞　ぶた　［大型種肉］　ばら　脂身つき　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 14.4,
        "f": 35.4,
        "c": 0.1,
        "kcal": 366.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11129"
  },
  {
    "name": "豚ひき肉",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "11163",
      "officialName": "＜畜肉類＞　ぶた　［ひき肉］　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 17.7,
        "f": 17.2,
        "c": 0.1,
        "kcal": 209.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:11163"
  },
  {
    "name": "うなぎ(蒲焼)",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "10070",
      "officialName": "＜魚類＞　うなぎ　かば焼",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 23.0,
        "f": 21.0,
        "c": 3.1,
        "kcal": 285.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:10070"
  },
  {
    "name": "きゅうり",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "06065",
      "officialName": "きゅうり　果実　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 1.0,
        "f": 0.1,
        "c": 3.0,
        "kcal": 13.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:06065"
  },
  {
    "name": "無脂肪ヨーグルト",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "13054",
      "officialName": "＜牛乳及び乳製品＞　（発酵乳・乳酸菌飲料）　ヨーグルト　無脂肪無糖",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 4.0,
        "f": 0.3,
        "c": 5.7,
        "kcal": 37.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:13054"
  },
  {
    "name": "カッテージチーズ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "13033",
      "officialName": "＜牛乳及び乳製品＞　（チーズ類）　ナチュラルチーズ　カテージ",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 13.3,
        "f": 4.5,
        "c": 1.9,
        "kcal": 99.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:13033"
  },
  {
    "name": "玄米",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "01085",
      "officialName": "こめ　［水稲めし］　玄米",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 2.8,
        "f": 1.0,
        "c": 35.6,
        "kcal": 152.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:01085"
  },
  {
    "name": "木綿豆腐",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "04032",
      "officialName": "だいず　［豆腐・油揚げ類］　木綿豆腐",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 7.0,
        "f": 4.9,
        "c": 1.5,
        "kcal": 73.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:04032"
  },
  {
    "name": "絹ごし豆腐",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "04033",
      "officialName": "だいず　［豆腐・油揚げ類］　絹ごし豆腐",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 5.3,
        "f": 3.5,
        "c": 2.0,
        "kcal": 56.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:04033"
  },
  {
    "name": "ヨーグルト",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "13025",
      "officialName": "＜牛乳及び乳製品＞　（発酵乳・乳酸菌飲料）　ヨーグルト　全脂無糖",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 3.6,
        "f": 3.0,
        "c": 4.9,
        "kcal": 56.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:13025"
  },
  {
    "name": "ブリ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "10241",
      "officialName": "＜魚類＞　ぶり　成魚　生",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 21.4,
        "f": 17.6,
        "c": 0.3,
        "kcal": 222.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:10241"
  },
  {
    "name": "はちみつ",
    "source": {
      "kind": "mext",
      "label": "文部科学省 日本食品標準成分表",
      "itemNo": "03022",
      "officialName": "（その他）　はちみつ",
      "datasetSha256": "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c",
      "verifiedAt": "2026-08-12",
      "per100g": {
        "p": 0.3,
        "f": 0.0,
        "c": 81.9,
        "kcal": 329.0,
        "a": 0.0
      }
    },
    "canonicalId": "mext:03022"
  }
];
  // REGISTRY_DATA_END

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･\s()（）]/g, '');
  }

  function parseGramBasis(raw) {
    const match = String(raw || '').normalize('NFKC').trim().match(/^([0-9]+(?:\.[0-9]+)?)g$/i);
    if (!match) return null;
    const grams = Number(match[1]);
    return Number.isFinite(grams) && grams > 0 ? grams : null;
  }

  function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function install() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return;
    const hints = window.__PFC_DB_V3_VERIFIED_SOURCES__ || {};
    const applied = [];
    const skipped = [];

    ENTRIES.forEach(entry => {
      const key = normalize(entry.name);
      const indexes = [];
      DB.forEach((row, index) => {
        if (normalize(row?.[1]) === key) indexes.push(index);
      });
      if (!indexes.length) {
        skipped.push({ name: entry.name, itemNo: entry.source.itemNo, reason: 'missing-db-row' });
        return;
      }

      indexes.forEach(index => {
        const row = DB[index];
        const grams = parseGramBasis(row?.[3]);
        if (!grams) {
          skipped.push({ name: entry.name, itemNo: entry.source.itemNo, index, reason: 'non-gram-basis', basis: row?.[3] });
          return;
        }
        const scale = grams / 100;
        const n = entry.source.per100g;
        row[4] = round(n.p * scale);
        row[5] = round(n.f * scale);
        row[6] = round(n.c * scale);
        row[7] = round(n.kcal * scale);
        row[8] = round((n.a || 0) * scale);
        applied.push({ name: entry.name, itemNo: entry.source.itemNo, index, grams });
      });

      const previous = hints[entry.name] || {};
      hints[entry.name] = {
        ...previous,
        source: { ...entry.source },
        serving: previous.serving || {
          kind: 'mass-basis', measure: '100g', grams: 100, exactForEntry: true,
          note: 'MEXT可食部100g値を既存のg基準量へ比例換算。個数換算は行わない。'
        },
        confidence: 'high',
        canonicalId: entry.canonicalId,
        verifiedAt: entry.source.verifiedAt,
        verifiedVersion: VERSION
      };
    });

    window.__PFC_DB_V3_VERIFIED_SOURCES__ = hints;
    window.__PFC_FOOD_MASTER_MEXT_REGISTRY__ = {
      version: VERSION,
      datasetSha256: DATASET_SHA256,
      count: ENTRIES.length,
      names: ENTRIES.map(entry => entry.name),
      itemNos: ENTRIES.map(entry => entry.source.itemNo),
      applied,
      skipped
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-food-master-restaurant-registry.js ===== */
// Food Master D6: official restaurant nutrition registry.
(() => {
  'use strict';

  const VERSION = '6.0.0';
  const VERIFIED_AT = '2026-08-12';
  const PROVIDER = 'McDonald\'s Japan';
  const ENTRIES = [
    { name: 'ハンバーガー', canonicalId: 'restaurant:mcd-jp:hamburger', officialName: 'ハンバーガー', sourceUrl: 'https://www.mcdonalds.co.jp/products/1040/', nutrition: { p: 13.0, f: 9.5, c: 30.3, kcal: 259, a: 0 } },
    { name: 'チーズバーガー', canonicalId: 'restaurant:mcd-jp:cheeseburger', officialName: 'チーズバーガー', sourceUrl: 'https://www.mcdonalds.co.jp/products/1070/', nutrition: { p: 15.9, f: 13.5, c: 31.0, kcal: 310, a: 0 } },
    { name: 'ダブルチーズ', canonicalId: 'restaurant:mcd-jp:double-cheeseburger', officialName: 'ダブルチーズバーガー', sourceUrl: 'https://www.mcdonalds.co.jp/products/1360/', nutrition: { p: 26.4, f: 25.1, c: 31.8, kcal: 459, a: 0 } },
    { name: 'ビッグマック', canonicalId: 'restaurant:mcd-jp:big-mac', officialName: 'ビッグマック®', sourceUrl: 'https://www.mcdonalds.co.jp/products/1210/', nutrition: { p: 26.1, f: 28.0, c: 42.0, kcal: 524, a: 0 } },
    { name: 'フィレオフィッシュ', canonicalId: 'restaurant:mcd-jp:filet-o-fish', officialName: 'フィレオフィッシュ®', sourceUrl: 'https://www.mcdonalds.co.jp/products/1110/', nutrition: { p: 15.0, f: 14.2, c: 37.4, kcal: 338, a: 0 } },
    { name: 'チキチー', canonicalId: 'restaurant:mcd-jp:chikichee', officialName: 'チキチー® (マックチキン® チーズ)', sourceUrl: 'https://www.mcdonalds.co.jp/products/8000/', nutrition: { p: 16.4, f: 23.2, c: 40.3, kcal: 433, a: 0 } },
    { name: 'エグチ', canonicalId: 'restaurant:mcd-jp:eguchi', officialName: 'エグチ(エッグチーズバーガー)', sourceUrl: 'https://www.mcdonalds.co.jp/products/7070/', nutrition: { p: 22.4, f: 19.0, c: 31.2, kcal: 390, a: 0 } },
    { name: 'ポテト(S)', canonicalId: 'restaurant:mcd-jp:fries-s', officialName: 'マックフライポテト® Sサイズ', sourceUrl: 'https://www.mcdonalds.co.jp/products/2010/?size=2', nutrition: { p: 2.8, f: 10.7, c: 28.5, kcal: 221, a: 0 } },
    { name: 'ポテト(M)', canonicalId: 'restaurant:mcd-jp:fries-m', officialName: 'マックフライポテト® Mサイズ', sourceUrl: 'https://www.mcdonalds.co.jp/products/2010/', nutrition: { p: 5.3, f: 19.7, c: 51.8, kcal: 404, a: 0 } },
    { name: 'ポテト(L)', canonicalId: 'restaurant:mcd-jp:fries-l', officialName: 'マックフライポテト® Lサイズ', sourceUrl: 'https://www.mcdonalds.co.jp/products/2010/?size=3', nutrition: { p: 6.7, f: 24.8, c: 65.3, kcal: 509, a: 0 } },
    { name: 'ナゲット(5個)', canonicalId: 'restaurant:mcd-jp:nuggets-5', officialName: 'チキンマックナゲット® 5ピース', sourceUrl: 'https://www.mcdonalds.co.jp/products/1900/', nutrition: { p: 15.3, f: 16.1, c: 13.3, kcal: 262, a: 0 } }
  ];

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[®™・･\s()（）]/g, '');
  }

  function install() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return;
    const hints = window.__PFC_DB_V3_VERIFIED_SOURCES__ || {};
    const applied = [];
    const skipped = [];

    ENTRIES.forEach(entry => {
      const key = normalize(entry.name);
      const indexes = [];
      DB.forEach((row, index) => {
        if (normalize(row?.[1]) === key) indexes.push(index);
      });
      if (!indexes.length) {
        skipped.push({ name: entry.name, reason: 'missing-db-row' });
        return;
      }

      indexes.forEach(index => {
        const row = DB[index];
        row[4] = entry.nutrition.p;
        row[5] = entry.nutrition.f;
        row[6] = entry.nutrition.c;
        row[7] = entry.nutrition.kcal;
        row[8] = entry.nutrition.a || 0;
        applied.push({ name: entry.name, index, canonicalId: entry.canonicalId });
      });

      hints[entry.name] = {
        source: {
          kind: 'restaurant',
          provider: PROVIDER,
          label: `${PROVIDER} 公式メニュー栄養情報`,
          url: entry.sourceUrl,
          productId: entry.canonicalId.split(':').pop(),
          officialName: entry.officialName,
          verifiedAt: VERIFIED_AT,
          servingNutrition: { ...entry.nutrition }
        },
        serving: {
          kind: 'official-menu-serving',
          measure: entry.name === 'ナゲット(5個)' ? '5個' : '1食',
          exactForEntry: true,
          note: 'マクドナルド公式の可食部1食当たり栄養情報。カスタマイズ時は異なる。'
        },
        confidence: 'high',
        canonicalId: entry.canonicalId,
        verifiedAt: VERIFIED_AT,
        verifiedVersion: VERSION
      };
    });

    window.__PFC_DB_V3_VERIFIED_SOURCES__ = hints;
    window.__PFC_FOOD_MASTER_RESTAURANT_REGISTRY__ = {
      version: VERSION,
      provider: PROVIDER,
      verifiedAt: VERIFIED_AT,
      count: ENTRIES.length,
      canonicalIds: ENTRIES.map(entry => entry.canonicalId),
      names: ENTRIES.map(entry => entry.name),
      applied,
      skipped
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3.js ===== */
// PFC Mirror Database V3 Phase A: compatibility-safe unit metadata and scaling engine.
(() => {
  'use strict';

  const VERSION = '3.0.0';
  const LEGACY_SOURCE_ROWS = 408;
  const MIGRATION_MARKER = 'pfc-db-v3-favorite-units-300';
  const ENERGY_POLICY = 'stored kcal';

  const GENERIC_ALIAS_TOKENS = new Set([
    '肉','にく','魚','さかな','米','こめ','ごはん','麺','めん','パン','ぱん',
    '野菜','やさい','果物','くだもの','フルーツ','ふるーつ','コンビニ','こんびに',
    'お菓子','おかし','スイーツ','すいーつ','酒','お酒','飲み物','スープ','すーぷ','汁'
  ].map(normalize));

  const DISPLAY_UNIT_OVERRIDES = {
    'パックご飯': 'パック',
    '納豆': 'パック',
    'ケンタッキー': 'ピース',
    'プロテイン(標準:ザバス等)': 'スクープ',
    'プロテイン(高:ゴルスタ等)': 'スクープ',
    'ホエイ(牛乳)': 'スクープ',
    'ソイプロテイン': 'スクープ'
  };

  const DEFAULT_AMOUNT_OVERRIDES = {
    '白米': 150,
    '玄米': 150,
    '雑穀米': 150,
    '麦ご飯': 150,
    'パスタ(乾麺)': 100,
    'パスタ(ゆで)': 200,
    '鶏むね(皮なし)': 100,
    '鶏むね(皮あり)': 100,
    '鶏ささみ': 100,
    '鶏もも(皮なし)': 100,
    '鶏もも(皮あり)': 100
  };

  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･\s]/g, '')
      .trim();
  }

  function fmt(value) {
    const n = Math.round(Number(value || 0) * 100) / 100;
    return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, '').replace(/\.$/, '');
  }

  function parseNumber(value) {
    const raw = String(value || '').trim();
    if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(raw)) {
      const [a, b] = raw.split('/').map(Number);
      return b ? a / b : 0;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeCountUnit(rawUnit, name) {
    const u = String(rawUnit || '');
    if (/^P$/i.test(u)) {
      if (name === 'ケンタッキー') return { id: 'piece', label: 'ピース', type: 'count' };
      return { id: 'package', label: 'パック', type: 'package' };
    }
    const map = {
      '個': ['count','個'], '本': ['count','本'], '枚': ['count','枚'], '切': ['count','切'],
      '切れ': ['count','切れ'], '粒': ['count','粒'], '玉': ['count','玉'], '束': ['count','束'],
      '缶': ['package','缶'], '袋': ['package','袋'], '箱': ['package','箱'], 'パック': ['package','パック'],
      '小袋': ['package','小袋'], '杯': ['portion','杯'], '皿': ['portion','皿'], '食': ['portion','食'],
      '人前': ['portion','人前'], '舟': ['portion','舟'], 'かけ': ['count','かけ'], '片': ['count','片'],
      '尾': ['count','尾'], '貫': ['count','貫'], '合': ['portion','合'], '個分': ['portion','個分'],
      'スクープ': ['portion','スクープ']
    };
    const hit = map[u];
    return hit ? { id: normalize(hit[1]), label: hit[1], type: hit[0] } : { id: normalize(u), label: u, type: 'portion' };
  }

  function parseLegacyBasis(row) {
    const name = String(row?.[1] || '');
    const raw = String(row?.[3] || '').normalize('NFKC').trim();
    let match = raw.match(/^([0-9.]+)g$/i);
    if (match) return { amount: Number(match[1]), unit: 'g', type: 'mass', raw, exact: true };
    match = raw.match(/^([0-9.]+)ml$/i);
    if (match) return { amount: Number(match[1]), unit: 'ml', type: 'volume', raw, exact: true };
    match = raw.match(/^(大さじ|小さじ)([0-9./]+)$/);
    if (match) return { amount: parseNumber(match[2]), unit: match[1], type: 'cooking', raw, exact: true };
    match = raw.match(/^([0-9.]+(?:\/[0-9.]+)?)(個分|小袋|人前|切れ|パック|スクープ|個|本|枚|切|粒|玉|束|缶|袋|杯|皿|食|箱|P|舟|かけ|片|尾|貫|合)$/i);
    if (match) {
      const unit = normalizeCountUnit(match[2], name);
      return { amount: parseNumber(match[1]), unit: unit.label, type: unit.type, raw, exact: true };
    }
    if (/^(S|M|L|並|小|大|特盛|メガ)$/i.test(raw)) {
      return { amount: 1, unit: inferServingUnit(row), type: 'size', raw, exact: false, variant: raw };
    }
    if (/^(小鉢|一口|少々)$/i.test(raw)) {
      return { amount: 1, unit: raw, type: 'portion', raw, exact: false, vague: true };
    }
    return { amount: 1, unit: raw || '食', type: 'portion', raw, exact: false, vague: true };
  }

  function inferServingUnit(row) {
    const category = String(row?.[0] || '');
    const name = String(row?.[1] || '');
    if (/シェイク|ドリンク|コーヒー|ジュース/.test(name)) return '杯';
    if (/カレー/.test(name)) return '皿';
    if (/丼|ラーメン|うどん|そば|スープ|汁/.test(name)) return '杯';
    if (/弁当|定食|パスタ|オムライス|ドリア|グラタン|焼きそば|冷やし中華/.test(name)) return '食';
    if (/コンビニ/.test(category)) return '食';
    return '食';
  }

  function normalizeCategory(row) {
    const legacy = String(row?.[0] || '');
    const name = String(row?.[1] || '');
    if (legacy.includes('炭水化物')) return 'staples';
    if (legacy.includes('肉類')) return 'meat';
    if (legacy.includes('魚介')) return 'seafood';
    if (legacy.includes('卵・乳・大豆')) return 'eggs-dairy-soy';
    if (legacy.includes('野菜')) return 'vegetables';
    if (legacy.includes('果物')) return 'fruit';
    if (legacy.includes('汁物')) return 'soup';
    if (legacy.includes('油脂')) return 'fats-condiments';
    if (legacy.includes('コンビニ')) return 'convenience';
    if (legacy.includes('サプリ')) return 'supplements';
    if (legacy.includes('酒・ジュース')) {
      const a = Number(row?.[8]);
      return Number.isFinite(a) && a > 0 ? 'alcohol' : 'beverages';
    }
    if (legacy.includes('ジャンク・菓子')) {
      if (/(牛丼|豚丼|カレー|定食|ラーメン|チャーハン|餃子|麻婆豆腐|唐揚げ|ピザ|たこ焼き|お好み焼き|うな牛)/.test(name)) return 'dishes';
      if (/(バーガー|マック|ポテト\([SML]\)|ナゲット|ケンタッキー|クリスピー|ツイスター)/.test(name)) return 'fast-food';
      return 'snacks-sweets';
    }
    if (legacy.includes('料理')) return 'dishes';
    return 'other';
  }

  function baseName(name) {
    return String(name || '').replace(/[（(]([^()（）]+)[)）]\s*$/, '').trim();
  }

  function variantLabel(name, basis) {
    if (basis?.variant) return basis.variant;
    const match = String(name || '').match(/[（(]([^()（）]+)[)）]\s*$/);
    return match ? match[1] : '';
  }

  function defaultAmountFor(row, basis) {
    const name = String(row?.[1] || '');
    if (Number.isFinite(Number(DEFAULT_AMOUNT_OVERRIDES[name]))) return Number(DEFAULT_AMOUNT_OVERRIDES[name]);
    if (basis.type === 'mass') return Math.max(0.01, basis.amount);
    if (basis.type === 'volume') return Math.max(1, basis.amount);
    return Math.max(0.01, basis.amount || 1);
  }

  function quickStepFor(row, basis, defaultAmount) {
    const name = String(row?.[1] || '');
    if (basis.type === 'mass') {
      if (/クレアチン/.test(name)) return 1;
      if (defaultAmount <= 10) return 1;
      if (defaultAmount <= 30) return 5;
      if (defaultAmount <= 60) return 10;
      return 50;
    }
    if (basis.type === 'volume') return defaultAmount >= 500 ? 100 : 50;
    if (basis.type === 'cooking') return 0.5;
    if (basis.type === 'portion' || basis.type === 'size') {
      if (basis.amount < 1) return basis.amount;
      return 0.5;
    }
    if (basis.type === 'package') {
      if (basis.amount < 1) return basis.amount;
      return 1;
    }
    if (basis.type === 'count') {
      if (basis.amount < 1) return basis.amount;
      if (basis.amount >= 10) return 5;
      return 1;
    }
    return 1;
  }

  function displayUnitFor(row, basis) {
    const name = String(row?.[1] || '');
    if (DISPLAY_UNIT_OVERRIDES[name]) return DISPLAY_UNIT_OVERRIDES[name];
    if (basis.type === 'size') return inferServingUnit(row);
    return basis.unit;
  }

  function formatAmount(meta, amount) {
    const unit = meta?.input?.defaultUnit || '';
    const value = fmt(amount);
    if (unit === '大さじ' || unit === '小さじ') return `${unit}${value}`;
    return `${value}${unit}`;
  }

  function buildMeta(row, index) {
    const basis = parseLegacyBasis(row);
    const defaultAmount = defaultAmountFor(row, basis);
    const aliases = String(row?.[2] || '').split(/\s+/).filter(Boolean);
    const genericTags = aliases.filter(alias => GENERIC_ALIAS_TOKENS.has(normalize(alias)));
    const specificAliases = aliases.filter(alias => !GENERIC_ALIAS_TOKENS.has(normalize(alias)));
    const name = String(row?.[1] || '');
    const a = Number.isFinite(Number(row?.[8])) ? Number(row[8]) : 0;
    const category = normalizeCategory(row);
    const displayUnit = displayUnitFor(row, basis);
    const confidence = basis.vague ? 'low' : 'medium';

    return {
      id: `db:${normalize(name)}:${index}`,
      legacyIndex: index < LEGACY_SOURCE_ROWS ? index : null,
      runtimeIndex: index,
      name,
      baseName: baseName(name),
      variant: variantLabel(name, basis),
      legacyCategory: String(row?.[0] || ''),
      category,
      aliases: specificAliases,
      genericTags,
      nutritionBasis: {
        amount: basis.amount,
        unit: basis.unit,
        type: basis.type,
        legacy: basis.raw,
        exact: basis.exact
      },
      nutrition: {
        p: Number(row?.[4] || 0),
        f: Number(row?.[5] || 0),
        c: Number(row?.[6] || 0),
        a,
        kcal: Number(row?.[7] || 0)
      },
      input: {
        defaultUnit: displayUnit,
        defaultAmount,
        quickStep: quickStepFor(row, basis, defaultAmount),
        quickMin: basis.amount < 1 ? basis.amount : (basis.type === 'mass' ? Math.min(defaultAmount, Math.max(1, quickStepFor(row, basis, defaultAmount))) : (basis.type === 'volume' ? Math.min(defaultAmount, 50) : (basis.type === 'cooking' || basis.type === 'portion' || basis.type === 'size' ? 0.5 : 1))),
        type: basis.type
      },
      source: {
        kind: index >= LEGACY_SOURCE_ROWS ? 'mirror-curated' : 'legacy',
        label: index >= LEGACY_SOURCE_ROWS ? 'Mirror curated extension' : 'Legacy PFC DB'
      },
      confidence
    };
  }

  let items = [];
  let byIndex = new Map();

  function rebuild() {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) {
      items = [];
      byIndex = new Map();
      return;
    }
    items = DB.map(buildMeta);
    byIndex = new Map(items.map(item => [item.runtimeIndex, item]));

    const firstByCanonical = new Map();
    items.forEach(item => {
      const key = normalize(item.name);
      const first = firstByCanonical.get(key);
      if (!first) firstByCanonical.set(key, item);
      else item.duplicateOf = first.id;
    });
  }

  function get(index) {
    return byIndex.get(Number(index)) || null;
  }

  function multiplierFor(index, amount) {
    const meta = get(index);
    if (!meta) return 0;
    const basis = Number(meta.nutritionBasis.amount || 1);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !basis) return 0;
    return value / basis;
  }

  function scale(index, amount) {
    const meta = get(index);
    const multiplier = multiplierFor(index, amount);
    if (!meta || !multiplier) return null;
    const n = meta.nutrition;
    return {
      amount: Number(amount),
      unit: meta.input.defaultUnit,
      multiplier,
      p: Number((n.p * multiplier).toFixed(1)),
      f: Number((n.f * multiplier).toFixed(1)),
      c: Number((n.c * multiplier).toFixed(1)),
      a: Number((n.a * multiplier).toFixed(1)),
      kcal: Math.round(n.kcal * multiplier)
    };
  }

  function amountChoices(index) {
    const meta = get(index);
    if (!meta) return [];
    const base = Number(meta.input.defaultAmount || meta.nutritionBasis.amount || 1);
    const step = Number(meta.input.quickStep || 1);
    const type = meta.input.type;
    const name = meta.name;
    let values = [];

    if (/^(白米|玄米|雑穀米|麦ご飯)$/.test(name)) values = [100,150,200,250,300,400];
    else if (type === 'mass') {
      if (base <= 10) values = [Math.max(1, base-step*2), Math.max(1, base-step), base, base+step, base+step*2];
      else if (base <= 30) values = [Math.max(step, base-step*2), Math.max(step, base-step), base, base+step, base+step*2];
      else values = [Math.max(step, base-step), base, base+step, base+step*2, base+step*3];
    } else if (type === 'volume') {
      values = base >= 500 ? [250,350,500,750,1000] : [Math.max(50,base-100), Math.max(50,base-50), base, base+50, base+100];
    } else if (type === 'cooking') values = [0.5,1,1.5,2];
    else if (base < 1) values = [base, base*2, base*3, base*4];
    else if ((type === 'count' || type === 'package') && base >= 5) values = [Math.max(1, base-step), base, base+step, base+step*2];
    else if (type === 'count' || type === 'package') values = [0.5,1,2,3];
    else values = [0.5,1,1.5,2];

    return [...new Set(values.map(v => Math.round(v * 100) / 100).filter(v => Number.isFinite(v) && v > 0))].sort((a,b) => a-b);
  }

  function buildRecord(index, amount, time) {
    const meta = get(index);
    const scaled = scale(index, amount);
    if (!meta || !scaled) return null;
    const row = DB[index];
    return {
      id: Date.now(),
      N: `${meta.name}(${formatAmount(meta, amount)})`,
      P: scaled.p,
      F: scaled.f,
      C: scaled.c,
      A: scaled.a,
      Cal: scaled.kcal,
      U: row?.[3] || `${meta.nutritionBasis.amount}${meta.nutritionBasis.unit}`,
      time: time || (typeof getAutoTime === 'function' ? getAutoTime() : '朝'),
      _dbv3: { id: meta.id, index, amount: Number(amount), unit: meta.input.defaultUnit }
    };
  }

  function migrateFavoriteAmounts() {
    try {
      if (localStorage.getItem(MIGRATION_MARKER) === '1') return;
      if (typeof favoriteSettings === 'undefined' || !favoriteSettings || typeof favoriteSettings !== 'object') {
        localStorage.setItem(MIGRATION_MARKER, '1');
        return;
      }
      let changed = false;
      Object.entries(favoriteSettings).forEach(([key, setting]) => {
        const match = key.match(/^db:(\d+)$/);
        if (!match || !setting || !Number.isFinite(Number(setting.amount)) || Number(setting.amount) <= 0) return;
        const index = Number(match[1]);
        const meta = get(index);
        const row = typeof DB !== 'undefined' ? DB[index] : null;
        if (!meta || !row) return;
        const legacyUnit = String(row[3] || '');
        // Legacy quick input treated every non-g unit as a multiplier, not a real amount.
        if (!legacyUnit.includes('g')) {
          const basis = Number(meta.nutritionBasis.amount || 1);
          if (basis !== 1) {
            setting.amount = Math.round(Number(setting.amount) * basis * 100) / 100;
            changed = true;
          }
        }
      });
      if (changed && typeof saveFavoriteSettings === 'function') saveFavoriteSettings();
      localStorage.setItem(MIGRATION_MARKER, '1');
    } catch (error) {
      console.warn('[PFC DB V3] favorite migration skipped', error);
    }
  }

  function installCompatibilityOverrides() {
    const legacyGetDbDefaultAmount = window.getDbDefaultAmount;
    const legacyGetFavoriteUnit = window.getFavoriteUnit;
    const legacyFormatFavoriteAmount = window.formatFavoriteAmount;
    const legacyBuildFavoriteLogItem = window.buildFavoriteLogItem;

    window.getDbDefaultAmount = function (index) {
      const meta = get(index);
      if (!meta) return typeof legacyGetDbDefaultAmount === 'function' ? legacyGetDbDefaultAmount(index) : 1;
      if (typeof getFavoriteSetting === 'function') {
        const setting = getFavoriteSetting('db', index);
        if (Number.isFinite(Number(setting?.amount)) && Number(setting.amount) > 0) return Number(setting.amount);
      }
      return meta.input.defaultAmount;
    };

    window.getFavoriteUnit = function (item) {
      if (item?.source === 'db') return get(item.i)?.input?.defaultUnit || '';
      return typeof legacyGetFavoriteUnit === 'function' ? legacyGetFavoriteUnit(item) : '個';
    };

    window.formatFavoriteAmount = function (item) {
      if (item?.source === 'db') {
        const meta = get(item.i);
        const amount = typeof getFavoriteAmount === 'function' ? getFavoriteAmount(item) : meta?.input?.defaultAmount;
        if (meta) return formatAmount(meta, amount);
      }
      return typeof legacyFormatFavoriteAmount === 'function' ? legacyFormatFavoriteAmount(item) : '';
    };

    window.buildFavoriteLogItem = function (item, amount) {
      if (item?.source === 'db') return buildRecord(item.i, amount);
      return typeof legacyBuildFavoriteLogItem === 'function' ? legacyBuildFavoriteLogItem(item, amount) : null;
    };
  }

  function install() {
    rebuild();
    migrateFavoriteAmounts();
    installCompatibilityOverrides();
    window.__PFC_DB_V3__ = {
      version: VERSION,
      phase: 'A',
      energyPolicy: ENERGY_POLICY,
      legacySourceRows: LEGACY_SOURCE_ROWS,
      get items() { return items; },
      get,
      rebuild,
      scale,
      buildRecord,
      multiplierFor,
      amountChoices,
      formatAmount,
      parseLegacyBasis,
      stats: () => ({
        effectiveRows: items.length,
        legacyRows: items.filter(x => x.source.kind === 'legacy').length,
        curatedRows: items.filter(x => x.source.kind === 'mirror-curated').length,
        duplicates: items.filter(x => x.duplicateOf).length,
        unitTypes: items.reduce((acc, x) => { acc[x.input.type] = (acc[x.input.type] || 0) + 1; return acc; }, {})
      })
    };
    document.documentElement.classList.add('pfc-db-v3');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-catalog.js ===== */
// PFC Mirror Database V3 Phase B: curated natural-unit metadata.
(() => {
  'use strict';

  const VERSION = '3.1.2';
  const BASE_VERSION = '3.1.0';
  const BUNDLE_MIGRATION_MARKER = 'pfc-db-v3-bundle-units-310';

  // These are semantic/unit corrections only. Nutrition values remain untouched.
  const MEAL_AS_ONE_SERVING = new Set([
    '海苔弁当','幕の内弁当','ハンバーグ弁当','チキン南蛮弁当','生姜焼き弁当',
    'カツ丼','親子丼','麻婆丼','中華丼','オムライス','ミートソース','カルボナーラ',
    'ナポリタン','明太子パスタ','ペペロンチーノ','ドリア','グラタン','冷やし中華',
    'ざるそば','焼きそば','カップ麺','ポテト(S)','ポテト(M)','ポテト(L)'
  ]);

  const PACKAGE_OVERRIDES = {
    'からあげクン': 'パック',
    'じゃがりこ': 'カップ',
    'アイス(カップ)': 'カップ'
  };

  // The legacy row is one tray/box, but the name itself specifies an item count.
  // Converting these to explicit count bases makes Quick Input behave naturally.
  const BUNDLE_COUNT_BASES = {
    'ナゲット(5個)': 5,
    '餃子(6個)': 6,
    '唐揚げ(5個)': 5
  };

  const RICE_SERVING_REFERENCE = {
    kind: 'maff-serving-guide',
    label: '農林水産省 食事バランスガイド SV早見表',
    url: 'https://www.maff.go.jp/j/syokuiku/zissen_navi/balance/chart.html',
    exact: false,
    presets: [
      { label: 'S', grams: 100 },
      { label: 'M', grams: 150 },
      { label: 'L', grams: 200 }
    ],
    note: '食事バランスガイド上の標準的な主食量。茶碗そのものの固定重量ではない。'
  };

  const EGG_SIZE_REFERENCE = {
    kind: 'maff-egg-standard',
    label: '農林水産省 鶏卵の規格',
    url: 'https://www.maff.go.jp/j/kokuji_tuti/kokuji/k0000481.html',
    exact: true,
    grossWeightRanges: {
      M: [58, 64],
      L: [64, 70]
    },
    note: '殻を含む重量区分。可食部gへの自動換算には使わない。'
  };

  function findByName(name) {
    const api = window.__PFC_DB_V3__;
    if (!api?.items) return [];
    return api.items.filter(item => item?.name === name);
  }

  function setNaturalServing(meta, unit = '食') {
    if (!meta?.input) return;
    meta.input.defaultUnit = unit;
    meta.input.defaultAmount = 1;
    meta.input.quickStep = 0.5;
    meta.input.quickMin = 0.5;
    meta.input.type = unit === '食' ? 'portion' : 'package';
    meta.unitConfidence = 'high';
  }

  function migrateBundleFavoriteSettings() {
    try {
      if (localStorage.getItem(BUNDLE_MIGRATION_MARKER) === '1') return;
      if (typeof favoriteSettings === 'undefined' || !favoriteSettings || typeof favoriteSettings !== 'object') {
        localStorage.setItem(BUNDLE_MIGRATION_MARKER, '1');
        return;
      }
      let changed = false;
      Object.entries(BUNDLE_COUNT_BASES).forEach(([name, count]) => {
        findByName(name).forEach(meta => {
          const setting = favoriteSettings[`db:${meta.runtimeIndex}`];
          if (!setting || !Number.isFinite(Number(setting.amount)) || Number(setting.amount) <= 0) return;
          // Before 3.1, 1 meant one legacy tray/box/plate. Preserve that meaning as N items.
          setting.amount = Math.round(Number(setting.amount) * count * 100) / 100;
          changed = true;
        });
      });
      if (changed && typeof saveFavoriteSettings === 'function') saveFavoriteSettings();
      localStorage.setItem(BUNDLE_MIGRATION_MARKER, '1');
    } catch (error) {
      console.warn('[PFC DB V3.1] bundle favorite migration skipped', error);
    }
  }

  function applyBundleCountBases() {
    Object.entries(BUNDLE_COUNT_BASES).forEach(([name, count]) => {
      findByName(name).forEach(meta => {
        meta.nutritionBasis.amount = count;
        meta.nutritionBasis.unit = '個';
        meta.nutritionBasis.type = 'count';
        meta.nutritionBasis.exact = true;
        meta.input.defaultUnit = '個';
        meta.input.defaultAmount = count;
        meta.input.quickStep = 1;
        meta.input.quickMin = 1;
        meta.input.type = 'count';
        meta.unitConfidence = 'high';
        meta.unitSource = { kind: 'legacy-name', label: `${name} の食品名に明示された個数` };
      });
    });
  }

  function applyVerifiedSources() {
    const hints = window.__PFC_DB_V3_VERIFIED_SOURCES__ || {};
    Object.entries(hints).forEach(([name, hint]) => {
      findByName(name).forEach(meta => {
        meta.source = { ...hint.source };
        meta.servingSource = { ...hint.serving };
        meta.confidence = hint.confidence || 'high';
        meta.verifiedVersion = hint.verifiedVersion;
        meta.unitConfidence = hint.serving?.exactForEntry === true ? 'high' : meta.unitConfidence;
        if (hint.canonicalId) meta.canonicalId = hint.canonicalId;
        else if (hint.source?.kind === 'mext' && hint.source?.itemNo) meta.canonicalId = `mext:${hint.source.itemNo}`;
        meta.provenance = {
          sourceKind: hint.source?.kind || null,
          sourceId: hint.source?.itemNo || hint.source?.productId || null,
          confidence: hint.confidence || 'high',
          verifiedAt: hint.verifiedAt || hint.source?.verifiedAt || null,
          verifiedVersion: hint.verifiedVersion || null,
          datasetSha256: hint.source?.datasetSha256 || null
        };
      });
    });
  }

  function applyNaturalUnits() {
    const api = window.__PFC_DB_V3__;
    if (!api?.items) return;

    api.items.forEach(meta => {
      if (MEAL_AS_ONE_SERVING.has(meta.name)) setNaturalServing(meta, '食');
      const packageUnit = PACKAGE_OVERRIDES[meta.name];
      if (packageUnit) setNaturalServing(meta, packageUnit);

      if (['白米','玄米','雑穀米','麦ご飯'].includes(meta.name)) {
        meta.input.references = [...(meta.input.references || []), RICE_SERVING_REFERENCE];
      }
      if (meta.name === '全卵(M)') {
        meta.input.references = [...(meta.input.references || []), { ...EGG_SIZE_REFERENCE, selectedSize: 'M' }];
      }
      if (meta.name === '全卵(L)') {
        meta.input.references = [...(meta.input.references || []), { ...EGG_SIZE_REFERENCE, selectedSize: 'L' }];
      }
    });
  }

  function install() {
    if (!window.__PFC_DB_V3__) return;
    migrateBundleFavoriteSettings();
    applyBundleCountBases();
    applyNaturalUnits();
    applyVerifiedSources();

    window.__PFC_DB_V3_CATALOG__ = {
      version: VERSION,
      baseVersion: BASE_VERSION,
      semanticOnly: true,
      bundleCountFoods: Object.keys(BUNDLE_COUNT_BASES),
      mealServingFoods: [...MEAL_AS_ONE_SERVING],
      packageOverrides: { ...PACKAGE_OVERRIDES },
      verifiedSourcesApplied: Object.keys(window.__PFC_DB_V3_VERIFIED_SOURCES__ || {}).length,
      provenanceSchema: 1,
      sources: {
        maffRiceServingGuide: RICE_SERVING_REFERENCE.url,
        maffEggStandard: EGG_SIZE_REFERENCE.url
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-manual.js ===== */
// PFC Mirror Database V3 Phase A: manual-input compatibility adapter.
(() => {
  'use strict';

  const VERSION = '3.0.0';

  function api() {
    return window.__PFC_DB_V3__ || null;
  }

  function numberValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    if (typeof parseNum === 'function') return parseNum(el.value);
    return Number(el.value) || 0;
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function displayPreview(index, amount, scaled) {
    const dbv3 = api();
    const meta = dbv3?.get(index);
    if (!meta || !scaled) return;

    const preview = document.getElementById('pv-bar');
    if (preview) preview.style.display = 'block';
    const name = document.getElementById('pv-name');
    if (name) name.textContent = `${meta.name} (${dbv3.formatAmount(meta, amount)})`;
    const stat = document.getElementById('pv-stat');
    if (stat) {
      const aText = (typeof TG !== 'undefined' && TG?.alcMode && scaled.a > 0) ? ` A${scaled.a.toFixed(1)}` : '';
      stat.textContent = `${scaled.kcal}kcal (P${scaled.p.toFixed(1)} F${scaled.f.toFixed(1)} C${scaled.c.toFixed(1)}${aText})`;
    }
  }

  function renderAmountChoices(index, preferredAmount) {
    const dbv3 = api();
    const meta = dbv3?.get(index);
    if (!meta) return;

    const rice = document.getElementById('rice-btns');
    const portion = document.getElementById('pst-btns');
    if (!portion) return;
    if (rice) {
      rice.innerHTML = '';
      rice.style.display = 'none';
    }
    portion.innerHTML = '';
    portion.style.display = 'grid';

    const values = dbv3.amountChoices(index);
    values.forEach(value => {
      const button = document.createElement('div');
      button.className = 'a-btn';
      button.innerHTML = `<span>${dbv3.formatAmount(meta, value)}</span>`;
      if (Math.abs(Number(value) - Number(preferredAmount)) < 0.0001) button.classList.add('sel');
      button.onclick = () => {
        document.querySelectorAll('.a-btn').forEach(x => x.classList.remove('sel'));
        button.classList.add('sel');
        window.updBd(value);
      };
      portion.appendChild(button);
    });
  }

  function install() {
    const dbv3 = api();
    if (!dbv3 || typeof window.selFd !== 'function' || typeof window.updBd !== 'function') return;

    const legacySelFd = window.selFd;
    const legacyUpdBd = window.updBd;
    const legacyCalcM = window.calcM;

    window.updBd = function (value) {
      if (typeof selIdx === 'undefined' || selIdx < 0) return legacyUpdBd.apply(this, arguments);
      const meta = dbv3.get(selIdx);
      const row = typeof DB !== 'undefined' ? DB[selIdx] : null;
      const amount = Number(value);
      const scaled = dbv3.scale(selIdx, amount);
      if (!meta || !row || !scaled) return legacyUpdBd.apply(this, arguments);

      setValue('m-mul', Number(scaled.multiplier.toFixed(4)));
      setValue('m-name', meta.name);
      setValue('m-p', Number(row[4] || 0));
      setValue('m-f', Number(row[5] || 0));
      setValue('m-c', Number(row[6] || 0));
      setValue('m-a', Number.isFinite(Number(row[8])) ? Number(row[8]) : 0);
      setValue('m-cal', scaled.kcal);
      displayPreview(selIdx, amount, scaled);
    };

    window.calcM = function () {
      if (typeof selIdx === 'undefined' || selIdx < 0 || !dbv3.get(selIdx)) {
        return typeof legacyCalcM === 'function' ? legacyCalcM.apply(this, arguments) : undefined;
      }

      const meta = dbv3.get(selIdx);
      const row = typeof DB !== 'undefined' ? DB[selIdx] : null;
      if (!row) return typeof legacyCalcM === 'function' ? legacyCalcM.apply(this, arguments) : undefined;

      // If the user manually edited the base macros, preserve the legacy custom calculation path.
      const baseA = Number.isFinite(Number(row[8])) ? Number(row[8]) : 0;
      const edited = Math.abs(numberValue('m-p') - Number(row[4] || 0)) > 0.01 ||
        Math.abs(numberValue('m-f') - Number(row[5] || 0)) > 0.01 ||
        Math.abs(numberValue('m-c') - Number(row[6] || 0)) > 0.01 ||
        Math.abs(numberValue('m-a') - baseA) > 0.01;
      if (edited) return typeof legacyCalcM === 'function' ? legacyCalcM.apply(this, arguments) : undefined;

      const multiplier = numberValue('m-mul') || 1;
      const amount = Number(meta.nutritionBasis.amount || 1) * multiplier;
      const scaled = dbv3.scale(selIdx, amount);
      if (!scaled) return typeof legacyCalcM === 'function' ? legacyCalcM.apply(this, arguments) : undefined;
      setValue('m-cal', scaled.kcal);
      displayPreview(selIdx, amount, scaled);
    };

    window.selFd = function (index) {
      const result = legacySelFd.apply(this, arguments);
      const meta = dbv3.get(index);
      if (!meta) return result;

      const favoriteItem = { source: 'db', i: index, name: meta.name, isMy: false };
      const preferred = typeof getFavoriteAmount === 'function'
        ? Number(getFavoriteAmount(favoriteItem))
        : Number(meta.input.defaultAmount);
      const amount = Number.isFinite(preferred) && preferred > 0 ? preferred : Number(meta.input.defaultAmount || meta.nutritionBasis.amount || 1);

      renderAmountChoices(index, amount);
      window.updBd(amount);
      if (typeof ensureAmountPanelVisible === 'function') requestAnimationFrame(ensureAmountPanelVisible);
      return result;
    };

    window.__PFC_DB_V3_MANUAL__ = {
      version: VERSION,
      unitAwareButtons: true,
      storedKcalScaling: true,
      explicitAlcoholOnly: true
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-multiunit.js ===== */
// PFC Mirror Database V3 Phase C1: verified multi-unit input engine.
(() => {
  'use strict';

  const VERSION = '3.6.0';
  const activeUnits = new Map();

  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s・･]/g, '');
  const fmt = value => {
    const n = Math.round(Number(value || 0) * 100) / 100;
    return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, '').replace(/\.$/, '');
  };

  function api() { return window.__PFC_DB_V3__ || null; }

  function makeDefaultUnit(meta) {
    return {
      id: normalize(meta.input.defaultUnit),
      label: meta.input.defaultUnit,
      type: meta.input.type,
      basisPerUnit: 1,
      exact: true,
      source: 'nutrition-basis'
    };
  }

  function buildUnits(meta) {
    if (!meta?.input) return [];
    const units = [makeDefaultUnit(meta)];
    const serving = meta.servingSource;
    if (serving?.kind === 'maff-recipe-weight' && Number(serving.grams) > 0 && meta.input.defaultUnit !== 'g') {
      units.push({
        id: 'g',
        label: 'g',
        type: 'mass',
        basisPerUnit: 1 / Number(serving.grams),
        exact: serving.exactForEntry === true,
        source: serving.url || serving.label,
        note: `${meta.input.defaultUnit}1 = ${Number(serving.grams)}g`
      });
    }
    return units;
  }

  function units(index) {
    const meta = api()?.get?.(index);
    if (!meta) return [];
    if (!Array.isArray(meta.input.units)) meta.input.units = buildUnits(meta);
    return meta.input.units;
  }

  function defaultUnitId(index) {
    return units(index)[0]?.id || '';
  }

  function activeUnitId(index) {
    const available = units(index);
    const selected = activeUnits.get(Number(index));
    return available.some(unit => unit.id === selected) ? selected : (available[0]?.id || '');
  }

  function unit(index, unitId) {
    const available = units(index);
    return available.find(item => item.id === (unitId || activeUnitId(index))) || available[0] || null;
  }

  function toBasisAmount(index, amount, unitId) {
    const u = unit(index, unitId);
    const value = Number(amount);
    if (!u || !Number.isFinite(value) || value <= 0) return 0;
    return value * Number(u.basisPerUnit || 0);
  }

  function fromBasisAmount(index, basisAmount, unitId) {
    const u = unit(index, unitId);
    const value = Number(basisAmount);
    if (!u || !Number.isFinite(value) || value <= 0 || !Number(u.basisPerUnit)) return 0;
    return value / Number(u.basisPerUnit);
  }

  function convert(index, amount, fromUnitId, toUnitId) {
    const basisAmount = toBasisAmount(index, amount, fromUnitId);
    return fromBasisAmount(index, basisAmount, toUnitId);
  }

  function scaleInput(index, amount, unitId) {
    const basisAmount = toBasisAmount(index, amount, unitId);
    return basisAmount > 0 ? api()?.scale?.(index, basisAmount) || null : null;
  }

  function formatInput(index, amount, unitId) {
    const u = unit(index, unitId);
    if (!u) return fmt(amount);
    return u.label === '大さじ' || u.label === '小さじ' ? `${u.label}${fmt(amount)}` : `${fmt(amount)}${u.label}`;
  }

  function buildRecordInput(index, amount, unitId, time) {
    const dbv3 = api();
    const meta = dbv3?.get?.(index);
    const scaled = scaleInput(index, amount, unitId);
    if (!meta || !scaled) return null;
    return {
      id: Date.now(),
      N: `${meta.name}(${formatInput(index, amount, unitId)})`,
      P: scaled.p, F: scaled.f, C: scaled.c, A: scaled.a, Cal: scaled.kcal,
      U: meta.nutritionBasis.legacy,
      time: time || (typeof getAutoTime === 'function' ? getAutoTime() : '朝'),
      _dbv3: { id: meta.id, index, amount: Number(amount), unit: unit(index, unitId)?.label || '' }
    };
  }

  function choices(index, unitId) {
    const dbv3 = api();
    const meta = dbv3?.get?.(index);
    const u = unit(index, unitId);
    if (!meta || !u) return [];
    if (u.id === defaultUnitId(index)) return dbv3.amountChoices(index);
    if (u.id === 'g' && Number(meta.servingSource?.grams) > 0) {
      const g = Number(meta.servingSource.grams);
      return [...new Set([g / 2, g, g * 1.5, g * 2, g * 3].map(v => Math.round(v * 10) / 10))];
    }
    return [0.5, 1, 1.5, 2];
  }

  function ensureStyle() {
    if (document.getElementById('pfc-db-v3-multiunit-style')) return;
    const style = document.createElement('style');
    style.id = 'pfc-db-v3-multiunit-style';
    style.textContent = `
      .dbv3-unit-switch{display:flex;gap:5px;margin:7px 0 5px;padding:3px;background:#eef7f2;border-radius:10px;width:max-content;max-width:100%}
      .dbv3-unit-switch button{border:0;background:transparent;color:#687970;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:900;min-width:48px}
      .dbv3-unit-switch button.active{background:#fff;color:#187a51;box-shadow:0 1px 5px rgba(27,93,66,.12)}
      .dbv3-unit-note{font-size:9.5px;color:#82938b;margin:-1px 0 5px}
    `;
    document.head?.appendChild(style);
  }

  function currentBasisAmount(index) {
    const meta = api()?.get?.(index);
    const mul = Number(document.getElementById('m-mul')?.value || 1);
    return meta ? Number(meta.nutritionBasis.amount || 1) * mul : 0;
  }

  function renderChoices(index) {
    const box = document.getElementById('pst-btns');
    if (!box) return;
    const unitId = activeUnitId(index);
    box.innerHTML = '';
    box.style.display = 'grid';
    choices(index, unitId).forEach(value => {
      const button = document.createElement('div');
      button.className = 'a-btn';
      button.innerHTML = `<span>${formatInput(index, value, unitId)}</span>`;
      button.onclick = () => {
        box.querySelectorAll('.a-btn').forEach(x => x.classList.remove('sel'));
        button.classList.add('sel');
        window.updBd(value);
      };
      box.appendChild(button);
    });
  }

  function updatePreviewLabel(index, inputAmount) {
    const meta = api()?.get?.(index);
    const name = document.getElementById('pv-name');
    if (meta && name) name.textContent = `${meta.name} (${formatInput(index, inputAmount, activeUnitId(index))})`;
  }

  function renderSwitch(index) {
    document.getElementById('dbv3-unit-switch')?.remove();
    document.getElementById('dbv3-unit-note')?.remove();
    const available = units(index);
    if (available.length <= 1) return;
    const amountArea = document.getElementById('amt-area');
    const amountButtons = document.getElementById('pst-btns');
    if (!amountArea || !amountButtons) return;

    const switcher = document.createElement('div');
    switcher.id = 'dbv3-unit-switch';
    switcher.className = 'dbv3-unit-switch';
    available.forEach(u => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = u.label;
      button.classList.toggle('active', u.id === activeUnitId(index));
      button.onclick = () => {
        const basisBefore = currentBasisAmount(index) || Number(api()?.get(index)?.nutritionBasis.amount || 1);
        activeUnits.set(Number(index), u.id);
        const nextInput = fromBasisAmount(index, basisBefore, u.id);
        renderSwitch(index);
        renderChoices(index);
        window.updBd(nextInput);
      };
      switcher.appendChild(button);
    });
    amountArea.insertBefore(switcher, amountButtons);

    const selected = unit(index);
    if (selected?.note) {
      const note = document.createElement('div');
      note.id = 'dbv3-unit-note';
      note.className = 'dbv3-unit-note';
      note.textContent = selected.note;
      amountArea.insertBefore(note, amountButtons);
    }
  }

  function installUi() {
    if (typeof window.selFd !== 'function' || typeof window.updBd !== 'function') return;
    ensureStyle();
    const legacySelFd = window.selFd;
    const legacyUpdBd = window.updBd;
    const legacyAddM = window.addM;

    window.selFd = function (index) {
      activeUnits.set(Number(index), defaultUnitId(index));
      const result = legacySelFd.apply(this, arguments);
      renderSwitch(index);
      renderChoices(index);
      return result;
    };

    window.updBd = function (inputAmount) {
      if (typeof selIdx === 'undefined' || selIdx < 0 || units(selIdx).length <= 1) {
        return legacyUpdBd.apply(this, arguments);
      }
      const basisAmount = toBasisAmount(selIdx, inputAmount, activeUnitId(selIdx));
      const result = legacyUpdBd.call(this, basisAmount);
      updatePreviewLabel(selIdx, inputAmount);
      return result;
    };

    if (typeof legacyAddM === 'function') {
      window.addM = function () {
        if (typeof selIdx !== 'undefined' && selIdx >= 0 && units(selIdx).length > 1) {
          const meta = api()?.get(selIdx);
          const nameInput = document.getElementById('m-name');
          const basisAmount = currentBasisAmount(selIdx);
          const inputAmount = fromBasisAmount(selIdx, basisAmount, activeUnitId(selIdx));
          if (meta && nameInput && nameInput.value === meta.name) {
            nameInput.value = `${meta.name}(${formatInput(selIdx, inputAmount, activeUnitId(selIdx))})`;
          }
        }
        return legacyAddM.apply(this, arguments);
      };
    }
  }

  function install() {
    const dbv3 = api();
    if (!dbv3) return;
    dbv3.items.forEach(meta => { meta.input.units = buildUnits(meta); });
    const extension = {
      version: VERSION,
      getUnits: units,
      activeUnitId,
      toBasisAmount,
      fromBasisAmount,
      convert,
      scaleInput,
      buildRecordInput,
      formatInput,
      choices
    };
    window.__PFC_DB_V3_MULTIUNIT__ = extension;
    installUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-database-v3-search.js ===== */
// PFC Mirror Database V3 Phase C2: canonical search ranking and deduplication.
(() => {
  'use strict';

  const VERSION = '3.7.0';

  const CATEGORY_QUERY = {
    '米': { categories: ['staples'], nameHints: ['米','ご飯','ごはん','ライス'], prefer: ['白米','玄米','雑穀米','麦ご飯','パックご飯'] },
    'こめ': { categories: ['staples'], nameHints: ['米','ご飯','ごはん','ライス'], prefer: ['白米','玄米','雑穀米','麦ご飯','パックご飯'] },
    'ごはん': { categories: ['staples'], nameHints: ['米','ご飯','ごはん','ライス'], prefer: ['白米','玄米','雑穀米','麦ご飯','パックご飯'] },
    'パン': { categories: ['staples'], nameHints: ['パン','ベーグル','クロワッサン','マフィン','トースト'], prefer: ['食パン(6枚切)','食パン(8枚切)','ロールパン','ベーグル'] },
    'ぱん': { categories: ['staples'], nameHints: ['パン','ベーグル','クロワッサン','マフィン','トースト'], prefer: ['食パン(6枚切)','食パン(8枚切)','ロールパン','ベーグル'] },
    '麺': { categories: ['staples'], nameHints: ['麺','うどん','そば','そうめん','パスタ','スパゲッティ','ラーメン'], prefer: ['うどん(1玉)','そば(1玉)','パスタ(ゆで)','中華麺'] },
    'めん': { categories: ['staples'], nameHints: ['麺','うどん','そば','そうめん','パスタ','スパゲッティ','ラーメン'], prefer: ['うどん(1玉)','そば(1玉)','パスタ(ゆで)','中華麺'] },
    '肉': { categories: ['meat'], prefer: ['鶏むね(皮なし)','鶏もも(皮なし)','鶏ささみ','豚ヒレ','豚ロース(脂身無)','牛モモ(赤身)'] },
    'にく': { categories: ['meat'], prefer: ['鶏むね(皮なし)','鶏もも(皮なし)','鶏ささみ','豚ヒレ','豚ロース(脂身無)','牛モモ(赤身)'] },
    '鶏肉': { categories: ['meat'], nameHints: ['鶏','チキン'], prefer: ['鶏むね(皮なし)','鶏もも(皮なし)','鶏ささみ','鶏手羽元(皮つき)'] },
    'とりにく': { categories: ['meat'], nameHints: ['鶏','チキン'], prefer: ['鶏むね(皮なし)','鶏もも(皮なし)','鶏ささみ','鶏手羽元(皮つき)'] },
    '豚肉': { categories: ['meat'], nameHints: ['豚','ポーク'], prefer: ['豚ヒレ','豚ロース(脂身無)','豚肩ロース(脂身つき)','豚モモ(脂身無)'] },
    'ぶたにく': { categories: ['meat'], nameHints: ['豚','ポーク'], prefer: ['豚ヒレ','豚ロース(脂身無)','豚肩ロース(脂身つき)','豚モモ(脂身無)'] },
    '牛肉': { categories: ['meat'], nameHints: ['牛','ビーフ'], prefer: ['牛モモ(赤身)','牛ヒレ(赤身)','牛カタ(赤身)','牛サーロイン'] },
    'ぎゅうにく': { categories: ['meat'], nameHints: ['牛','ビーフ'], prefer: ['牛モモ(赤身)','牛ヒレ(赤身)','牛カタ(赤身)','牛サーロイン'] },
    '魚': { categories: ['seafood'], prefer: ['鮭(焼き)','サバ(生)','アジ(生)','まだら(生)','マグロ(赤身)'] },
    'さかな': { categories: ['seafood'], prefer: ['鮭(焼き)','サバ(生)','アジ(生)','まだら(生)','マグロ(赤身)'] },
    '野菜': { categories: ['vegetables'], prefer: ['ブロッコリー','キャベツ','トマト','ほうれん草','小松菜','白菜','ピーマン'] },
    'やさい': { categories: ['vegetables'], prefer: ['ブロッコリー','キャベツ','トマト','ほうれん草','小松菜','白菜','ピーマン'] },
    '果物': { categories: ['fruit'], prefer: ['バナナ','りんご','みかん','キウイ','ブルーベリー(生)','マンゴー(生)'] },
    'くだもの': { categories: ['fruit'], prefer: ['バナナ','りんご','みかん','キウイ','ブルーベリー(生)','マンゴー(生)'] },
    'フルーツ': { categories: ['fruit'], prefer: ['バナナ','りんご','みかん','キウイ','ブルーベリー(生)','マンゴー(生)'] },
    '卵': { categories: ['eggs-dairy-soy'], nameHints: ['卵','玉子','たまご'], prefer: ['全卵(M)','全卵(L)','ゆで卵','卵白'] },
    'たまご': { categories: ['eggs-dairy-soy'], nameHints: ['卵','玉子','たまご'], prefer: ['全卵(M)','全卵(L)','ゆで卵','卵白'] },
    '酒': { categories: ['alcohol'] },
    'お酒': { categories: ['alcohol'] },
    '飲み物': { categories: ['beverages','alcohol'] },
    'のみもの': { categories: ['beverages','alcohol'] }
  };

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(value) {
    return normalize(value).replace(/[()（）\[\]【】\-_/\s]/g, '');
  }

  function baseName(value) {
    return normalize(value).replace(/[（(].*?[)）]/g, '').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function queryRule(rawQuery) {
    const raw = String(rawQuery ?? '').normalize('NFKC').trim();
    return CATEGORY_QUERY[raw] || CATEGORY_QUERY[normalize(raw)] || null;
  }

  function sourcePriority(meta) {
    const kind = meta?.source?.kind || '';
    if (kind === 'mext' || kind === 'manufacturer' || kind === 'restaurant') return 40;
    if (kind === 'mirror-curated') return 20;
    return 0;
  }

  function canonicalItems() {
    const dbv3 = window.__PFC_DB_V3__;
    if (!dbv3?.items || typeof DB === 'undefined') return [];
    const groups = new Map();
    dbv3.items.forEach(meta => {
      const key = normalize(meta.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(meta);
    });

    return [...groups.values()].map(group => {
      return group.slice().sort((a, b) => {
        const sourceDiff = sourcePriority(b) - sourcePriority(a);
        if (sourceDiff) return sourceDiff;
        const aDuplicate = a.duplicateOf ? 1 : 0;
        const bDuplicate = b.duplicateOf ? 1 : 0;
        if (aDuplicate !== bDuplicate) return aDuplicate - bDuplicate;
        return a.runtimeIndex - b.runtimeIndex;
      })[0];
    });
  }

  function preferenceScore(rule, meta) {
    if (!rule) return 0;
    const prefer = rule.prefer || [];
    const index = prefer.indexOf(meta.name);
    if (index >= 0) return Math.max(40, 360 - index * 45);
    return 0;
  }

  function categoryScore(rule, meta) {
    if (!rule || !(rule.categories || []).includes(meta.category)) return 0;
    if (rule.nameHints?.length) {
      const haystack = `${meta.name} ${(meta.aliases || []).join(' ')}`;
      if (!rule.nameHints.some(hint => haystack.includes(hint))) return 0;
    }
    return 900 + preferenceScore(rule, meta) + sourcePriority(meta);
  }

  function scoreMeta(meta, rawQuery) {
    const query = normalize(rawQuery);
    const qCompact = compact(rawQuery);
    const qBase = baseName(rawQuery);
    if (!qCompact) return 0;
    const rule = queryRule(rawQuery);

    // Broad food words are category queries only. This prevents e.g. `米` from ranking `米みそ`.
    if (rule) return categoryScore(rule, meta);

    const nName = normalize(meta.name);
    const cName = compact(meta.name);
    const bName = baseName(meta.name);
    let score = 0;

    if (nName === query || cName === qCompact) score = 5200;
    else if (bName === qBase && qBase.length >= 1) score = 4700;
    else if (nName.startsWith(query) || cName.startsWith(qCompact)) score = 3000;
    else if (qCompact.length >= 2 && (nName.includes(query) || cName.includes(qCompact))) score = 2200;

    for (const alias of meta.aliases || []) {
      const a = normalize(alias);
      const ac = compact(alias);
      if (a === query || ac === qCompact) score = Math.max(score, 4100);
      else if (qCompact.length >= 2 && (a.startsWith(query) || ac.startsWith(qCompact))) score = Math.max(score, 2600);
      else if (qCompact.length >= 2 && (a.includes(query) || ac.includes(qCompact))) score = Math.max(score, 1700);
    }

    // Generic tags never act like a strong synonym. They are consumed only by CATEGORY_QUERY above.
    return score ? score + sourcePriority(meta) : 0;
  }

  function myFoodMatches(rawQuery) {
    if (typeof myFoods === 'undefined' || !Array.isArray(myFoods)) return [];
    const query = normalize(rawQuery);
    const qCompact = compact(rawQuery);
    if (!qCompact) return [];
    return myFoods.map((item, index) => {
      const name = String(item?.N || item?.name || '');
      const n = normalize(name);
      const c = compact(name);
      let score = 0;
      if (n === query || c === qCompact) score = 5600;
      else if (n.startsWith(query) || c.startsWith(qCompact)) score = 3200;
      else if (qCompact.length >= 2 && (n.includes(query) || c.includes(qCompact))) score = 2300;
      if (score && item?.Fav) score += 80;
      if (score) score += Math.min(60, Number(item?.useCount || 0) * 3);
      return score ? { source: 'my', index, item, name, score } : null;
    }).filter(Boolean);
  }

  function search(rawQuery, limit = 12) {
    const rule = queryRule(rawQuery);
    const dbResults = canonicalItems()
      .map(meta => {
        const score = scoreMeta(meta, rawQuery);
        return score ? {
          source: 'db',
          index: meta.runtimeIndex,
          item: DB[meta.runtimeIndex],
          meta,
          name: meta.name,
          score
        } : null;
      })
      .filter(Boolean);

    const personal = rule ? [] : myFoodMatches(rawQuery);
    return [...personal, ...dbResults]
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'ja'))
      .slice(0, Math.max(1, Number(limit) || 12));
  }

  function resultMeta(result) {
    if (result.source === 'my') {
      const x = result.item || {};
      return `My食品 · ${Math.round(Number(x.Cal || 0))} kcal`;
    }
    const meta = result.meta || window.__PFC_DB_V3__?.get?.(result.index);
    const row = result.item || [];
    const category = String(row[0] || '').trim();
    const unit = meta?.input?.defaultUnit || row[3] || '1食';
    const defaultAmount = meta?.input?.defaultAmount;
    const amountText = meta && Number(defaultAmount) > 0 && window.__PFC_DB_V3__?.formatAmount
      ? window.__PFC_DB_V3__.formatAmount(meta, defaultAmount)
      : String(unit);
    const kcal = meta && window.__PFC_DB_V3__?.scale
      ? window.__PFC_DB_V3__.scale(result.index, Number(defaultAmount || meta.nutritionBasis.amount))?.kcal
      : Math.round(Number(row[7] || 0));
    return `${category} · ${amountText} · ${Math.round(Number(kcal || 0))} kcal`;
  }

  function clearSearch() {
    const input = document.getElementById('s-inp');
    const result = document.getElementById('s-res');
    if (input) input.value = '';
    if (result) {
      result.innerHTML = '';
      result.style.display = 'none';
    }
    document.querySelector('.pfc-search-clear')?.classList.remove('show');
  }

  function filterF() {
    const input = document.getElementById('s-inp');
    const box = document.getElementById('s-res');
    if (!input || !box) return;
    const query = input.value.trim();
    box.innerHTML = '';
    document.querySelector('.pfc-search-clear')?.classList.toggle('show', !!query);
    if (!query) {
      box.style.display = 'none';
      return;
    }

    const results = search(query, 12);
    box.style.display = 'block';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 's-item pfc-search-empty';
      empty.innerHTML = `<strong>「${escapeHtml(query)}」は見つかりませんでした</strong><small>別の名前で検索するか、My食品に登録できます</small>`;
      box.appendChild(empty);
      return;
    }

    results.forEach((result, order) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 's-item pfc-search-result';
      row.dataset.searchOrder = String(order);
      row.innerHTML = `<span class="pfc-search-main"><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(resultMeta(result))}</small></span><span class="pfc-search-arrow">›</span>`;
      row.onclick = () => {
        if (result.source === 'my' && typeof selMyFd === 'function') selMyFd(result.index);
        else if (result.source === 'db' && typeof selFd === 'function') selFd(result.index);
        clearSearch();
      };
      box.appendChild(row);
    });
  }

  function install() {
    if (!window.__PFC_DB_V3__ || !window.__PFC_SEARCH_V21__) return;
    window.filterF = filterF;
    window.__PFC_SEARCH_V21__.search = search;
    window.__PFC_SEARCH_V21__.rebuildV3 = () => true;
    window.__PFC_DB_V3_SEARCH__ = {
      version: VERSION,
      search,
      canonicalCount: () => canonicalItems().length,
      duplicateCount: () => window.__PFC_DB_V3__.items.length - canonicalItems().length,
      categoryQueries: Object.keys(CATEGORY_QUERY)
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

;

/* ===== pfc-food-master-runtime.js ===== */
// PFC Mirror Food Master Runtime: local-first, background-update infrastructure.
(() => {
  'use strict';

  const VERSION = '1.0.0';
  const BUILD_FINGERPRINT = '54e2ba1d95889563cafe3dcae2073754';
  const MANIFEST_URL = 'food-master-manifest.json';
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const STORAGE_PREFIX = 'pfc-mirror:food-master:';
  const KEYS = {
    applied: `${STORAGE_PREFIX}applied`,
    pending: `${STORAGE_PREFIX}pending`,
    checkedAt: `${STORAGE_PREFIX}checked-at`
  };

  const tasks = new Map();
  let taskSequence = 0;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function now() { return Date.now(); }

  const initialPending = readStorage(KEYS.pending) || '';
  if (initialPending && initialPending === BUILD_FINGERPRINT) removeStorage(KEYS.pending);
  writeStorage(KEYS.applied, BUILD_FINGERPRINT);

  const state = {
    status: initialPending && initialPending !== BUILD_FINGERPRINT ? 'update-ready' : 'ready',
    activeFingerprint: BUILD_FINGERPRINT,
    pendingFingerprint: initialPending && initialPending !== BUILD_FINGERPRINT ? initialPending : '',
    lastCheckedAt: Number(readStorage(KEYS.checkedAt) || 0),
    lastError: '',
    lastManifest: null
  };

  function snapshotState() {
    return {
      status: state.status,
      activeFingerprint: state.activeFingerprint,
      pendingFingerprint: state.pendingFingerprint,
      lastCheckedAt: state.lastCheckedAt,
      lastError: state.lastError,
      lastManifest: state.lastManifest
    };
  }

  function emitState() {
    try {
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('pfc:food-master-state', { detail: snapshotState() }));
      }
    } catch (_) {}
  }

  function setState(patch) {
    Object.assign(state, patch || {});
    emitState();
  }

  function trimTasks() {
    if (tasks.size <= 30) return;
    const ordered = [...tasks.values()].sort((a, b) => a.createdAt - b.createdAt);
    ordered.slice(0, Math.max(0, ordered.length - 20)).forEach(task => tasks.delete(task.id));
  }

  function taskSnapshot(task) {
    if (!task) return null;
    return {
      id: task.id,
      label: task.label,
      status: task.status,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt || 0,
      error: task.error || '',
      result: task.result
    };
  }

  // Returns immediately. The executor starts in a microtask so callers can finish UI work first.
  function defer(label, executor, hooks = {}) {
    if (typeof executor !== 'function') throw new TypeError('Food Master deferred executor must be a function');
    const task = {
      id: `fm-${now()}-${++taskSequence}`,
      label: String(label || 'background-task'),
      status: 'pending',
      createdAt: now(),
      result: undefined,
      error: ''
    };
    tasks.set(task.id, task);
    trimTasks();

    Promise.resolve().then(executor).then(result => {
      task.status = 'confirmed';
      task.result = result;
      task.finishedAt = now();
      try { hooks.onConfirmed?.(result, taskSnapshot(task)); } catch (_) {}
    }).catch(error => {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error || 'unknown error');
      task.finishedAt = now();
      try { hooks.onFailed?.(error, taskSnapshot(task)); } catch (_) {}
    });

    return taskSnapshot(task);
  }

  function getTask(id) {
    return taskSnapshot(tasks.get(String(id)));
  }

  function listTasks() {
    return [...tasks.values()].map(taskSnapshot);
  }

  async function sha256Hex(buffer) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return '';
    const digest = await subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function absoluteUrl(relative) {
    try { return new URL(String(relative || ''), window.location?.href || '').href; }
    catch (_) { return String(relative || ''); }
  }

  async function fetchManifest() {
    const separator = MANIFEST_URL.includes('?') ? '&' : '?';
    const url = absoluteUrl(`${MANIFEST_URL}${separator}ts=${now()}`);
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    if (!response?.ok) throw new Error(`Food Master manifest HTTP ${response?.status || 0}`);
    const manifest = await response.json();
    if (!manifest || manifest.schemaVersion !== 1 || !manifest.fingerprint || !Array.isArray(manifest.assets)) {
      throw new Error('Food Master manifest is invalid');
    }
    return manifest;
  }

  async function stageAsset(asset) {
    if (!asset?.url) throw new Error('Food Master asset URL is missing');
    const response = await fetch(absoluteUrl(asset.url), { cache: 'reload', credentials: 'same-origin' });
    if (!response?.ok) throw new Error(`Food Master asset HTTP ${response?.status || 0}: ${asset.url}`);
    const bytes = await response.arrayBuffer();
    if (asset.sha256) {
      const actual = await sha256Hex(bytes);
      if (actual && actual !== asset.sha256) throw new Error(`Food Master asset hash mismatch: ${asset.url}`);
    }
    return asset.url;
  }

  async function stageManifest(manifest) {
    // Do not hot-swap DB arrays in the middle of a session. Prime browser cache only.
    await Promise.all(manifest.assets.map(stageAsset));
    writeStorage(KEYS.pending, manifest.fingerprint);
    setState({
      status: 'update-ready',
      pendingFingerprint: manifest.fingerprint,
      lastManifest: manifest,
      lastError: ''
    });
    return manifest.fingerprint;
  }

  async function checkNow(options = {}) {
    const force = !!options.force;
    if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) return snapshotState();
    const last = Number(readStorage(KEYS.checkedAt) || state.lastCheckedAt || 0);
    if (!force && last && now() - last < CHECK_INTERVAL_MS) return snapshotState();

    setState({ status: 'checking', lastError: '' });
    try {
      const manifest = await fetchManifest();
      const checkedAt = now();
      writeStorage(KEYS.checkedAt, checkedAt);
      state.lastCheckedAt = checkedAt;
      state.lastManifest = manifest;

      if (manifest.fingerprint === BUILD_FINGERPRINT) {
        removeStorage(KEYS.pending);
        setState({
          status: 'ready',
          pendingFingerprint: '',
          lastCheckedAt: checkedAt,
          lastManifest: manifest,
          lastError: ''
        });
        return snapshotState();
      }

      setState({ status: 'staging', lastCheckedAt: checkedAt, lastManifest: manifest });
      await stageManifest(manifest);
      return snapshotState();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown error');
      // Network/update failure never blocks the already-loaded local Food Master.
      setState({ status: state.pendingFingerprint ? 'update-ready' : 'ready', lastError: message });
      return snapshotState();
    }
  }

  function scheduleCheck() {
    const run = () => defer('food-master-update-check', () => checkNow({ force: false }));
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2500 });
    } else if (typeof setTimeout === 'function') {
      setTimeout(run, 800);
    }
  }

  const api = {
    version: VERSION,
    localFirst: true,
    hotSwapDuringSession: false,
    get state() { return snapshotState(); },
    checkNow,
    scheduleCheck,
    defer,
    getTask,
    listTasks,
    manifestUrl: MANIFEST_URL
  };

  window.__PFC_FOOD_MASTER_RUNTIME__ = api;
  scheduleCheck();
})();

;

/* ===== pfc-input-v25.js ===== */
// PFC Mirror V2.5: compact non-voice input polish.
(() => {
  'use strict';

  const VERSION = '2.5.1';

  const fmt = value => {
    const n = Math.round(Number(value || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  function v3Meta(item) {
    return item?.source === 'db' ? window.__PFC_DB_V3__?.get?.(item.i) || null : null;
  }

  function getItemStep(item, amount) {
    const meta = v3Meta(item);
    if (meta) {
      if (Number(meta.nutritionBasis?.amount) > 0 && Number(meta.nutritionBasis.amount) < 1 && ['count','package'].includes(meta.input?.type)) {
        return Number(meta.nutritionBasis.amount);
      }
      const value = Number(meta.input?.quickStep);
      if (Number.isFinite(value) && value > 0) return value;
    }
    const unit = typeof getFavoriteUnit === 'function' ? String(getFavoriteUnit(item) || '') : '';
    if (unit === 'g' || /ml/i.test(unit)) return 50;
    return Number(amount) <= 1 ? 0.5 : 1;
  }

  function getItemMin(item) {
    const meta = v3Meta(item);
    const value = Number(meta?.input?.quickMin);
    if (Number.isFinite(value) && value > 0) return value;
    const unit = typeof getFavoriteUnit === 'function' ? String(getFavoriteUnit(item) || '') : '';
    if (unit === 'g' || /ml/i.test(unit)) return 50;
    return 0.5;
  }

  function formatItemAmount(item, amount) {
    const meta = v3Meta(item);
    if (meta && window.__PFC_DB_V3__?.formatAmount) return window.__PFC_DB_V3__.formatAmount(meta, amount);
    const unit = typeof getFavoriteUnit === 'function' ? String(getFavoriteUnit(item) || '') : '';
    return `${fmt(amount)}${unit}`;
  }

  function rerenderFavorites() {
    const list = document.getElementById('f-list');
    if (list) list.dataset.cat = '';
    const favBtn = document.querySelector('.fav-cat-btn');
    if (favBtn && typeof shwList === 'function') shwList('⭐', favBtn);
  }

  function adjustFavorite(item, delta) {
    if (!item || typeof getFavoriteAmount !== 'function' || typeof getFavoriteSetting !== 'function') return;
    const current = Number(getFavoriteAmount(item)) || 1;
    const next = Math.max(getItemMin(item), current + delta);
    const setting = getFavoriteSetting(item.source, item.i);
    setting.amount = Math.round(next * 100) / 100;
    if (typeof saveFavoriteSettings === 'function') saveFavoriteSettings();
    rerenderFavorites();
  }

  function decorateQuickCards() {
    const manual = document.getElementById('manual-inp-sec');
    if (!manual?.classList.contains('quick-favorite-mode')) return;
    if (typeof getAllFavoriteItems !== 'function') return;

    const items = getAllFavoriteItems();
    const rows = Array.from(document.querySelectorAll('#f-list .favorite-quick-row'));
    rows.forEach((row, index) => {
      const item = items[index];
      if (!item || row.querySelector('.v25-stepper')) return;

      const amount = Number(getFavoriteAmount(item)) || 1;
      const step = getItemStep(item, amount);

      const oldAmount = row.querySelector('.favorite-chip-main em');
      if (oldAmount) oldAmount.classList.add('v25-old-amount');

      const stepper = document.createElement('div');
      stepper.className = 'v25-stepper';
      stepper.innerHTML = `
        <button type="button" class="v25-step v25-minus" aria-label="量を減らす">−</button>
        <button type="button" class="v25-amount" aria-label="この量で記録">${formatItemAmount(item, amount)}</button>
        <button type="button" class="v25-step v25-plus" aria-label="量を増やす">＋</button>`;

      const minus = stepper.querySelector('.v25-minus');
      const center = stepper.querySelector('.v25-amount');
      const plus = stepper.querySelector('.v25-plus');

      minus.onclick = event => {
        event.stopPropagation();
        adjustFavorite(item, -step);
      };
      plus.onclick = event => {
        event.stopPropagation();
        adjustFavorite(item, step);
      };
      center.onclick = event => {
        event.stopPropagation();
        if (typeof addFavoriteQuick === 'function') addFavoriteQuick(item.source, item.i);
      };

      row.appendChild(stepper);
    });
  }

  function installQuickDecorator() {
    if (typeof shwList !== 'function') return;
    const original = shwList;
    window.shwList = function (...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(decorateQuickCards);
      return result;
    };
    requestAnimationFrame(decorateQuickCards);
  }

  function normalizeTypedUnit(value) {
    const raw = String(value || '').normalize('NFKC').toLowerCase();
    const map = {
      'グラム':'g', 'ｇ':'g', 'g':'g', 'ml':'ml', 'ｍｌ':'ml',
      '個':'個', '本':'本', '枚':'枚', '杯':'杯', 'パック':'パック', 'p':'パック',
      '粒':'粒', '切':'切', '切れ':'切れ', '玉':'玉', '束':'束', '缶':'缶', '袋':'袋',
      '皿':'皿', '食':'食', '箱':'箱', '尾':'尾', '貫':'貫', '合':'合', '個分':'個分',
      '大さじ':'大さじ', '小さじ':'小さじ', 'スクープ':'スクープ', 'ピース':'ピース'
    };
    return map[raw] || raw;
  }

  function parseCommand(raw) {
    const value = String(raw || '').normalize('NFKC').trim();
    const match = value.match(/^(.+?)[\s　]*([0-9]+(?:\.[0-9]+)?)[\s　]*(g|グラム|ml|mL|個分|個|本|枚|杯|パック|P|粒|切れ|切|玉|束|缶|袋|皿|食|箱|尾|貫|合|大さじ|小さじ|スクープ|ピース)?$/i);
    if (!match) return null;
    const food = match[1].trim();
    const amount = Number(match[2]);
    if (!food || !Number.isFinite(amount) || amount <= 0) return null;
    return { food, amount, typedUnit: normalizeTypedUnit(match[3] || '') };
  }

  function commandUnitMatches(index, typedUnit) {
    if (!typedUnit) return true;
    const meta = window.__PFC_DB_V3__?.get?.(index);
    if (!meta) return true;
    return normalizeTypedUnit(meta.input?.defaultUnit) === typedUnit;
  }

  function recordCommand(result, amount) {
    if (!result || result.source !== 'db' || typeof buildFavoriteLogItem !== 'function') return;
    const item = { source: 'db', i: result.index, name: result.name, isMy: false };
    const record = buildFavoriteLogItem(item, amount);
    if (!record || !Array.isArray(window.lst || (typeof lst !== 'undefined' ? lst : null))) return;

    if (typeof isCheatDay !== 'undefined' && isCheatDay && typeof recordOnCheatDay !== 'undefined' && !recordOnCheatDay) {
      if (typeof showToast === 'function') showToast('チートデイ設定により記録をスキップしました');
      return;
    }

    lst.push(record);
    if (typeof sv === 'function') sv();
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
    const input = document.getElementById('s-inp');
    const box = document.getElementById('s-res');
    if (input) input.value = '';
    if (box) { box.innerHTML = ''; box.style.display = 'none'; }
    if (typeof showToast === 'function') showToast(`${record.N}を追加しました`);
  }

  function prependCommandCandidate() {
    const input = document.getElementById('s-inp');
    const box = document.getElementById('s-res');
    if (!input || !box) return;
    const command = parseCommand(input.value);
    if (!command || !window.__PFC_SEARCH_V21__?.search) return;

    const hit = window.__PFC_SEARCH_V21__.search(command.food, 3)
      .find(result => result?.source === 'db' && commandUnitMatches(result.index, command.typedUnit));
    if (!hit) return;

    const row = typeof DB !== 'undefined' ? DB[hit.index] : null;
    if (!row) return;
    const meta = window.__PFC_DB_V3__?.get?.(hit.index);
    const amountLabel = meta && window.__PFC_DB_V3__?.formatAmount
      ? window.__PFC_DB_V3__.formatAmount(meta, command.amount)
      : `${fmt(command.amount)}${typeof getFavoriteUnit === 'function' ? getFavoriteUnit({ source: 'db', i: hit.index }) : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v25-command-hit pfc-search-result';
    button.innerHTML = `<span><strong>${hit.name}</strong><small>${amountLabel}で直接記録</small></span><b>追加</b>`;
    button.onclick = () => recordCommand(hit, command.amount);

    const previous = box.querySelector('.v25-command-hit');
    if (previous) previous.remove();
    box.insertBefore(button, box.firstChild);
    box.style.display = 'block';
  }

  function installCommandSearch() {
    if (typeof filterF !== 'function') return;
    const original = filterF;
    window.filterF = function (...args) {
      const result = original.apply(this, args);
      prependCommandCandidate();
      return result;
    };
  }

  function install() {
    installQuickDecorator();
    installCommandSearch();
    window.__PFC_INPUT_V25__ = {
      version: VERSION,
      visibleSmartPanel: false,
      basket: false,
      mealSets: false,
      quickStepper: true,
      smartCommandSearch: true,
      databaseV3Aware: !!window.__PFC_DB_V3__
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

;

/* ===== pfc-dish-photo-v30.js ===== */
// PFC Mirror V3.8: low-latency Gemini 3.5 Flash-Lite visual identification with user-confirmed quantities.
(() => {
  'use strict';

  const VERSION = '3.8.0';
  const MODEL = 'gemini-3.5-flash-lite';
  const THINKING_LEVEL = 'minimal';
  const MAX_SIDE = 512;
  const JPEG_QUALITY = 0.62;
  const MAX_FOODS = 10;
  const REQUEST_TIMEOUT_MS = 15000;
  const MIN_REQUEST_INTERVAL_MS = 5000;
  const RATE_LIMIT_RETRY_MS = 8000;
  const COUNT_UNITS = /^(個|切れ|枚|本|玉|杯|粒|袋|パック|カップ|缶|食)$/;
  const CUT_STYLE_WORDS = ['千切り','細切り','薄切り','輪切り','角切り','短冊切り','拍子木切り','みじん切り','花形','飾り切り'];
  let busy = false;
  let requestQueue = Promise.resolve();
  let nextRequestAt = 0;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
  const baseName = value => norm(value).replace(/[（(].*?[)）]/g, '');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function cleanVisualFoodName(value) {
    const original = String(value || '').trim();
    let cleaned = original;
    for (const word of CUT_STYLE_WORDS) {
      cleaned = cleaned.replace(new RegExp('^' + word + '[の・\\s]*'), '');
      cleaned = cleaned.replace(new RegExp('[の・\\s]*' + word + '$'), '');
    }
    return cleaned.trim() || original;
  }

  function parseVisibleCount(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1 && n <= 30 ? n : null;
  }

  function parseAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function parseIdentityResponse(raw) {
    const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    const root = Array.isArray(data) && data.length === 1 && data[0] && Array.isArray(data[0].foods) ? data[0] : data;
    const source = Array.isArray(root) ? root : root?.foods;
    if (!Array.isArray(source)) return null;
    const seen = new Map();
    const foods = [];
    for (const item of source) {
      const object = typeof item === 'object' && item ? item : {};
      const rawName = String(typeof item === 'string' ? item : object.name || '').trim();
      const name = cleanVisualFoodName(rawName);
      if (!name || name.length > 40) continue;
      const key = norm(name);
      const parsed = {
        name,
        confidence: Math.max(0, Math.min(1, num(typeof item === 'string' ? 0 : object.confidence))),
        visibleCount: parseVisibleCount(object.visibleCount),
        ambiguity: String(object.ambiguity || '').trim().slice(0, 100),
        note: String(object.note || (rawName !== name ? `見た目表記: ${rawName}` : '')).trim().slice(0, 100),
        rawCountCertain: object.countCertain === true,
        rawVariantVisible: object.variantVisible === true
      };
      if (seen.has(key)) {
        const existing = seen.get(key);
        existing.confidence = Math.max(existing.confidence, parsed.confidence);
        if (!existing.visibleCount && parsed.visibleCount) existing.visibleCount = parsed.visibleCount;
        if (!existing.ambiguity && parsed.ambiguity) existing.ambiguity = parsed.ambiguity;
        if (!existing.note && parsed.note) existing.note = parsed.note;
        existing.rawCountCertain = existing.rawCountCertain || parsed.rawCountCertain;
        existing.rawVariantVisible = existing.rawVariantVisible || parsed.rawVariantVisible;
        continue;
      }
      seen.set(key, parsed);
      foods.push(parsed);
      if (foods.length >= MAX_FOODS) break;
    }
    return {
      foods,
      dishName: String(root?.dishName || '').slice(0,80),
      uncertain: !!root?.uncertain
    };
  }

  function parentheticalDetail(value) {
    const m = String(value || '').match(/[（(]([^()（）]+)[)）]/);
    return m ? norm(m[1]) : '';
  }

  function isUnsafeSpecificMatch(ai, result) {
    if (!ai || !result) return true;
    const fold = value => norm(value)
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･]/g, '');
    const candidate = String(result.name || result.meta?.name || '');
    const q = fold(ai.name);
    const c = fold(candidate);
    if (!q || !c) return true;
    if (q === c) return false;

    // A strict containment difference means one name is more specific than the other.
    // Never infer hidden fillings, flavors, cuts, brands or variants from a photo query.
    if (c.includes(q) || q.includes(c)) return true;

    // The only non-identical automatic match allowed is a curated exact alias.
    const aliases = Array.isArray(result.meta?.aliases) ? result.meta.aliases : [];
    if (aliases.some(alias => fold(alias) === q)) return false;

    // All remaining prefix/substring/fuzzy search results require user confirmation.
    return true;
  }

  function searchHits(ai, minScore = 2000) {
    const search = window.__PFC_DB_V3_SEARCH__?.search;
    if (typeof search !== 'function' || !ai?.name) return [];
    return search(ai.name, 8).filter(x => x?.source === 'db' && Number(x.score || 0) >= minScore);
  }

  function resolveFood(ai) {
    return searchHits(ai).find(hit => !isUnsafeSpecificMatch(ai, hit)) || null;
  }

  function resolveFoods(identity) {
    return (identity?.foods || []).map(ai => {
      const match = resolveFood(ai);
      if (!match) return { ai, match:null, reason:'no-safe-match', amount:null, countSuggestion:null };
      const meta = match.meta || window.__PFC_DB_V3__?.get?.(match.index);
      if (!meta) return { ai, match:null, reason:'no-meta', amount:null, countSuggestion:null };
      const unit = String(meta.input?.defaultUnit || meta.nutritionBasis?.unit || '');
      const countSuggestion = ai.visibleCount && COUNT_UNITS.test(unit) ? ai.visibleCount : null;
      return { ai, match, meta, unit, amount:null, countSuggestion, countApplied:false };
    });
  }

  function ensureModal() {
    let modal = document.getElementById('pfc-dish-v30-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'pfc-dish-v30-modal';
    modal.className = 'dish-v30-modal';
    modal.innerHTML = '<div class="dish-v30-sheet"><div class="dish-v30-head"><strong id="dish-v30-title">料理写真</strong><button type="button" id="dish-v30-close" aria-label="閉じる">×</button></div><div id="dish-v30-body"></div></div>';
    document.body.appendChild(modal);
    const close = () => modal.classList.remove('show');
    modal.querySelector('#dish-v30-close').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    return modal;
  }

  function modal(title, html) {
    const host = ensureModal();
    host.querySelector('#dish-v30-title').textContent = title;
    host.querySelector('#dish-v30-body').innerHTML = html;
    host.classList.add('show');
    return host;
  }

  function choosePhotoSource() {
    const host = modal('料理写真から追加', `
      <div class="dish-v30-source-grid">
        <button type="button" id="dish-v30-camera"><b>カメラで撮る</b><span>今の食事をその場で撮影</span></button>
        <button type="button" id="dish-v30-library"><b>カメラロールから選ぶ</b><span>保存済みの写真を選択</span></button>
      </div>
      <div class="dish-v30-note">AIは見えている食品を候補化します。種類と量は追加前に確認し、写真だけでP/F/C/kcalを確定しません。</div>`);
    host.querySelector('#dish-v30-camera').onclick = () => { host.classList.remove('show'); selectPhoto('camera'); };
    host.querySelector('#dish-v30-library').onclick = () => { host.classList.remove('show'); selectPhoto('library'); };
  }

  function selectPhoto(source) {
    const id = source === 'camera' ? 'dish-v30-camera-file' : 'dish-v30-library-file';
    let input = document.getElementById(id);
    if (!input) {
      input = document.createElement('input');
      input.id = id;
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.setAttribute('capture', 'environment');
      input.hidden = true;
      document.body.appendChild(input);
      input.onchange = async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await runDishPhoto(file);
      };
    }
    input.click();
  }

  function stripDataUrl(value) { return String(value || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i,''); }

  async function compressImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await new Promise((resolve,reject) => { img.onload=resolve; img.onerror=()=>reject(new Error('画像を開けませんでした')); });
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,width,height);
      return stripDataUrl(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    } finally { URL.revokeObjectURL(url); }
  }

  function endpoint() {
    try { if (typeof gasUrl !== 'undefined' && gasUrl) return gasUrl; } catch {}
    return 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  }

  function identityPrompt() {
    return `あなたは食事写真の視覚的食品抽出器です。画像から直接見える食べ物だけを日本語で抽出し、JSONだけ返してください。
- 弁当・定食・ワンプレートは全体名だけで終わらず、区別できる主食・主菜・卵・野菜・漬物・副菜を個別に拾う。
- 見えない具、味、肉の部位、ソース、調理法を補完しない。具が見えないおにぎりは「おにぎり」とだけ書く。
- 料理名を断定できない場合は安全な一般名にしてambiguityへ候補を書く。
- visibleCountは独立した同一食品の境界を1つずつ確認して数えられる場合だけ整数。同じ個体を二重に数えず、別の副菜や飾りを混ぜない。少しでも曖昧ならnullを優先する。
- 重量、ml、P/F/C、kcal、油量、調味料量は推測しない。
- 食品でない画像はfoods=[]。説明文・Markdownは禁止。
形式: {"dishName":"","uncertain":true,"foods":[{"name":"","visibleCount":null,"ambiguity":"","note":""}]}
最大${MAX_FOODS}食品。`;
  }

  function buildRequestPayload(base64) {
    return {
      taskType:'image',
      modelPreference:MODEL,
      contents:[{parts:[{text:identityPrompt()}]}],
      imageBase64:base64,
      generationConfig:{
        thinkingConfig:{thinkingLevel:THINKING_LEVEL},
        maxOutputTokens:768,
        responseMimeType:'application/json',
        mediaResolution:'MEDIA_RESOLUTION_LOW'
      }
    };
  }

  function extractAiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim();
  }

  function classifyUpstreamText(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    if (!/^GASエラー:/i.test(text) && !/^AI API /i.test(text)) return null;
    const error = new Error(text.slice(0, 420));
    error.retryable = /\b(?:429|500|502|503|504)\b/.test(text);
    error.rateLimited = /\b429\b/.test(text);
    error.upstream = true;
    return error;
  }

  async function requestIdentity(base64) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint(), {
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify(buildRequestPayload(base64)),
        signal:controller.signal
      });
      if (!response.ok) {
        const error = new Error(`画像AI HTTP ${response.status}`);
        error.retryable = [429,500,502,503,504].includes(response.status);
        error.rateLimited = response.status === 429;
        throw error;
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error('GASからJSONではない応答が返りました'); }
      const raw = extractAiText(data);
      const upstreamError = classifyUpstreamText(raw);
      if (upstreamError) throw upstreamError;
      const parsed = parseIdentityResponse(raw);
      if (!parsed) {
        const sample = raw ? raw.replace(/\s+/g,' ').slice(0,220) : '空の応答';
        throw new Error(`Gemini応答を食品JSONとして読めませんでした: ${sample}`);
      }
      return parsed;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Gemini 3.5 Flash-Liteが${Math.round(REQUEST_TIMEOUT_MS/1000)}秒以内に応答しませんでした`);
        timeoutError.retryable = false;
        throw timeoutError;
      }
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function waitForRequestSlot() {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay > 0) await wait(delay);
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  }

  function enqueueIdentity(task) {
    const run = async () => {
      await waitForRequestSlot();
      try {
        return await task();
      } catch (error) {
        // Do not amplify 404/5xx/GAS failures. Only an explicit 429 gets one paced retry.
        if (!error?.rateLimited) throw error;
        await wait(RATE_LIMIT_RETRY_MS);
        nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
        return await task();
      }
    };
    const queued = requestQueue.then(run, run);
    requestQueue = queued.catch(() => {});
    return queued;
  }

  async function identifyDish(base64) {
    return await enqueueIdentity(() => requestIdentity(base64));
  }

  function nutritionPreview(row) {
    const amount = parseAmount(row.amount);
    if (!amount) return '量を入力するとP/F/C/kcalを表示';
    const scaled = window.__PFC_DB_V3__?.scale?.(row.match.index, amount);
    return scaled ? `${scaled.kcal} kcal · P ${scaled.p} / F ${scaled.f} / C ${scaled.c}` : '栄養値を計算できませんでした';
  }

  function aiMetaText(ai, countSuggestion = null) {
    const parts = [`AI認識: ${ai.name}`];
    if (countSuggestion) parts.push(`個数候補 ${countSuggestion}`);
    else if (ai.visibleCount) parts.push(`見た目の個数候補 ${ai.visibleCount}`);
    if (ai.ambiguity) parts.push(`要確認: ${ai.ambiguity}`);
    return parts.join(' · ');
  }

  function dbSearch(query, limit = 18) {
    const search = window.__PFC_DB_V3_SEARCH__?.search;
    if (typeof search !== 'function') return [];
    const q = String(query || '').trim();
    if (!q) return [];
    return search(q, limit).filter(x => x?.source === 'db');
  }

  function applyDbMatch(row, result) {
    const meta = result?.meta || window.__PFC_DB_V3__?.get?.(result?.index);
    if (!result || !meta) return { ...row, match:null, meta:null, unit:'', countSuggestion:null };
    const unit = String(meta.input?.defaultUnit || meta.nutritionBasis?.unit || '');
    const countSuggestion = row?.ai?.visibleCount && COUNT_UNITS.test(unit) ? row.ai.visibleCount : null;
    return { ...row, match:result, meta, unit, countSuggestion, countApplied:false };
  }

  function editorRows(identity) {
    return resolveFoods(identity).map((row, index) => ({ ...row, id:`ai-${index}`, manualDb:false }));
  }

  function editorRowFromDb(result, index = 0) {
    const ai = { name:String(result?.name || ''), visibleCount:null, ambiguity:'', note:'', confidence:0 };
    return applyDbMatch({ ai, match:null, meta:null, unit:'', amount:null, countSuggestion:null, countApplied:false, id:`db-${Date.now()}-${index}`, manualDb:true }, result);
  }

  function dbResultMeta(result) {
    const meta = result?.meta || window.__PFC_DB_V3__?.get?.(result?.index);
    if (!meta) return '';
    const unit = meta.input?.defaultUnit || meta.nutritionBasis?.unit || '';
    const amount = meta.input?.defaultAmount || meta.nutritionBasis?.amount || '';
    const scaled = window.__PFC_DB_V3__?.scale?.(result.index, Number(amount));
    return [unit ? `基準 ${amount}${unit}` : '', scaled ? `${scaled.kcal} kcal` : ''].filter(Boolean).join(' · ');
  }

  function ensureDbPicker() {
    let picker = document.getElementById('dish-v30-db-picker');
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'dish-v30-db-picker';
    picker.className = 'dish-v30-db-picker';
    picker.innerHTML = '<div class="dish-v30-db-sheet"><div class="dish-v30-db-head"><strong>Food Masterから選択</strong><button type="button" id="dish-v30-db-close" aria-label="閉じる">×</button></div><input id="dish-v30-db-query" class="dish-v30-db-query" type="search" placeholder="食品名を検索"><div id="dish-v30-db-results" class="dish-v30-db-results"></div></div>';
    document.body.appendChild(picker);
    const close = () => picker.classList.remove('show');
    picker.querySelector('#dish-v30-db-close').onclick = close;
    picker.addEventListener('click', e => { if (e.target === picker) close(); });
    return picker;
  }

  function openDbPicker(initialQuery, onPick) {
    const picker = ensureDbPicker();
    const input = picker.querySelector('#dish-v30-db-query');
    const resultsHost = picker.querySelector('#dish-v30-db-results');
    const render = () => {
      const results = dbSearch(input.value, 18);
      resultsHost.innerHTML = results.length
        ? results.map((result, i) => `<button type="button" class="dish-v30-db-result" data-db-row="${i}"><b>${esc(result.name)}</b><small>${esc(dbResultMeta(result))}</small></button>`).join('')
        : '<div class="dish-v30-db-empty">食品名を入力してFood Masterを検索してください。</div>';
      resultsHost.querySelectorAll('.dish-v30-db-result').forEach(button => {
        button.onclick = () => {
          const result = results[Number(button.dataset.dbRow)];
          if (!result) return;
          picker.classList.remove('show');
          onPick(result);
        };
      });
    };
    input.value = String(initialQuery || '');
    input.oninput = render;
    render();
    picker.classList.add('show');
    setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 0);
  }

  function showMatches(identity) {
    const state = { rows:editorRows(identity) };
    const renderEditor = () => {
      const cards = state.rows.map((row, i) => {
        const matched = !!row.match;
        const title = matched ? row.match.name : row.ai.name;
        const unit = matched ? (row.unit || row.meta?.input?.defaultUnit || row.meta?.nutritionBasis?.unit || '食') : '';
        const status = matched ? aiMetaText(row.ai,row.countSuggestion) : `AI認識: ${row.ai.name}${row.ai.visibleCount ? ` · 個数候補 ${row.ai.visibleCount}` : ''}${row.ai.ambiguity ? ` · 要確認: ${row.ai.ambiguity}` : ''}`;
        const amountHtml = matched
          ? `<div class="dish-v30-amount"><input class="dish-v30-amount-input" type="number" min="0.1" step="0.1" value="${row.amount || ''}" placeholder="量を入力"><span>${esc(unit)}</span>${row.countSuggestion ? `<button type="button" class="dish-v30-use-count">候補${row.countSuggestion}${esc(unit)}</button>` : ''}</div><div class="dish-v30-pfc">${esc(nutritionPreview(row))}</div>`
          : '<div class="dish-v30-unmatched">Food Masterの食品を選ぶと量とP/F/C/kcalを入力できます。</div>';
        return `<div class="dish-v30-card dish-v30-editor-card${matched ? '' : ' is-unmatched'}" data-row="${i}"><div class="dish-v30-editor-head"><div><b>${esc(title)}</b><small>${esc(status)}</small></div><button type="button" class="dish-v30-delete" aria-label="カードを削除">×</button></div>${amountHtml}<div class="dish-v30-card-actions"><button type="button" class="dish-v30-change-db">${matched ? 'DBから変更' : 'DBから選ぶ'}</button></div></div>`;
      }).join('');
      const badge = identity.dishName ? `<div class="dish-v30-badge">AI判定: ${esc(identity.dishName)}</div>` : '';
      const empty = '<div class="dish-v30-message">食品カードがありません。</div>';
      const host = modal('写真認識を確認', `${badge}<div id="dish-v30-editor">${cards || empty}</div><button type="button" class="dish-v30-secondary" id="dish-v30-add-db">＋ DBから食品を追加</button><div class="dish-v30-note">AIが拾った食品はすべてカードとして残しています。不要なカードは削除し、種類が違うものはDBから変更できます。量を入力したカードだけ記録します。</div><button class="dish-v30-primary" id="dish-v30-add" disabled>量を入力した食品を追加</button>`);
      const addButton = host.querySelector('#dish-v30-add');
      const refreshAddState = () => { addButton.disabled = !state.rows.some(row => row.match && parseAmount(row.amount)); };

      host.querySelectorAll('.dish-v30-editor-card').forEach((card, i) => {
        const row = state.rows[i];
        card.querySelector('.dish-v30-delete').onclick = () => { state.rows.splice(i,1); renderEditor(); };
        card.querySelector('.dish-v30-change-db').onclick = () => {
          openDbPicker(row.match?.name || row.ai?.name || '', result => {
            state.rows[i] = applyDbMatch({ ...row, amount:null }, result);
            renderEditor();
          });
        };
        const input = card.querySelector('.dish-v30-amount-input');
        if (input) input.oninput = () => {
          row.amount = parseAmount(input.value);
          card.querySelector('.dish-v30-pfc').textContent = nutritionPreview(row);
          refreshAddState();
        };
        const useCount = card.querySelector('.dish-v30-use-count');
        if (useCount) useCount.onclick = () => {
          row.amount = row.countSuggestion;
          if (input) input.value = String(row.countSuggestion);
          card.querySelector('.dish-v30-pfc').textContent = nutritionPreview(row);
          refreshAddState();
        };
      });

      host.querySelector('#dish-v30-add-db').onclick = () => {
        openDbPicker('', result => {
          state.rows.push(editorRowFromDb(result,state.rows.length));
          renderEditor();
        });
      };

      addButton.onclick = () => {
        const records = [];
        for (const row of state.rows) {
          const amount = parseAmount(row.amount);
          if (!row.match || !amount) continue;
          const record = window.__PFC_DB_V3__?.buildRecord?.(row.match.index, amount);
          if (!record) continue;
          record._photoAI = {
            version:VERSION,
            identityOnly:true,
            model:MODEL,
            thinkingLevel:THINKING_LEVEL,
            aiName:row.manualDb ? '' : row.ai.name,
            visualConfidence:row.ai.confidence,
            visibleCountSuggestion:row.ai.visibleCount,
            ambiguity:row.ai.ambiguity || '',
            userConfirmedAmount:amount,
            manualDbSelected:!!row.manualDb,
            aiAmountAutoApplied:false,
            aiVariantFlagsTrusted:false
          };
          records.push(record);
        }
        if (!records.length || typeof lst === 'undefined' || !Array.isArray(lst)) return;
        lst.push(...records);
        if (typeof sv === 'function') sv();
        if (typeof ren === 'function') ren();
        if (typeof upd === 'function') upd();
        if (typeof showToast === 'function') showToast(`${records.length}件を確認して追加しました`);
        host.classList.remove('show');
      };
      refreshAddState();
    };
    renderEditor();
  }

  async function runDishPhoto(file) {
    if (busy) return;
    busy = true;
    modal('料理写真を判定中','<div class="dish-v30-loading"><span></span><b>Gemini 3.5 Flash-Liteで食品を確認しています</b></div><div class="dish-v30-note">低遅延設定で処理しています。種類・個数は候補として扱い、量や栄養値を写真だけで確定しません。</div>');
    try {
      const identity = await identifyDish(await compressImage(file));
      if (!identity.foods.length) throw new Error('食べ物として認識できませんでした');
      showMatches(identity);
    } catch (error) {
      const host = modal('判定できませんでした', `<div class="dish-v30-message">${esc(error?.message || '料理写真の判定に失敗しました')}</div><div class="dish-v30-note">エラー内容をそのまま表示しています。再発時はこの画面のスクショで原因を特定できます。</div><button class="dish-v30-primary" id="dish-v30-retry">写真を選び直す</button>`);
      host.querySelector('#dish-v30-retry').onclick = () => { host.classList.remove('show'); choosePhotoSource(); };
    } finally { busy = false; }
  }

  function install() {
    if (document.getElementById('dish-v30-action')) return;
    const input = document.getElementById('s-inp');
    if (!input) return;
    const actions = document.createElement('div');
    actions.id = 'dish-v30-actions';
    actions.className = 'dish-v30-actions';
    actions.innerHTML = '<button type="button" id="dish-v30-action" aria-label="料理写真から食品を追加">料理写真</button>';
    const anchor = input.closest('.search-box') || input.parentElement;
    anchor.insertAdjacentElement('afterend', actions);
    actions.querySelector('#dish-v30-action').onclick = choosePhotoSource;
    document.documentElement.classList.add('pfc-dish-photo-v30');
  }

  window.__PFC_DISH_PHOTO_V30__ = {
    version:VERSION,
    model:MODEL,
    thinkingLevel:THINKING_LEVEL,
    requestTimeoutMs:REQUEST_TIMEOUT_MS,
    imageMaxSide:MAX_SIDE,
    jpegQuality:JPEG_QUALITY,
    identityOnly:true,
    nutritionFromAI:false,
    conservativeVisual:true,
    genericToSpecificBlocked:true,
    strictSpecificityGuard:true,
    visibleCount:true,
    aiAmountAutoApplied:false,
    aiVariantFlagsTrusted:false,
    requiresUserAmount:true,
    editablePhotoCards:true,
    dbPicker:true,
    removablePhotoCards:true,
    latencyOptimized:true,
    structuredJson:true,
    mediaResolution:'MEDIA_RESOLUTION_LOW',
    imageTransportOptimized:true,
    rateLimitQueue:true,
    minRequestIntervalMs:MIN_REQUEST_INTERVAL_MS,
    rateLimitRetryOnly:true,
    rateLimitRetryMs:RATE_LIMIT_RETRY_MS,
    autoRetry:false,
    retryTransient:false,
    cameraRoll:true,
    camera:true,
    parseIdentityResponse,
    cleanVisualFoodName,
    isUnsafeSpecificMatch,
    resolveFood,
    resolveFoods,
    dbSearch,
    applyDbMatch,
    editorRows,
    editorRowFromDb,
    identityPrompt,
    buildRequestPayload,
    extractAiText,
    classifyUpstreamText,
    identifyDish,
    choosePhotoSource,
    selectPhoto,
    install
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
;

/* ===== pfc-dish-photo-v40.js ===== */
// PFC Mirror Dish Photo V4.0: AI-provisional portions + Food Master nutrition, fully editable before commit.
(() => {
  'use strict';

  const VERSION = '4.0.0';
  const MODEL = 'gemini-3.5-flash-lite';
  const THINKING_LEVEL = 'minimal';
  const MAX_SIDE = 512;
  const JPEG_QUALITY = 0.62;
  const MAX_FOODS = 12;
  const REQUEST_TIMEOUT_MS = 15000;
  const MIN_REQUEST_INTERVAL_MS = 5000;
  const RATE_LIMIT_RETRY_MS = 8000;
  const COUNT_UNITS = /^(個|切れ|枚|本|玉|杯|粒|袋|パック|カップ|缶|食)$/;
  const CUT_STYLE_WORDS = ['千切り','細切り','薄切り','輪切り','角切り','短冊切り','拍子木切り','みじん切り','花形','飾り切り'];
  let busy = false;
  let requestQueue = Promise.resolve();
  let nextRequestAt = 0;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function fold(value) {
    return norm(value)
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/[・･]/g, '');
  }

  function cleanVisualFoodName(value) {
    const original = String(value || '').trim();
    let cleaned = original;
    for (const word of CUT_STYLE_WORDS) {
      cleaned = cleaned.replace(new RegExp('^' + word + '[の・\\s]*'), '');
      cleaned = cleaned.replace(new RegExp('[の・\\s]*' + word + '$'), '');
    }
    const key = fold(cleaned);
    if (/^(鶏|鶏肉)?の?(から揚げ|唐揚げ)$/.test(key) || key === 'から揚げ') return '唐揚げ';
    if (key === '玉子焼き') return '卵焼き';
    if (key === 'だし巻き玉子') return 'だし巻き卵';
    return cleaned.trim() || original;
  }

  function parsePositive(value, max = Infinity) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  }

  function parseVisibleCount(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1 && n <= 30 ? n : null;
  }

  function roundEstimate(value, step = 5) {
    const n = parsePositive(value, 5000);
    if (!n) return null;
    return Math.max(step, Math.round(n / step) * step);
  }

  function parseIdentityResponse(raw) {
    const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    const root = Array.isArray(data) && data.length === 1 && data[0] && Array.isArray(data[0].foods) ? data[0] : data;
    const source = Array.isArray(root) ? root : root?.foods;
    if (!Array.isArray(source)) return null;
    const seen = new Map();
    const foods = [];
    for (const item of source) {
      const object = typeof item === 'object' && item ? item : {};
      const rawName = String(typeof item === 'string' ? item : object.name || '').trim();
      const name = cleanVisualFoodName(rawName);
      if (!name || name.length > 40) continue;
      const key = fold(name);
      const confidenceRaw = String(object.portionConfidence || object.estimateConfidence || '').toLowerCase();
      const portionConfidence = ['high','medium','low'].includes(confidenceRaw) ? confidenceRaw : 'low';
      const parsed = {
        name,
        visibleCount: parseVisibleCount(object.visibleCount),
        estimatedWeightG: roundEstimate(object.estimatedWeightG, 5),
        estimatedVolumeMl: roundEstimate(object.estimatedVolumeMl, 10),
        portionConfidence,
        ambiguity: String(object.ambiguity || '').trim().slice(0, 100),
        note: String(object.note || (rawName !== name ? `見た目表記: ${rawName}` : '')).trim().slice(0, 100)
      };
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (!existing.visibleCount && parsed.visibleCount) existing.visibleCount = parsed.visibleCount;
        if (parsed.estimatedWeightG) existing.estimatedWeightG = roundEstimate((existing.estimatedWeightG || 0) + parsed.estimatedWeightG, 5);
        if (parsed.estimatedVolumeMl) existing.estimatedVolumeMl = roundEstimate((existing.estimatedVolumeMl || 0) + parsed.estimatedVolumeMl, 10);
        if (!existing.ambiguity && parsed.ambiguity) existing.ambiguity = parsed.ambiguity;
        if (!existing.note && parsed.note) existing.note = parsed.note;
        continue;
      }
      seen.set(key, parsed);
      foods.push(parsed);
      if (foods.length >= MAX_FOODS) break;
    }
    return { foods, dishName:String(root?.dishName || '').slice(0,80), uncertain:!!root?.uncertain };
  }

  function identityPrompt() {
    return `あなたは食事写真の視覚的食品抽出器です。画像から直接見える食品を、ユーザーが後で修正するための「仮入力」としてJSONだけで返してください。
ルール:
- 弁当・定食・ワンプレートは、主食・主菜・卵・野菜・漬物・副菜を見分けられる範囲で個別に列挙する。
- 同じ食材が切り方や置き場所だけ違う場合は1食品へまとめる。
- 見えない具、味、肉の部位、ソース、ブランドを推測しない。具が見えないおにぎりは必ず「おにぎり」。
- 調理法を断定できない場合は安全な一般名にしてambiguityへ候補を書く。
- visibleCountは独立した同一食品を数えられる場合だけ整数。曖昧ならnull。
- estimatedWeightGは写真から見える可食部の概算重量。断定値ではなく、10〜20%程度ずれてもよい「編集前の仮値」として保守的に推定する。数えられる食品でも可能なら全体重量を推定する。
- 飲料・汁物など重量より容量が自然な場合のみestimatedVolumeMlを使う。
- portionConfidenceはhigh/medium/low。写真の遠近・重なり・容器で量が読みづらければlow。
- P/F/C、kcal、アルコール、油量、調味料量は絶対に出さない。栄養値はアプリのFood Masterが計算する。
- 食品でない画像はfoods=[]。説明文やMarkdownは禁止。
形式: {"dishName":"","uncertain":true,"foods":[{"name":"","visibleCount":null,"estimatedWeightG":null,"estimatedVolumeMl":null,"portionConfidence":"low","ambiguity":"","note":""}]}
最大${MAX_FOODS}食品。最後に重複・個数・見落とし・見えない具の推測がないか確認してからJSONを返す。`;
  }

  function endpoint() {
    try { if (typeof gasUrl !== 'undefined' && gasUrl) return gasUrl; } catch {}
    return 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  }

  function buildRequestPayload(base64) {
    return {
      taskType:'image',
      modelPreference:MODEL,
      contents:[{parts:[{text:identityPrompt()}]}],
      imageBase64:base64,
      generationConfig:{
        thinkingConfig:{thinkingLevel:THINKING_LEVEL},
        maxOutputTokens:1024,
        responseMimeType:'application/json',
        mediaResolution:'MEDIA_RESOLUTION_LOW'
      }
    };
  }

  function extractAiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim();
  }

  function classifyUpstreamText(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    if (!/^GASエラー:/i.test(text) && !/^AI API /i.test(text)) return null;
    const error = new Error(text.slice(0,420));
    error.rateLimited = /\b429\b/.test(text);
    error.upstream = true;
    return error;
  }

  async function requestIdentity(base64) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint(), {
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify(buildRequestPayload(base64)),
        signal:controller.signal
      });
      if (!response.ok) {
        const error = new Error(`画像AI HTTP ${response.status}`);
        error.rateLimited = response.status === 429;
        throw error;
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error('GASからJSONではない応答が返りました'); }
      const raw = extractAiText(data);
      const upstreamError = classifyUpstreamText(raw);
      if (upstreamError) throw upstreamError;
      const parsed = parseIdentityResponse(raw);
      if (!parsed) throw new Error(`Gemini応答を食品JSONとして読めませんでした: ${raw.replace(/\s+/g,' ').slice(0,180) || '空の応答'}`);
      return parsed;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`Gemini 3.5 Flash-Liteが${Math.round(REQUEST_TIMEOUT_MS/1000)}秒以内に応答しませんでした`);
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function waitForRequestSlot() {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay > 0) await wait(delay);
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  }

  function enqueueIdentity(task) {
    const run = async () => {
      await waitForRequestSlot();
      try { return await task(); }
      catch (error) {
        if (!error?.rateLimited) throw error;
        await wait(RATE_LIMIT_RETRY_MS);
        nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
        return await task();
      }
    };
    const queued = requestQueue.then(run, run);
    requestQueue = queued.catch(() => {});
    return queued;
  }

  function identifyDish(base64) { return enqueueIdentity(() => requestIdentity(base64)); }

  function stripDataUrl(value) { return String(value || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i,''); }

  async function compressImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await new Promise((resolve,reject) => { img.onload=resolve; img.onerror=()=>reject(new Error('画像を開けませんでした')); });
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,width,height);
      return stripDataUrl(canvas.toDataURL('image/jpeg',JPEG_QUALITY));
    } finally { URL.revokeObjectURL(url); }
  }

  function dbSearch(query, limit = 18) {
    const search = window.__PFC_DB_V3_SEARCH__?.search;
    if (typeof search !== 'function') return [];
    const q = String(query || '').trim();
    if (!q) return [];
    return search(q,limit).filter(x => x?.source === 'db');
  }

  function safeResolveFood(ai) {
    if (!ai?.name) return null;
    const q = fold(ai.name);
    for (const hit of dbSearch(ai.name,12)) {
      const meta = hit.meta || window.__PFC_DB_V3__?.get?.(hit.index);
      if (!meta) continue;
      if (fold(hit.name || meta.name) === q) return { ...hit, meta };
      if ((meta.aliases || []).some(alias => fold(alias) === q)) return { ...hit, meta };
    }
    return null;
  }

  function estimateForMeta(ai, meta, manual = false) {
    const unit = String(meta?.input?.defaultUnit || meta?.nutritionBasis?.unit || '');
    const fallback = parsePositive(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount, 10000);
    if (COUNT_UNITS.test(unit) && ai?.visibleCount) return { amount:ai.visibleCount, unit, source:'ai-count', estimated:!manual };
    if (unit === 'g' && ai?.estimatedWeightG) return { amount:ai.estimatedWeightG, unit, source:'ai-weight', estimated:!manual };
    if (/^ml$/i.test(unit) && ai?.estimatedVolumeMl) return { amount:ai.estimatedVolumeMl, unit, source:'ai-volume', estimated:!manual };
    return { amount:fallback, unit, source:'db-default', estimated:!manual };
  }

  function makeEditorRow(ai, index) {
    const match = safeResolveFood(ai);
    if (!match) return { id:`ai-${index}`, ai, match:null, meta:null, unit:'', amount:null, estimateSource:'ai-only', estimated:true, userEditedAmount:false, manualDb:false };
    const meta = match.meta || window.__PFC_DB_V3__?.get?.(match.index);
    const estimate = estimateForMeta(ai,meta,false);
    return { id:`ai-${index}`, ai, match, meta, unit:estimate.unit, amount:estimate.amount, estimateSource:estimate.source, estimated:true, userEditedAmount:false, manualDb:false };
  }

  function applyDbMatch(row, result, manualSelection = true) {
    const meta = result?.meta || window.__PFC_DB_V3__?.get?.(result?.index);
    if (!result || !meta) return { ...row, match:null, meta:null, unit:'', amount:null };
    const estimate = estimateForMeta(row.ai,meta,false);
    return { ...row, match:{...result,meta}, meta, unit:estimate.unit, amount:estimate.amount, estimateSource:estimate.source, estimated:true, userEditedAmount:false, manualDb:row.manualDb || manualSelection };
  }

  function editorRowFromDb(result, index = 0) {
    const meta = result?.meta || window.__PFC_DB_V3__?.get?.(result?.index);
    const ai = { name:String(result?.name || meta?.name || ''), visibleCount:null, estimatedWeightG:null, estimatedVolumeMl:null, portionConfidence:'low', ambiguity:'', note:'' };
    const row = { id:`db-${Date.now()}-${index}`, ai, match:null, meta:null, unit:'', amount:null, estimateSource:'db-default', estimated:false, userEditedAmount:false, manualDb:true };
    const matched = applyDbMatch(row,result,true);
    matched.estimated = false;
    return matched;
  }

  function nutritionFor(row) {
    const amount = parsePositive(row?.amount,10000);
    if (!row?.match || !amount) return null;
    return window.__PFC_DB_V3__?.scale?.(row.match.index,amount) || null;
  }

  function nutritionText(row) {
    const scaled = nutritionFor(row);
    if (!scaled) return row?.match ? '量を確認するとP/F/C/kcalを計算できます' : 'Food Master未確定のためP/F/C/kcalは未計算';
    const prefix = row.userEditedAmount || row.manualDb ? '計算' : '推定';
    return `${prefix} ${scaled.kcal} kcal · P ${scaled.p} / F ${scaled.f} / C ${scaled.c}`;
  }

  function aiEstimateText(ai) {
    const parts = [];
    if (ai.visibleCount) parts.push(`見た目 ${ai.visibleCount}個候補`);
    if (ai.estimatedWeightG) parts.push(`約${ai.estimatedWeightG}g`);
    if (ai.estimatedVolumeMl) parts.push(`約${ai.estimatedVolumeMl}ml`);
    const label = ai.portionConfidence === 'high' ? '量推定:高' : ai.portionConfidence === 'medium' ? '量推定:中' : '量推定:低';
    if (parts.length) parts.push(label);
    return parts.join(' · ');
  }

  function dbResultMeta(result) {
    const meta = result?.meta || window.__PFC_DB_V3__?.get?.(result?.index);
    if (!meta) return '';
    const unit = meta.input?.defaultUnit || meta.nutritionBasis?.unit || '';
    const amount = meta.input?.defaultAmount || meta.nutritionBasis?.amount || '';
    const scaled = window.__PFC_DB_V3__?.scale?.(result.index,Number(amount));
    return [unit ? `基準 ${amount}${unit}` : '',scaled ? `${scaled.kcal} kcal` : ''].filter(Boolean).join(' · ');
  }

  function ensureModal() {
    let modal = document.getElementById('pfc-dish-v30-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'pfc-dish-v30-modal';
    modal.className = 'dish-v30-modal';
    modal.innerHTML = '<div class="dish-v30-sheet"><div class="dish-v30-head"><strong id="dish-v30-title">料理写真</strong><button type="button" id="dish-v30-close" aria-label="閉じる">×</button></div><div id="dish-v30-body"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#dish-v30-close').onclick = () => modal.classList.remove('show');
    modal.addEventListener('click',e => { if (e.target === modal) modal.classList.remove('show'); });
    return modal;
  }

  function modal(title,html) {
    const host = ensureModal();
    host.querySelector('#dish-v30-title').textContent = title;
    host.querySelector('#dish-v30-body').innerHTML = html;
    host.classList.add('show');
    return host;
  }

  function ensureDbPicker() {
    let picker = document.getElementById('dish-v40-db-picker');
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = 'dish-v40-db-picker';
    picker.className = 'dish-v30-db-picker dish-v40-db-picker';
    picker.innerHTML = '<div class="dish-v30-db-sheet"><div class="dish-v30-db-head"><strong>Food Masterから選択</strong><button type="button" id="dish-v40-db-close" aria-label="閉じる">×</button></div><input id="dish-v40-db-query" class="dish-v30-db-query" type="search" placeholder="食品名を検索"><div id="dish-v40-db-results" class="dish-v30-db-results"></div></div>';
    document.body.appendChild(picker);
    const close = () => picker.classList.remove('show');
    picker.querySelector('#dish-v40-db-close').onclick = close;
    picker.addEventListener('click',e => { if (e.target === picker) close(); });
    return picker;
  }

  function openDbPicker(initialQuery,onPick) {
    const picker = ensureDbPicker();
    const input = picker.querySelector('#dish-v40-db-query');
    const resultsHost = picker.querySelector('#dish-v40-db-results');
    const render = () => {
      const results = dbSearch(input.value,18);
      resultsHost.innerHTML = results.length
        ? results.map((result,i) => `<button type="button" class="dish-v30-db-result" data-row="${i}"><b>${esc(result.name)}</b><small>${esc(dbResultMeta(result))}</small></button>`).join('')
        : '<div class="dish-v30-db-empty">食品名を入力してFood Masterを検索してください。</div>';
      resultsHost.querySelectorAll('[data-row]').forEach(button => {
        button.onclick = () => {
          const result = results[Number(button.dataset.row)];
          if (!result) return;
          picker.classList.remove('show');
          onPick(result);
        };
      });
    };
    input.value = String(initialQuery || '');
    input.oninput = render;
    render();
    picker.classList.add('show');
    setTimeout(() => { try { input.focus(); input.select(); } catch {} },0);
  }

  function showEditor(identity) {
    const state = { rows:(identity.foods || []).map(makeEditorRow) };
    const render = () => {
      const cards = state.rows.map((row,i) => {
        const matched = !!row.match;
        const title = matched ? row.match.name : row.ai.name;
        const estimate = aiEstimateText(row.ai);
        const detail = [estimate,row.ai.ambiguity ? `要確認: ${row.ai.ambiguity}` : '',row.ai.note || ''].filter(Boolean).join(' · ');
        const estimateBadge = row.userEditedAmount ? '<span class="dish-v40-state is-edited">編集済み</span>' : row.manualDb ? '<span class="dish-v40-state is-manual">DB追加</span>' : '<span class="dish-v40-state">AI仮入力</span>';
        const amount = matched
          ? `<div class="dish-v40-amount-row"><label>量</label><input class="dish-v40-amount" type="number" min="0.1" step="0.1" value="${row.amount ?? ''}"><span>${esc(row.unit || '')}</span></div><div class="dish-v40-nutrition">${esc(nutritionText(row))}</div>`
          : `<div class="dish-v40-provisional">${estimate ? `AI推定量: ${esc(estimate)}` : 'AI推定量: 不明'}<br><span>Food Masterを選ぶとP/F/C/kcalを仮計算できます。</span></div>`;
        return `<div class="dish-v30-card dish-v40-card${matched ? '' : ' is-unmatched'}" data-index="${i}"><div class="dish-v40-card-head"><div><div class="dish-v40-title-line"><b>${esc(title)}</b>${estimateBadge}</div><small>AI認識: ${esc(row.ai.name)}${detail ? ` · ${esc(detail)}` : ''}</small></div><button type="button" class="dish-v30-delete dish-v40-delete" aria-label="カードを削除">×</button></div>${amount}<div class="dish-v40-actions"><button type="button" class="dish-v30-change-db dish-v40-change-db">${matched ? 'DBから変更' : 'DBから選ぶ'}</button></div></div>`;
      }).join('');
      const badge = identity.dishName ? `<div class="dish-v30-badge">AI判定: ${esc(identity.dishName)}</div>` : '';
      const host = modal('写真認識を確認',`${badge}<div class="dish-v40-summary">AIが食品と量を仮入力しました。間違っている所だけ直して追加できます。</div><div id="dish-v40-editor">${cards || '<div class="dish-v30-message">食品カードがありません。</div>'}</div><button type="button" class="dish-v30-secondary" id="dish-v40-add-db">＋ DBから食品を追加</button><div class="dish-v40-footer-note">「推定」は写真からの仮量です。P/F/C/kcalはAIではなくFood Masterから計算しています。</div><button class="dish-v30-primary" id="dish-v40-commit">この内容で追加</button>`);
      const commit = host.querySelector('#dish-v40-commit');
      const usable = () => state.rows.filter(row => row.match && parsePositive(row.amount,10000));
      commit.disabled = usable().length === 0;

      host.querySelectorAll('.dish-v40-card').forEach((card,i) => {
        const row = state.rows[i];
        card.querySelector('.dish-v40-delete').onclick = () => { state.rows.splice(i,1); render(); };
        card.querySelector('.dish-v40-change-db').onclick = () => {
          openDbPicker(row.match?.name || row.ai?.name || '',result => {
            state.rows[i] = applyDbMatch(row,result,true);
            render();
          });
        };
        const input = card.querySelector('.dish-v40-amount');
        if (input) input.oninput = () => {
          row.amount = parsePositive(input.value,10000);
          row.userEditedAmount = true;
          row.estimated = false;
          card.querySelector('.dish-v40-nutrition').textContent = nutritionText(row);
          const stateBadge = card.querySelector('.dish-v40-state');
          if (stateBadge) { stateBadge.textContent = '編集済み'; stateBadge.className = 'dish-v40-state is-edited'; }
          commit.disabled = usable().length === 0;
        };
      });

      host.querySelector('#dish-v40-add-db').onclick = () => {
        openDbPicker('',result => { state.rows.push(editorRowFromDb(result,state.rows.length)); render(); });
      };

      commit.onclick = () => {
        const records = [];
        for (const row of usable()) {
          const amount = parsePositive(row.amount,10000);
          const record = window.__PFC_DB_V3__?.buildRecord?.(row.match.index,amount);
          if (!record) continue;
          record._photoAI = {
            version:VERSION,
            model:MODEL,
            provisional:true,
            aiName:row.manualDb ? '' : row.ai.name,
            visibleCount:row.ai.visibleCount,
            estimatedWeightG:row.ai.estimatedWeightG,
            estimatedVolumeMl:row.ai.estimatedVolumeMl,
            portionConfidence:row.ai.portionConfidence,
            estimateSource:row.estimateSource,
            userEditedAmount:!!row.userEditedAmount,
            manualDbSelected:!!row.manualDb,
            nutritionSource:'Food Master'
          };
          records.push(record);
        }
        if (!records.length || typeof lst === 'undefined' || !Array.isArray(lst)) return;
        lst.push(...records);
        if (typeof sv === 'function') sv();
        if (typeof ren === 'function') ren();
        if (typeof upd === 'function') upd();
        if (typeof showToast === 'function') showToast(`${records.length}件を写真から追加しました`);
        host.classList.remove('show');
      };
    };
    render();
  }

  function choosePhotoSource() {
    const host = modal('料理写真から追加','<div class="dish-v30-source-grid"><button type="button" id="dish-v40-camera"><b>カメラで撮る</b><span>今の食事をその場で撮影</span></button><button type="button" id="dish-v40-library"><b>カメラロールから選ぶ</b><span>保存済みの写真を選択</span></button></div><div class="dish-v40-footer-note">AIが食品名と量を仮入力し、P/F/C/kcalはFood Masterから計算します。追加前にすべて編集できます。</div>');
    host.querySelector('#dish-v40-camera').onclick = () => { host.classList.remove('show'); selectPhoto('camera'); };
    host.querySelector('#dish-v40-library').onclick = () => { host.classList.remove('show'); selectPhoto('library'); };
  }

  function selectPhoto(source) {
    const id = source === 'camera' ? 'dish-v40-camera-file' : 'dish-v40-library-file';
    let input = document.getElementById(id);
    if (!input) {
      input = document.createElement('input');
      input.id = id;
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.setAttribute('capture','environment');
      input.hidden = true;
      document.body.appendChild(input);
      input.onchange = async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await runDishPhoto(file);
      };
    }
    input.click();
  }

  async function runDishPhoto(file) {
    if (busy) return;
    busy = true;
    modal('料理写真を判定中','<div class="dish-v30-loading"><span></span><b>Gemini 3.5 Flash-Liteで食品と量を仮入力しています</b></div><div class="dish-v40-footer-note">P/F/C/kcalはAIに作らせず、認識後にFood Masterから計算します。</div>');
    try {
      const identity = await identifyDish(await compressImage(file));
      if (!identity.foods.length) throw new Error('食べ物として認識できませんでした');
      showEditor(identity);
    } catch (error) {
      const host = modal('判定できませんでした',`<div class="dish-v30-message">${esc(error?.message || '料理写真の判定に失敗しました')}</div><button class="dish-v30-primary" id="dish-v40-retry">写真を選び直す</button>`);
      host.querySelector('#dish-v40-retry').onclick = () => { host.classList.remove('show'); choosePhotoSource(); };
    } finally { busy = false; }
  }

  function install() {
    const action = document.getElementById('dish-v30-action');
    if (!action) return false;
    action.onclick = choosePhotoSource;
    action.setAttribute('aria-label','料理写真からAI仮入力して追加');
    document.documentElement.classList.add('pfc-dish-photo-v40');
    return true;
  }

  window.__PFC_DISH_PHOTO_V40__ = {
    version:VERSION,
    model:MODEL,
    thinkingLevel:THINKING_LEVEL,
    nutritionFromAI:false,
    nutritionSource:'Food Master',
    provisionalAmounts:true,
    editableAmounts:true,
    removableCards:true,
    dbReplacement:true,
    dbAddition:true,
    oneRequestPerPhoto:true,
    imageMaxSide:MAX_SIDE,
    jpegQuality:JPEG_QUALITY,
    requestTimeoutMs:REQUEST_TIMEOUT_MS,
    minRequestIntervalMs:MIN_REQUEST_INTERVAL_MS,
    parseIdentityResponse,
    cleanVisualFoodName,
    identityPrompt,
    buildRequestPayload,
    safeResolveFood,
    estimateForMeta,
    makeEditorRow,
    applyDbMatch,
    editorRowFromDb,
    nutritionFor,
    nutritionText,
    aiEstimateText,
    dbSearch,
    identifyDish,
    choosePhotoSource,
    selectPhoto,
    install
  };

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (install() || attempts >= 20) clearInterval(timer); },100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

;

/* ===== pfc-meal-engine-v50.js ===== */
// PFC Mirror Meal Engine V5.0: trusted Food Master mutations + structured voice command planning.
(() => {
  'use strict';

  const VERSION = '5.0.0';
  const VOICE_MODEL = 'gemini-3.1-flash-lite';
  const LAST_TX_KEY = 'pfc_v50_last_transaction';
  const PENDING_KEY = 'pfc_v50_pending_action';
  const MAX_RECENT = 12;
  const REQUEST_TIMEOUT_MS = 30000;
  let voiceBusy = false;

  const normalize = value => String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[・･\s]/g, '')
    .trim();
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const clone = value => JSON.parse(JSON.stringify(value));
  const storage = () => window.mirrorStorage || window.localStorage;
  const dbv3 = () => window.__PFC_DB_V3__ || null;
  const multi = () => window.__PFC_DB_V3_MULTIUNIT__ || null;
  const searchApi = () => window.__PFC_DB_V3_SEARCH__ || null;
  const isPositive = value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10000;
  const unitCanon = value => {
    const raw = normalize(value);
    if (!raw) return '';
    if (/^(g|ぐらむ|グラム)$/.test(raw)) return 'g';
    if (/^(ml|みり|ミリ|みりりっとる|ミリリットル)$/.test(raw)) return 'ml';
    if (/^(こ|個)$/.test(raw)) return '個';
    if (/^(たま|玉)$/.test(raw)) return '玉';
    if (/^(はい|杯)$/.test(raw)) return '杯';
    if (/^(ほん|本)$/.test(raw)) return '本';
    if (/^(まい|枚)$/.test(raw)) return '枚';
    if (/^(きれ|切れ|切)$/.test(raw)) return '切れ';
    if (/^(ぱっく|パック|p)$/.test(raw)) return 'パック';
    if (/^(にんまえ|人前)$/.test(raw)) return '人前';
    if (/^(しょく|食)$/.test(raw)) return '食';
    return String(value || '').trim();
  };

  function searchFood(query, limit = 8) {
    const api = searchApi();
    if (!api?.search) return [];
    return api.search(String(query || '').trim(), limit).filter(row => row?.source === 'db');
  }

  function safeResolveFood(query) {
    const q = String(query || '').trim();
    if (!q) return null;
    const nq = normalize(q);
    const results = searchFood(q, 16);
    if (!results.length) return null;

    if (/^(米|お米|ご飯|ごはん|白米|ライス)$/.test(q)) {
      const rice = results.find(row => row.name === '白米') || searchFood('白米', 4).find(row => row.name === '白米');
      if (rice) return rice;
    }

    const exact = results.find(row => normalize(row.name) === nq);
    if (exact) return exact;

    const aliasExact = results.filter(row => (row.meta?.aliases || []).some(alias => normalize(alias) === nq));
    if (aliasExact.length === 1) return aliasExact[0];

    const baseMatches = results.filter(row => normalize(row.meta?.baseName || row.name.replace(/[（(].*?[)）]/g, '')) === nq);
    if (baseMatches.length === 1) return baseMatches[0];

    return null;
  }

  function getUnit(index, requestedUnit) {
    const meta = dbv3()?.get?.(index);
    if (!meta) return null;
    const requested = unitCanon(requestedUnit);
    const units = multi()?.getUnits?.(index) || [{ id: normalize(meta.input.defaultUnit), label: meta.input.defaultUnit }];
    if (!requested) return units[0] || null;
    const hit = units.find(item => unitCanon(item.label) === requested || unitCanon(item.id) === requested);
    if (hit) return hit;
    if (unitCanon(meta.input.defaultUnit) === requested) return units[0] || { id: normalize(meta.input.defaultUnit), label: meta.input.defaultUnit };
    return null;
  }

  function buildTrustedRecord(index, amount, unitLabel, time, forcedId) {
    const meta = dbv3()?.get?.(index);
    if (!meta || !isPositive(amount)) return null;
    const selectedUnit = getUnit(index, unitLabel);
    if (!selectedUnit) return null;
    let record = null;
    if (multi()?.buildRecordInput) record = multi().buildRecordInput(index, Number(amount), selectedUnit.id, time);
    if (!record) record = dbv3()?.buildRecord?.(index, Number(amount), time) || null;
    if (!record) return null;
    if (forcedId) record.id = forcedId;
    record._mealEngine = { version: VERSION, nutritionSource: 'Food Master', trusted: true };
    return record;
  }

  function validateTrustedRecord(record) {
    if (!record || !record._dbv3 || !Number.isFinite(Number(record._dbv3.index))) return { ok:false, reason:'Food Master参照がありません' };
    const meta = dbv3()?.get?.(record._dbv3.index);
    if (!meta) return { ok:false, reason:'Food Master食品を解決できません' };
    for (const key of ['P','F','C','A','Cal']) {
      if (!Number.isFinite(Number(record[key])) || Number(record[key]) < 0) return { ok:false, reason:`${key}が不正です` };
    }
    if (meta.category !== 'alcohol' && Number(record.A || 0) !== 0) return { ok:false, reason:'非アルコール食品にアルコール量が入っています' };
    return { ok:true, meta };
  }

  function persistRecords(records) {
    if (typeof lst === 'undefined' || !Array.isArray(lst)) throw new Error('食事記録を参照できません');
    lst.splice(0, lst.length, ...records);
    if (typeof sv === 'function') sv();
    else storage().setItem('tf_dat', JSON.stringify(lst));
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
  }

  function getLastTransaction() {
    try { return JSON.parse(storage().getItem(LAST_TX_KEY) || 'null'); } catch { return null; }
  }
  function setLastTransaction(tx) {
    if (!tx) storage().removeItem(LAST_TX_KEY);
    else storage().setItem(LAST_TX_KEY, JSON.stringify(tx));
  }
  function getPendingAction() {
    try { return JSON.parse(storage().getItem(PENDING_KEY) || 'null'); } catch { return null; }
  }
  function setPendingAction(value) {
    if (!value) storage().removeItem(PENDING_KEY);
    else storage().setItem(PENDING_KEY, JSON.stringify(value));
  }

  function stripRecordName(name) {
    return String(name || '').replace(/^🤖\s*/, '').replace(/[（(][^()（）]*[0-9][^()（）]*[)）]\s*$/, '').trim();
  }

  function buildRecordRefs() {
    const refs = new Map();
    const rows = [];
    const source = (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst.slice(-MAX_RECENT).reverse() : [];
    source.forEach((item, index) => {
      const ref = `r${index + 1}`;
      refs.set(ref, Number(item.id));
      rows.push({ ref, time:item.time || '', name:stripRecordName(item.N), displayName:String(item.N || '') });
    });
    return { refs, rows };
  }

  function currentTotals() {
    const source = (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : [];
    return source.reduce((acc, item) => {
      acc.kcal += Number(item.Cal || 0); acc.p += Number(item.P || 0); acc.f += Number(item.F || 0); acc.c += Number(item.C || 0); acc.a += Number(item.A || 0);
      return acc;
    }, { kcal:0,p:0,f:0,c:0,a:0 });
  }

  function plannerPrompt() {
    return `あなたは食事管理アプリの操作プランナーです。ユーザーの自然な日本語・音声認識の揺れ・省略を理解し、アプリ操作をJSONだけで返してください。

最重要:
- P/F/C/A/kcalは絶対に生成しない。栄養値はアプリのFood Masterだけが決定する。
- 「登録した」「削除した」など実行済みの表現を勝手に確定しない。あなたは操作計画だけ作る。
- 質問なら記録操作をしない。複合発話なら操作と質問を同じoperations配列へ分ける。
- recentRecordsのrefは現在の記録を指す。修正・削除は可能ならrefを使う。
- mealDraftがある場合、「これ」「この」「今の」は原則mealDraftを優先する。
- 量を変更していない修正ではpreserveAmount=true。属性や食品名だけの修正で既存量を100g等へ戻さない。
- 「今の全部消して」「さっき入れたの全部消して」は、直前トランザクションを元に戻すundoを優先する。
- 「今日の記録を全部消して」は危険操作。delete + scope=allToday + needsConfirmation=trueにする。
- 重要な対象が複数あり特定不能ならneedsConfirmation=trueでconfirmationQuestionを返す。
- 今日以外の過去/未来記録は実行せずnoopにする。
- 音声で「さんたま」は3玉、「にぱっく」は2パック等、食事文脈の数量として自然に解釈する。

operation形式:
{
  "op":"add|update|delete|undo|question|noop",
  "foodQuery":"食品名",
  "replacementQuery":"置換後食品名",
  "amountValue":3,
  "amountUnit":"g|ml|個|玉|杯|本|枚|切れ|パック|食|人前|",
  "targetRef":"r1 または d1",
  "targetQuery":"対象食品名",
  "scope":"single|lastTransaction|allToday",
  "preserveAmount":true,
  "needsConfirmation":false,
  "confirmationQuestion":"",
  "answer":"質問への短い日本語回答"
}

出力形式:
{"operations":[...],"reply":"必要なら短い補足。操作結果の断定は禁止"}
JSON以外は禁止。`;
  }

  function buildPlannerContext() {
    const { refs, rows } = buildRecordRefs();
    const totals = currentTotals();
    const lastTx = getLastTransaction();
    let draft = [];
    try { draft = window.__PFC_MEAL_EDITOR_V50__?.plannerContext?.() || []; } catch {}
    const targets = (typeof TG !== 'undefined' && TG) ? { kcal:TG.cal, p:TG.p, f:TG.f, c:TG.c } : {};
    return {
      refs,
      context: {
        currentTime: new Date().toISOString(),
        currentMeal: typeof getAutoTime === 'function' ? getAutoTime() : '',
        targets,
        totals: { kcal:Math.round(totals.kcal), p:Number(totals.p.toFixed(1)), f:Number(totals.f.toFixed(1)), c:Number(totals.c.toFixed(1)), a:Number(totals.a.toFixed(1)) },
        recentRecords: rows,
        lastTransaction: lastTx ? { id:lastTx.id, summary:lastTx.summary || '', changedIds:lastTx.changedIds || [] } : null,
        mealDraft: draft
      }
    };
  }

  function gasEndpoint() {
    try { if (typeof gasUrl !== 'undefined' && gasUrl) return gasUrl; } catch {}
    return 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  }

  function extractAiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim() : '';
  }

  function parsePlan(raw) {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    if (!parsed || !Array.isArray(parsed.operations)) return null;
    const allowed = new Set(['add','update','delete','undo','question','noop']);
    parsed.operations = parsed.operations.filter(op => op && allowed.has(op.op)).slice(0, 12).map(op => ({
      op:op.op,
      foodQuery:String(op.foodQuery || '').slice(0,80),
      replacementQuery:String(op.replacementQuery || '').slice(0,80),
      amountValue:isPositive(op.amountValue) ? Number(op.amountValue) : null,
      amountUnit:unitCanon(op.amountUnit),
      targetRef:String(op.targetRef || '').slice(0,20),
      targetQuery:String(op.targetQuery || '').slice(0,80),
      scope:String(op.scope || 'single'),
      preserveAmount:op.preserveAmount !== false,
      needsConfirmation:op.needsConfirmation === true,
      confirmationQuestion:String(op.confirmationQuestion || '').slice(0,180),
      answer:String(op.answer || '').slice(0,500)
    }));
    parsed.reply = String(parsed.reply || '').slice(0,500);
    return parsed;
  }

  async function requestPlan(text) {
    const built = buildPlannerContext();
    const payload = {
      taskType:'chat',
      modelPreference:VOICE_MODEL,
      contents:[{parts:[{text:`${plannerPrompt()}\n\n【アプリ状態】\n${JSON.stringify(built.context)}\n\n【ユーザー発言】\n${String(text || '').trim()}`}]}],
      generationConfig:{ maxOutputTokens:900, responseMimeType:'application/json', temperature:0.1 }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(gasEndpoint(), { method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(payload), signal:controller.signal });
      if (!response.ok) throw new Error(`音声AI HTTP ${response.status}`);
      const data = await response.json();
      const raw = extractAiText(data);
      if (/^GASエラー:/i.test(raw)) throw new Error(raw.slice(0,240));
      const plan = parsePlan(raw);
      if (!plan) throw new Error('音声AIの操作計画を読めませんでした');
      return { plan, refs:built.refs };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('音声AIが30秒以内に応答しませんでした');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function resolveTargetIds(op, refMap, working) {
    if (op.scope === 'allToday') return working.map(item => Number(item.id)).filter(Boolean);
    if (op.scope === 'lastTransaction') {
      const tx = getLastTransaction();
      return (tx?.changedIds || []).map(Number).filter(id => working.some(item => Number(item.id) === id));
    }
    if (op.targetRef && refMap?.has(op.targetRef)) return [refMap.get(op.targetRef)];
    const query = normalize(op.targetQuery || op.foodQuery || '');
    if (!query) return [];
    const hit = working.slice().reverse().find(item => normalize(stripRecordName(item.N)).includes(query) || query.includes(normalize(stripRecordName(item.N))));
    return hit ? [Number(hit.id)] : [];
  }

  function recordDbIndex(record) {
    if (Number.isFinite(Number(record?._dbv3?.index))) return Number(record._dbv3.index);
    const resolved = safeResolveFood(stripRecordName(record?.N));
    return resolved ? Number(resolved.index) : null;
  }

  function recordAmount(record, index) {
    if (isPositive(record?._dbv3?.amount)) return Number(record._dbv3.amount);
    const meta = dbv3()?.get?.(index);
    return Number(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount || 1);
  }

  function makeTransaction(before, after, summary, changedIds) {
    return { id:`tx-${Date.now()}`, createdAt:Date.now(), version:VERSION, summary, changedIds:[...new Set(changedIds.map(Number).filter(Boolean))], before, after };
  }

  function undoLastTransaction() {
    const tx = getLastTransaction();
    if (!tx?.before || !Array.isArray(tx.before)) return { ok:false, message:'取り消せる直前操作がありません。' };
    persistRecords(clone(tx.before));
    setLastTransaction(null);
    return { ok:true, message:'直前の操作を元に戻しました。', changed:[] };
  }

  function executeDeleteAllConfirmed() {
    const before = (typeof lst !== 'undefined' && Array.isArray(lst)) ? clone(lst) : [];
    persistRecords([]);
    const tx = makeTransaction(before, [], '今日の記録をすべて削除', before.map(x => x.id));
    setLastTransaction(tx);
    setPendingAction(null);
    return { ok:true, message:`${before.length}件の記録を削除しました。`, changed:[] };
  }

  function executePlan(plan, refMap) {
    if (!plan?.operations?.length) return { ok:false, message:plan?.reply || '操作内容を特定できませんでした。' };
    const dangerous = plan.operations.find(op => op.op === 'delete' && op.scope === 'allToday');
    if (dangerous) {
      setPendingAction({ type:'deleteAllToday', createdAt:Date.now() });
      return { ok:false, confirmation:true, message:dangerous.confirmationQuestion || '今日の記録をすべて削除しますか？' };
    }
    if (plan.operations.some(op => op.needsConfirmation)) {
      const op = plan.operations.find(x => x.needsConfirmation);
      return { ok:false, confirmation:true, message:op.confirmationQuestion || '対象をもう少し具体的に教えてください。' };
    }
    if (plan.operations.some(op => op.op === 'undo')) return undoLastTransaction();

    const before = (typeof lst !== 'undefined' && Array.isArray(lst)) ? clone(lst) : [];
    let working = clone(before);
    const changed = [];
    const changedIds = [];
    const unresolved = [];
    const replies = [];
    let idSeed = Date.now();

    for (const op of plan.operations) {
      if (op.op === 'question') { if (op.answer) replies.push(op.answer); continue; }
      if (op.op === 'noop') { if (op.answer) replies.push(op.answer); continue; }

      if (op.op === 'add') {
        const resolved = safeResolveFood(op.foodQuery);
        if (!resolved) { unresolved.push({ query:op.foodQuery, amountValue:op.amountValue, amountUnit:op.amountUnit, source:'voice' }); continue; }
        const meta = resolved.meta || dbv3()?.get?.(resolved.index);
        const amount = op.amountValue || Number(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount || 1);
        const record = buildTrustedRecord(resolved.index, amount, op.amountUnit || meta?.input?.defaultUnit, typeof getAutoTime === 'function' ? getAutoTime() : '', ++idSeed);
        const validation = validateTrustedRecord(record);
        if (!validation.ok) throw new Error(validation.reason);
        working.push(record); changed.push(record); changedIds.push(record.id);
        continue;
      }

      const targetIds = resolveTargetIds(op, refMap, working);
      if (!targetIds.length) { unresolved.push({ query:op.targetQuery || op.foodQuery, operation:op.op, source:'voice-target' }); continue; }

      if (op.op === 'delete') {
        const set = new Set(targetIds.map(Number));
        working = working.filter(item => !set.has(Number(item.id)));
        changedIds.push(...targetIds);
        continue;
      }

      if (op.op === 'update') {
        for (const targetId of targetIds) {
          const pos = working.findIndex(item => Number(item.id) === Number(targetId));
          if (pos < 0) continue;
          const existing = working[pos];
          let index = recordDbIndex(existing);
          if (op.replacementQuery) {
            const replacement = safeResolveFood(op.replacementQuery);
            if (!replacement) { unresolved.push({ query:op.replacementQuery, operation:'update', targetId, source:'voice' }); continue; }
            index = Number(replacement.index);
          }
          if (!Number.isFinite(index)) { unresolved.push({ query:stripRecordName(existing.N), operation:'update', targetId, source:'voice' }); continue; }
          const existingAmount = recordAmount(existing, index);
          const amount = op.amountValue || existingAmount;
          const unit = op.amountValue ? (op.amountUnit || existing?._dbv3?.unit || dbv3()?.get(index)?.input?.defaultUnit) : (existing?._dbv3?.unit || dbv3()?.get(index)?.input?.defaultUnit);
          const replacementRecord = buildTrustedRecord(index, amount, unit, existing.time, existing.id);
          const validation = validateTrustedRecord(replacementRecord);
          if (!validation.ok) throw new Error(validation.reason);
          working[pos] = replacementRecord; changed.push(replacementRecord); changedIds.push(replacementRecord.id);
        }
      }
    }

    if (unresolved.length) return { ok:false, unresolved, message:'Food Masterで特定できない項目があります。編集画面で確認してください。' };

    const mutating = plan.operations.some(op => ['add','update','delete'].includes(op.op));
    if (mutating) {
      persistRecords(working);
      const names = changed.map(item => stripRecordName(item.N));
      const summary = names.length ? names.join('、') : '食事記録を更新';
      setLastTransaction(makeTransaction(before, clone(working), summary, changedIds));
    }

    if (mutating) {
      const adds = plan.operations.filter(op => op.op === 'add').length;
      const updates = plan.operations.filter(op => op.op === 'update').length;
      const deletes = plan.operations.filter(op => op.op === 'delete').length;
      if (adds) replies.unshift(`${adds}件を記録しました。`);
      if (updates) replies.unshift(`${updates}件を修正しました。`);
      if (deletes) replies.unshift(`${deletes}件を削除しました。`);
    }
    if (!replies.length && plan.reply) replies.push(plan.reply);
    return { ok:true, message:replies.join(' '), changed };
  }

  function resultCards(items) {
    const rows = (items || []).map(item => `<div class="v50-result-card"><b>${escapeHtml(stripRecordName(item.N))}</b><span>P ${Number(item.P||0).toFixed(1)} / F ${Number(item.F||0).toFixed(1)} / C ${Number(item.C||0).toFixed(1)}</span><strong>${Math.round(Number(item.Cal||0)).toLocaleString()} kcal</strong></div>`).join('');
    return rows ? `<div class="v50-result-list">${rows}</div>` : '';
  }

  function yesAnswer(text) { return /^(はい|うん|お願い|お願いします|実行|削除|消して|ok|オーケー)$/i.test(String(text || '').trim()); }
  function noAnswer(text) { return /^(いいえ|いや|やめ|やめて|キャンセル|中止|戻る)$/i.test(String(text || '').trim()); }

  async function sendVoiceV50() {
    const inputEl = document.getElementById('v-chat-input');
    const text = String(inputEl?.value || '').trim();
    if (!text || voiceBusy) return;
    voiceBusy = true;
    const status = document.getElementById('v-status-text');
    if (inputEl) { inputEl.value = ''; inputEl.disabled = true; }
    if (status) status.textContent = '音声を解析中…';
    if (typeof addChatMsg === 'function') addChatMsg('user', text);
    const loadingId = typeof addChatMsg === 'function' ? addChatMsg('bot', '音声を解析中…') : null;

    try {
      const pending = getPendingAction();
      if (pending?.type === 'deleteAllToday') {
        let result;
        if (yesAnswer(text)) result = executeDeleteAllConfirmed();
        else if (noAnswer(text)) { setPendingAction(null); result = { ok:false, message:'削除をキャンセルしました。' }; }
        else result = { ok:false, message:'削除する場合は「はい」、やめる場合は「キャンセル」と言ってください。' };
        if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
        if (typeof addChatMsg === 'function') addChatMsg('bot', result.message, true);
        return;
      }

      const { plan, refs } = await requestPlan(text);
      if (status) status.textContent = 'Food Masterを照合中…';
      let result;
      const editor = window.__PFC_MEAL_EDITOR_V50__;
      if (editor?.hasOpenDraft?.()) result = editor.applyVoicePlan(plan);
      else result = executePlan(plan, refs);

      if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
      if (result?.unresolved?.length && editor?.openFromUnresolved) {
        editor.openFromUnresolved(result.unresolved);
      }
      const message = result?.message || plan.reply || '処理しました。';
      if (typeof addChatMsg === 'function') addChatMsg('bot', escapeHtml(message) + resultCards(result?.changed || []), true);
    } catch (error) {
      if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
      if (typeof addChatMsg === 'function') addChatMsg('bot', `音声処理に失敗しました。${escapeHtml(error?.message || '')}`, true);
    } finally {
      if (status) status.textContent = 'マイクOFF';
      if (inputEl) inputEl.disabled = false;
      voiceBusy = false;
    }
  }

  function installVoice() {
    window.sendVoiceChat = sendVoiceV50;
    document.documentElement.classList.add('pfc-meal-engine-v50');
  }

  window.__PFC_MEAL_ENGINE_V50__ = {
    version:VERSION,
    voiceModel:VOICE_MODEL,
    nutritionSource:'Food Master',
    legacyCommandTags:false,
    transactionalMutations:true,
    nonAlcoholAZeroGuard:true,
    searchFood,
    safeResolveFood,
    getUnit,
    buildTrustedRecord,
    validateTrustedRecord,
    parsePlan,
    requestPlan,
    executePlan,
    undoLastTransaction,
    buildRecordRefs,
    currentTotals,
    stripRecordName,
    unitCanon,
    plannerPrompt,
    installVoice
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installVoice, { once:true });
  else installVoice();
})();

;

/* ===== pfc-meal-editor-v50.js ===== */
// PFC Mirror Meal Editor V5.0: one-layer editable workspace shared by photo and voice.
(() => {
  'use strict';

  const VERSION = '5.0.0';
  const MAX_SIDE = 512;
  const JPEG_QUALITY = 0.68;
  let draft = null;
  let busy = false;

  const engine = () => window.__PFC_MEAL_ENGINE_V50__ || null;
  const dbv3 = () => window.__PFC_DB_V3__ || null;
  const multi = () => window.__PFC_DB_V3_MULTIUNIT__ || null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10000 ? Number(value) : null;
  const countUnit = unit => /^(個|切れ|切|枚|本|玉|杯|粒|袋|パック|カップ|缶|食|人前|ピース)$/.test(String(unit || ''));

  function makeId(prefix='row') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function createRow(spec = {}) {
    const query = String(spec.query || spec.name || '').trim();
    const row = {
      id:makeId(spec.source || 'row'),
      source:spec.source || 'manual',
      query,
      dbIndex:null,
      dbName:'',
      amount:positive(spec.amountValue || spec.amount),
      unit:String(spec.amountUnit || spec.unit || ''),
      ai:spec.ai || null,
      edited:false
    };
    const match = engine()?.safeResolveFood?.(query);
    if (match) bindMatch(row, match, false);
    return row;
  }

  function estimatePhotoAmount(row, meta) {
    const ai = row.ai || {};
    const unit = String(meta?.input?.defaultUnit || '');
    if (countUnit(unit) && positive(ai.visibleCount)) return Number(ai.visibleCount);
    if (unit === 'g' && positive(ai.estimatedWeightG)) return Number(ai.estimatedWeightG);
    if (/^ml$/i.test(unit) && positive(ai.estimatedVolumeMl)) return Number(ai.estimatedVolumeMl);
    return positive(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount) || 1;
  }

  function bindMatch(row, result, manual = true) {
    const meta = result?.meta || dbv3()?.get?.(result?.index);
    if (!meta) return row;
    row.dbIndex = Number(result.index);
    row.dbName = String(result.name || meta.name || '');
    row.query = row.dbName;
    const units = multi()?.getUnits?.(row.dbIndex) || [];
    const requested = engine()?.unitCanon?.(row.unit || '');
    const selected = units.find(u => engine()?.unitCanon?.(u.label) === requested) || units[0];
    row.unit = selected?.label || meta.input?.defaultUnit || '';
    if (!positive(row.amount)) row.amount = row.source === 'photo' ? estimatePhotoAmount(row, meta) : positive(meta.input?.defaultAmount || meta.nutritionBasis?.amount) || 1;
    row.edited = row.edited || manual;
    return row;
  }

  function rowRecord(row, forcedId) {
    if (!Number.isFinite(Number(row?.dbIndex)) || !positive(row?.amount)) return null;
    return engine()?.buildTrustedRecord?.(row.dbIndex, Number(row.amount), row.unit, typeof getAutoTime === 'function' ? getAutoTime() : '', forcedId) || null;
  }

  function rowNutrition(row) {
    const record = rowRecord(row);
    if (!record) return null;
    const validation = engine()?.validateTrustedRecord?.(record);
    return validation?.ok ? record : null;
  }

  function ensureHost() {
    let host = document.getElementById('pfc-meal-editor-v50');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'pfc-meal-editor-v50';
    host.className = 'pfc-meal-editor-v50';
    host.innerHTML = '<div class="v50-sheet"><header><div><small id="v50-kicker">MEAL DRAFT</small><h2 id="v50-title">食事を確認</h2></div><button type="button" id="v50-close" aria-label="閉じる">×</button></header><div id="v50-body" class="v50-body"></div><footer><div id="v50-status" class="v50-status"></div><button type="button" id="v50-commit" class="v50-commit">この内容で記録</button></footer></div>';
    document.body.appendChild(host);
    host.querySelector('#v50-close').onclick = close;
    host.addEventListener('click', event => { if (event.target === host) close(); });
    host.querySelector('#v50-commit').onclick = commit;
    return host;
  }

  function open(nextDraft) {
    draft = nextDraft;
    const host = ensureHost();
    host.classList.add('show');
    document.documentElement.classList.add('v50-editor-open');
    render();
  }

  function close() {
    ensureHost().classList.remove('show');
    document.documentElement.classList.remove('v50-editor-open');
    draft = null;
  }

  function statusText() {
    if (!draft) return '';
    const unresolved = draft.rows.filter(row => !Number.isFinite(Number(row.dbIndex))).length;
    const invalid = draft.rows.filter(row => Number.isFinite(Number(row.dbIndex)) && !positive(row.amount)).length;
    if (!draft.rows.length) return '食品を1件以上追加してください。';
    if (unresolved) return `Food Master未確定: ${unresolved}件。食品名を入力して候補を選んでください。`;
    if (invalid) return `量が未確定: ${invalid}件。`;
    return `${draft.rows.length}件すべてFood Masterで計算できます。`;
  }

  function canCommit() {
    return !!draft?.rows?.length && draft.rows.every(row => Number.isFinite(Number(row.dbIndex)) && positive(row.amount) && rowNutrition(row));
  }

  function detailText(row) {
    const ai = row.ai || {};
    const parts = [];
    if (row.source === 'photo') parts.push('AI写真認識');
    if (positive(ai.visibleCount)) parts.push(`見た目 ${ai.visibleCount}個`);
    if (positive(ai.estimatedWeightG)) parts.push(`推定 約${ai.estimatedWeightG}g`);
    if (positive(ai.estimatedVolumeMl)) parts.push(`推定 約${ai.estimatedVolumeMl}ml`);
    if (ai.portionConfidence) parts.push(`量推定 ${ai.portionConfidence}`);
    if (ai.ambiguity) parts.push(`要確認: ${ai.ambiguity}`);
    return parts.join(' · ');
  }

  function unitOptions(row) {
    if (!Number.isFinite(Number(row.dbIndex))) return [];
    return multi()?.getUnits?.(row.dbIndex) || [{ id:String(row.unit), label:String(row.unit) }];
  }

  function render() {
    if (!draft) return;
    const host = ensureHost();
    host.querySelector('#v50-title').textContent = draft.title || '食事を確認';
    host.querySelector('#v50-kicker').textContent = draft.source === 'photo' ? 'PHOTO → MEAL DRAFT' : 'MEAL DRAFT';
    const body = host.querySelector('#v50-body');
    const cards = draft.rows.map((row,index) => {
      const nutrition = rowNutrition(row);
      const units = unitOptions(row);
      const unitControl = units.length > 1
        ? `<select class="v50-unit">${units.map(u => `<option value="${esc(u.label)}"${engine()?.unitCanon?.(u.label)===engine()?.unitCanon?.(row.unit)?' selected':''}>${esc(u.label)}</option>`).join('')}</select>`
        : `<span class="v50-unit-label">${esc(row.unit || '')}</span>`;
      const macro = nutrition
        ? `<div class="v50-macros"><span>P <b>${Number(nutrition.P).toFixed(1)}</b>g</span><span>F <b>${Number(nutrition.F).toFixed(1)}</b>g</span><span>C <b>${Number(nutrition.C).toFixed(1)}</b>g</span><strong>${Math.round(Number(nutrition.Cal)).toLocaleString()} kcal</strong></div>`
        : `<div class="v50-macros is-unresolved">${Number.isFinite(Number(row.dbIndex)) ? '量を入力するとP/F/C/kcalを表示' : 'Food Masterの候補を選ぶとP/F/C/kcalを表示'}</div>`;
      const badge = row.edited ? '編集済み' : row.source === 'photo' ? 'AI仮入力' : '追加';
      return `<section class="v50-card${Number.isFinite(Number(row.dbIndex))?'':' is-unresolved'}" data-row="${index}"><div class="v50-card-head"><span class="v50-badge">${badge}</span><button type="button" class="v50-delete" aria-label="削除">×</button></div><label class="v50-label">食品名</label><input class="v50-name" type="search" autocomplete="off" enterkeyhint="search" value="${esc(row.query)}" placeholder="食品名を入力"><div class="v50-suggestions"></div>${detailText(row)?`<small class="v50-detail">${esc(detailText(row))}</small>`:''}<div class="v50-amount-wrap"><label>量</label><input class="v50-amount" type="number" inputmode="decimal" min="0.1" step="0.1" value="${row.amount ?? ''}" placeholder="量">${unitControl}</div>${macro}</section>`;
    }).join('');
    body.innerHTML = `${draft.dishName ? `<div class="v50-dish-name">AI判定: ${esc(draft.dishName)}</div>` : ''}<div class="v50-guide">食品名・量は直接編集できます。候補はカード内に表示されるため、別レイヤーは開きません。</div>${cards || '<div class="v50-empty">食品がありません。</div>'}<button type="button" id="v50-add-row" class="v50-add-row">＋ Food Masterから食品を追加</button>`;
    host.querySelector('#v50-status').textContent = statusText();
    host.querySelector('#v50-commit').disabled = !canCommit();

    body.querySelectorAll('.v50-card').forEach((card,index) => wireCard(card,index));
    body.querySelector('#v50-add-row').onclick = () => {
      draft.rows.push(createRow({ source:'manual' }));
      render();
      setTimeout(() => body.querySelectorAll('.v50-name')[draft.rows.length - 1]?.focus(), 0);
    };
  }

  function showSuggestions(card, row) {
    const box = card.querySelector('.v50-suggestions');
    const query = String(row.query || '').trim();
    if (!query) { box.innerHTML = ''; box.classList.remove('show'); return; }
    const results = engine()?.searchFood?.(query, 6) || [];
    if (!results.length) {
      box.innerHTML = '<div class="v50-no-hit">候補がありません。別の食品名を入力してください。</div>';
      box.classList.add('show');
      return;
    }
    box.innerHTML = results.map((result,i) => {
      const meta = result.meta || dbv3()?.get?.(result.index);
      const amount = Number(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount || 1);
      const preview = dbv3()?.scale?.(result.index, amount);
      return `<button type="button" data-hit="${i}"><b>${esc(result.name)}</b><small>${esc(meta?.input?.defaultAmount || '')}${esc(meta?.input?.defaultUnit || '')}${preview ? ` · ${preview.kcal} kcal` : ''}</small></button>`;
    }).join('');
    box.classList.add('show');
    box.querySelectorAll('[data-hit]').forEach(button => {
      button.onclick = () => {
        const result = results[Number(button.dataset.hit)];
        bindMatch(row, result, true);
        render();
      };
    });
  }

  function updateMacroInCard(card,row) {
    const macro = card.querySelector('.v50-macros');
    const nutrition = rowNutrition(row);
    if (!nutrition) {
      macro.className = 'v50-macros is-unresolved';
      macro.textContent = Number.isFinite(Number(row.dbIndex)) ? '量を入力するとP/F/C/kcalを表示' : 'Food Masterの候補を選ぶとP/F/C/kcalを表示';
    } else {
      macro.className = 'v50-macros';
      macro.innerHTML = `<span>P <b>${Number(nutrition.P).toFixed(1)}</b>g</span><span>F <b>${Number(nutrition.F).toFixed(1)}</b>g</span><span>C <b>${Number(nutrition.C).toFixed(1)}</b>g</span><strong>${Math.round(Number(nutrition.Cal)).toLocaleString()} kcal</strong>`;
    }
    const host = ensureHost();
    host.querySelector('#v50-status').textContent = statusText();
    host.querySelector('#v50-commit').disabled = !canCommit();
  }

  function wireCard(card,index) {
    const row = draft.rows[index];
    card.querySelector('.v50-delete').onclick = () => { draft.rows.splice(index,1); render(); };
    const name = card.querySelector('.v50-name');
    name.onfocus = () => showSuggestions(card,row);
    name.oninput = () => {
      row.query = name.value;
      row.edited = true;
      if (row.dbName && engine()?.unitCanon?.(row.query) !== engine()?.unitCanon?.(row.dbName) && row.query !== row.dbName) {
        row.dbIndex = null; row.dbName = ''; row.amount = row.amount || null;
        card.classList.add('is-unresolved');
      }
      showSuggestions(card,row);
      updateMacroInCard(card,row);
    };
    name.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const hit = engine()?.safeResolveFood?.(row.query);
        if (hit) { bindMatch(row,hit,true); render(); }
      }
    };
    const amount = card.querySelector('.v50-amount');
    amount.oninput = () => { row.amount = positive(amount.value); row.edited = true; updateMacroInCard(card,row); };
    const unit = card.querySelector('.v50-unit');
    if (unit) unit.onchange = () => { row.unit = unit.value; row.edited = true; updateMacroInCard(card,row); };
  }

  function commit() {
    if (!draft || !canCommit()) return;
    const before = typeof lst !== 'undefined' && Array.isArray(lst) ? JSON.parse(JSON.stringify(lst)) : [];
    const records = [];
    const seed = Date.now();
    draft.rows.forEach((row,index) => {
      const record = rowRecord(row, seed + index + 1);
      if (!record) return;
      record._mealDraft = { version:VERSION, source:draft.source, aiName:row.ai?.name || '', edited:!!row.edited, nutritionSource:'Food Master' };
      records.push(record);
    });
    if (records.length !== draft.rows.length) return;
    const validations = records.map(record => engine()?.validateTrustedRecord?.(record));
    if (validations.some(result => !result?.ok)) return;
    if (typeof lst === 'undefined' || !Array.isArray(lst)) return;
    lst.push(...records);
    if (typeof sv === 'function') sv();
    else (window.mirrorStorage || window.localStorage).setItem('tf_dat', JSON.stringify(lst));
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
    try {
      const tx = { id:`tx-${Date.now()}`, createdAt:Date.now(), version:VERSION, summary:records.map(r => engine()?.stripRecordName?.(r.N) || r.N).join('、'), changedIds:records.map(r => r.id), before, after:JSON.parse(JSON.stringify(lst)) };
      (window.mirrorStorage || window.localStorage).setItem('pfc_v50_last_transaction', JSON.stringify(tx));
    } catch {}
    if (typeof showToast === 'function') showToast(`${records.length}件をFood Masterから記録しました`);
    close();
  }

  function plannerContext() {
    if (!draft) return [];
    return draft.rows.map((row,index) => ({ ref:`d${index+1}`, name:row.query, amount:row.amount, unit:row.unit, resolved: Number.isFinite(Number(row.dbIndex)) }));
  }

  function targetDraftRow(ref, query) {
    const match = String(ref || '').match(/^d(\d+)$/);
    if (match) return { row:draft.rows[Number(match[1])-1], index:Number(match[1])-1 };
    const nq = engine()?.unitCanon?.(query) || String(query || '');
    for (let i=draft.rows.length-1;i>=0;i--) {
      const name = engine()?.unitCanon?.(draft.rows[i].query) || draft.rows[i].query;
      if (nq && (name.includes(nq) || nq.includes(name))) return { row:draft.rows[i], index:i };
    }
    return null;
  }

  function applyVoicePlan(plan) {
    if (!draft) return { ok:false, message:'編集画面が開いていません。' };
    const confirm = plan?.operations?.find(op => op.needsConfirmation);
    if (confirm) return { ok:false, message:confirm.confirmationQuestion || 'どの食品かもう少し具体的に教えてください。' };
    const replies = [];
    let changed = false;
    for (const op of plan?.operations || []) {
      if (op.op === 'question' || op.op === 'noop') { if (op.answer) replies.push(op.answer); continue; }
      if (op.op === 'add') {
        const row = createRow({ source:'voice-draft', query:op.foodQuery, amountValue:op.amountValue, amountUnit:op.amountUnit });
        draft.rows.push(row); changed = true; continue;
      }
      const target = targetDraftRow(op.targetRef, op.targetQuery || op.foodQuery);
      if (!target) { replies.push('編集対象を特定できませんでした。'); continue; }
      if (op.op === 'delete') { draft.rows.splice(target.index,1); changed = true; continue; }
      if (op.op === 'update') {
        if (op.replacementQuery) {
          target.row.query = op.replacementQuery;
          target.row.dbIndex = null; target.row.dbName = '';
          const resolved = engine()?.safeResolveFood?.(op.replacementQuery);
          if (resolved) bindMatch(target.row,resolved,true);
        }
        if (positive(op.amountValue)) target.row.amount = Number(op.amountValue);
        if (op.amountUnit) target.row.unit = op.amountUnit;
        target.row.edited = true; changed = true;
      }
      if (op.op === 'undo') replies.push('編集中のカードは手動で戻してください。');
    }
    if (changed) render();
    if (!replies.length) replies.push('写真の編集内容を更新しました。');
    return { ok:true, message:replies.join(' '), changed:[] };
  }

  function openFromUnresolved(items) {
    const rows = (items || []).map(item => createRow({ source:'voice', query:item.query || '', amountValue:item.amountValue, amountUnit:item.amountUnit }));
    open({ source:'voice', title:'Food Masterで確認', rows, dishName:'' });
  }

  function rowsFromPhoto(identity) {
    return (identity?.foods || []).map(ai => createRow({ source:'photo', query:ai.name, ai }));
  }

  async function compressImage(file) {
    let bitmap = null;
    let width = 0, height = 0;
    try {
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(file, { imageOrientation:'from-image' });
        width = bitmap.width; height = bitmap.height;
      }
    } catch {}
    if (!bitmap) {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image(); img.decoding = 'async'; img.src = url;
        await new Promise((resolve,reject) => { img.onload=resolve; img.onerror=()=>reject(new Error('画像を開けませんでした')); });
        bitmap = img; width = img.naturalWidth || img.width; height = img.naturalHeight || img.height;
      } finally { setTimeout(() => URL.revokeObjectURL(url),0); }
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(width,height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(width*scale)); canvas.height = Math.max(1,Math.round(height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    try { bitmap.close?.(); } catch {}
    return canvas.toDataURL('image/jpeg',JPEG_QUALITY).replace(/^data:image\/jpeg;base64,/, '');
  }

  function choosePhotoSource() {
    const host = ensureHost();
    draft = { source:'source', title:'料理写真から追加', rows:[], dishName:'' };
    host.classList.add('show'); document.documentElement.classList.add('v50-editor-open');
    host.querySelector('#v50-title').textContent = '料理写真から追加';
    host.querySelector('#v50-kicker').textContent = 'PHOTO INPUT';
    host.querySelector('#v50-body').innerHTML = '<div class="v50-source-grid"><button type="button" id="v50-camera"><b>カメラで撮る</b><span>今の食事を撮影</span></button><button type="button" id="v50-library"><b>カメラロールから選ぶ</b><span>保存済みの写真を選択</span></button></div><div class="v50-guide">写真AIは食品名と量の仮値だけを作ります。P/F/C/kcalはFood Masterから計算します。</div>';
    host.querySelector('footer').style.display = 'none';
    host.querySelector('#v50-camera').onclick = () => selectPhoto('camera');
    host.querySelector('#v50-library').onclick = () => selectPhoto('library');
  }

  function selectPhoto(source) {
    const host = ensureHost(); host.classList.remove('show'); document.documentElement.classList.remove('v50-editor-open'); draft = null;
    const id = `v50-photo-${source}`;
    let input = document.getElementById(id);
    if (!input) {
      input = document.createElement('input'); input.id=id; input.type='file'; input.accept='image/*'; input.hidden=true;
      if (source === 'camera') input.setAttribute('capture','environment');
      document.body.appendChild(input);
      input.onchange = async event => {
        const file = event.target.files?.[0]; event.target.value='';
        if (file) await runPhoto(file);
      };
    }
    input.click();
  }

  async function runPhoto(file) {
    if (busy) return; busy = true;
    const host = ensureHost(); host.classList.add('show'); document.documentElement.classList.add('v50-editor-open');
    host.querySelector('footer').style.display = 'none';
    host.querySelector('#v50-title').textContent = '料理写真を解析中'; host.querySelector('#v50-kicker').textContent = 'PHOTO AI';
    host.querySelector('#v50-body').innerHTML = '<div class="v50-loading"><span></span><b>食品と量の仮入力を作成しています…</b><small>P/F/C/kcalはAIに生成させません。</small></div>';
    try {
      const photo = window.__PFC_DISH_PHOTO_V40__;
      if (!photo?.identifyDish) throw new Error('料理写真AIを利用できません');
      const identity = await photo.identifyDish(await compressImage(file));
      if (!identity?.foods?.length) throw new Error('食べ物として認識できませんでした');
      host.querySelector('footer').style.display = '';
      open({ source:'photo', title:'写真認識を確認', dishName:identity.dishName || '', rows:rowsFromPhoto(identity) });
    } catch (error) {
      host.querySelector('#v50-title').textContent = '判定できませんでした';
      host.querySelector('#v50-body').innerHTML = `<div class="v50-error">${esc(error?.message || '料理写真の判定に失敗しました')}</div><button type="button" id="v50-photo-retry" class="v50-add-row">写真を選び直す</button>`;
      host.querySelector('#v50-photo-retry').onclick = choosePhotoSource;
    } finally { busy=false; }
  }

  function install() {
    const action = document.getElementById('dish-v30-action');
    if (action) { action.onclick = choosePhotoSource; action.setAttribute('aria-label','料理写真をMeal Draftへ読み込む'); }
    ensureHost().querySelector('footer').style.display = '';
  }

  window.__PFC_MEAL_EDITOR_V50__ = {
    version:VERSION,
    singleLayerEditor:true,
    directNameEditing:true,
    inlineDbSearch:true,
    removableCards:true,
    voiceDraftEditing:true,
    photoUsesFoodMasterNutrition:true,
    hasOpenDraft:() => !!draft && draft.source !== 'source',
    plannerContext,
    applyVoicePlan,
    openFromUnresolved,
    choosePhotoSource,
    runPhoto,
    createRow,
    bindMatch,
    rowNutrition,
    install
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();

;

/* ===== pfc-meal-v501-hardening.js ===== */
// PFC Mirror Meal V5.0.1 hardening + Voice Intelligence V5.1.
// Keeps the single-layer editor hardening while replacing the voice command path
// with richer context, generic confirmation memory, deterministic Food Master repair,
// and Gemini 3.5 Flash-Lite planning.
(() => {
  'use strict';

  // Keep this marker for the existing build contract.
  const VERSION = '5.0.1';
  const VOICE_INTELLIGENCE_VERSION = '5.1.0';
  const VOICE_MODEL = 'gemini-3.5-flash-lite';
  const LAST_TX_KEY = 'pfc_v50_last_transaction';
  const PENDING_KEY = 'pfc_v50_pending_action';
  const PENDING_TTL_MS = 5 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 30000;
  const MAX_RECENT = 12;

  let editorRecognition = null;
  let voiceBusyV51 = false;

  const engine = () => window.__PFC_MEAL_ENGINE_V50__ || null;
  const dbv3 = () => window.__PFC_DB_V3__ || null;
  const storage = () => window.mirrorStorage || window.localStorage;
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalize = value => String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[・･\s]/g, '')
    .trim();
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10000;
  const unitCanon = value => engine()?.unitCanon?.(value) || String(value || '').trim();

  function readJson(key) {
    try { return JSON.parse(storage().getItem(key) || 'null'); } catch { return null; }
  }
  function writeJson(key, value) {
    if (value == null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  }

  function getPending() {
    const pending = readJson(PENDING_KEY);
    if (!pending) return null;
    if (Date.now() - Number(pending.createdAt || 0) > PENDING_TTL_MS) {
      writeJson(PENDING_KEY, null);
      return null;
    }
    return pending;
  }
  function setPending(value) { writeJson(PENDING_KEY, value); }

  function yesAnswer(text) {
    return /^(はい|うん|お願い|お願いします|それで|それでお願い|実行|やって|やってください|ok|オーケー)$/i.test(String(text || '').trim());
  }
  function noAnswer(text) {
    return /^(いいえ|いや|違う|やめ|やめて|キャンセル|中止|戻る)$/i.test(String(text || '').trim());
  }

  function stripName(record) {
    return engine()?.stripRecordName?.(record?.N) || String(record?.N || '').replace(/[（(][^()（）]*[0-9][^()（）]*[)）]\s*$/,'').trim();
  }

  function legacyAmountUnit(record) {
    if (positive(record?._dbv3?.amount)) {
      return { amount:Number(record._dbv3.amount), unit:unitCanon(record._dbv3.unit || '') };
    }
    const match = String(record?.N || '').match(/[（(]\s*([0-9]+(?:\.[0-9]+)?)\s*(g|ml|個|玉|杯|本|枚|切れ|切|パック|食|人前)\s*[)）]\s*$/i);
    if (!match || !positive(match[1])) return null;
    return { amount:Number(match[1]), unit:unitCanon(match[2]) };
  }

  function recordDbIndex(record) {
    if (Number.isFinite(Number(record?._dbv3?.index))) return Number(record._dbv3.index);
    const resolved = engine()?.safeResolveFood?.(stripName(record));
    return resolved ? Number(resolved.index) : null;
  }

  function recordAmountUnit(record, index) {
    const parsed = legacyAmountUnit(record);
    if (parsed?.amount && parsed?.unit) return parsed;
    const meta = dbv3()?.get?.(index);
    const amount = positive(record?._dbv3?.amount) ? Number(record._dbv3.amount) : null;
    const unit = unitCanon(record?._dbv3?.unit || meta?.input?.defaultUnit || '');
    return amount && unit ? { amount, unit } : null;
  }

  function expectedRecord(record) {
    const index = recordDbIndex(record);
    if (!Number.isFinite(index)) return null;
    const amountUnit = recordAmountUnit(record,index);
    if (!amountUnit) return null;
    return engine()?.buildTrustedRecord?.(index, amountUnit.amount, amountUnit.unit, record.time || '', record.id) || null;
  }

  function nutritionMismatch(record, expected) {
    if (!expected) return null;
    const keys = ['P','F','C','A','Cal'];
    return keys.some(key => Math.abs(Number(record?.[key] || 0) - Number(expected?.[key] || 0)) > 0.6);
  }

  function buildRichRecordContext() {
    const source = (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst.slice(-MAX_RECENT).reverse() : [];
    return source.map((record,index) => {
      const expected = expectedRecord(record);
      const amountUnit = legacyAmountUnit(record);
      const dbIndex = recordDbIndex(record);
      return {
        ref:`r${index + 1}`,
        id:Number(record.id),
        time:record.time || '',
        name:stripName(record),
        displayName:String(record.N || ''),
        amount:amountUnit?.amount ?? (positive(record?._dbv3?.amount) ? Number(record._dbv3.amount) : null),
        unit:amountUnit?.unit || unitCanon(record?._dbv3?.unit || ''),
        p:Number(record.P || 0),
        f:Number(record.F || 0),
        c:Number(record.C || 0),
        a:Number(record.A || 0),
        kcal:Number(record.Cal || 0),
        dbIndex:Number.isFinite(dbIndex) ? dbIndex : null,
        foodMasterExpected:expected ? {
          p:Number(expected.P || 0),
          f:Number(expected.F || 0),
          c:Number(expected.C || 0),
          a:Number(expected.A || 0),
          kcal:Number(expected.Cal || 0)
        } : null,
        nutritionMismatch:nutritionMismatch(record,expected),
        trusted:record?._mealEngine?.trusted === true
      };
    });
  }

  function totals() {
    return engine()?.currentTotals?.() || { kcal:0,p:0,f:0,c:0,a:0 };
  }

  function plannerContextV51() {
    const current = totals();
    const pending = getPending();
    const lastTx = readJson(LAST_TX_KEY);
    let draft = [];
    try { draft = window.__PFC_MEAL_EDITOR_V50__?.plannerContext?.() || []; } catch {}
    const targets = (typeof TG !== 'undefined' && TG) ? { kcal:TG.cal,p:TG.p,f:TG.f,c:TG.c } : {};
    return {
      currentTime:new Date().toISOString(),
      currentMeal:typeof getAutoTime === 'function' ? getAutoTime() : '',
      targets,
      totals:{
        kcal:Math.round(Number(current.kcal || 0)),
        p:Number(Number(current.p || 0).toFixed(1)),
        f:Number(Number(current.f || 0).toFixed(1)),
        c:Number(Number(current.c || 0).toFixed(1)),
        a:Number(Number(current.a || 0).toFixed(1))
      },
      recentRecords:buildRichRecordContext(),
      lastTransaction:lastTx ? { id:lastTx.id, summary:lastTx.summary || '', changedIds:lastTx.changedIds || [] } : null,
      pendingAction:pending ? { type:pending.type || '', question:pending.question || '', plan:pending.plan || null } : null,
      mealDraft:draft
    };
  }

  function plannerPromptV51() {
    return `あなたは食事管理アプリの操作プランナーです。自然な日本語、短い返答、省略、言い直し、音声認識の揺れを文脈込みで理解し、JSONだけを返してください。

重要:
- P/F/C/A/kcalは絶対に生成・推測しない。栄養値はFood Masterだけが決定する。
- recentRecordsには現在の栄養値とfoodMasterExpectedがある。nutritionMismatch=trueならFood Master再計算で修復可能。
- 「成分がおかしい」「栄養がおかしい」「PFCがおかしい」「カロリーがおかしい」「成分直して」「修整して」「再計算して」は、対象が一意ならrepair。確認質問を挟まない。
- repairは食品・量・単位・時刻・IDを保持し、Food Masterから栄養値だけを再構築する。
- recentRecordsのrefを優先して対象を指定する。
- pendingActionがある場合、「はい」「うん」「それで」などはその未完了操作への返答として扱う。ただし通常はアプリ側が先に処理する。
- 「これ」「それ」「さっきの」「今の」はmealDraft、lastTransaction、recentRecordsの順で文脈解決する。
- updateで量を言っていない場合はpreserveAmount=true。
- 質問だけならquestion。記録操作を勝手に行わない。
- 「今の全部消して」「さっき入れたの全部消して」はundoを優先。
- 「今日の記録を全部消して」はdelete scope=allToday needsConfirmation=true。
- 対象が本当に複数で特定不能な場合だけneedsConfirmation=true。
- 今日以外の記録操作はnoop。
- 「さんたま」=3玉、「にぱっく」=2パック等を自然に解釈する。

operation:
{
 "op":"add|update|repair|delete|undo|question|noop",
 "foodQuery":"",
 "replacementQuery":"",
 "amountValue":null,
 "amountUnit":"",
 "targetRef":"",
 "targetQuery":"",
 "scope":"single|lastTransaction|allToday",
 "preserveAmount":true,
 "needsConfirmation":false,
 "confirmationQuestion":"",
 "answer":""
}

出力:
{"operations":[...],"reply":""}
JSON以外は禁止。`;
  }

  function parsePlanV51(raw) {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    if (!parsed || !Array.isArray(parsed.operations)) return null;
    const allowed = new Set(['add','update','repair','delete','undo','question','noop']);
    parsed.operations = parsed.operations.filter(op => op && allowed.has(op.op)).slice(0,12).map(op => ({
      op:op.op,
      foodQuery:String(op.foodQuery || '').slice(0,80),
      replacementQuery:String(op.replacementQuery || '').slice(0,80),
      amountValue:positive(op.amountValue) ? Number(op.amountValue) : null,
      amountUnit:unitCanon(op.amountUnit),
      targetRef:String(op.targetRef || '').slice(0,20),
      targetQuery:String(op.targetQuery || '').slice(0,80),
      scope:String(op.scope || 'single'),
      preserveAmount:op.preserveAmount !== false,
      needsConfirmation:op.needsConfirmation === true,
      confirmationQuestion:String(op.confirmationQuestion || '').slice(0,180),
      answer:String(op.answer || '').slice(0,500)
    }));
    parsed.reply = String(parsed.reply || '').slice(0,500);
    return parsed;
  }

  function gasEndpoint() {
    try { if (typeof gasUrl !== 'undefined' && gasUrl) return gasUrl; } catch {}
    return 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  }

  function extractAiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim() : '';
  }

  async function requestPlanV51(text) {
    const payload = {
      taskType:'chat',
      modelPreference:VOICE_MODEL,
      contents:[{parts:[{text:`${plannerPromptV51()}\n\n【アプリ状態】\n${JSON.stringify(plannerContextV51())}\n\n【ユーザー発言】\n${String(text || '').trim()}`}]}],
      generationConfig:{ maxOutputTokens:900,responseMimeType:'application/json',temperature:0.1 }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(gasEndpoint(),{
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify(payload),
        signal:controller.signal
      });
      if (!response.ok) throw new Error(`音声AI HTTP ${response.status}`);
      const data = await response.json();
      const raw = extractAiText(data);
      if (/^GASエラー:/i.test(raw)) throw new Error(raw.slice(0,240));
      const plan = parsePlanV51(raw);
      if (!plan) throw new Error('音声AIの操作計画を読めませんでした');
      return plan;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('音声AIが30秒以内に応答しませんでした');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function saveRecords(records) {
    if (typeof lst === 'undefined' || !Array.isArray(lst)) throw new Error('食事記録を参照できません');
    lst.splice(0,lst.length,...records);
    if (typeof sv === 'function') sv();
    else storage().setItem('tf_dat',JSON.stringify(lst));
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
  }

  function saveTransaction(before,after,summary,changedIds) {
    writeJson(LAST_TX_KEY,{
      id:`tx-${Date.now()}`,
      createdAt:Date.now(),
      version:VOICE_INTELLIGENCE_VERSION,
      summary,
      changedIds:[...new Set((changedIds || []).map(Number).filter(Boolean))],
      before,
      after
    });
  }

  function resolveTargetIdsV51(op,records) {
    const refs = engine()?.buildRecordRefs?.().refs;
    if (op.scope === 'allToday') return records.map(item => Number(item.id)).filter(Boolean);
    if (op.scope === 'lastTransaction') {
      const tx = readJson(LAST_TX_KEY);
      return (tx?.changedIds || []).map(Number).filter(id => records.some(item => Number(item.id) === id));
    }
    if (op.targetRef && refs?.has(op.targetRef)) return [Number(refs.get(op.targetRef))];
    const query = normalize(op.targetQuery || op.foodQuery || '');
    if (!query) return [];
    const matches = records.slice().reverse().filter(item => {
      const name = normalize(stripName(item));
      return name && (name.includes(query) || query.includes(name));
    });
    return matches.length ? [Number(matches[0].id)] : [];
  }

  function rebuildRecord(record) {
    const index = recordDbIndex(record);
    if (!Number.isFinite(index)) return null;
    const amountUnit = recordAmountUnit(record,index);
    if (!amountUnit) return null;
    const rebuilt = engine()?.buildTrustedRecord?.(index,amountUnit.amount,amountUnit.unit,record.time || '',record.id);
    const validation = engine()?.validateTrustedRecord?.(rebuilt);
    if (!rebuilt || !validation?.ok) return null;
    rebuilt._mealEngine = {
      ...(rebuilt._mealEngine || {}),
      version:VOICE_INTELLIGENCE_VERSION,
      nutritionSource:'Food Master',
      trusted:true,
      repaired:true,
      repairedAt:Date.now()
    };
    return rebuilt;
  }

  function executeRepairOps(ops) {
    const before = (typeof lst !== 'undefined' && Array.isArray(lst)) ? clone(lst) : [];
    const working = clone(before);
    const changed = [];
    const changedIds = [];
    const unresolved = [];

    for (const op of ops) {
      const targetIds = resolveTargetIdsV51(op,working);
      if (!targetIds.length) {
        unresolved.push({query:op.targetQuery || op.foodQuery,operation:'repair',source:'voice-target'});
        continue;
      }
      for (const targetId of targetIds) {
        const pos = working.findIndex(item => Number(item.id) === Number(targetId));
        if (pos < 0) continue;
        const rebuilt = rebuildRecord(working[pos]);
        if (!rebuilt) {
          unresolved.push({query:stripName(working[pos]),operation:'repair',targetId,source:'voice'});
          continue;
        }
        working[pos] = rebuilt;
        changed.push(rebuilt);
        changedIds.push(rebuilt.id);
      }
    }

    if (unresolved.length) {
      return {ok:false,unresolved,message:'Food Masterで安全に再計算できない項目があります。編集画面で確認してください。'};
    }
    saveRecords(working);
    const names = changed.map(stripName).filter(Boolean);
    saveTransaction(before,clone(working),`${names.join('、') || '食事'}をFood Masterから再計算`,changedIds);
    setPending(null);
    return {
      ok:true,
      message:`${changed.length}件をFood Masterから再計算して修正しました。`,
      changed
    };
  }

  function tryLocalRepair(text) {
    const raw = String(text || '').trim();
    const intent = /(?:成分|栄養|pfc|カロリー|cal).*(?:おかし|変|修正|修整|直|再計算)|(?:修正|修整|直|再計算).*(?:成分|栄養|pfc|カロリー|cal)/i.test(raw);
    if (!intent) return null;
    const records = (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst.slice() : [];
    const matches = records.slice().reverse().filter(record => {
      const name = normalize(stripName(record));
      return name && normalize(raw).includes(name);
    });
    let target = null;
    if (matches.length === 1) target = matches[0];
    else if (matches.length > 1 && /(さっき|直近|最後|今の)/.test(raw)) target = matches[0];
    if (!target) return null;
    return executeRepairOps([{op:'repair',targetQuery:stripName(target),targetRef:'',scope:'single'}]);
  }

  function confirmationFromPlan(plan) {
    const dangerous = (plan.operations || []).find(op => op.op === 'delete' && op.scope === 'allToday');
    if (dangerous) {
      const executable = clone(plan);
      executable.operations.forEach(op => { op.needsConfirmation = false;op.confirmationQuestion = ''; });
      const question = dangerous.confirmationQuestion || '今日の記録をすべて削除しますか？';
      setPending({type:'planConfirmationV51',createdAt:Date.now(),question,plan:executable});
      return {ok:false,confirmation:true,message:question};
    }
    const op = (plan.operations || []).find(item => item.needsConfirmation);
    if (!op) return null;
    const executable = clone(plan);
    executable.operations.forEach(item => { item.needsConfirmation = false;item.confirmationQuestion = ''; });
    const question = op.confirmationQuestion || 'この内容で実行しますか？';
    setPending({type:'planConfirmationV51',createdAt:Date.now(),question,plan:executable});
    return {ok:false,confirmation:true,message:question};
  }

  function executeDeleteAllV51() {
    const before = (typeof lst !== 'undefined' && Array.isArray(lst)) ? clone(lst) : [];
    saveRecords([]);
    saveTransaction(before,[],'今日の記録をすべて削除',before.map(item => item.id));
    setPending(null);
    return {ok:true,message:`${before.length}件の記録を削除しました。`,changed:[]};
  }

  function executePlanV51(plan) {
    if (!plan?.operations?.length) return {ok:false,message:plan?.reply || '操作内容を特定できませんでした。'};

    const confirmation = confirmationFromPlan(plan);
    if (confirmation) return confirmation;

    if (plan.operations.some(op => op.op === 'undo')) {
      setPending(null);
      return engine()?.undoLastTransaction?.() || {ok:false,message:'取り消せる操作がありません。'};
    }

    const repairs = plan.operations.filter(op => op.op === 'repair');
    const others = plan.operations.filter(op => op.op !== 'repair');
    const messages = [];
    const changed = [];
    let unresolved = [];

    if (others.length) {
      const result = engine()?.executePlan?.({operations:others,reply:plan.reply || ''},engine()?.buildRecordRefs?.().refs);
      if (result?.unresolved?.length) unresolved = unresolved.concat(result.unresolved);
      if (result?.message) messages.push(result.message);
      if (result?.changed?.length) changed.push(...result.changed);
      if (result?.confirmation) return result;
    }

    if (repairs.length) {
      const result = executeRepairOps(repairs);
      if (result?.unresolved?.length) unresolved = unresolved.concat(result.unresolved);
      if (result?.message) messages.push(result.message);
      if (result?.changed?.length) changed.push(...result.changed);
    }

    if (unresolved.length) return {ok:false,unresolved,message:'確認が必要な食品があります。'};
    setPending(null);
    return {ok:true,message:messages.filter(Boolean).join(' ') || plan.reply || '処理しました。',changed};
  }

  function resultCards(items) {
    const rows = (items || []).map(item => `<div class="v50-result-card"><b>${escapeHtml(stripName(item))}</b><span>P ${Number(item.P || 0).toFixed(1)} / F ${Number(item.F || 0).toFixed(1)} / C ${Number(item.C || 0).toFixed(1)}</span><strong>${Math.round(Number(item.Cal || 0)).toLocaleString()} kcal</strong></div>`).join('');
    return rows ? `<div class="v50-result-list">${rows}</div>` : '';
  }

  function removeLoading(loadingId) {
    if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
  }

  function showBot(message,changed=[]) {
    if (typeof addChatMsg === 'function') addChatMsg('bot',escapeHtml(message || '処理しました。') + resultCards(changed),true);
  }

  async function sendVoiceV51() {
    const input = document.getElementById('v-chat-input');
    const text = String(input?.value || '').trim();
    if (!text || voiceBusyV51) return;

    voiceBusyV51 = true;
    const status = document.getElementById('v-status-text');
    if (input) { input.value='';input.disabled=true; }
    if (status) status.textContent='音声を解析中…';
    if (typeof addChatMsg === 'function') addChatMsg('user',text);
    const loadingId = typeof addChatMsg === 'function' ? addChatMsg('bot','音声を解析中…') : null;

    try {
      const pending = getPending();
      if (pending?.type === 'planConfirmationV51' && yesAnswer(text)) {
        setPending(null);
        let result;
        if ((pending.plan?.operations || []).some(op => op.op === 'delete' && op.scope === 'allToday')) result = executeDeleteAllV51();
        else result = executePlanV51(pending.plan);
        removeLoading(loadingId);
        showBot(result?.message || '実行しました。',result?.changed || []);
        return;
      }
      if (pending?.type === 'planConfirmationV51' && noAnswer(text)) {
        setPending(null);
        removeLoading(loadingId);
        showBot('キャンセルしました。');
        return;
      }

      const localRepair = tryLocalRepair(text);
      if (localRepair) {
        removeLoading(loadingId);
        showBot(localRepair.message,localRepair.changed || []);
        return;
      }

      const plan = await requestPlanV51(text);
      if (pending?.type === 'planConfirmationV51') setPending(null);
      if (status) status.textContent='Food Masterを照合中…';

      const editor = window.__PFC_MEAL_EDITOR_V50__;
      let result;
      if (editor?.hasOpenDraft?.() && !plan.operations.some(op => op.op === 'repair')) {
        result = editor.applyVoicePlan(plan);
      } else {
        result = executePlanV51(plan);
      }

      removeLoading(loadingId);
      if (result?.unresolved?.length && editor?.openFromUnresolved) editor.openFromUnresolved(result.unresolved);
      showBot(result?.message || plan.reply || '処理しました。',result?.changed || []);
    } catch (error) {
      removeLoading(loadingId);
      showBot(`音声処理に失敗しました。${error?.message || ''}`);
    } finally {
      if (status) status.textContent='マイクOFF';
      if (input) input.disabled=false;
      voiceBusyV51=false;
    }
  }

  function ensureStyle() {
    if (document.getElementById('pfc-meal-v501-style')) return;
    const style = document.createElement('style');
    style.id = 'pfc-meal-v501-style';
    style.textContent = `.v50-footer-actions{display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);gap:8px}.v50-voice-edit{border:1px solid #bfe0d1;border-radius:14px;background:#eef9f4;color:#167653;font-size:13px;font-weight:900;padding:13px 8px}.v50-voice-edit.is-listening{background:#dcf5e9;box-shadow:0 0 0 3px rgba(34,160,107,.12)}@media(max-width:360px){.v50-footer-actions{grid-template-columns:1fr}.v50-voice-edit{padding:10px}}`;
    document.head.appendChild(style);
  }

  function submitTranscript(text) {
    const input = document.getElementById('v-chat-input');
    const transcript = String(text || '').trim();
    if (!transcript || !input || typeof window.sendVoiceChat !== 'function') return false;
    input.value = transcript;
    input.disabled = false;
    window.sendVoiceChat();
    return true;
  }

  function startEditorVoice(voice,status) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (status) status.textContent='このブラウザは音声入力に対応していません。';
      return;
    }
    try { editorRecognition?.abort?.(); } catch {}
    const recognition = new SpeechRecognition();
    editorRecognition = recognition;
    recognition.lang='ja-JP';
    recognition.continuous=false;
    recognition.interimResults=false;
    try { recognition.maxAlternatives=3; } catch {}
    recognition.onstart=()=>{
      voice.classList.add('is-listening');
      if (status) status.textContent='話してください。例:「唐揚げを100gにして」「キャベツ消して」';
    };
    recognition.onresult=event=>{
      const result=event?.results?.[0];
      const transcript=result?.[0]?.transcript || '';
      if (status) status.textContent=transcript ? `認識: ${transcript}` : '音声を認識できませんでした。';
      submitTranscript(transcript);
    };
    recognition.onerror=event=>{
      if (status) status.textContent=event?.error === 'not-allowed' ? 'マイクの使用を許可してください。' : '音声入力に失敗しました。もう一度試してください。';
    };
    recognition.onend=()=>{
      voice.classList.remove('is-listening');
      editorRecognition=null;
    };
    try { recognition.start(); }
    catch {
      voice.classList.remove('is-listening');
      if (status) status.textContent='音声入力を開始できませんでした。';
    }
  }

  function ensureVoiceButton() {
    const host=document.getElementById('pfc-meal-editor-v50');
    const footer=host?.querySelector('footer');
    const commit=host?.querySelector('#v50-commit');
    if (!host || !footer || !commit || footer.querySelector('#v50-voice-edit')) return false;
    const wrap=document.createElement('div');
    wrap.className='v50-footer-actions';
    commit.parentNode.insertBefore(wrap,commit);
    wrap.appendChild(commit);
    const voice=document.createElement('button');
    voice.type='button';
    voice.id='v50-voice-edit';
    voice.className='v50-voice-edit';
    voice.textContent='🎤 声で修正';
    wrap.insertBefore(voice,commit);
    voice.onclick=()=>{
      const editor=window.__PFC_MEAL_EDITOR_V50__;
      const status=host.querySelector('#v50-status');
      if (!editor?.hasOpenDraft?.()) {
        if (status) status.textContent='食品カードを開いてから音声修正を使ってください。';
        return;
      }
      if (editorRecognition) {
        try { editorRecognition.stop(); } catch {}
        return;
      }
      startEditorVoice(voice,status);
    };
    return true;
  }

  function recoverFooterForDraft() {
    const host=document.getElementById('pfc-meal-editor-v50');
    if (!host?.classList.contains('show')) return;
    const kicker=host.querySelector('#v50-kicker')?.textContent || '';
    if (kicker === 'PHOTO INPUT' || kicker === 'PHOTO AI') return;
    const footer=host.querySelector('footer');
    if (footer) footer.style.display='';
  }

  function patchUnresolvedOpen() {
    const editor=window.__PFC_MEAL_EDITOR_V50__;
    if (!editor?.openFromUnresolved || editor.openFromUnresolved.__v501) return;
    const original=editor.openFromUnresolved;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      recoverFooterForDraft();
      ensureVoiceButton();
      return result;
    };
    wrapped.__v501=true;
    editor.openFromUnresolved=wrapped;
  }

  function install() {
    ensureStyle();
    ensureVoiceButton();
    patchUnresolvedOpen();

    const e=engine();
    if (e) {
      e.voiceModel=VOICE_MODEL;
      e.voiceIntelligenceVersion=VOICE_INTELLIGENCE_VERSION;
      e.requestPlan=requestPlanV51;
      e.plannerPrompt=plannerPromptV51;
      e.recordNutritionContext=true;
      e.genericConfirmationMemory=true;
      e.foodMasterRepair=true;
    }
    window.sendVoiceChat=sendVoiceV51;

    const host=document.getElementById('pfc-meal-editor-v50');
    if (host && typeof MutationObserver !== 'undefined') {
      const observer=new MutationObserver(()=>{recoverFooterForDraft();ensureVoiceButton();});
      observer.observe(host,{attributes:true,subtree:true,childList:true,attributeFilter:['class','style']});
    }

    window.__PFC_MEAL_V501__={
      version:VERSION,
      voiceIntelligenceVersion:VOICE_INTELLIGENCE_VERSION,
      voiceModel:VOICE_MODEL,
      inEditorVoice:true,
      editorVoiceIndependentAutoSend:true,
      footerRecovery:true,
      singleLayerPreserved:true,
      genericConfirmationMemory:true,
      recordNutritionContext:true,
      foodMasterRepair:true,
      localRepairFastPath:true,
      buildRichRecordContext,
      parsePlanV51,
      plannerPromptV51,
      requestPlanV51,
      executePlanV51,
      tryLocalRepair
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
;

/* ===== pfc-agent-v60.js ===== */
// PFC Mirror Agent Runtime V6.0
// Capability-based tool agent for voice/text control. Gemini interprets intent;
// the browser owns permissions, Food Master truth, transactions, and confirmation gates.
(() => {
  'use strict';

  const VERSION = '6.0.0';
  const MODEL = 'gemini-3.5-flash-lite';
  const MAX_AGENT_STEPS = 4;
  const REQUEST_TIMEOUT_MS = 30000;
  const HISTORY_KEY = 'pfc_agent_v60_history';
  const PENDING_KEY = 'pfc_agent_v60_pending';
  const LAST_TX_KEY = 'pfc_v50_last_transaction';
  const PENDING_TTL_MS = 10 * 60 * 1000;
  let busy = false;

  const engine = () => window.__PFC_MEAL_ENGINE_V50__ || null;
  const editor = () => window.__PFC_MEAL_EDITOR_V50__ || null;
  const dbv3 = () => window.__PFC_DB_V3__ || null;
  const multi = () => window.__PFC_DB_V3_MULTIUNIT__ || null;
  const storage = () => window.mirrorStorage || window.localStorage;
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = value => Number.isFinite(Number(value));
  const positive = value => finite(value) && Number(value) > 0 && Number(value) <= 10000;
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)).replace(/[・･\s]/g, '').trim();
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const unitCanon = value => engine()?.unitCanon?.(value) || String(value || '').trim();

  function readJson(key, fallback = null) {
    try { const value = JSON.parse(storage().getItem(key) || 'null'); return value == null ? fallback : value; }
    catch { return fallback; }
  }
  function writeJson(key, value) {
    if (value == null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  }

  function cleanMasterName(index) {
    const meta = dbv3()?.get?.(Number(index));
    const raw = String(meta?.baseName || meta?.name || '').trim();
    return raw.replace(/[（(]\s*1(?:\.0+)?\s*(?:g|ml|個|玉|杯|本|枚|切れ|切|パック|食|人前)\s*[)）]\s*$/i,'').trim() || raw;
  }
  function formatAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  }
  function recordIndex(record) {
    if (finite(record?._dbv3?.index)) return Number(record._dbv3.index);
    const resolved = engine()?.safeResolveFood?.(engine()?.stripRecordName?.(record?.N) || record?.N || '');
    return resolved ? Number(resolved.index) : null;
  }
  function recordAmountUnit(record, index) {
    if (positive(record?._dbv3?.amount)) {
      return { amount:Number(record._dbv3.amount), unit:unitCanon(record._dbv3.unit || dbv3()?.get?.(index)?.input?.defaultUnit || '') };
    }
    const match = String(record?.N || '').match(/[（(]\s*([0-9]+(?:\.[0-9]+)?)\s*(g|ml|個|玉|杯|本|枚|切れ|切|パック|食|人前)\s*[)）]\s*$/i);
    if (match && positive(match[1])) return { amount:Number(match[1]), unit:unitCanon(match[2]) };
    const meta = dbv3()?.get?.(index);
    if (positive(meta?.input?.defaultAmount)) return { amount:Number(meta.input.defaultAmount), unit:unitCanon(meta.input.defaultUnit) };
    return null;
  }
  function normalizeBuiltName(record, index, amount, unit) {
    if (!record) return record;
    const clean = cleanMasterName(index) || engine()?.stripRecordName?.(record.N) || record.N || '食品';
    const amountText = positive(amount) && unit ? `(${formatAmount(amount)}${unitCanon(unit)})` : '';
    record.N = `${clean}${amountText}`;
    return record;
  }
  function summarizeRecord(record) {
    const index = recordIndex(record);
    const au = Number.isFinite(index) ? recordAmountUnit(record,index) : null;
    return {
      id:Number(record?.id),
      name:Number.isFinite(index) ? cleanMasterName(index) : (engine()?.stripRecordName?.(record?.N) || String(record?.N || '')),
      amount:au?.amount ?? null,
      unit:au?.unit || '',
      meal:String(record?.time || ''),
      p:Number(record?.P || 0), f:Number(record?.F || 0), c:Number(record?.C || 0), a:Number(record?.A || 0), kcal:Number(record?.Cal || 0),
      foodIndex:Number.isFinite(index) ? index : null
    };
  }
  function todayRecords() {
    return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : [];
  }
  function saveRecords(records) {
    if (typeof lst === 'undefined' || !Array.isArray(lst)) throw new Error('食事記録へアクセスできません');
    lst.splice(0,lst.length,...records);
    if (typeof sv === 'function') sv();
    else storage().setItem('tf_dat',JSON.stringify(lst));
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
  }
  function saveTransaction(before, after, summary, changedIds) {
    writeJson(LAST_TX_KEY,{
      id:`tx-${Date.now()}`,
      createdAt:Date.now(), version:VERSION, summary,
      changedIds:[...new Set((changedIds || []).map(Number).filter(Boolean))],
      before:clone(before), after:clone(after)
    });
  }

  function buildRecord(index, amount, unit, meal, id) {
    const meta = dbv3()?.get?.(Number(index));
    if (!meta) throw new Error('Food Masterの食品番号が不正です');
    const finalAmount = positive(amount) ? Number(amount) : Number(meta.input?.defaultAmount || meta.nutritionBasis?.amount || 1);
    const finalUnit = unitCanon(unit || meta.input?.defaultUnit || meta.nutritionBasis?.unit || '');
    const record = engine()?.buildTrustedRecord?.(Number(index),finalAmount,finalUnit,meal || (typeof getAutoTime === 'function' ? getAutoTime() : ''),id);
    const validation = engine()?.validateTrustedRecord?.(record);
    if (!record || !validation?.ok) throw new Error(validation?.reason || 'Food Masterから記録を作れませんでした');
    normalizeBuiltName(record,index,finalAmount,finalUnit);
    record._agentV6 = { version:VERSION, nutritionSource:'Food Master', toolMutation:true };
    return record;
  }

  function getPending() {
    const pending = readJson(PENDING_KEY,null);
    if (!pending) return null;
    if (Date.now() - Number(pending.createdAt || 0) > PENDING_TTL_MS) { writeJson(PENDING_KEY,null); return null; }
    return pending;
  }
  function setPending(value) { writeJson(PENDING_KEY,value); }

  function getHistory() {
    const items = readJson(HISTORY_KEY,[]);
    return Array.isArray(items) ? items.slice(-8) : [];
  }
  function appendHistory(role,text) {
    const items = getHistory();
    items.push({role:String(role),text:String(text || '').slice(0,600),at:Date.now()});
    writeJson(HISTORY_KEY,items.slice(-8));
  }

  const TOOL_CATALOG = [
    { name:'list_today_records', description:'今日の保存済み食事記録と現在のPFC/kcalを読む。対象が曖昧ならまず使う。', args:{} },
    { name:'search_food_master', description:'Food Masterから食品候補を検索する。食品を追加・置換する前に必要なら使う。', args:{query:'string',limit:'number optional'} },
    { name:'add_food', description:'Food Masterの食品を今日の記録へ追加する。栄養値はFood Masterが決定する。', args:{foodIndex:'number',amount:'number optional',unit:'string optional',meal:'string optional'} },
    { name:'update_record', description:'保存済み1件を変更する。未指定の食品・量・単位・食事区分は保持する。', args:{recordId:'number',foodIndex:'number optional',amount:'number optional',unit:'string optional',meal:'string optional'} },
    { name:'repair_record', description:'保存済み記録の食品・量・単位を保持してFood MasterからPFC/kcalだけ再計算する。', args:{recordId:'number'} },
    { name:'delete_records', description:'指定した保存済み記録を削除する。全件削除になる場合はランタイムが確認を要求する。', args:{recordIds:'number[]'} },
    { name:'delete_all_today', description:'今日の全記録を削除したい時に使う。必ずランタイム確認が入る。', args:{} },
    { name:'confirm_pending_action', description:'直前にランタイムが確認を求めた破壊操作を、ユーザーが了承した時だけ確定する。', args:{} },
    { name:'cancel_pending_action', description:'直前の確認待ち操作をユーザーが拒否・中止した時にキャンセルする。', args:{} },
    { name:'undo_last_action', description:'ユーザーが「元に戻す」「取り消す」と明示した時だけ直前のトランザクションを戻す。削除依頼の代用には使わない。', args:{} },
    { name:'get_open_draft', description:'写真などで現在開いているMeal Draftの食品カードを読む。', args:{} },
    { name:'edit_open_draft', description:'現在開いているMeal Draftの食品カードを追加・変更・削除する。', args:{operations:'array of {action:add|update|delete,targetRef?,foodQuery?,replacementQuery?,amount?,unit?}'} },
    { name:'save_open_draft', description:'現在開いているMeal DraftをFood Master値で保存する。', args:{} }
  ];

  function toolResult(name,args) {
    switch (name) {
      case 'list_today_records':
        return {ok:true,records:todayRecords().map(summarizeRecord),pending:getPending(),draft:editor()?.plannerContext?.() || []};
      case 'search_food_master': {
        const query = String(args?.query || '').trim();
        const limit = Math.max(1,Math.min(10,Number(args?.limit || 6)));
        if (!query) return {ok:false,error:'query is required'};
        const rows = engine()?.searchFood?.(query,limit) || [];
        return {ok:true,candidates:rows.map(row => {
          const meta = row.meta || dbv3()?.get?.(row.index) || {};
          const units = multi()?.getUnits?.(row.index) || [];
          return {foodIndex:Number(row.index),name:cleanMasterName(row.index) || row.name,sourceName:row.name,defaultAmount:Number(meta.input?.defaultAmount || 1),defaultUnit:String(meta.input?.defaultUnit || ''),units:units.map(u=>String(u.label || u.id)).slice(0,8)};
        })};
      }
      case 'add_food': {
        const index = Number(args?.foodIndex);
        if (!Number.isFinite(index)) return {ok:false,error:'foodIndex is required'};
        const before = clone(todayRecords());
        const id = Date.now();
        const record = buildRecord(index,args?.amount,args?.unit,args?.meal,id);
        const after = clone(before); after.push(record);
        saveRecords(after); saveTransaction(before,after,`追加: ${summarizeRecord(record).name}`,[record.id]);
        return {ok:true,mutation:true,record:summarizeRecord(record)};
      }
      case 'update_record': {
        const id = Number(args?.recordId);
        const before = clone(todayRecords());
        const pos = before.findIndex(r => Number(r.id) === id);
        if (pos < 0) return {ok:false,error:'recordId not found'};
        const current = before[pos];
        const currentIndex = recordIndex(current);
        const index = finite(args?.foodIndex) ? Number(args.foodIndex) : currentIndex;
        if (!Number.isFinite(index)) return {ok:false,error:'Food Master source unresolved'};
        const au = recordAmountUnit(current,currentIndex);
        const amount = positive(args?.amount) ? Number(args.amount) : au?.amount;
        const unit = args?.unit ? unitCanon(args.unit) : au?.unit;
        const meal = args?.meal || current.time || '';
        const next = buildRecord(index,amount,unit,meal,current.id);
        const after = clone(before); after[pos] = next;
        saveRecords(after); saveTransaction(before,after,`変更: ${summarizeRecord(next).name}`,[next.id]);
        return {ok:true,mutation:true,record:summarizeRecord(next)};
      }
      case 'repair_record': {
        const id = Number(args?.recordId);
        const before = clone(todayRecords());
        const pos = before.findIndex(r => Number(r.id) === id);
        if (pos < 0) return {ok:false,error:'recordId not found'};
        const current = before[pos];
        const index = recordIndex(current);
        if (!Number.isFinite(index)) return {ok:false,error:'Food Master source unresolved'};
        const au = recordAmountUnit(current,index);
        if (!au) return {ok:false,error:'amount/unit unresolved'};
        const next = buildRecord(index,au.amount,au.unit,current.time,current.id);
        next._agentV6.repaired = true;
        const after = clone(before); after[pos] = next;
        saveRecords(after); saveTransaction(before,after,`再計算: ${summarizeRecord(next).name}`,[next.id]);
        return {ok:true,mutation:true,record:summarizeRecord(next)};
      }
      case 'delete_records': {
        const ids = [...new Set((Array.isArray(args?.recordIds) ? args.recordIds : []).map(Number).filter(Number.isFinite))];
        const before = clone(todayRecords());
        if (!ids.length) return {ok:false,error:'recordIds is required'};
        const existing = ids.filter(id => before.some(r => Number(r.id) === id));
        if (!existing.length) return {ok:false,error:'records not found'};
        if (before.length > 0 && existing.length === before.length) {
          const pending = {id:`pending-${Date.now()}`,createdAt:Date.now(),action:{name:'delete_records',args:{recordIds:existing},confirmed:true},question:`今日の記録${existing.length}件をすべて削除しますか？`};
          setPending(pending);
          return {ok:true,requiresConfirmation:true,pendingId:pending.id,question:pending.question};
        }
        const set = new Set(existing); const after = before.filter(r => !set.has(Number(r.id)));
        saveRecords(after); saveTransaction(before,after,`${existing.length}件を削除`,existing);
        return {ok:true,mutation:true,deletedIds:existing,remaining:after.map(summarizeRecord)};
      }
      case 'delete_all_today': {
        const before = clone(todayRecords());
        if (!before.length) return {ok:true,mutation:false,message:'今日の記録はありません。'};
        const ids = before.map(r=>Number(r.id)).filter(Number.isFinite);
        const pending = {id:`pending-${Date.now()}`,createdAt:Date.now(),action:{name:'delete_records',args:{recordIds:ids},confirmed:true},question:`今日の記録${ids.length}件をすべて削除しますか？`};
        setPending(pending);
        return {ok:true,requiresConfirmation:true,pendingId:pending.id,question:pending.question};
      }
      case 'confirm_pending_action': {
        const pending = getPending();
        if (!pending?.action) return {ok:false,error:'確認待ちの操作はありません'};
        setPending(null);
        if (pending.action.name === 'delete_records') {
          const before = clone(todayRecords());
          const ids = (pending.action.args?.recordIds || []).map(Number);
          const set = new Set(ids); const after = before.filter(r=>!set.has(Number(r.id)));
          saveRecords(after); saveTransaction(before,after,`${ids.length}件を削除`,ids);
          return {ok:true,mutation:true,confirmed:true,deletedIds:ids,remaining:after.map(summarizeRecord)};
        }
        return {ok:false,error:'unsupported pending action'};
      }
      case 'cancel_pending_action':
        if (!getPending()) return {ok:true,cancelled:false,message:'確認待ちの操作はありません。'};
        setPending(null); return {ok:true,cancelled:true,message:'操作をキャンセルしました。'};
      case 'undo_last_action': {
        const result = engine()?.undoLastTransaction?.();
        return result || {ok:false,error:'取り消せる操作がありません'};
      }
      case 'get_open_draft':
        return {ok:true,open:!!editor()?.hasOpenDraft?.(),rows:editor()?.plannerContext?.() || []};
      case 'edit_open_draft': {
        if (!editor()?.hasOpenDraft?.()) return {ok:false,error:'Meal Draft is not open'};
        const operations = (Array.isArray(args?.operations) ? args.operations : []).slice(0,12).map(item => {
          const action = String(item?.action || '');
          if (action === 'add') return {op:'add',foodQuery:String(item.foodQuery || ''),amountValue:positive(item.amount)?Number(item.amount):null,amountUnit:unitCanon(item.unit)};
          if (action === 'delete') return {op:'delete',targetRef:String(item.targetRef || ''),targetQuery:String(item.foodQuery || '')};
          return {op:'update',targetRef:String(item.targetRef || ''),targetQuery:String(item.foodQuery || ''),replacementQuery:String(item.replacementQuery || ''),amountValue:positive(item.amount)?Number(item.amount):null,amountUnit:unitCanon(item.unit)};
        });
        const result = editor().applyVoicePlan({operations});
        return {ok:!!result?.ok,mutation:true,message:result?.message || '',draft:editor()?.plannerContext?.() || []};
      }
      case 'save_open_draft': {
        if (!editor()?.hasOpenDraft?.()) return {ok:false,error:'Meal Draft is not open'};
        const button = document.getElementById('v50-commit');
        if (!button || button.disabled) return {ok:false,error:'Meal Draft cannot be saved yet'};
        button.click();
        return {ok:true,mutation:true,message:'Meal Draftを保存しました。'};
      }
      default:
        return {ok:false,error:`unknown tool: ${name}`};
    }
  }

  function currentSnapshot() {
    return {
      records:todayRecords().map(summarizeRecord),
      totals:engine()?.currentTotals?.() || null,
      pending:getPending() ? {id:getPending().id,question:getPending().question,actionName:getPending().action?.name || ''} : null,
      draft:editor()?.hasOpenDraft?.() ? (editor()?.plannerContext?.() || []) : [],
      recentConversation:getHistory()
    };
  }

  function systemInstruction() {
    return `あなたはPFCアプリ内蔵の操作エージェントです。ユーザーの自然な日本語を文脈で理解し、必要なら利用可能なツールを自律的に使ってアプリを操作してください。\n\n原則:\n- ユーザーの目的を優先し、不要な確認や聞き返しを減らす。対象がツールや現在状態から特定できるなら自分で特定する。\n- P/F/C/A/kcalを自分で生成・推測しない。Food Master由来のツール結果だけを栄養値の真実として扱う。\n- 「削除」と「元に戻す」は別物。undo_last_actionはユーザーが明示的に元へ戻したい時だけ使う。\n- 全件削除などはツールランタイムがrequiresConfirmationを返す。確認待ちがある時は、ユーザーの次の返答を自然な文脈で解釈し、了承ならconfirm_pending_action、拒否ならcancel_pending_actionを使う。特定の語句への完全一致には依存しない。\n- 写真のMeal Draftが開いている時、「これ」「この料理」「このカード」などはDraftを優先する。\n- ツール結果が失敗したら必要なら別ツールで調べて再試行する。\n- アプリ操作が必要なら final で済ませずtool_callsを返す。質問・説明だけならfinalで答える。\n\n出力はJSONのみ。\nツール呼び出し: {"type":"tool_calls","calls":[{"id":"c1","name":"tool_name","args":{}}],"message":""}\n最終回答: {"type":"final","message":"短い自然な日本語"}\n1回に最大4ツール。`;
  }

  function gasEndpoint() {
    try { if (typeof gasUrl !== 'undefined' && gasUrl) return gasUrl; } catch {}
    return 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
  }
  function extractText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map(p=>typeof p?.text === 'string' ? p.text : '').join('').trim() : '';
  }
  function parseEnvelope(raw) {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    let value;
    try { value = JSON.parse(text); } catch { return null; }
    if (!value || !['tool_calls','final'].includes(value.type)) return null;
    if (value.type === 'final') return {type:'final',message:String(value.message || '').slice(0,1000)};
    const allowed = new Set(TOOL_CATALOG.map(t=>t.name));
    const calls = (Array.isArray(value.calls) ? value.calls : []).slice(0,4).filter(c=>c && allowed.has(c.name)).map((c,i)=>({id:String(c.id || `c${i+1}`).slice(0,40),name:c.name,args:(c.args && typeof c.args === 'object') ? c.args : {}}));
    return calls.length ? {type:'tool_calls',calls,message:String(value.message || '').slice(0,500)} : null;
  }

  async function requestEnvelope(userText, trace) {
    const prompt = `${systemInstruction()}\n\n【利用可能なツール】\n${JSON.stringify(TOOL_CATALOG)}\n\n【現在のアプリ状態】\n${JSON.stringify(currentSnapshot())}\n\n【今回のユーザー発言】\n${String(userText || '').trim()}\n\n【このターンで既に行ったツール処理】\n${JSON.stringify(trace || [])}`;
    const payload = {
      taskType:'chat', modelPreference:MODEL,
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{maxOutputTokens:1200,responseMimeType:'application/json',temperature:0.15}
    };
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(gasEndpoint(),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),signal:controller.signal});
      if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
      const data = await response.json();
      const raw = extractText(data);
      if (/^GASエラー:/i.test(raw)) throw new Error(raw.slice(0,240));
      const envelope = parseEnvelope(raw);
      if (!envelope) throw new Error('AIのツール選択を解釈できませんでした');
      return envelope;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('AIが30秒以内に応答しませんでした');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function deterministicToolMessage(results) {
    const last = results[results.length-1]?.result;
    if (!last) return '処理しました。';
    if (last.requiresConfirmation) return last.question || 'この操作を実行しますか？';
    if (last.cancelled) return last.message || 'キャンセルしました。';
    if (Array.isArray(last.deletedIds)) return `${last.deletedIds.length}件を削除しました。`;
    if (last.record) return `${last.record.name}${last.record.amount ? ` ${formatAmount(last.record.amount)}${last.record.unit || ''}` : ''}を更新しました。`;
    if (last.message) return String(last.message);
    return '処理しました。';
  }

  async function runAgent(userText) {
    const trace = [];
    for (let step=0; step<MAX_AGENT_STEPS; step++) {
      const envelope = await requestEnvelope(userText,trace);
      if (envelope.type === 'final') return {message:envelope.message || '了解しました。',trace};
      const batch = [];
      for (const call of envelope.calls) {
        let result;
        try { result = toolResult(call.name,call.args); }
        catch (error) { result = {ok:false,error:String(error?.message || error)}; }
        batch.push({id:call.id,name:call.name,args:call.args,result});
        if (result?.requiresConfirmation) {
          trace.push({calls:batch});
          return {message:result.question || 'この操作を実行しますか？',trace,confirmation:true};
        }
      }
      trace.push({calls:batch});
      const terminalMutation = batch.some(x=>x.result?.mutation) && !batch.some(x=>['list_today_records','search_food_master','get_open_draft'].includes(x.name));
      if (terminalMutation && step >= 1) return {message:deterministicToolMessage(batch),trace};
    }
    const lastBatch = trace.at(-1)?.calls || [];
    return {message:deterministicToolMessage(lastBatch),trace};
  }

  function resultCardsFromTrace(trace) {
    const records = [];
    for (const step of trace || []) for (const item of step.calls || []) if (item.result?.record) records.push(item.result.record);
    if (!records.length) return '';
    return `<div class="v50-result-list">${records.slice(-4).map(r=>`<div class="v50-result-card"><b>${esc(r.name)}${r.amount ? ` ${esc(formatAmount(r.amount)+r.unit)}` : ''}</b><span>P ${Number(r.p||0).toFixed(1)} / F ${Number(r.f||0).toFixed(1)} / C ${Number(r.c||0).toFixed(1)}</span><strong>${Math.round(Number(r.kcal||0)).toLocaleString()} kcal</strong></div>`).join('')}</div>`;
  }

  async function sendAgentVoice() {
    const input = document.getElementById('v-chat-input');
    const text = String(input?.value || '').trim();
    if (!text || busy) return;
    busy = true;
    const status = document.getElementById('v-status-text');
    if (input) { input.value=''; input.disabled=true; }
    if (status) status.textContent='AIが操作を考え中…';
    if (typeof addChatMsg === 'function') addChatMsg('user',text);
    const loadingId = typeof addChatMsg === 'function' ? addChatMsg('bot','AIがアプリを確認中…') : null;
    appendHistory('user',text);
    try {
      const result = await runAgent(text);
      if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
      const message = result.message || '処理しました。';
      appendHistory('assistant',message);
      if (typeof addChatMsg === 'function') addChatMsg('bot',esc(message)+resultCardsFromTrace(result.trace),true);
    } catch (error) {
      if (loadingId && typeof removeMsg === 'function') removeMsg(loadingId);
      const message = `操作に失敗しました。${String(error?.message || '')}`;
      appendHistory('assistant',message);
      if (typeof addChatMsg === 'function') addChatMsg('bot',esc(message),true);
    } finally {
      if (status) status.textContent='マイクOFF';
      if (input) input.disabled=false;
      busy=false;
    }
  }

  function normalizeExistingTrustedNames() {
    const rows = todayRecords();
    let changed = false;
    for (const record of rows) {
      const index = recordIndex(record);
      if (!Number.isFinite(index) || !positive(record?._dbv3?.amount)) continue;
      const unit = unitCanon(record._dbv3.unit || dbv3()?.get?.(index)?.input?.defaultUnit || '');
      const expected = `${cleanMasterName(index)}(${formatAmount(record._dbv3.amount)}${unit})`;
      if (expected && record.N !== expected) { record.N = expected; changed = true; }
    }
    if (changed) {
      if (typeof sv === 'function') sv();
      else storage().setItem('tf_dat',JSON.stringify(rows));
      if (typeof ren === 'function') ren();
      if (typeof upd === 'function') upd();
    }
    return changed;
  }

  function install() {
    normalizeExistingTrustedNames();
    window.sendVoiceChat = sendAgentVoice;
    window.__PFC_AGENT_V60__ = {
      version:VERSION, model:MODEL, capabilityAgent:true, iterativeToolUse:true,
      nutritionTruth:'Food Master', destructiveConfirmation:'runtime-gated',
      toolCatalog:clone(TOOL_CATALOG), parseEnvelope, toolResult, currentSnapshot,
      runAgent, normalizeExistingTrustedNames
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

;
