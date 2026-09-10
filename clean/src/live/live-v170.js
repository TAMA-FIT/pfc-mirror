import { readState, writeRecords } from '../storage.js';
import { buildRecord, formatAmount } from '../nutrition/engine.js';
import { LIVE_VERSION } from './config-v170.js?v=1.7.3';
import { LiveMealDraft } from './draft-v170.js';
import { GeminiLiveTransport } from './transport-v170.js?v=1.7.2';
import { LiveAudioIO } from './audio-v170.js';

const draft=new LiveMealDraft();
let transport=null;
let audio=null;
let modal=null;
let sessionState='idle';
let lastUser='';
let lastModel='';
let errorText='';
let diagnosticText='';
let registeredCount=0;
let patchQueued=false;

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function statusText(){
  if(errorText)return errorText;
  if(sessionState==='token')return '接続の準備をしています…';
  if(sessionState==='connecting'||sessionState==='setup')return 'Gemini Liveに接続しています…';
  if(sessionState==='ready')return '会話中です。普通に話してください。';
  if(sessionState==='turn-complete')return '聞いています。続けて話せます。';
  if(sessionState==='closed')return '接続が終了しました。';
  return '開始しています…';
}

function formatDiagnostic(d={}){
  const parts=[];
  if(d.stage)parts.push(String(d.stage));
  if(d.gasBuild)parts.push(String(d.gasBuild));
  if(d.phase)parts.push(String(d.phase));
  if(d.httpStatus)parts.push(`HTTP ${d.httpStatus}`);
  if(d.googleStatus)parts.push(String(d.googleStatus));
  if(d.message&&d.message!==d.gasBuild)parts.push(String(d.message));
  return parts.filter(Boolean).join(' | ');
}

function loadCss(){
  if(document.getElementById('pfc-live-v170-css'))return;
  const link=document.createElement('link');
  link.id='pfc-live-v170-css';
  link.rel='stylesheet';
  link.href=new URL('../../assets/live-v170.css?v=1.7.3',import.meta.url).href;
  document.head.appendChild(link);
}

function ensureModal(){
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='pfc-live-modal';
  modal.className='modal pfc-live-modal';
  modal.hidden=true;
  modal.innerHTML='<div class="modal-sheet pfc-live-sheet" id="pfc-live-sheet"></div>';
  document.body.appendChild(modal);
  return modal;
}

function itemStatus(item){
  if(item.needsSkin&&item.needsAmount)return '皮あり・皮なしと量を確認します';
  if(item.needsSkin)return '皮あり・皮なしを確認します';
  if(item.unresolved)return item.candidateNames?.length?'食品候補を確認中':'食品を確認中';
  if(item.needsAmount)return '量を確認します';
  if(item.assumed)return '標準量を仮置き';
  return '確認済み';
}
function itemQty(item){
  if(item.needsSkin||item.unresolved)return '確認中';
  if(item.needsAmount)return '量を確認';
  return formatAmount(item.amount,item.unit);
}

function render(){
  ensureModal();
  const sheet=document.getElementById('pfc-live-sheet');
  if(!sheet)return;
  const items=draft.snapshot();
  const ready=draft.isReady();
  sheet.innerHTML=`
    <div class="sv4-header pfc-live-head">
      <button type="button" class="close-btn" data-live-action="end" aria-label="終了">‹</button>
      <strong>ライブ会話 <small>実験</small></strong>
      <span class="pfc-live-dot ${sessionState==='ready'||sessionState==='turn-complete'?'on':''}"></span>
    </div>
    <div class="sv4-body">
      <div class="pfc-live-status">${esc(statusText())}</div>
      ${diagnosticText?`<div class="pfc-live-diagnostic"><strong>診断</strong><span>${esc(diagnosticText)}</span></div>`:''}
      <div class="pfc-live-conversation">
        ${lastUser?`<div><span>あなた</span><b>${esc(lastUser)}</b></div>`:''}
        ${lastModel?`<div class="model"><span>AI</span><b>${esc(lastModel)}</b></div>`:''}
      </div>
      <div class="sv4-memo pfc-live-memo">
        <div class="sv4-memo-head"><strong>今日の食事メモ</strong><span>${ready?'登録できます':items.length?'会話で確認中':'待機中'}</span></div>
        ${items.length?items.map(x=>`
          <div class="sv4-food ${x.needsSkin||x.unresolved||x.needsAmount?'pending':''}">
            <div><div class="sv4-food-name">${esc(x.canonicalName||x.name)}</div><div class="sv4-food-meta">${esc(itemStatus(x))}</div></div>
            <div class="sv4-food-qty">${esc(itemQty(x))}<button class="memo-remove" data-live-action="remove" data-ref="${esc(x.ref)}" aria-label="削除">×</button></div>
          </div>`).join(''):'<div class="sv4-empty">会話から食品をここへ追加します。</div>'}
      </div>
      ${registeredCount?`<div class="pfc-live-saved">このセッションで ${registeredCount}件 登録済み</div>`:''}
    </div>
    <div class="sv4-actions pfc-live-actions">
      <button class="primary" data-live-action="register" ${ready?'':'disabled'}>これで登録する</button>
      <button data-live-action="end">ライブを終了</button>
    </div>`;
}

