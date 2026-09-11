import { readState, writeRecords } from '../storage.js';
import { buildRecord, formatAmount } from '../nutrition/engine.js';
import { buildEvidenceRecord, chooseNutritionMode, evidenceSourceText } from '../nutrition/evidence-v1716.js?v=1.7.21';
import { LIVE_VERSION } from './config-v1720.js?v=1.7.21';
import { LiveMealDraft } from './draft-v1716.js?v=1.7.16';
import { GeminiLiveTransport } from './transport-v1720.js?v=1.7.21';
import { GeminiLiveTranscriber, TRANSCRIBE_MODEL } from './transcribe-v178.js?v=1.7.8';
import { LiveAudioIO, LIVE_AUDIO_TARGET_BUFFER_SEC } from './audio-v170.js?v=1.7.12';
import { mergeTranscriptFragment } from './transcript-v177.js?v=1.7.8';
import { normalizeProvisionalFoodName, unresolvedItems, shouldRecoverTurn, buildInternalRecoveryMessage, buildOfficialResolvedMessage, evidenceMacroLine } from './live-guard-v1720.js?v=1.7.21';
import { lookupOfficialNutrition, NUTRITION_LOOKUP_MODEL, isLookupDebugEnabled, getLookupDiagnostics, formatLookupDiagnosticsText, clearLookupDiagnostics, setLookupDiagnosticListener } from './nutrition-lookup-v1720.js?v=1.7.23';

