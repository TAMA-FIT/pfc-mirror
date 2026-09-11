import { GAS_URL } from './config-v1720.js?v=1.7.25';

export const NUTRITION_LOOKUP_VERSION='v1.7.25-tavily';
export const NUTRITION_LOOKUP_MODEL='Tavily + Gemini 3.1 Flash Lite';
export const NUTRITION_LOOKUP_TIMEOUT_MS=22000;
export const NUTRITION_LOOKUP_CACHE_TTL_MS=30*24*60*60*1000;
const CACHE_KEY='pfc-official-nutrition-cache-v2';
const LOOKUP_DEBUG=new URLSearchParams(globalThis.location?.search||'').get('lookupDebug')==='1';
const LOOKUP_DIAG_MAX=18;
const lookupDiagnostics=[];
const lookupDiagnosticListeners=new Set();

function text(v){return String(v??'').trim()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function round1(v){return Math.round(Number(v)*10)/10}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
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
  if(body.errorCode)parts.push(`code=${sanitize(body.errorCode,60)}`);
  if(body.ok===false)parts.push('ok=false');
  if(body.gasBuild)parts.push(`gas=${sanitize(body.gasBuild,80)}`);
  if(body.searchProvider)parts.push(`search=${sanitize(body.searchProvider,40)}`);
  if(body.model)parts.push(`extract=${sanitize(body.model,60)}`);
  if(body.httpStatus)parts.push(`upstreamHTTP=${sanitize(body.httpStatus,20)}`);
  if(body.officialFetchStatus)parts.push(`officialHTTP=${sanitize(body.officialFetchStatus,20)}`);
  if(body.verificationMethod)parts.push(`verify=${sanitize(body.verificationMethod,80)}`);
  if(body.searchCredits!=null)parts.push(`credits=${sanitize(body.searchCredits,20)}`);
  if(body.tavilyRequestId)parts.push(`tavilyRequest=${sanitize(body.tavilyRequestId,80)}`);
  if(body.grounded===true)parts.push('grounded=true');
  if(body.grounded===false)parts.push('grounded=false');
  if(body.message)parts.push(`message=${sanitize(body.message,180)}`);
  if(Array.isArray(body.webSearchQueries)&&body.webSearchQueries.length){
    parts.push(`queries=${body.webSearchQueries.map(x=>sanitize(x,100)).filter(Boolean).slice(0,4).join(' / ')}`);
  }
  if(body.productName)parts.push(`product=${sanitize(body.productName,100)}`);
  if(body.sourceDomain)parts.push(`source=${sanitize(body.sourceDomain,100)}`);
  return parts.join(' | ')||'no diagnostic fields';
}
function diagnosticCopyRows(){
  return lookupDiagnostics.map((r,i)=>`#${i+1} ${r.foodName} | ${r.stage} | ${Number.isFinite(r.elapsedMs)?`${(r.elapsedMs/1000).toFixed(1)}s`:'n/a'} | ${r.summary}${r.candidates?.length?` | candidates=${r.candidates.join(' / ')}`:''}`);
}
function emitLookupDiagnostics(){
  if(!LOOKUP_DEBUG)return;
  const snapshot=getLookupDiagnostics();
  for(const listener of [...lookupDiagnosticListeners]){
    try{listener(snapshot)}catch{}
  }
}
function addLookupDiagnostic({foodName='',candidateNames=[],stage='',elapsedMs=null,body=null,summary=''}={}){
  if(!LOOKUP_DEBUG)return;
  lookupDiagnostics.push({
    foodName:sanitize(foodName,100),
    candidates:(Array.isArray(candidateNames)?candidateNames:[]).map(x=>sanitize(x,80)).filter(Boolean).slice(0,5),
    stage:sanitize(stage,60),
    elapsedMs:Number.isFinite(elapsedMs)?elapsedMs:null,
    summary:sanitize(summary||diagnosticSummary(body||{}),900)
  });
  if(lookupDiagnostics.length>LOOKUP_DIAG_MAX)lookupDiagnostics.splice(0,lookupDiagnostics.length-LOOKUP_DIAG_MAX);
  emitLookupDiagnostics();
}

export function isLookupDebugEnabled(){return LOOKUP_DEBUG}
export function getLookupDiagnostics(){return lookupDiagnostics.map(r=>({...r,candidates:[...(r.candidates||[])]}))}
export function formatLookupDiagnosticsText(){
  return [`PFC lookup diagnostics ${NUTRITION_LOOKUP_VERSION}`,...diagnosticCopyRows()].join('\n');
}
export function clearLookupDiagnostics(){lookupDiagnostics.length=0;emitLookupDiagnostics()}
export function setLookupDiagnosticListener(listener){
  if(typeof listener!=='function')return ()=>{};
  lookupDiagnosticListeners.add(listener);
  return ()=>lookupDiagnosticListeners.delete(listener);
}

