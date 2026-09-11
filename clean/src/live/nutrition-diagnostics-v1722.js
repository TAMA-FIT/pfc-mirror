export const NUTRITION_DIAGNOSTICS_VERSION='v1.7.22-diagnostics';

const MAX_RECORDS=12;
const records=[];
let seq=0;
let renderQueued=false;
const originalFetch=globalThis.fetch.bind(globalThis);

function text(v){return String(v??'').trim()}
function esc(v){return text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function sanitize(v,max=220){
  return text(v)
    .replace(/AIza[0-9A-Za-z_-]{16,}/g,'[REDACTED_KEY]')
    .replace(/([?&](?:key|api[_-]?key|apikey)=)[^&\s]+/gi,'$1[REDACTED]')
    .replace(/\s+/g,' ')
    .slice(0,max);
}
function parsePayload(init){
  try{
    const raw=typeof init?.body==='string'?init.body:'';
    if(!raw)return null;
    const body=JSON.parse(raw);
    return body?.taskType==='nutritionLookup'?body:null;
  }catch{return null}
}
function compactQueries(value){
  if(!Array.isArray(value)||!value.length)return '';
  const queries=value.map(x=>sanitize(x,80)).filter(Boolean).slice(0,3);
  return queries.length?`queries=${queries.join(' / ')}`:'';
}
function diagnosticSummary({httpStatus,body,parseError=false}={}){
  const parts=[];
  if(httpStatus)parts.push(`HTTP ${httpStatus}`);
  if(parseError)parts.push('response=non-JSON');
  if(body&&typeof body==='object'){
    if(body.ok===false)parts.push('ok=false');
    if(body.status)parts.push(`status=${sanitize(body.status,40)}`);
    if(body.gasBuild)parts.push(sanitize(body.gasBuild,80));
    if(body.model)parts.push(sanitize(body.model,60));
    if(body.httpStatus)parts.push(`upstreamHTTP=${sanitize(body.httpStatus,20)}`);
    if(body.googleStatus)parts.push(`google=${sanitize(body.googleStatus,100)}`);
    if(body.grounded===true)parts.push('grounded=true');
    if(body.grounded===false)parts.push('grounded=false');
    if(body.message)parts.push(`message=${sanitize(body.message)}`);
    const q=compactQueries(body.webSearchQueries);if(q)parts.push(q);
    if(body.productName)parts.push(`product=${sanitize(body.productName,80)}`);
    if(body.sourceDomain)parts.push(`source=${sanitize(body.sourceDomain,80)}`);
  }
  return parts.filter(Boolean).join(' | ')||'response received';
}
function addRecord(payload){
  const record={
    id:++seq,
    foodName:sanitize(payload?.foodName||'不明',100),
    candidates:Array.isArray(payload?.candidateNames)?payload.candidateNames.map(x=>sanitize(x,80)).filter(Boolean).slice(0,5):[],
    state:'送信中',
    summary:'GASへ nutritionLookup を送信中',
    startedAt:Date.now()
  };
  records.push(record);if(records.length>MAX_RECORDS)records.splice(0,records.length-MAX_RECORDS);
  queueRender();return record;
}
function finishRecord(record,state,summary){
  if(!record)return;
  record.state=state;record.summary=sanitize(summary,500);record.finishedAt=Date.now();queueRender();
}
function copyText(){
  return [
    `PFC official-search diagnostics ${NUTRITION_DIAGNOSTICS_VERSION}`,
    ...records.map(r=>{
      const elapsed=r.finishedAt?`${((r.finishedAt-r.startedAt)/1000).toFixed(1)}s`:'pending';
      const candidates=r.candidates.length?` | candidates=${r.candidates.join(' / ')}`:'';
      return `#${r.id} ${r.foodName} | ${r.state} | ${elapsed} | ${r.summary}${candidates}`;
    })
  ].join('\n');
}
function renderPanel(){
  renderQueued=false;
  if(!records.length)return;
  const memo=document.querySelector('#pfc-live-sheet .pfc-live-memo');
  if(!memo)return;
  let panel=document.getElementById('pfc-search-diagnostics-v1722');
  if(!panel){
    panel=document.createElement('div');panel.id='pfc-search-diagnostics-v1722';panel.className='pfc-live-diagnostic';memo.insertAdjacentElement('afterend',panel);
  }
  const key=JSON.stringify(records.map(r=>[r.id,r.state,r.summary,r.finishedAt||0]));
  if(panel.dataset.key===key)return;
  panel.dataset.key=key;
  panel.innerHTML=`<strong>公式検索 診断</strong><div style="margin-top:6px;font-size:12px;line-height:1.45;word-break:break-word">${records.map(r=>{
    const elapsed=r.finishedAt?`${((r.finishedAt-r.startedAt)/1000).toFixed(1)}秒`:'処理中';
    return `<div style="margin-top:6px"><b>#${r.id} ${esc(r.foodName)}</b><br>${esc(r.state)} / ${esc(elapsed)}<br>${esc(r.summary)}</div>`;
  }).join('')}</div><button type="button" data-pfc-copy-search-diag style="margin-top:8px">診断をコピー</button>`;
}
function queueRender(){
  if(renderQueued)return;renderQueued=true;
  requestAnimationFrame(renderPanel);
}

globalThis.fetch=async function(input,init){
  const payload=parsePayload(init);
  if(!payload)return originalFetch(input,init);
  const record=addRecord(payload);
  try{
    const response=await originalFetch(input,init);
    let body=null;let parseError=false;
    try{const raw=await response.clone().text();body=JSON.parse(raw)}catch{parseError=true}
    const summary=diagnosticSummary({httpStatus:response.status,body,parseError});
    const state=response.ok?(body?.status==='verified'?'公式値取得':body?.status==='not_found'?'未確定':body?.ok===false?'GASエラー':'応答あり'):'HTTPエラー';
    finishRecord(record,state,summary);
    return response;
  }catch(error){
    const name=sanitize(error?.name||'Error',60);const message=sanitize(error?.message||error,260);
    const state=name==='AbortError'?'中断/タイムアウト':'通信例外';
    finishRecord(record,state,`${name}: ${message}`);
    throw error;
  }
};

new MutationObserver(queueRender).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-pfc-copy-search-diag]');if(!button)return;
  navigator.clipboard?.writeText?.(copyText()).then(()=>{button.textContent='コピーしました'}).catch(()=>{button.textContent='コピー失敗'});
});

console.info('[PFC nutrition diagnostics]',{version:NUTRITION_DIAGNOSTICS_VERSION,visible:true});
