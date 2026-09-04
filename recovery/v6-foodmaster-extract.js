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
