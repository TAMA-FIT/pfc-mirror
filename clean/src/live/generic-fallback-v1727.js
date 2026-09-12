import { resolveFood, normalize } from '../nutrition/catalog.js';
import { scaleFood } from '../nutrition/engine.js';

export const GENERIC_FALLBACK_VERSION='v1.7.28-mext-grounded';

const BRAND_PATTERNS=[
  /coco\s*壱番屋/i,/coco\s*壱/i,/ココイチ/i,
  /マクドナルド/i,/マック/i,/mcdonald'?s?/i,
  /スターバックス/i,/スタバ/i,/starbucks/i,
  /モスバーガー/i,/モス/i,
  /ケンタッキー/i,/\bkfc\b/i,
  /セブン(?:-?イレブン)?/i,/ローソン/i,/ファミリーマート/i,/ファミマ/i,
  /吉野家/i,/すき家/i,/松屋/i
];

export function isLikelyBrandProduct(name=''){
  const s=String(name||'').normalize('NFKC');
  return BRAND_PATTERNS.some(re=>re.test(s));
}

function stripBrandWords(name=''){
  let s=String(name||'').normalize('NFKC');
  for(const re of BRAND_PATTERNS)s=s.replace(new RegExp(re.source,re.flags.includes('g')?re.flags:`${re.flags}g`),' ');
  return s.replace(/\s+/g,' ').trim();
}

function round1(v){return Math.round((Number(v)||0)*10)/10}
function sumNutrition(parts){
  return parts.reduce((s,x)=>({
    p:round1(s.p+x.nutrition.p),
    f:round1(s.f+x.nutrition.f),
    c:round1(s.c+x.nutrition.c),
    kcal:Math.round(s.kcal+x.nutrition.kcal)
  }),{p:0,f:0,c:0,kcal:0});
}
function mextFood(name){
  const food=resolveFood(name);
  return food?.source?.kind==='mext'?food:null;
}
function component(name,amount,unit='g',assumed=false){
  const food=mextFood(name);
  if(!food)return null;
  const nutrition=scaleFood(food,amount,unit);
  if(!nutrition)return null;
  return {name:food.name,itemNo:food.source.itemNo,amount,unit,assumed,nutrition};
}
function evidenceFromParts(originalName,brandlessName,parts,note=''){
  if(!parts.length||parts.some(x=>!x))return null;
  const total=sumNutrition(parts);
  const partLabel=parts.map(x=>`${x.name}${x.amount}${x.unit}${x.assumed?'(量推定)':''}`).join(' + ');
  return {
    originalName:String(originalName||'').trim(),
    brandlessName,
    genericName:parts.map(x=>x.name).join(' + '),
    foodId:parts.length===1?`mext:${parts[0].itemNo}`:'',
    sourceKind:'mext',
    sourceLabel:`文部科学省 日本食品標準成分表ベース${parts.some(x=>x.assumed)?'推定':'代替'}（${partLabel}）`,
    components:parts.map(({nutrition,...rest})=>rest),
    evidence:{
      sourceType:'trusted-fallback',
      p:total.p,f:total.f,c:total.c,kcal:total.kcal,
      sourceLabel:`文部科学省 日本食品標準成分表ベース${parts.some(x=>x.assumed)?'推定':'代替'}（${partLabel}）`,
      sourceUrl:'https://fooddb.mext.go.jp/',
      servingLabel:note||partLabel
    }
  };
}

export function buildMextComponentEstimate(originalName='',components=[]){
  const raw=Array.isArray(components)?components:[];
  if(!raw.length)return null;
  const parts=raw.map(x=>{
    const name=String(x?.name||'').trim();
    const amount=Number(x?.amount);
    const unit=String(x?.unit||'g').trim()||'g';
    if(!name||!Number.isFinite(amount)||amount<=0)return null;
    return component(name,amount,unit,true);
  });
  if(parts.some(x=>!x))return null;
  return evidenceFromParts(String(originalName||'').trim(),String(originalName||'').trim(),parts,'文科省食品の構成・量をAIが推定');
}

function parseRiceGrams(raw){
  const s=String(raw||'').normalize('NFKC');
  const a=s.match(/(?:ライス|ごはん|御飯)\s*(\d+(?:\.\d+)?)\s*g/i);
  if(a)return Number(a[1]);
  const b=s.match(/(\d+(?:\.\d+)?)\s*g\s*(?:ライス|ごはん|御飯)/i);
  return b?Number(b[1]):null;
}
function stripServingNoise(raw){
  return String(raw||'').normalize('NFKC')
    .replace(/(?:ライス|ごはん|御飯)\s*\d+(?:\.\d+)?\s*g/gi,' ')
    .replace(/\d+(?:\.\d+)?\s*g\s*(?:ライス|ごはん|御飯)?/gi,' ')
    .replace(/(?:辛さ|からさ)\s*(?:普通|ふつう|標準|\d+\s*辛)/g,' ')
    .replace(/(?:普通のやつ|普通|ふつう|定番|いつもの|標準)/g,' ')
    .replace(/[【】\[\]{}「」『』]/g,' ')
    .replace(/[・･,，、/／]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function curryType(brandless){
  const q=normalize(brandless);
  if(q.includes(normalize('ポークカレー')))return 'ポークカレー';
  if(q.includes(normalize('チキンカレー')))return 'チキンカレー';
  if(q.includes(normalize('ビーフカレー')))return 'ビーフカレー';
  return '';
}
function friesSize(brandless){
  const s=String(brandless||'').normalize('NFKC');
  if(!/(?:フライド?ポテト|フライポテト|ポテト)/i.test(s))return null;
  if(/(?:^|\s|ポテト)\s*L\b/i.test(s))return {label:'L',grams:200};
  if(/(?:^|\s|ポテト)\s*M\b/i.test(s))return {label:'M',grams:135};
  if(/(?:^|\s|ポテト)\s*S\b/i.test(s))return {label:'S',grams:75};
  return {label:'標準',grams:100};
}

// Runtime policy v1.7.28:
// Restaurant/chain names are not treated as a separate nutrition database.
// We map them to MEXT foods and let the app calculate P/F/C/kcal from MEXT values.
export function buildTrustedGenericFallback(name=''){
  if(!isLikelyBrandProduct(name))return null;
  const originalName=String(name||'').trim();
  const brandlessRaw=stripBrandWords(originalName);
  const brandless=stripServingNoise(brandlessRaw);

  const curry=curryType(brandless);
  if(curry){
    const givenRice=parseRiceGrams(originalName);
    const riceGrams=givenRice||300;
    const parts=[
      component('白米',riceGrams,'g',!givenRice),
      component(curry,200,'g',true)
    ];
    return evidenceFromParts(
      originalName,
      brandless,
      parts,
      `白米${riceGrams}g + ${curry}200g（${givenRice?'カレー量':'ライス量・カレー量'}に推定を含む）`
    );
  }

  const fries=friesSize(brandless);
  if(fries){
    return evidenceFromParts(
      originalName,
      brandless,
      [component('フライドポテト(市販冷凍)',fries.grams,'g',true)],
      `${fries.label}相当 ${fries.grams}g（量推定）`
    );
  }

  const exactMap=new Map([
    [normalize('ポークカレー'),'ポークカレー'],
    [normalize('チキンカレー'),'チキンカレー'],
    [normalize('ビーフカレー'),'ビーフカレー']
  ]);
  const mapped=exactMap.get(normalize(brandless));
  if(!mapped)return null;
  return evidenceFromParts(originalName,brandless,[component(mapped,200,'g',true)],`${mapped}200g（量推定）`);
}
