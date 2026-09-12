export const NUTRITION_LOOKUP_VERSION='v1.7.28-mext-only';
export const NUTRITION_LOOKUP_MODEL='文科省データ優先・Web検索停止';
export const NUTRITION_LOOKUP_TIMEOUT_MS=0;

const listeners=new Set();
let diagnostics=[];

function emit(){for(const fn of listeners){try{fn(getLookupDiagnostics())}catch{}}}
export function isLookupDebugEnabled(){
  try{return new URLSearchParams(globalThis.location?.search||'').get('lookupDebug')==='1'}catch{return false}
}
export function getLookupDiagnostics(){return diagnostics.map(x=>({...x}))}
export function clearLookupDiagnostics(){diagnostics=[];emit()}
export function setLookupDiagnosticListener(fn){
  if(typeof fn!=='function')return ()=>{};
  listeners.add(fn);return ()=>listeners.delete(fn);
}
export function formatLookupDiagnosticsText(){
  if(!diagnostics.length)return 'MEXT-only mode: restaurant/chain Web lookup is disabled.';
  return diagnostics.map(x=>`${x.foodName}: ${x.summary}`).join('\n');
}

// Compatibility adapter for live-v1720.js.
// The old runtime still asks this module whether an unresolved item should use the
// restaurant/chain Web path. v1.7.28 deliberately returns immediately without any
// network request so recovery can ask Gemini for a MEXT food/component plan instead.
export async function lookupOfficialNutrition({foodName='',candidateNames=[]}={}){
  const started=performance?.now?.()??Date.now();
  const result={
    ok:false,
    status:'not_found',
    errorCode:'MEXT_ONLY_MODE',
    message:'Restaurant/chain Web lookup is disabled; resolve with MEXT food data/components.',
    searchProvider:'disabled',
    model:'mext-grounded',
    officialSource:false,
    grounded:false
  };
  diagnostics.push({
    foodName:String(foodName||''),
    candidates:Array.isArray(candidateNames)?candidateNames.slice(0,5):[],
    stage:'mext-only',
    elapsedMs:Math.max(0,(performance?.now?.()??Date.now())-started),
    summary:result.message,
    errorCode:result.errorCode
  });
  if(diagnostics.length>20)diagnostics=diagnostics.slice(-20);
  emit();
  return result;
}
