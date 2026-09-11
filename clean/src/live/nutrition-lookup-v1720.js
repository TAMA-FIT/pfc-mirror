import { GAS_URL } from './config-v1720.js?v=1.7.21';

export const NUTRITION_LOOKUP_VERSION='v1.7.22-diagnostics-safe';
export const NUTRITION_LOOKUP_MODEL='gemini-2.5-flash';
export const NUTRITION_LOOKUP_TIMEOUT_MS=12000;
export const NUTRITION_LOOKUP_CACHE_TTL_MS=30*24*60*60*1000;
const CACHE_KEY='pfc-official-nutrition-cache-v1';
const LOOKUP_DEBUG=new URLSearchParams(globalThis.location?.search||'').get('lookupDebug')==='1';
const LOOKUP_DIAG_MAX=12;
const lookupDiagnostics=[];

function text(v){return String(v??'').trim()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function round1(v){return Math.round(Number(v)*10)/10}
function normalizeKeyPart(v){return text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()}
function sanitize(v,max=220){
  return text(v)
    .replace(/AIza[0-9A-Za-z_-]{16,}/g,'[REDACTED_KEY]')
    .replace(/([?&](?:key|api[_-]?key|apikey)=)[^&\s]+/gi,'$1[REDACTED]')
    .replace(/\s+/g,' ')
    .slice(0,max);
}
function diagnosticSummary(body={}){
  const parts=[];
  if(body.clientHttpStatus)parts.push(`clientHTTP=${sanitize(body.clientHttpStatus,20)}`);
  if(body.status)parts.push(`status=${sanitize(body.status,40)}`);
  if(body.ok===false)parts.push('ok=false');
  if(body.gasBuild)parts.push(`gas=${sanitize(body.gasBuild,80)}`);
  if(body.model)parts.push(`model=${sanitize(body.model,60)}`);
  if(body.httpStatus)parts.push(`upstreamHTTP=${sanitize(body.httpStatus,20)}`);
  if(body.googleStatus)parts.push(`google=${sanitize(body.googleStatus,120)}`);
  if(body.grounded===true)parts.push('grounded=true');
  if(body.grounded===false)parts.push('grounded=false');
  if(body.message)parts.push(`message=${sanitize(body.message,180)}`);
  if(Array.isArray(body.webSearchQueries)&&body.webSearchQueries.length){
    parts.push(`queries=${body.webSearchQueries.map(x=>sanitize(x,80)).filter(Boolean).slice(0,4).join(' / ')}`);
  }
  if(body.productName)parts.push(`product=${sanitize(body.productName,100)}`);
  if(body.sourceDomain)parts.push(`source=${sanitize(body.sourceDomain,100)}`);
  return parts.join(' | ')||'no diagnostic fields';
}
function renderLookupDiagnostics(){
  if(!LOOKUP_DEBUG||typeof document==='undefined'||!lookupDiagnostics.length)return;
  const memo=document.querySelector('#pfc-live-sheet .pfc-live-memo');
  if(!memo)return;
  let panel=document.getElementById('pfc-lookup-debug-safe');
  if(!panel){
    panel=document.createElement('div');
    panel.id='pfc-lookup-debug-safe';
    panel.className='pfc-live-diagnostic';
    memo.insertAdjacentElement('afterend',panel);
  }
  panel.innerHTML=`<strong>公式検索 診断（安全モード）</strong><div style="margin-top:6px;font-size:12px;line-height:1.45;word-break:break-word">${lookupDiagnostics.map((r,i)=>{
    const elapsed=Number.isFinite(r.elapsedMs)?`${(r.elapsedMs/1000).toFixed(1)}秒`:'';
    const candidates=r.candidates?.length?`<br>候補: ${r.candidates.map(x=>sanitize(x,80)).join(' / ')}`:'';
    return `<div style="margin-top:7px"><b>#${i+1} ${sanitize(r.foodName,100)}</b><br>${sanitize(r.stage,60)}${elapsed?` / ${elapsed}`:''}<br>${sanitize(r.summary,700)}${candidates}</div>`;
  }).join('')}</div><button type="button" data-copy-safe-lookup-diag style="margin-top:8px">診断をコピー</button>`;
  const button=panel.querySelector('[data-copy-safe-lookup-diag]');
  if(button)button.onclick=async()=>{
    const out=[
      `PFC lookup diagnostics ${NUTRITION_LOOKUP_VERSION}`,
      ...lookupDiagnostics.map((r,i)=>`#${i+1} ${r.foodName} | ${r.stage} | ${Number.isFinite(r.elapsedMs)?`${(r.elapsedMs/1000).toFixed(1)}s`:'n/a'} | ${r.summary}${r.candidates?.length?` | candidates=${r.candidates.join(' / ')}`:''}`)
    ].join('\n');
    try{await navigator.clipboard.writeText(out);button.textContent='コピーしました'}catch{button.textContent='コピー失敗'}
  };
}
function addLookupDiagnostic({foodName='',candidateNames=[],stage='',elapsedMs=null,body=null,summary=''}={}){
  if(!LOOKUP_DEBUG)return;
  lookupDiagnostics.push({
    foodName:sanitize(foodName,100),
    candidates:(Array.isArray(candidateNames)?candidateNames:[]).map(x=>sanitize(x,80)).filter(Boolean).slice(0,5),
    stage:sanitize(stage,60),
    elapsedMs:Number.isFinite(elapsedMs)?elapsedMs:null,
    summary:sanitize(summary||diagnosticSummary(body||{}),700)
  });
  if(lookupDiagnostics.length>LOOKUP_DIAG_MAX)lookupDiagnostics.splice(0,lookupDiagnostics.length-LOOKUP_DIAG_MAX);
  queueMicrotask(renderLookupDiagnostics);
}
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
  if(!force){
    const hit=cachedResult(key);
    if(hit){
      addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'cache-hit',elapsedMs:0,body:hit});
      return {...hit,cacheHit:true};
    }
  }
  const started=performance.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),NUTRITION_LOOKUP_TIMEOUT_MS);
  addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'request-start',summary:`GASへ送信 / model=${NUTRITION_LOOKUP_MODEL}`});
  try{
    const response=await fetch(GAS_URL,{
      method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),redirect:'follow',signal:controller.signal
    });
    const rawText=await response.text();
    let body;
    try{body=JSON.parse(rawText)}
    catch{
      addLookupDiagnostic({
        foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'response-non-json',
        elapsedMs:performance.now()-started,
        summary:`clientHTTP=${response.status} | response=non-JSON | body=${sanitize(rawText,180)}`
      });
      throw new Error('nutrition lookup response is not JSON');
    }

    const diagnosticBody={...body,clientHttpStatus:response.status};
    addLookupDiagnostic({
      foodName:payload.foodName,candidateNames:payload.candidateNames,
      stage:response.ok?'response':'http-error',
      elapsedMs:performance.now()-started,
      body:diagnosticBody
    });

    if(!response.ok)throw new Error(`nutrition lookup GAS HTTP ${response.status}`);
    if(body?.ok===false)throw new Error(text(body?.message)||text(body?.error)||'nutrition lookup failed');
    if(text(body?.status)!=='verified')return {
      status:text(body?.status)||'not_found',
      message:text(body?.message),
      model:text(body?.model)||NUTRITION_LOOKUP_MODEL,
      gasBuild:text(body?.gasBuild),
      grounded:body?.grounded===true,
      httpStatus:num(body?.httpStatus),
      googleStatus:text(body?.googleStatus),
      webSearchQueries:Array.isArray(body?.webSearchQueries)?body.webSearchQueries.map(text).filter(Boolean).slice(0,8):[]
    };
    const result=validateGroundedNutrition(body);
    cacheResult(key,result);
    addLookupDiagnostic({
      foodName:payload.foodName,candidateNames:payload.candidateNames,
      stage:'verified',elapsedMs:performance.now()-started,body:{...body,clientHttpStatus:response.status}
    });
    return {...result,cacheHit:false};
  }catch(error){
    const elapsedMs=performance.now()-started;
    if(error?.name==='AbortError'){
      addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'timeout',elapsedMs,summary:`timeout after ${NUTRITION_LOOKUP_TIMEOUT_MS}ms`});
      throw new Error('nutrition lookup timed out');
    }
    addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'client-exception',elapsedMs,summary:`${sanitize(error?.name||'Error',60)}: ${sanitize(error?.message||error,260)}`});
    throw error;
  }finally{clearTimeout(timer)}
}
