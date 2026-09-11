import { resolveFood, defaultAmount, normalize } from '../nutrition/catalog.js';
import { scaleFood, formatAmount } from '../nutrition/engine.js';

export const GENERIC_FALLBACK_VERSION='v1.7.27-trusted-generic';

const BRAND_PATTERNS=[
  /coco\s*壱番屋/i,/coco\s*壱/i,/ココイチ/i,
  /マクドナルド/i,/マック/i,/mcdonald'?s?/i,
  /スターバックス/i,/スタバ/i,/starbucks/i,
  /モスバーガー/i,/モス/i,
  /ケンタッキー/i,/\bkfc\b/i,
  /セブン(?:-?イレブン)?/i,/ローソン/i,/ファミリーマート/i,/ファミマ/i,
  /吉野家/i,/すき家/i,/松屋/i,
  /サムライマック/i,/ビッグマック/i,/マックフライポテト/i,
  /ファミチキ/i,/lチキ/i,/ななチキ/i,/からあげクン/i
];

export function isLikelyBrandProduct(name=''){
  const s=String(name||'').normalize('NFKC');
  return BRAND_PATTERNS.some(re=>re.test(s));
}

function stripBrandAndServingNoise(name=''){
  let s=String(name||'').normalize('NFKC');
  for(const re of BRAND_PATTERNS)s=s.replace(new RegExp(re.source,re.flags.includes('g')?re.flags:`${re.flags}g`),' ');
  s=s
    .replace(/(?:ライス|ごはん|御飯)\s*\d+(?:\.\d+)?\s*g/gi,' ')
    .replace(/\d+(?:\.\d+)?\s*g\s*(?:ライス|ごはん|御飯)?/gi,' ')
    .replace(/(?:辛さ|からさ)\s*(?:普通|ふつう|標準|\d+\s*辛)/g,' ')
    .replace(/(?:普通のやつ|普通|ふつう|定番|いつもの|標準)/g,' ')
    .replace(/(?:1|一)\s*(?:皿|食|個|杯)/g,' ')
    .replace(/[【】\[\]{}「」『』]/g,' ')
    .replace(/[・･,，、/／]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  return s;
}

const SAFE_GENERIC_ENTRIES=[
  ['カレー','カレーライス'],
  ['カレーライス','カレーライス'],
  ['ポークカレー','カレーライス'],
  ['ポークカレーライス','カレーライス'],
  ['ビーフカレー','カレーライス'],
  ['ビーフカレーライス','カレーライス'],
  ['カツカレー','カツカレー'],
  ['ハンバーグ','ハンバーグ'],
  ['ハンバーガー','ハンバーガー'],
  ['チーズバーガー','チーズバーガー'],
  ['コーヒー','コーヒー'],
  ['ホットコーヒー','コーヒー'],
  ['アイスコーヒー','コーヒー'],
  ['コーラ','コーラ'],
  ['牛丼','牛丼(並盛)'],
  ['牛丼並','牛丼(並盛)'],
  ['牛丼並盛','牛丼(並盛)'],
  ['牛丼大盛','牛丼(大盛)'],
  ['牛丼特盛','牛丼(特盛)'],
  ['豚丼','豚丼'],
  ['フライドポテトS','ポテト(S)'],
  ['フライポテトS','ポテト(S)'],
  ['ポテトS','ポテト(S)'],
  ['フライドポテトM','ポテト(M)'],
  ['フライポテトM','ポテト(M)'],
  ['ポテトM','ポテト(M)'],
  ['フライドポテトL','ポテト(L)'],
  ['フライポテトL','ポテト(L)'],
  ['ポテトL','ポテト(L)']
];
const SAFE_GENERIC_BY_NORMALIZED=new Map(SAFE_GENERIC_ENTRIES.map(([from,to])=>[normalize(from),to]));

function safeGenericName(brandless=''){
  const q=normalize(brandless);
  if(!q)return '';
  return SAFE_GENERIC_BY_NORMALIZED.get(q)||'';
}

function servingLabelFor(food){
  const d=defaultAmount(food);
  const raw=String(food?.nutritionBasis?.raw||'').trim();
  if(/^(S|M|L|並|小|大|特盛|メガ)$/i.test(raw))return `${raw}（${formatAmount(d.amount,d.unit)}）`;
  return formatAmount(d.amount,d.unit);
}

export function buildTrustedGenericFallback(name=''){
  if(!isLikelyBrandProduct(name))return null;
  const brandless=stripBrandAndServingNoise(name);
  const genericName=safeGenericName(brandless);
  if(!genericName)return null;
  const food=resolveFood(genericName);
  if(!food)return null;
  const d=defaultAmount(food);
  const nutrition=scaleFood(food,d.amount,d.unit);
  if(!nutrition)return null;
  const mext=food?.source?.kind==='mext';
  return {
    originalName:String(name||'').trim(),
    brandlessName:brandless,
    genericName:food.name,
    foodId:food.id,
    sourceKind:food?.source?.kind||'catalog',
    sourceLabel:mext
      ? `文部科学省 日本食品標準成分表・代替（${food.name}）`
      : `Food Master代替値（${food.name}）`,
    evidence:{
      sourceType:'trusted-fallback',
      p:nutrition.p,f:nutrition.f,c:nutrition.c,kcal:nutrition.kcal,
      sourceLabel:mext
        ? `文部科学省 日本食品標準成分表・代替（${food.name}）`
        : `Food Master代替値（${food.name}）`,
      sourceUrl:'',
      servingLabel:servingLabelFor(food)
    }
  };
}
