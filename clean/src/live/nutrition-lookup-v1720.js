import { GAS_URL } from './config-v1720.js?v=1.7.21';

export const NUTRITION_LOOKUP_VERSION='v1.7.21';
export const NUTRITION_LOOKUP_MODEL='gemini-2.5-flash';
export const NUTRITION_LOOKUP_TIMEOUT_MS=12000;
export const NUTRITION_LOOKUP_CACHE_TTL_MS=30*24*60*60*1000;
const CACHE_KEY='pfc-official-nutrition-cache-v1';

function text(v){return String(v??'').trim()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function round1(v){return Math.round(Number(v)*10)/10}
function normalizeKeyPart(v){return text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()}
export function nutritionLookupCacheKey({foodName='',contextText='',candidateNames=[]}={}){
  const candidates=(Array.isArray(candidateNames)?candidateNames:[]).map(normalizeKeyPart).filter(Boolean).join(' / ');
  return `${normalizeKeyPart(foodName)}|${normalizeKeyPart(contextText)}|${candidates}`;
}

function readCache(){
  try{const raw=localStorage.getItem(CACHE_KEY);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==='object'?parsed:{}}catch{return {}}
}
function writeCache(cache){try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}}
function cachedResult(key){
  if(!key)return null;
  const cache=readCache();const entry=cache[key];if(!entry)return null;
  if(Date.now()-Number(entry.cachedAt||0)>NUTRITION_LOOKUP_CACHE_TTL_MS){delete cache[key];writeCache(cache);return null}
  return entry.result||null;
}
function cacheResult(key,result){
  if(!key||!result||result.status!=='verified')return;
  const cache=readCache();cache[key]={cachedAt:Date.now(),result};
  const entries=Object.entries(cache).sort((a,b)=>Number(b[1]?.cachedAt||0)-Number(a[1]?.cachedAt||0)).slice(0,80);
  writeCache(Object.fromEntries(entries));
}

export function validateGroundedNutrition(raw={}){
  if(text(raw.status)!=='verified')return {status:text(raw.status)||'not_found'};
  if(raw.grounded!==true||raw.officialSource!==true)throw new Error('nutrition lookup is not grounded to an official source');
  const p=num(raw.p),f=num(raw.f),c=num(raw.c),kcal=num(raw.kcal);
  if(p==null||p<0||f==null||f<0||c==null||c<0||kcal==null||kcal<=0)throw new Error('invalid grounded nutrition values');
  const sourceUrl=text(raw.sourceUrl);
  if(!/^https:\/\//i.test(sourceUrl))throw new Error('official nutrition sourceUrl is required');
  const servingLabel=text(raw.servingLabel)||'1食';
  return {
    status:'verified',
    grounded:true,
    officialSource:true,
    brand:text(raw.brand),
    productName:text(raw.productName),
    servingLabel,
    p:round1(p),f:round1(f),c:round1(c),kcal:Math.round(kcal),
    sourceLabel:text(raw.sourceLabel)||'公式情報',
    sourceUrl,
    sourceDomain:text(raw.sourceDomain),
    model:text(raw.model)||NUTRITION_LOOKUP_MODEL,
    verifiedAt:text(raw.verifiedAt)||new Date().toISOString(),
    resolutionNote:text(raw.resolutionNote),
    gasBuild:text(raw.gasBuild),
    webSearchQueries:Array.isArray(raw.webSearchQueries)?raw.webSearchQueries.map(text).filter(Boolean).slice(0,8):[]
  };
}

export function buildNutritionLookupPayload({foodName='',contextText='',candidateNames=[]}={}){
  const name=text(foodName);if(!name)throw new Error('foodName is required');
  return {
    taskType:'nutritionLookup',
    foodName:name.slice(0,120),
    contextText:text(contextText).slice(0,240),
    candidateNames:(Array.isArray(candidateNames)?candidateNames:[]).map(text).filter(Boolean).slice(0,5)
  };
}

export async function lookupOfficialNutrition(input,{force=false}={}){
  const payload=buildNutritionLookupPayload(input);
  const key=nutritionLookupCacheKey(payload);
  if(!force){const hit=cachedResult(key);if(hit)return {...hit,cacheHit:true}}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),NUTRITION_LOOKUP_TIMEOUT_MS);
  try{
    const response=await fetch(GAS_URL,{
      method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),redirect:'follow',signal:controller.signal
    });
    if(!response.ok)throw new Error(`nutrition lookup GAS HTTP ${response.status}`);
    const rawText=await response.text();let body;
    try{body=JSON.parse(rawText)}catch{throw new Error('nutrition lookup response is not JSON')}
    if(body?.ok===false)throw new Error(text(body?.message)||text(body?.error)||'nutrition lookup failed');
    if(text(body?.status)!=='verified')return {status:text(body?.status)||'not_found',message:text(body?.message),model:text(body?.model)||NUTRITION_LOOKUP_MODEL,gasBuild:text(body?.gasBuild),webSearchQueries:Array.isArray(body?.webSearchQueries)?body.webSearchQueries.map(text).filter(Boolean).slice(0,8):[]};
    const result=validateGroundedNutrition(body);cacheResult(key,result);return {...result,cacheHit:false};
  }catch(error){
    if(error?.name==='AbortError')throw new Error('nutrition lookup timed out');
    throw error;
  }finally{clearTimeout(timer)}
}