const draft=new LiveMealDraft();
const LIVE_DEBUG=new URLSearchParams(globalThis.location?.search||'').get('liveDebug')==='1';
const LOOKUP_DEBUG=isLookupDebugEnabled();
const TRANSCRIBER_START_DELAY_MS=120;
const LIVE_MUTE_STORAGE_KEY='pfc-live-ai-muted-v1';
const TURN_RECOVERY_DELAY_MS=180;
const TURN_RECOVERY_MAX_ATTEMPTS=2;
let transport=null;
let transcriber=null;
let transcriberReady=false;
let transcriberConnected=false;
let captureStarted=false;
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
let diagnosticReplayActive=false;
let aiMuted=readAiMuted();
let userTurnId=0;
let toolCallsInTurn=0;
let localFallbackTurn=-1;
let recoveryAttempts=0;
let recoveryTimer=null;
let liveHistoryArmed=false;
let pendingExplicitEnd=false;
let cleanupInFlight=null;
const lookupStates=new Map();

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
function n1(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*10)/10):''}
function readAiMuted(){try{return localStorage.getItem(LIVE_MUTE_STORAGE_KEY)==='1'}catch{return false}}
function writeAiMuted(value){try{localStorage.setItem(LIVE_MUTE_STORAGE_KEY,value?'1':'0')}catch{}}
function setAiMuted(value){aiMuted=!!value;writeAiMuted(aiMuted);if(aiMuted)audio?.interruptOutput?.();render()}
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
function traceStamp(){if(!traceStartMs)return '0.0s';return `${((performance.now()-traceStartMs)/1000).toFixed(1)}s`}
function addTrace(text,{renderNow=LIVE_DEBUG}={}){const entry=`${traceStamp()} ${text}`;traceEvents.push(entry);if(traceEvents.length>10)traceEvents.shift();if(renderNow)render()}
function handleLiveTrace(event={}){
  const type=String(event.type||'');
  if(type==='audio'){
    const now=performance.now();const countMatch=String(event.detail||'').match(/chunks=(\d+)/);audioChunkCount+=countMatch?Number(countMatch[1]):1;
    if(!lastAudioArrivalMs||now-lastAudioArrivalMs>700){audioBurstCount++;addTrace(`audio-start #${audioBurstCount}`,{renderNow:LIVE_DEBUG})}
    else{const gap=now-lastAudioArrivalMs;if(gap>140&&gap<700)addTrace(`audio-gap ${Math.round(gap)}ms`,{renderNow:LIVE_DEBUG})}
    lastAudioArrivalMs=now;return;
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
  if(document.getElementById('pfc-live-v1721-css'))return;
  const link=document.createElement('link');link.id='pfc-live-v1721-css';link.rel='stylesheet';
  link.href=new URL('../../assets/live-v170.css?v=1.7.21',import.meta.url).href;document.head.appendChild(link);
}
function ensureModal(){
  if(modal)return modal;
  modal=document.createElement('div');modal.id='pfc-live-modal';modal.className='modal pfc-live-modal';modal.hidden=true;
  modal.innerHTML='<div class="modal-sheet pfc-live-sheet" id="pfc-live-sheet"></div>';document.body.appendChild(modal);return modal;
}
function lookupState(item){return item?.ref?lookupStates.get(item.ref)||null:null}
function itemStatus(item){
  const mode=chooseNutritionMode(item);
  if(mode.mode==='evidence'){
    const source=evidenceSourceText(mode.evidence);
    return mode.evidence?.kcalDerived?`${source}・kcalはPFCから計算`:source;
  }
  const ls=lookupState(item);
  if(item.unresolved&&ls?.status==='searching')return `公式情報を検索中（${NUTRITION_LOOKUP_MODEL}）`;
  if(item.unresolved&&ls?.status==='not_found')return '公式情報を確定できず・商品候補を確認中';
  if(item.unresolved&&ls?.status==='error')return '公式検索エラー・商品候補を確認中';
  if(item.needsSkin&&item.needsAmount)return '皮あり・皮なしと量を確認します';
  if(item.needsSkin)return '皮あり・皮なしを確認します';
  if(item.unresolved)return item.candidateNames?.length?'公式検索用の商品候補を確認中':'公式情報を検索します';
  if(item.needsAmount)return '量を確認します';
  if(item.assumed)return `標準量：${item.standardLabel||formatAmount(item.amount,item.unit)}`;
  return '確認済み';
}
function itemQty(item){
  const mode=chooseNutritionMode(item);
  if(mode.mode==='evidence')return mode.evidence?.servingLabel||'1食';
  if(item.needsSkin||item.unresolved)return '確認中';
  if(item.needsAmount)return '量を確認';
  if(item.assumed&&item.standardLabel)return item.standardLabel;
  return formatAmount(item.amount,item.unit);
}
function itemNutritionLine(item){
  const evidenceLine=evidenceMacroLine(item);if(evidenceLine)return evidenceLine;
  if(chooseNutritionMode(item).mode!=='trusted-db')return '';
  try{
    const r=buildRecord({foodId:item.foodId,amount:item.amount,unit:item.unit,meal:item.meal});if(!r)return '';
    return `${Math.round(Number(r.Cal)||0)} kcal ・ P ${n1(r.P)}g / F ${n1(r.F)}g / C ${n1(r.C)}g`;
  }catch{return ''}
}
function lookupDiagnosticPanelHtml(){
  if(!LOOKUP_DEBUG)return '';
  const rows=getLookupDiagnostics();
  const body=rows.length?rows.map((r,i)=>{
    const elapsed=Number.isFinite(r.elapsedMs)?`${(r.elapsedMs/1000).toFixed(1)}秒`:'n/a';
    const candidates=r.candidates?.length?`<br><span>候補: ${esc(r.candidates.join(' / '))}</span>`:'';
    return `<div style="margin-top:8px"><b>#${i+1} ${esc(r.foodName)}</b><br><span>${esc(r.stage)} / ${esc(elapsed)}</span><br><span>${esc(r.summary)}</span>${candidates}</div>`;
  }).join(''):'<div style="margin-top:6px"><span>診断モード有効。公式検索の開始を待っています。</span></div>';
  return `<div class="pfc-live-diagnostic" data-lookup-diagnostic-panel><strong>公式検索 診断（安全モード）</strong>${body}<button type="button" data-live-action="copy-lookup-diag" style="margin-top:8px">診断をコピー</button></div>`;
}
function render(){
  ensureModal();const sheet=document.getElementById('pfc-live-sheet');if(!sheet)return;
  const items=draft.snapshot();const ready=draft.isReady();
  const traceSummary=LIVE_DEBUG&&traceEvents.length?`${traceEvents.join(' → ')} | audio chunks=${audioChunkCount}`:'';
  const rawInfo=LIVE_DEBUG?(audio?.getLastTurnRawInfo?.()||null):null;
  sheet.innerHTML=`
    <div class="sv4-header pfc-live-head">
      <button type="button" class="close-btn" data-live-action="end" aria-label="終了">‹</button>
      <strong>ライブ会話</strong><span class="pfc-live-dot ${sessionState==='ready'||sessionState==='turn-complete'?'on':''}"></span>
    </div>
    <div class="sv4-body">
      <div class="pfc-live-status">${esc(statusText())}</div>
      <div class="pfc-live-audio-setting">
        <div><strong>AI音声をミュート</strong><small>文字起こしと入力ガイドはそのまま使えます</small></div>
        <button type="button" class="pfc-live-mute-switch ${aiMuted?'on':''}" data-live-action="toggle-mute" role="switch" aria-checked="${aiMuted?'true':'false'}" aria-label="AI音声をミュート"><span class="pfc-live-switch-track"><i></i></span><b>${aiMuted?'ON':'OFF'}</b></button>
      </div>
      ${LIVE_DEBUG&&diagnosticText?`<div class="pfc-live-diagnostic"><strong>診断</strong><span>${esc(diagnosticText)}</span></div>`:''}
      ${LIVE_DEBUG&&transcribeDiagnosticText?`<div class="pfc-live-diagnostic"><strong>文字起こし</strong><span>${esc(transcribeDiagnosticText)}</span></div>`:''}
      ${traceSummary?`<div class="pfc-live-diagnostic"><strong>音声イベント</strong><span>${esc(traceSummary)}</span></div>`:''}
      ${LIVE_DEBUG?`<div class="pfc-live-diagnostic"><strong>再生バッファ</strong><span>${Math.round(LIVE_AUDIO_TARGET_BUFFER_SEC*1000)}ms</span></div>`:''}
      ${LIVE_DEBUG?`<div class="pfc-live-diagnostic"><strong>再生エンジン</strong><span>${audio?.getPlaybackMode?.()==='audio-worklet-continuous'?'AudioWorklet 連続ストリーム':'旧BufferSource fallback'}</span></div>`:''}
      ${rawInfo?`<div class="pfc-live-diagnostic"><strong>生PCM診断</strong><span>直前AI音声 ${rawInfo.durationSec.toFixed(1)}秒 / ${rawInfo.chunkCount} chunks。</span></div>`:''}
      <div class="pfc-live-conversation">
        ${lastUser?`<div><span>あなた</span><b>${esc(lastUser)}</b></div>`:''}
        ${lastModel?`<div class="model"><span>AI</span><b>${esc(lastModel)}</b></div>`:''}
      </div>
      <div class="sv4-memo pfc-live-memo">
        <div class="sv4-memo-head"><strong>今日の食事メモ</strong><span>${ready?'登録できます':items.length?'会話で確認中':'待機中'}</span></div>
        ${items.length?items.map(x=>{const nutrition=itemNutritionLine(x);return `
          <div class="sv4-food ${chooseNutritionMode(x).mode==='pending'?'pending':''}">
            <div><div class="sv4-food-name">${esc(x.canonicalName||x.name)}</div><div class="sv4-food-meta">${esc(itemStatus(x))}</div>${nutrition?`<div class="pfc-live-food-macros">${esc(nutrition)}</div>`:''}</div>
            <div class="sv4-food-qty">${esc(itemQty(x))}<button class="memo-remove" data-live-action="remove" data-ref="${esc(x.ref)}" aria-label="削除">×</button></div>
          </div>`}).join(''):'<div class="sv4-empty">会話から食品をここへ追加します。</div>'}
      </div>
      ${lookupDiagnosticPanelHtml()}
      ${registeredCount?`<div class="pfc-live-saved">このセッションで ${registeredCount}件 登録済み</div>`:''}
    </div>
    <div class="sv4-actions pfc-live-actions">
      <button class="primary" data-live-action="register" ${ready?'':'disabled'}>これで登録する</button>
      ${rawInfo?`<button data-live-action="replay-pcm" ${diagnosticReplayActive?'disabled':''}>${diagnosticReplayActive?'PCM診断を再生中…':'PCM診断①：直前AI音声を一括再生'}</button><button data-live-action="replay-pcm-chunked" ${diagnosticReplayActive?'disabled':''}>${diagnosticReplayActive?'PCM診断を再生中…':'PCM診断②：同じchunksを新エンジンで再生'}</button>`:''}
      <button data-live-action="end">ライブを終了</button>
    </div>`;
}
function patchVersion(){
  const badge=document.querySelector('.app-build-version');if(badge&&badge.textContent!==LIVE_VERSION)badge.textContent=LIVE_VERSION;
  const runtime=document.querySelector('#view-settings .runtime-panel p');if(runtime&&!runtime.textContent.includes(LIVE_VERSION))runtime.innerHTML=runtime.innerHTML.replace(/v1\.\d+\.\d+/,LIVE_VERSION);
}
function patchHome(){
  const home=document.getElementById('view-home');if(!home||home.hidden)return;
  const talk=home.querySelector('.senior-talk-btn');if(!talk)return;
  for(const extra of home.querySelectorAll('.senior-live-btn'))if(extra!==talk)extra.remove();
  if(talk.dataset.liveAction==='start')return;
  talk.removeAttribute('data-action');talk.dataset.liveAction='start';talk.classList.add('senior-live-btn');
  talk.innerHTML='<span class="live-icon">🎙</span><span><strong>話して記録</strong><small>AIと会話しながら、そのまま記録</small></span>';
}
function queuePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(()=>{patchQueued=false;patchVersion();patchHome()})}
function resetTurnGuard(){toolCallsInTurn=0;localFallbackTurn=-1;recoveryAttempts=0;if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null}}
function scheduleTurnRecovery(delay=TURN_RECOVERY_DELAY_MS){if(recoveryTimer)clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{recoveryTimer=null;recoverCurrentTurn()},delay)}
function applyLocalProvisionalCard(userText){
  if(localFallbackTurn===userTurnId)return false;
  const name=normalizeProvisionalFoodName(userText);if(!name)return false;
  localFallbackTurn=userTurnId;
  try{draft.applyFunctionCall({id:`local-provisional-${userTurnId}`,args:{operations:[{op:'add',name}]}});addTrace(`local-card ${name}`);render();return true}
  catch(e){addTrace(`local-card-error ${String(e?.message||e)}`);return false}
}
function lookupPendingFor(items=[]){return unresolvedItems(items).some(item=>lookupState(item)?.status==='searching')}
function lookupAttemptedForAll(items=[]){const u=unresolvedItems(items);return u.length>0&&u.every(item=>['verified','not_found','error'].includes(lookupState(item)?.status))}
function startOfficialLookups(items=draft.snapshot()){
  let started=0;
  for(const item of unresolvedItems(items)){
    if(!item?.ref||item?.nutritionEvidence)continue;
    const existing=lookupState(item);if(existing)continue;
    started+=1;resolveOfficialItem(item);
  }
  return started;
}
async function resolveOfficialItem(item){
  const ref=item.ref;const originalName=item.name;lookupStates.set(ref,{status:'searching',name:originalName});addTrace(`official-search ${originalName}`);render();
  try{
    const candidates=[originalName,item.canonicalName,...(item.candidateNames||[])].map(x=>String(x||'').trim()).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,5);
    const contextText=[lastUser?`ユーザー発話: ${lastUser}`:'',item.canonicalName?`カード候補: ${item.canonicalName}`:''].filter(Boolean).join(' / ');
    const result=await lookupOfficialNutrition({foodName:originalName,contextText,candidateNames:candidates});
    const current=draft.snapshot().find(x=>x.ref===ref);
    if(!current||current.name!==originalName||!current.unresolved||current.nutritionEvidence)return;
    if(result?.status==='verified'){
      draft.applyFunctionCall({id:`official-${Date.now()}-${ref}`,args:{operations:[{
        op:'update',ref,
        ...(result.productName?{name:result.productName}:{}),
        p:result.p,f:result.f,c:result.c,kcal:result.kcal,
        nutritionSource:'official-web',sourceLabel:result.sourceLabel,sourceUrl:result.sourceUrl,servingLabel:result.servingLabel
      }]}});
      lookupStates.set(ref,{status:'verified',result});addTrace(`official-hit ${result.sourceDomain||result.sourceLabel}${result.cacheHit?' cache':''}`);render();
      if(draft.isReady()){
        const updated=draft.snapshot().find(x=>x.ref===ref);if(updated)transport?.sendText(buildOfficialResolvedMessage({item:updated}));
      }
      return;
    }
    lookupStates.set(ref,{status:'not_found',result});addTrace(`official-not-found ${originalName}`);render();scheduleTurnRecovery(40);
  }catch(e){
    lookupStates.set(ref,{status:'error',message:String(e?.message||e)});addTrace(`official-error ${String(e?.message||e)}`);render();scheduleTurnRecovery(40);
  }
}
function recoverCurrentTurn(){
  if(!transport||sessionState==='closed'||sessionState==='error')return;
  const userText=lastUser.trim();if(!userText)return;
  let items=draft.snapshot();if(draft.isReady())return;
  if(!items.length)applyLocalProvisionalCard(userText);
  items=draft.snapshot();if(draft.isReady())return;
  const unresolved=unresolvedItems(items);
  if(unresolved.length){
    const started=startOfficialLookups(items);
    if(started>0||lookupPendingFor(items))return;
    if(!lookupAttemptedForAll(items))return;
  }
  if(!shouldRecoverTurn({userText,ready:false,items,attempts:recoveryAttempts,maxAttempts:TURN_RECOVERY_MAX_ATTEMPTS}))return;
  recoveryAttempts+=1;const msg=buildInternalRecoveryMessage({userText,items,attempt:recoveryAttempts});addTrace(`fallback-recovery #${recoveryAttempts}`);
  try{transport.sendText(msg)}catch(e){addTrace(`recovery-send-error ${String(e?.message||e)}`)}
}
async function handleToolCalls(calls){
  const responses=[];toolCallsInTurn+=Array.isArray(calls)?calls.length:0;
  for(const call of calls){
    if(call?.name!=='update_meal_draft'){responses.push({id:call?.id,name:call?.name||'unknown',response:{result:{ok:false,error:'unsupported_tool'}}});continue}
    try{const result=draft.applyFunctionCall(call);responses.push({id:call.id,name:call.name,response:{result}})}
    catch(e){responses.push({id:call?.id,name:call?.name||'update_meal_draft',response:{result:{ok:false,error:String(e?.message||e),draft:draft.toolResult().draft}}})}
  }
  render();transport?.sendToolResponses(responses);startOfficialLookups(draft.snapshot());
}
function handleCancellations(ids){let changed=false;for(const id of ids||[])changed=draft.cancelCall(id)||changed;if(changed)render()}
function acceptInputTranscript(text){
  if(transcriptSpeaker!=='user'){lastUser='';lastModel='';transcriptSpeaker='user';userTurnId+=1;resetTurnGuard()}
  lastUser=mergeTranscriptFragment(lastUser,text);render();
}
function acceptOutputTranscript(text){
  if(transcriptSpeaker!=='model'){lastModel='';transcriptSpeaker='model'}
  lastModel=mergeTranscriptFragment(lastModel,text);
  if(!draft.isReady()&&/登録(?:ボタン|して|できます)/.test(lastModel))scheduleTurnRecovery(40);
  render();
}
function handleTranscriberState(state){
  if(state==='ready'){transcriberConnected=true;if(!captureStarted)transcriberReady=true;transcribeDiagnosticText=`${TRANSCRIBE_MODEL} | ja-JP | SMART`}
  else if(state==='closed'){transcriberConnected=false;transcriberReady=false;if(sessionState!=='closed')transcribeDiagnosticText='専用文字起こしが終了しました。Live本体の文字起こしへフォールバックします。'}
  if(LIVE_DEBUG)render();
}
function connectTranscriberInBackground(ownerTransport){
  setTimeout(async()=>{
    if(transport!==ownerTransport||sessionState==='closed')return;
    const instance=new GeminiLiveTranscriber({
      onState:handleTranscriberState,
      onFinal:t=>{if(transcriberReady)acceptInputTranscript(t)},onInterim:()=>{},
      onDiagnostic:d=>{if(d.stage==='transcribe-setup'&&d.ok)transcribeDiagnosticText=`${TRANSCRIBE_MODEL} | ja-JP | SMART`;else if(!d.ok)transcribeDiagnosticText=formatDiagnostic(d);if(LIVE_DEBUG)render()},
      onError:e=>{transcriberConnected=false;transcriberReady=false;transcribeDiagnosticText=`専用文字起こしエラー: ${String(e?.message||e)} | Live本体へフォールバック`;if(LIVE_DEBUG)render()}
    });
    transcriber=instance;
    try{await instance.connect();if(transport!==ownerTransport){try{instance.close()}catch{};if(transcriber===instance)transcriber=null;return}addTrace('transcribe-ready')}
    catch(e){try{instance.close()}catch{};if(transcriber===instance)transcriber=null;transcriberConnected=false;transcriberReady=false;transcribeDiagnosticText=`専用文字起こしに接続できません: ${String(e?.message||e)} | Live本体へフォールバック`;if(LIVE_DEBUG)render()}
  },TRANSCRIBER_START_DELAY_MS);
}
function armLiveHistory(){if(liveHistoryArmed)return;try{history.pushState({...((history.state&&typeof history.state==='object')?history.state:{}),__pfcLiveModal:true},'',location.href);liveHistoryArmed=true;addTrace('history-armed',{renderNow:false})}catch{}}
async function cleanupLiveSession({clearDraft=true,hide=true}={}){
  if(cleanupInFlight)return cleanupInFlight;
  cleanupInFlight=(async()=>{
    if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null}
    const t=transcriber;transcriber=null;transcriberReady=false;transcriberConnected=false;captureStarted=false;
    const tr=transport;transport=null;const a=audio;audio=null;
    try{t?.close()}catch{}try{tr?.close()}catch{}try{a?.stopCapture?.()}catch{}try{await a?.close?.()}catch{}
    if(clearDraft){draft.clear();lookupStates.clear()}
    sessionState='closed';if(hide&&modal)modal.hidden=true;
  })().finally(()=>{cleanupInFlight=null});return cleanupInFlight;
}
async function endLive(){
  pendingExplicitEnd=true;await cleanupLiveSession();
  if(liveHistoryArmed){liveHistoryArmed=false;try{history.back();setTimeout(()=>{if(pendingExplicitEnd)location.reload()},500);return}catch{}}
  pendingExplicitEnd=false;location.reload();
}
async function startLive(){
  if(transport)return;
  clearLookupDiagnostics();
  errorText='';diagnosticText=`app ${LIVE_VERSION}`;transcribeDiagnosticText='専用文字起こしを準備しています…';registeredCount=0;lastUser='';lastModel='';transcriptSpeaker='none';draft.clear();lookupStates.clear();
  traceStartMs=performance.now();traceEvents=[];lastAudioArrivalMs=0;audioBurstCount=0;audioChunkCount=0;transcriberReady=false;transcriberConnected=false;captureStarted=false;diagnosticReplayActive=false;userTurnId=0;resetTurnGuard();
  armLiveHistory();ensureModal().hidden=false;sessionState='token';render();
  try{
    audio=new LiveAudioIO();
    audio.onPlaybackEvent=e=>{if(e?.type==='underflow')addTrace('worklet-underflow');else if(e?.type==='rate-reset')addTrace(`worklet-rate-reset ${e?.sourceRate||''}`.trim())};
    transport=new GeminiLiveTransport({
      onState:s=>{
        sessionState=s==='ready'?'setup':s;
        if(s==='turn-complete'){audio?.completeModelTurn?.();lastUser=lastUser.trim();lastModel=lastModel.trim();transcriptSpeaker='complete';if(transcriberConnected)transcriberReady=true;scheduleTurnRecovery()}
        render();
      },
      onDiagnostic:d=>{const text=formatDiagnostic(d);if(text)diagnosticText=text;if(LIVE_DEBUG)render()},
      onAudio:(data,mime)=>{if(!diagnosticReplayActive&&!aiMuted)audio?.play(data,mime)},
      onInputTranscript:t=>{if(!transcriberReady)acceptInputTranscript(t)},onOutputTranscript:acceptOutputTranscript,
      onToolCall:handleToolCalls,onToolCancellation:handleCancellations,onInterrupted:()=>audio?.interruptOutput(),onTrace:handleLiveTrace,
      onError:e=>{errorText=`Liveエラー: ${String(e?.message||e)}`;render()}
    });
    const ownerTransport=transport;
    const audioReady=audio.prepare().then(()=>addTrace('audio-ready'));const liveReady=transport.connect().then(()=>addTrace('live-ready'));
    connectTranscriberInBackground(ownerTransport);await Promise.all([audioReady,liveReady]);
    await audio.startCapture(bytes=>{if(diagnosticReplayActive)return;transport?.sendAudio(bytes);if(transcriberReady)transcriber?.sendAudio(bytes)});
    captureStarted=true;if(transcriberConnected)transcriberReady=true;transport.sendOpening();sessionState='ready';addTrace('capture-ready');render();
  }catch(e){
    const d=e?.liveDiagnostic?formatDiagnostic({stage:'token',ok:false,...e.liveDiagnostic}):'';if(d)diagnosticText=d;
    errorText=`接続できません: ${String(e?.message||e)}`;sessionState='error';await cleanupLiveSession({clearDraft:false,hide:false});sessionState='error';render();
  }
}
async function registerDraft(){
  const items=draft.resolvedItems();if(!items.length)return;
  const current=readState();const records=[];
  for(const item of items){
    const mode=chooseNutritionMode(item);let record=null;
    if(mode.mode==='evidence')record=buildEvidenceRecord(item);
    else if(mode.mode==='trusted-db')record=buildRecord({foodId:item.foodId,amount:item.amount,unit:item.unit,meal:item.meal});
    if(record&&item.assumed&&item.standardLabel&&record._clean){record._clean.amountSource='food-master-default';record._clean.displayAmount=item.standardLabel}
    if(record)records.push(record);
  }
  if(!records.length)return;
  writeRecords([...(current.records||[]),...records]);registeredCount+=records.length;draft.clear();lookupStates.clear();lastModel='';transcriptSpeaker='complete';render();
  transport?.sendText(`__PFC_DRAFT_COMMITTED__ ユーザー操作で${records.length}件の食事を登録しました。現在のDraftは空です。以前のrefは今後update/removeに使わないでください。短く「登録しました」と伝え、追加があればそのまま聞いてください。`);
}
async function replayRawPcm(){
  if(!audio?.hasLastTurnRaw?.()||diagnosticReplayActive)return;diagnosticReplayActive=true;addTrace('pcm-replay start');render();
  try{const info=await audio.replayLastTurnRaw();addTrace(`pcm-replay end ${info?.durationSec?.toFixed?.(1)||'?'}s`)}catch(e){addTrace(`pcm-replay error ${String(e?.message||e)}`)}finally{diagnosticReplayActive=false;render()}
}
async function replayChunkedPcm(){
  if(!audio?.hasLastTurnRaw?.()||diagnosticReplayActive)return;diagnosticReplayActive=true;addTrace('pcm-chunked-replay start');render();
  try{const info=await audio.replayLastTurnChunked();addTrace(`pcm-chunked-replay end ${info?.durationSec?.toFixed?.(1)||'?'}s`)}catch(e){addTrace(`pcm-chunked-replay error ${String(e?.message||e)}`)}finally{diagnosticReplayActive=false;render()}
}