export function nutritionLookupCacheKey({foodName='',contextText='',candidateNames=[]}={}){
  const candidates=(Array.isArray(candidateNames)?candidateNames:[]).map(normalizeKeyPart).filter(Boolean).join(' / ');
  return `exact:${normalizeKeyPart(foodName)}|${normalizeKeyPart(contextText)}|${candidates}`;
}
function aliasKey(v){const n=normalizeKeyPart(v);return n?`alias:${n}`:''}
function explicitServingToken(v){
  const s=normalizeKeyPart(v);
  const size=s.match(/(?:^|[\s(（])([sml])(?:サイズ)?(?:$|[\s)）])/i);if(size)return size[1].toLowerCase();
  const amount=s.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)(?:$|[^a-z])/i);return amount?`${amount[1]}${amount[2].toLowerCase()}`:'';
}
function aliasSafeForResult(alias,result){
  const a=normalizeKeyPart(alias);if(a.length<2)return false;
  const servingToken=explicitServingToken(result?.servingLabel);
  if(servingToken&&!normalizeKeyPart(alias).includes(servingToken))return false;
  return true;
}
function readCache(){
  try{const raw=localStorage.getItem(CACHE_KEY);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==='object'?parsed:{}}catch{return {}}
}
function writeCache(cache){try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}}
function validCachedEntry(cache,key){
  if(!key)return null;const entry=cache[key];if(!entry)return null;
  if(Date.now()-Number(entry.cachedAt||0)>NUTRITION_LOOKUP_CACHE_TTL_MS){delete cache[key];return null}
  return entry.result||null;
}
function cachedResult(payload){
  const cache=readCache();
  const exact=validCachedEntry(cache,nutritionLookupCacheKey(payload));if(exact){writeCache(cache);return exact}
  const aliases=[payload.foodName,...(payload.candidateNames||[])].map(aliasKey).filter(Boolean);
  for(const key of aliases){const hit=validCachedEntry(cache,key);if(hit){writeCache(cache);return hit}}
  writeCache(cache);return null;
}
function cacheResult(payload,result){
  if(!result||result.status!=='verified')return;
  const cache=readCache();const now=Date.now();const entry={cachedAt:now,result};
  cache[nutritionLookupCacheKey(payload)]=entry;
  const aliases=[payload.foodName,...(payload.candidateNames||[]),result.productName,result.brand&&result.productName?`${result.brand} ${result.productName}`:'']
    .filter(Boolean).filter(v=>aliasSafeForResult(v,result));
  for(const alias of aliases){const key=aliasKey(alias);if(key)cache[key]=entry}
  const entries=Object.entries(cache).sort((a,b)=>Number(b[1]?.cachedAt||0)-Number(a[1]?.cachedAt||0)).slice(0,160);
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
    status:'verified',grounded:true,officialSource:true,
    brand:text(raw.brand),productName:text(raw.productName),servingLabel,
    p:round1(p),f:round1(f),c:round1(c),kcal:Math.round(kcal),
    sourceLabel:text(raw.sourceLabel)||'公式情報',sourceUrl,sourceDomain:text(raw.sourceDomain),
    model:text(raw.model)||'gemini-3.1-flash-lite',searchProvider:text(raw.searchProvider)||'tavily',
    verifiedAt:text(raw.verifiedAt)||new Date().toISOString(),resolutionNote:text(raw.resolutionNote),
    verificationMethod:text(raw.verificationMethod),officialFetchStatus:num(raw.officialFetchStatus),gasBuild:text(raw.gasBuild),
    tavilyRequestId:text(raw.tavilyRequestId),searchCredits:num(raw.searchCredits),
    webSearchQueries:Array.isArray(raw.webSearchQueries)?raw.webSearchQueries.map(text).filter(Boolean).slice(0,8):[]
  };
}

