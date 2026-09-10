import { readState, writeRecords } from '../storage.js';
import { buildRecord, formatAmount } from '../nutrition/engine.js';
import { LIVE_VERSION } from './config-v170.js?v=1.7.8';
import { LiveMealDraft } from './draft-v170.js';
import { GeminiLiveTransport } from './transport-v170.js?v=1.7.8';
import { GeminiLiveTranscriber, TRANSCRIBE_MODEL } from './transcribe-v178.js?v=1.7.8';
import { LiveAudioIO } from './audio-v170.js?v=1.7.8';
import { mergeTranscriptFragment } from './transcript-v177.js?v=1.7.8';

const draft=new LiveMealDraft();
let transport=null;
let transcriber=null;
let transcriberReady=false;
let audio=null;
let modal=null;
let sessionState='idle';
let lastUser='';
let lastModel='';
let transcriptSpeaker='none';
let errorText='';
let diagnosticText='';
let transcribeDiagnosticText='';
let registeredCount=0;
let patchQueued=false;
let traceStartMs=0;
let traceEvents=[];
let lastAudioArrivalMs=0;
let audioBurstCount=0;
let audioChunkCount=0;

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

function traceStamp(){
  if(!traceStartMs)return '0.0s';
  return `${((performance.now()-traceStartMs)/1000).toFixed(1)}s`;
}

function addTrace(text,{renderNow=true}={}){
  const entry=`${traceStamp()} ${text}`;
  traceEvents.push(entry);
  if(traceEvents.length>6)traceEvents.shift();
  if(renderNow)render();
}

function handleLiveTrace(event={}){
  const type=String(event.type||'');
  if(type==='audio'){
    const now=performance.now();
    const countMatch=String(event.detail||'').match(/chunks=(\d+)/);
    audioChunkCount+=countMatch?Number(countMatch[1]):1;
    if(!lastAudioArrivalMs||now-lastAudioArrivalMs>700){
      audioBurstCount++;
      addTrace(`audio-start #${audioBurstCount}`,{renderNow:true});
    }else{
      const gap=now-lastAudioArrivalMs;
      if(gap>140&&gap<700)addTrace(`audio-gap ${Math.round(gap)}ms`,{renderNow:true});
    }
    lastAudioArrivalMs=now;
    return;
  }
  if(type==='tool-call')addTrace(`toolCall ${event.detail||''}`.trim());
  else if(type==='tool-cancel')addTrace(`toolCancel ${event.detail||''}`.trim());
  else if(type==='interrupted')addTrace('interrupted');
  else if(type==='turn-complete')addTrace('turnComplete');
  else if(type==='go-away')addTrace('goAway');
  else if(type==='websocket-error')addTrace('ws-error');
  else if(type==='websocket-close')addTrace(`ws-close ${event.detail||''}`.trim());
}