setLookupDiagnosticListener(()=>{if(LOOKUP_DEBUG&&modal&&!modal.hidden)render()});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-live-action]');if(!button)return;const action=button.dataset.liveAction;
  if(action==='start'){e.preventDefault();startLive()}
  else if(action==='end'){e.preventDefault();endLive()}
  else if(action==='register'){e.preventDefault();registerDraft()}
  else if(action==='toggle-mute'){e.preventDefault();setAiMuted(!aiMuted)}
  else if(action==='replay-pcm'){e.preventDefault();replayRawPcm()}
  else if(action==='replay-pcm-chunked'){e.preventDefault();replayChunkedPcm()}
  else if(action==='copy-lookup-diag'){e.preventDefault();navigator.clipboard?.writeText?.(formatLookupDiagnosticsText()).then(()=>{button.textContent='コピーしました'}).catch(()=>{button.textContent='コピー失敗'})}
  else if(action==='remove'){e.preventDefault();const ref=button.dataset.ref;draft.removeLocal(ref);lookupStates.delete(ref);render()}
});
addEventListener('popstate',async()=>{if(!liveHistoryArmed&&!pendingExplicitEnd)return;liveHistoryArmed=false;pendingExplicitEnd=false;await cleanupLiveSession();location.reload()});
function emergencyRelease(){if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null}try{transcriber?.close()}catch{}transcriber=null;transcriberReady=false;transcriberConnected=false;try{transport?.close()}catch{}transport=null;try{audio?.stopCapture?.()}catch{}}
addEventListener('pagehide',emergencyRelease);addEventListener('beforeunload',emergencyRelease);
function warmLiveRuntime(){
  const workletUrl=new URL('./live-playback-worklet-v1711.js?v=1.7.11',import.meta.url).href;const warm=()=>fetch(workletUrl,{cache:'force-cache',credentials:'same-origin'}).catch(()=>{});
  if(typeof globalThis.requestIdleCallback==='function')globalThis.requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,600);
}

loadCss();ensureModal();warmLiveRuntime();
const observer=new MutationObserver(queuePatch);
for(const id of ['view-home','view-settings']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
queuePatch();
console.info('[PFC Gemini Live]',{version:LIVE_VERSION,transcriber:TRANSCRIBE_MODEL,audioBufferMs:LIVE_AUDIO_TARGET_BUFFER_SEC*1000,officialLookupModel:NUTRITION_LOOKUP_MODEL,turnGuard:true,lookupDebug:LOOKUP_DEBUG});