function patchVersion(){
  const badge=document.querySelector('.app-build-version');
  if(badge&&badge.textContent!==LIVE_VERSION)badge.textContent=LIVE_VERSION;
  const runtime=document.querySelector('#view-settings .runtime-panel p');
  if(runtime&&/v1\.6\.1/.test(runtime.innerHTML))runtime.innerHTML=runtime.innerHTML.replace(/v1\.6\.1/g,LIVE_VERSION);
}

function patchHome(){
  const home=document.getElementById('view-home');
  if(!home||home.hidden)return;
  const talk=home.querySelector('.senior-talk-btn');
  if(!talk||home.querySelector('.senior-live-btn'))return;
  talk.insertAdjacentHTML('afterend',`<button class="senior-live-btn" data-live-action="start"><span class="live-icon">◉</span><span><strong>ライブ会話</strong><small>AIとそのまま話して記録・実験中</small></span></button>`);
}

function queuePatch(){
  if(patchQueued)return;
  patchQueued=true;
  requestAnimationFrame(()=>{patchQueued=false;patchVersion();patchHome()});
}

async function handleToolCalls(calls){
  const responses=[];
  for(const call of calls){
    if(call?.name!=='update_meal_draft'){
      responses.push({id:call?.id,name:call?.name||'unknown',response:{result:{ok:false,error:'unsupported_tool'}}});
      continue;
    }
    try{
      const result=draft.applyFunctionCall(call);
      responses.push({id:call.id,name:call.name,response:{result}});
    }catch(e){
      responses.push({id:call?.id,name:call?.name||'update_meal_draft',response:{result:{ok:false,error:String(e?.message||e),draft:draft.toolResult().draft}}});
    }
  }
  render();
  transport?.sendToolResponses(responses);
}

function handleCancellations(ids){
  let changed=false;
  for(const id of ids||[])changed=draft.cancelCall(id)||changed;
  if(changed)render();
}
function appendTranscript(current,addition){
  const a=String(addition||'').trim();
  if(!a)return current;
  if(!current)return a;
  if(current.endsWith(a))return current;
  return `${current}${a}`;
}

async function startLive(){
  if(transport)return;
  errorText='';diagnosticText=`app ${LIVE_VERSION}`;registeredCount=0;lastUser='';lastModel='';draft.clear();
  ensureModal().hidden=false;sessionState='token';render();
  try{
    audio=new LiveAudioIO();
    await audio.prepare();
    transport=new GeminiLiveTransport({
      onState:s=>{sessionState=s;if(s==='turn-complete'){lastUser=lastUser.trim();lastModel=lastModel.trim()}render()},
      onDiagnostic:d=>{const text=formatDiagnostic(d);if(text)diagnosticText=text;render()},
      onAudio:(data,mime)=>audio?.play(data,mime),
      onInputTranscript:t=>{lastUser=appendTranscript(lastUser,t);render()},
      onOutputTranscript:t=>{lastModel=appendTranscript(lastModel,t);render()},
      onToolCall:handleToolCalls,
      onToolCancellation:handleCancellations,
      onInterrupted:()=>audio?.interruptOutput(),
      onError:e=>{errorText=`Liveエラー: ${String(e?.message||e)}`;render()}
    });
    await transport.connect();
    await audio.startCapture(bytes=>transport?.sendAudio(bytes));
    transport.sendOpening();
    sessionState='ready';render();
  }catch(e){
    const d=e?.liveDiagnostic?formatDiagnostic({stage:'token',ok:false,...e.liveDiagnostic}):'';
    if(d)diagnosticText=d;
    errorText=`接続できません: ${String(e?.message||e)}`;sessionState='error';
    try{transport?.close()}catch{}transport=null;
    try{await audio?.close()}catch{}audio=null;render();
  }
}

async function registerDraft(){
  const items=draft.resolvedItems();
  if(!items.length)return;
  const current=readState();
  const records=[];
  for(const item of items){
    const record=buildRecord({foodId:item.foodId,amount:item.amount,unit:item.unit,meal:item.meal});
    if(record)records.push(record);
  }
  if(!records.length)return;
  writeRecords([...(current.records||[]),...records]);
  registeredCount+=records.length;
  draft.clear();lastModel='';render();
  transport?.sendText(`__PFC_DRAFT_COMMITTED__ ユーザー操作で${records.length}件の食事を登録しました。現在のDraftは空です。以前のrefは今後update/removeに使わないでください。短く「登録しました」と伝え、追加があればそのまま聞いてください。`);
}

async function endLive(){
  try{transport?.close()}catch{}transport=null;
  try{await audio?.close()}catch{}audio=null;
  draft.clear();sessionState='closed';if(modal)modal.hidden=true;location.reload();
}

document.addEventListener('click',e=>{
  const button=e.target.closest('[data-live-action]');
  if(!button)return;
  const action=button.dataset.liveAction;
  if(action==='start'){e.preventDefault();startLive()}
  else if(action==='end'){e.preventDefault();endLive()}
  else if(action==='register'){e.preventDefault();registerDraft()}
  else if(action==='remove'){e.preventDefault();draft.removeLocal(button.dataset.ref);render()}
});

addEventListener('pagehide',()=>{try{transport?.close()}catch{}transport=null;try{audio?.stopCapture()}catch{}});
loadCss();ensureModal();
const observer=new MutationObserver(queuePatch);
for(const id of ['view-home','view-settings']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
queuePatch();
console.info('[PFC Gemini Live experiment]',{version:LIVE_VERSION});