function loadCss(){
  if(document.getElementById('pfc-live-v170-css'))return;
  const link=document.createElement('link');
  link.id='pfc-live-v170-css';
  link.rel='stylesheet';
  link.href=new URL('../../assets/live-v170.css?v=1.7.8',import.meta.url).href;
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
  const traceSummary=traceEvents.length?`${traceEvents.join(' → ')} | audio chunks=${audioChunkCount}`:'';
  sheet.innerHTML=`
    <div class="sv4-header pfc-live-head">
      <button type="button" class="close-btn" data-live-action="end" aria-label="終了">‹</button>
      <strong>ライブ会話 <small>実験</small></strong>
      <span class="pfc-live-dot ${sessionState==='ready'||sessionState==='turn-complete'?'on':''}"></span>
    </div>
    <div class="sv4-body">
      <div class="pfc-live-status">${esc(statusText())}</div>
      ${diagnosticText?`<div class="pfc-live-diagnostic"><strong>診断</strong><span>${esc(diagnosticText)}</span></div>`:''}
      ${transcribeDiagnosticText?`<div class="pfc-live-diagnostic"><strong>文字起こし</strong><span>${esc(transcribeDiagnosticText)}</span></div>`:''}
      ${traceSummary?`<div class="pfc-live-diagnostic"><strong>音声イベント</strong><span>${esc(traceSummary)}</span></div>`:''}
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

function acceptInputTranscript(text){
  if(transcriptSpeaker!=='user'){
    lastUser='';
    lastModel='';
    transcriptSpeaker='user';
  }
  lastUser=mergeTranscriptFragment(lastUser,text);
  render();
}

function acceptOutputTranscript(text){
  if(transcriptSpeaker!=='model'){
    lastModel='';
    transcriptSpeaker='model';
  }
  lastModel=mergeTranscriptFragment(lastModel,text);
  render();
}

function handleTranscriberState(state){
  if(state==='ready'){
    transcriberReady=true;
    transcribeDiagnosticText=`${TRANSCRIBE_MODEL} | ja-JP | SMART`;
  }else if(state==='closed'){
    transcriberReady=false;
    if(sessionState!=='closed')transcribeDiagnosticText='専用文字起こしが終了しました。Live本体の文字起こしへフォールバックします。';
  }
  render();
}

async function startLive(){
  if(transport)return;
  errorText='';diagnosticText=`app ${LIVE_VERSION}`;transcribeDiagnosticText='専用文字起こしを準備しています…';registeredCount=0;lastUser='';lastModel='';transcriptSpeaker='none';draft.clear();
  traceStartMs=performance.now();traceEvents=[];lastAudioArrivalMs=0;audioBurstCount=0;audioChunkCount=0;transcriberReady=false;
  ensureModal().hidden=false;sessionState='token';render();
  try{
    audio=new LiveAudioIO();
    await audio.prepare();
    transport=new GeminiLiveTransport({
      onState:s=>{
        sessionState=s;
        if(s==='turn-complete'){
          lastUser=lastUser.trim();
          lastModel=lastModel.trim();
          transcriptSpeaker='complete';
        }
        render();
      },
      onDiagnostic:d=>{const text=formatDiagnostic(d);if(text)diagnosticText=text;render()},
      onAudio:(data,mime)=>audio?.play(data,mime),
      onInputTranscript:t=>{if(!transcriberReady)acceptInputTranscript(t)},
      onOutputTranscript:acceptOutputTranscript,
      onToolCall:handleToolCalls,
      onToolCancellation:handleCancellations,
      onInterrupted:()=>audio?.interruptOutput(),
      onTrace:handleLiveTrace,
      onError:e=>{errorText=`Liveエラー: ${String(e?.message||e)}`;render()}
    });
    await transport.connect();

    try{
      transcriber=new GeminiLiveTranscriber({
        onState:handleTranscriberState,
        onFinal:acceptInputTranscript,
        onInterim:()=>{},
        onDiagnostic:d=>{
          if(d.stage==='transcribe-setup'&&d.ok)transcribeDiagnosticText=`${TRANSCRIBE_MODEL} | ja-JP | SMART`;
          else if(!d.ok)transcribeDiagnosticText=formatDiagnostic(d);
          render();
        },
        onError:e=>{
          transcriberReady=false;
          transcribeDiagnosticText=`専用文字起こしエラー: ${String(e?.message||e)} | Live本体へフォールバック`;
          render();
        }
      });
      await transcriber.connect();
    }catch(e){
      try{transcriber?.close()}catch{}
      transcriber=null;
      transcriberReady=false;
      transcribeDiagnosticText=`専用文字起こしに接続できません: ${String(e?.message||e)} | Live本体へフォールバック`;
      render();
    }

    await audio.startCapture(bytes=>{
      transport?.sendAudio(bytes);
      transcriber?.sendAudio(bytes);
    });
    transport.sendOpening();
    sessionState='ready';render();
  }catch(e){
    const d=e?.liveDiagnostic?formatDiagnostic({stage:'token',ok:false,...e.liveDiagnostic}):'';
    if(d)diagnosticText=d;
    errorText=`接続できません: ${String(e?.message||e)}`;sessionState='error';
    try{transcriber?.close()}catch{}transcriber=null;transcriberReady=false;
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
  draft.clear();lastModel='';transcriptSpeaker='complete';render();
  transport?.sendText(`__PFC_DRAFT_COMMITTED__ ユーザー操作で${records.length}件の食事を登録しました。現在のDraftは空です。以前のrefは今後update/removeに使わないでください。短く「登録しました」と伝え、追加があればそのまま聞いてください。`);
}

async function endLive(){
  try{transcriber?.close()}catch{}transcriber=null;transcriberReady=false;
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

addEventListener('pagehide',()=>{
  try{transcriber?.close()}catch{}transcriber=null;transcriberReady=false;
  try{transport?.close()}catch{}transport=null;
  try{audio?.stopCapture()}catch{}
});
loadCss();ensureModal();
const observer=new MutationObserver(queuePatch);
for(const id of ['view-home','view-settings']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
queuePatch();
console.info('[PFC Gemini Live experiment]',{version:LIVE_VERSION,transcriber:TRANSCRIBE_MODEL});