export function buildNutritionLookupPayload({foodName='',contextText='',candidateNames=[]}={}){
  const name=text(foodName);if(!name)throw new Error('foodName is required');
  return {
    taskType:'nutritionLookup',foodName:name.slice(0,120),contextText:text(contextText).slice(0,240),
    candidateNames:(Array.isArray(candidateNames)?candidateNames:[]).map(text).filter(Boolean).slice(0,5)
  };
}
function classifyBody(body={}){
  const status=text(body.status);
  const message=text(body.message);
  const code=text(body.errorCode);
  const upstream=num(body.httpStatus);
  const official=num(body.officialFetchStatus);
  if(status==='quota_exhausted'||/TAVILY_MONTHLY_CAP|quota|safety cap/i.test(`${code} ${message}`))return 'QUOTA';
  if(upstream===429||/TAVILY_RATE_LIMIT|EXTRACTOR_RATE_LIMIT/i.test(code))return 'PROVIDER_429';
  if(upstream!=null&&upstream>=500)return 'PROVIDER_5XX';
  if(official===404||/official page.*404|HTTP 404/i.test(message))return 'OFFICIAL_URL_404';
  if(status==='not_found')return 'NOT_FOUND';
  if(body.ok===false)return code||'UPSTREAM_ERROR';
  return '';
}
async function performRequest(payload,{attempt=1,label='primary'}={}){
  const started=performance.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),NUTRITION_LOOKUP_TIMEOUT_MS);
  addLookupDiagnostic({
    foodName:payload.foodName,candidateNames:payload.candidateNames,stage:`request-${label}-${attempt}`,
    summary:`GASへ送信 / search=Tavily / extract=Gemini 3.1 Flash Lite / timeout=${NUTRITION_LOOKUP_TIMEOUT_MS}ms`
  });
  try{
    const response=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),redirect:'follow',signal:controller.signal});
    const rawText=await response.text();let body;
    try{body=JSON.parse(rawText)}catch{
      addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'response-non-json',elapsedMs:performance.now()-started,summary:`clientHTTP=${response.status} | response=non-JSON | body=${sanitize(rawText,180)}`});
      const error=new Error('nutrition lookup response is not JSON');error.lookupCode='NON_JSON';throw error;
    }
    const errorCode=classifyBody(body);
    addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:response.ok?'response':'http-error',elapsedMs:performance.now()-started,body:{...body,clientHttpStatus:response.status,errorCode}});
    return {response,body,errorCode};
  }catch(error){
    const elapsedMs=performance.now()-started;
    if(error?.name==='AbortError'){
      addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'timeout',elapsedMs,summary:`timeout after ${NUTRITION_LOOKUP_TIMEOUT_MS}ms`});
      const timeout=new Error('nutrition lookup timed out');timeout.lookupCode='TIMEOUT';throw timeout;
    }
    addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'client-exception',elapsedMs,summary:`${sanitize(error?.name||'Error',60)}: ${sanitize(error?.message||error,260)}`});
    if(!error.lookupCode)error.lookupCode='NETWORK_OR_CLIENT';throw error;
  }finally{clearTimeout(timer)}
}
function publicNotFound(body,errorCode){
  return {
    status:text(body?.status)||'not_found',message:text(body?.message),errorCode:errorCode||classifyBody(body),
    model:text(body?.model)||'gemini-3.1-flash-lite',searchProvider:text(body?.searchProvider)||'tavily',gasBuild:text(body?.gasBuild),
    grounded:body?.grounded===true,httpStatus:num(body?.httpStatus),officialFetchStatus:num(body?.officialFetchStatus),
    tavilyRequestId:text(body?.tavilyRequestId),searchCredits:num(body?.searchCredits),
    webSearchQueries:Array.isArray(body?.webSearchQueries)?body.webSearchQueries.map(text).filter(Boolean).slice(0,8):[]
  };
}

export async function lookupOfficialNutrition(input,{force=false}={}){
  const payload=buildNutritionLookupPayload(input);
  if(!force){
    const hit=cachedResult(payload);
    if(hit){addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'cache-hit',elapsedMs:0,body:hit});return {...hit,cacheHit:true}}
  }

  let first;
  try{first=await performRequest(payload,{attempt:1,label:'primary'})}
  catch(error){
    if(error.lookupCode==='NETWORK_OR_CLIENT'){
      await sleep(350);
      first=await performRequest(payload,{attempt:2,label:'network-retry'});
    }else throw error;
  }

  const {response,body,errorCode}=first;
  if(!response.ok)throw new Error(`nutrition lookup GAS HTTP ${response.status}`);
  if(body?.ok===false){
    const error=new Error(text(body?.message)||text(body?.error)||'nutrition lookup failed');
    error.lookupCode=errorCode||'UPSTREAM_ERROR';throw error;
  }
  if(text(body?.status)!=='verified')return publicNotFound(body,errorCode);

  const result=validateGroundedNutrition(body);
  cacheResult(payload,result);
  addLookupDiagnostic({foodName:payload.foodName,candidateNames:payload.candidateNames,stage:'verified',body:{...body,clientHttpStatus:response.status,errorCode:''}});
  return {...result,cacheHit:false};
}
