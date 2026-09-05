import { resolveFood, defaultAmount } from '../nutrition/catalog.js';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live';
const CONVERSATION_MODEL = 'gemini-3.1-flash-live-preview';
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const BENCH_KEY = 'tf_voice_bench_v1';
const MAX_BENCH = 120;

const MODE_META = Object.freeze({
  voice: { code:'A', name:'最速Live', roles:'耳・脳・口＝会話Live' },
  chat: { code:'B', name:'専用耳Live', roles:'耳＝文字起こしLive / 脳・口＝会話Live' },
  auto: { code:'C', name:'完全分離', roles:'耳＝文字起こしLive / 脳＝Flash Lite / 口＝会話Live' }
});

const VOCABULARY = [
  '鶏むね','鶏もも','鶏胸肉','皮なし','皮あり','白米','玄米','雑穀米','麦ご飯','オートミール','パスタ',
  '納豆','味噌汁','全卵','ゆで卵','プロテイン','砂肝','サバ','アジ','鮭','マグロ','さつまいも','じゃがいも',
  'グラム','キログラム','ミリリットル','パック','スクープ','人前','大さじ','小さじ'
];

let activeInstance = null;
const perfNow = () => performance.now();
const clean = value => String(value ?? '').trim();
const uid = () => globalThis.crypto?.randomUUID?.() || `vl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const ms = value => Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;

function currentMode() {
  return document.querySelector('.voice-mode.selected')?.dataset.mode || 'voice';
}
function readBench() {
  try { const v=JSON.parse(localStorage.getItem(BENCH_KEY)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; }
}
function saveBench(rows) { localStorage.setItem(BENCH_KEY, JSON.stringify(rows.slice(-MAX_BENCH))); }
function pushBench(sample) {
  const rows=readBench(); rows.push(sample); saveBench(rows);
  globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench',{detail:sample}));
  return sample;
}
function rateLatest(accurate) {
  const rows=readBench(); if(!rows.length)return null;
  rows[rows.length-1].accurate=!!accurate; saveBench(rows);
  globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench',{detail:rows[rows.length-1]}));
  return rows[rows.length-1];
}
function clearBench(){ localStorage.removeItem(BENCH_KEY); globalThis.dispatchEvent(new CustomEvent('pfc-voice-bench',{detail:null})); }

function normalizeMealItems(rawItems, current=[]) {
  const out=[];
  const fallbackMeal=current.at(-1)?.meal||'';
  for(const raw of Array.isArray(rawItems)?rawItems:[]){
    const requested=clean(raw?.name); if(!requested)continue;
    const food=resolveFood(requested);
    if(!food){ out.push({key:uid(),name:requested,foodId:null,amount:null,unit:clean(raw?.unit)||'g',meal:clean(raw?.meal)||fallbackMeal,unresolved:true,needsAmount:false,assumed:false}); continue; }
    const d=defaultAmount(food);
    const n=Number(raw?.amount), hasAmount=Number.isFinite(n)&&n>0;
    out.push({
      key:uid(), name:food.name, foodId:food.id,
      amount:hasAmount?n:(food.criticalAmount?null:d.amount),
      unit:clean(raw?.unit)||d.unit,
      meal:clean(raw?.meal)||fallbackMeal,
      unresolved:false,
      needsAmount:!hasAmount&&food.criticalAmount,
      assumed:!hasAmount&&!food.criticalAmount
    });
  }
  return out;
}

function bytesToBase64(bytes){let s='';const step=0x8000;for(let i=0;i<bytes.length;i+=step)s+=String.fromCharCode(...bytes.subarray(i,i+step));return btoa(s)}
function base64ToInt16(b64){const s=atob(b64),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return new Int16Array(b.buffer)}
function downsample(float32,inputRate){
  const ratio=inputRate/16000, len=Math.max(1,Math.floor(float32.length/ratio)), out=new Int16Array(len);
  for(let i=0;i<len;i++){const a=Math.floor(i*ratio),z=Math.min(float32.length,Math.floor((i+1)*ratio));let sum=0;for(let j=a;j<z;j++)sum+=float32[j];const v=sum/Math.max(1,z-a);out[i]=Math.max(-32768,Math.min(32767,Math.round(v*32767)))}
  return out;
}
function levelOf(float32){let sum=0;for(let i=0;i<float32.length;i++)sum+=float32[i]*float32[i];return Math.sqrt(sum/Math.max(1,float32.length))}

class MicPcm16 {
  constructor(onChunk,onVoice,onError){this.onChunk=onChunk;this.onVoice=onVoice;this.onError=onError;this.active=false;this.stream=null;this.ctx=null;this.source=null;this.node=null;}
  async start(){
    try{
      this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext; this.ctx=new AC();
      this.source=this.ctx.createMediaStreamSource(this.stream); this.node=this.ctx.createScriptProcessor(4096,1,1);
      const mute=this.ctx.createGain();mute.gain.value=0;this.source.connect(this.node);this.node.connect(mute);mute.connect(this.ctx.destination);this.active=true;
      this.node.onaudioprocess=e=>{if(!this.active)return;const f=e.inputBuffer.getChannelData(0),t=perfNow();if(levelOf(f)>=0.012)this.onVoice?.(t);const pcm=downsample(f,this.ctx.sampleRate);this.onChunk?.(bytesToBase64(new Uint8Array(pcm.buffer)))};
    }catch(e){this.stop();this.onError?.(e);throw e}
  }
  stop(){this.active=false;try{this.node?.disconnect()}catch{}try{this.source?.disconnect()}catch{}try{this.stream?.getTracks().forEach(t=>t.stop())}catch{}try{this.ctx?.close()}catch{}this.node=null;this.source=null;this.stream=null;this.ctx=null;}
}

class AudioPlayer {
  constructor(onFirst,onDrained){this.onFirst=onFirst;this.onDrained=onDrained;this.ctx=null;this.next=0;this.first=false;this.pending=0;}
  reset(){this.first=false;this.pending=0;this.next=Math.max(this.ctx?.currentTime||0,0)}
  async play(b64){
    const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!this.ctx)this.ctx=new AC();if(this.ctx.state==='suspended')await this.ctx.resume();
    const pcm=base64ToInt16(b64),buf=this.ctx.createBuffer(1,pcm.length,24000),ch=buf.getChannelData(0);for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;
    const src=this.ctx.createBufferSource();src.buffer=buf;src.connect(this.ctx.destination);const at=Math.max(this.ctx.currentTime+0.012,this.next||0);this.next=at+buf.duration;
    if(!this.first){this.first=true;this.onFirst?.(perfNow())}this.pending++;src.onended=()=>{this.pending=Math.max(0,this.pending-1);if(!this.pending)this.onDrained?.()};src.start(at);
  }
  close(){try{this.ctx?.close()}catch{}this.ctx=null;this.next=0;this.first=false;this.pending=0;}
}

async function getToken(profile){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({taskType:'liveToken',profile}),signal:c.signal});
    if(!r.ok)throw new Error(`token-http-${r.status}`);const j=await r.json();if(!j?.ok||!j?.token)throw new Error(j?.error||j?.candidates?.[0]?.content?.parts?.[0]?.text||'live-token-unavailable');return j.token;
  }finally{clearTimeout(timer)}
}

class LiveWs {
  constructor(profile,setup,onMessage,onError){this.profile=profile;this.setup=setup;this.onMessage=onMessage;this.onError=onError;this.ws=null;this.ready=false;}
  async connect(){
    const token=await getToken(this.profile);
    await new Promise((resolve,reject)=>{const ws=new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(token)}`);this.ws=ws;const timer=setTimeout(()=>{try{ws.close()}catch{}reject(new Error('live-connect-timeout'))},12000);
      ws.onopen=()=>ws.send(JSON.stringify({setup:this.setup}));
      ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.setupComplete){clearTimeout(timer);this.ready=true;resolve();return}this.onMessage?.(m)};
      ws.onerror=()=>{clearTimeout(timer);const er=new Error('live-websocket-error');this.onError?.(er);if(!this.ready)reject(er)};
      ws.onclose=e=>{this.ready=false;if(e.code!==1000)this.onError?.(new Error(`live-closed-${e.code}`))};
    });
  }
  send(m){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(m))}
  audio(b64){this.send({realtimeInput:{audio:{data:b64,mimeType:'audio/pcm;rate=16000'}}})}
  audioEnd(){this.send({realtimeInput:{audioStreamEnd:true}})}
  text(text){this.send({realtimeInput:{text:String(text)}})}
  tool(functionResponses){this.send({toolResponse:{functionResponses}})}
  close(){try{this.ws?.close(1000,'mode-change')}catch{}this.ws=null;this.ready=false}
}

function mealTool(){return {functionDeclarations:[{name:'update_meal_memo',description:'食事発話を食品名・量・単位・食事区分へ構造化してアプリへ渡す。栄養値は生成しない。',parameters:{type:'OBJECT',properties:{items:{type:'ARRAY',items:{type:'OBJECT',properties:{name:{type:'STRING'},amount:{type:'NUMBER'},unit:{type:'STRING'},meal:{type:'STRING'}},required:['name']}},question:{type:'STRING'}},required:['items','question']}}]}}
function transcribeSetup(){return {model:`models/${TRANSCRIBE_MODEL}`,generationConfig:{responseModalities:['TEXT']},inputAudioTranscription:{languageCodes:['ja-JP'],mode:'SMART',customVocabulary:VOCABULARY}}}
function agentSetup(){return {model:`models/${CONVERSATION_MODEL}`,generationConfig:{responseModalities:['AUDIO'],temperature:0.1},systemInstruction:{parts:[{text:'あなたは、たまフィットPFCの食事記録用Liveエージェントです。ユーザーの食事発話を理解したら必ず update_meal_memo を呼び出してください。栄養値やカロリーは推測しません。食品名・量・単位・食事区分だけを返します。肉・魚・米・パスタ・オートミールなど量依存食品で量が不明なら最小限の質問を作ってください。納豆・味噌汁・卵など明白な単位食品は標準1単位で構いません。ツール応答後、質問があれば質問だけ、なければ「記録候補を作りました」とだけ短く話してください。'}]},inputAudioTranscription:{},outputAudioTranscription:{},tools:[mealTool()]}}
function mouthSetup(){return {model:`models/${CONVERSATION_MODEL}`,generationConfig:{responseModalities:['AUDIO'],temperature:0},systemInstruction:{parts:[{text:'あなたは読み上げ専用です。受け取った日本語を意味を変えず短く自然に読み上げてください。内容を追加しないでください。'}]},outputAudioTranscription:{}}}

class Profile {
  constructor(mode){this.id=uid();this.mode=mode;this.t={created:perfNow()};this.transcript='';this.done=false;}
  mark(k,t=perfNow()){if(k==='speechEnd'){this.t[k]=t;return}if(!Number.isFinite(this.t[k]))this.t[k]=t}
  voice(t){if(!this.t.speechStart)this.t.speechStart=t;this.t.speechEnd=t}
  finish(ok=true,error=null){if(this.done)return null;this.done=true;const t=this.t,end=t.speechEnd||t.micStop||t.transcriptFinal||t.created;const sample={id:this.id,at:new Date().toISOString(),mode:this.mode,ok,error:error?String(error):null,transcript:this.transcript,metrics:{transcriptMs:ms(Number.isFinite(t.transcriptFinal)?t.transcriptFinal-end:NaN),brainMs:ms(Number.isFinite(t.brainStart)&&Number.isFinite(t.brainDone)?t.brainDone-t.brainStart:NaN),mouthMs:ms(Number.isFinite(t.mouthStart)&&Number.isFinite(t.firstAudio)?t.firstAudio-t.mouthStart:NaN),responseMs:ms(Number.isFinite(t.firstAudio)?t.firstAudio-end:(Number.isFinite(t.memoReady)?t.memoReady-end:NaN)),totalMs:ms((t.turnDone||t.firstAudio||t.memoReady||perfNow())-(t.speechStart||t.created)),connectMs:ms(Number.isFinite(t.connectStart)&&Number.isFinite(t.connectDone)?t.connectDone-t.connectStart:NaN)}};return pushBench(sample)}
}

export class VoiceInput {
  constructor({onText,onInterim,onState,onError,onUtterance}={}){
    this.onText=onText||(()=>{});this.onInterim=onInterim||(()=>{});this.onState=onState||(()=>{});this.onError=onError||(()=>{});this.onUtterance=onUtterance||(()=>{});
    this.active=false;this.processing=false;this.mode='voice';this.transcript='';this.interim='';this.transcribe=null;this.conversation=null;this.convKind='';this.mic=null;this.profile=null;this.liveResult=null;this.emitted=false;this.pendingSpeakEnd=null;this.serverTurnComplete=false;this.preparePromise=null;this.player=new AudioPlayer(t=>this._firstAudio(t),()=>this._audioDrained());activeInstance=this;this._installBridge();
  }
  _installBridge(){
    const self=this;
    globalThis.__PFC_VOICE_LAB__={
      consumeLiveResult(mode){if(!self.liveResult||self.liveResult.mode!==mode)return null;const r=self.liveResult;self.liveResult=null;return r},
      brainStart(){self.profile?.mark('brainStart')},
      brainDone(result){self.profile?.mark('brainDone');self.profile?.mark('memoReady');if(!clean(result?.question))self._speakC('記録候補を作りました',null)},
      brainError(error){self._turnError(error)},
      rateLatest,clearBench,modeMeta:MODE_META,benchKey:BENCH_KEY
    };
  }
  supported(){return !!(navigator.mediaDevices?.getUserMedia&&globalThis.WebSocket&&(globalThis.AudioContext||globalThis.webkitAudioContext))}
  getText(){return clean(this.transcript||this.interim)}
  resetBuffer(){this.transcript='';this.interim=''}
  async _prepare(mode){
    if(this.mode===mode&&this._ready(mode))return;
    this._closeSockets();this.mode=mode;this.onState('connecting');const p=this.profile;p?.mark('connectStart');
    this.preparePromise=(async()=>{if(mode==='voice'){this.conversation=await this._connect('conversation',agentSetup(),'agent')}else if(mode==='chat'){this.transcribe=await this._connect('transcribe',transcribeSetup(),'transcribe');this.conversation=await this._connect('conversation',agentSetup(),'agent')}else{this.transcribe=await this._connect('transcribe',transcribeSetup(),'transcribe');this.conversation=await this._connect('conversation',mouthSetup(),'mouth')}p?.mark('connectDone');this.onState('ready')})();
    try{await this.preparePromise}finally{this.preparePromise=null}
  }
  _ready(mode){return mode==='voice'?!!this.conversation?.ready:!!this.transcribe?.ready&&!!this.conversation?.ready}
  async _connect(profile,setup,kind){const s=new LiveWs(profile,setup,m=>kind==='transcribe'?this._onTranscribe(m):this._onConversation(m,kind),e=>this._socketError(e));await s.connect();return s}
  async start({clear=true}={}){
    if(!this.supported()){this.onError('unsupported');return false}if(this.active)return true;if(clear)this.resetBuffer();this.mode=currentMode();this.profile=new Profile(this.mode);this.liveResult=null;this.emitted=false;this.processing=false;this.pendingSpeakEnd=null;this.serverTurnComplete=false;this.player.reset();
    try{await this._prepare(this.mode);this.mic=new MicPcm16(b64=>{if(this.mode==='voice')this.conversation?.audio(b64);else this.transcribe?.audio(b64)},t=>this.profile?.voice(t),e=>this._turnError(e));await this.mic.start();this.active=true;this.onState('listening');return true}catch(e){this._turnError(e);return false}
  }
  commitNow(){if(!this.active)return '';this.profile?.mark('micStop');this.mic?.stop();this.mic=null;this.active=false;this.processing=true;if(this.mode==='voice')this.conversation?.audioEnd();else this.transcribe?.audioEnd();this.onState('processing');return this.getText()}
  stop(manual=true,emitState=true){if(this.active){this.mic?.stop();this.mic=null;this.active=false}this.processing=false;this.pendingSpeakEnd=null;this.serverTurnComplete=false;if(emitState)this.onState('idle')}
  finishProcessing(){this.processing=false;this._flushPendingSpeakEnd();if(!this.active&&this.player.pending===0&&!this.pendingSpeakEnd)this.onState('ready')}
  _stopMicSilently(){if(!this.active)return;this.profile?.mark('micStop');this.mic?.stop();this.mic=null;this.active=false}
  _onTranscribe(msg){const c=msg.serverContent;if(c?.interimInputTranscription?.text){this.interim=clean(c.interimInputTranscription.text);this.onInterim(this.interim,this.transcript)}if(c?.inputTranscription?.text){const text=clean(c.inputTranscription.text);if(!text)return;this.transcript=text;this.interim='';this.profile&&(this.profile.transcript=text,this.profile.mark('transcriptFinal'));this.onText(text,text);this._stopMicSilently();if(this.mode==='chat'){this.profile?.mark('brainStart');this.serverTurnComplete=false;this.conversation?.text(text);this.onState('thinking')}else if(this.mode==='auto'){this.profile?.mark('brainStart');this.processing=true;this.onState('thinking');queueMicrotask(()=>this.onUtterance(text,'transcribe-live'))}}}
  _onConversation(msg,kind){const p=this.profile,c=msg.serverContent;if(this.mode==='voice'&&c?.inputTranscription?.text){const text=clean(c.inputTranscription.text);if(text){this.transcript=text;p&&(p.transcript=text,p.mark('transcriptFinal'),p.mark('brainStart'));this.onText(text,text);this._maybeEmitLive()}}
    if(msg.toolCall?.functionCalls?.length&&kind==='agent'){p?.mark('brainDone');let items=[],question='';const responses=[];for(const fc of msg.toolCall.functionCalls){if(fc.name==='update_meal_memo'){items=normalizeMealItems(fc.args?.items,[]);question=clean(fc.args?.question);if(!question&&items.some(x=>x.needsAmount))question='量が必要な食品は何グラムでしたか？';responses.push({name:fc.name,id:fc.id,response:{result:{accepted:true,ready:items.length>0&&!items.some(x=>x.unresolved||x.needsAmount),question}}})}else responses.push({name:fc.name,id:fc.id,response:{result:{accepted:false}}})}this.liveResult={mode:this.mode,items,question};if(question&&this.mode==='voice')this.pendingSpeakEnd=()=>this.start({clear:true});p?.mark('memoReady');p?.mark('mouthStart');this.conversation?.tool(responses);this._maybeEmitLive()}
    if(c?.modelTurn?.parts){for(const part of c.modelTurn.parts){if(part.inlineData?.data){this._stopMicSilently();this.onState('speaking');this.player.play(part.inlineData.data)}}}
    if(c?.turnComplete){this.serverTurnComplete=true;p?.mark('turnDone');this._finishBench(true);this._flushPendingSpeakEnd()}
  }
  _maybeEmitLive(){if(this.emitted||!this.liveResult)return;const text=clean(this.transcript);if(!text&&this.mode==='voice')return;this.emitted=true;this.processing=true;queueMicrotask(()=>this.onUtterance(text||'Live音声入力','conversation-live'))}
  _firstAudio(t){this.profile?.mark('firstAudio',t);this.onState('speaking')}
  _audioDrained(){this._flushPendingSpeakEnd()}
  _flushPendingSpeakEnd(){if(!this.serverTurnComplete||this.player.pending>0)return;if(this.processing){setTimeout(()=>this._flushPendingSpeakEnd(),40);return}const cb=this.pendingSpeakEnd;this.pendingSpeakEnd=null;this.serverTurnComplete=false;if(cb)setTimeout(cb,0);else if(!this.active)this.onState('ready')}
  _finishBench(ok,error=null){const s=this.profile?.finish(ok,error);if(s)this.profile=null}
  _turnError(e){console.warn('[Voice Lab]',e);this._stopMicSilently();this._finishBench(false,e?.message||e);this.processing=false;this.pendingSpeakEnd=null;this.serverTurnComplete=false;this.onState('idle');this.onError(e?.name==='NotAllowedError'?'permission-denied':e?.message||String(e))}
  _socketError(e){console.warn('[Voice Lab socket]',e);if(this.profile)this._turnError(e);else this.onError(e?.message||String(e))}
  _closeSockets(){this.transcribe?.close();this.conversation?.close();this.transcribe=null;this.conversation=null;this.convKind=''}
  async _speakC(text,onEnd){try{if(this.mode!=='auto'){onEnd?.();return}await this._prepare('auto');this.serverTurnComplete=false;this.profile?.mark('mouthStart');this.pendingSpeakEnd=onEnd||this.pendingSpeakEnd;this.onState('speaking');this.conversation?.text(text)}catch(e){this._turnError(e);onEnd?.()}}
  speak(text,onEnd){if(!text){onEnd?.();return}if(this.mode==='chat'){this.pendingSpeakEnd=onEnd||this.pendingSpeakEnd;this._flushPendingSpeakEnd();return}if(this.mode==='auto'){this._speakC(text,onEnd);return}onEnd?.()}
  close(){this.stop();this._closeSockets();this.player.close();if(activeInstance===this)activeInstance=null}
}

export function speak(text,onEnd){if(activeInstance){activeInstance.speak(String(text||''),onEnd);return}onEnd?.()}

export const VOICE_INFO=Object.freeze({input:'Gemini Live A/B/C voice lab',transcribeModel:TRANSCRIBE_MODEL,conversationModel:CONVERSATION_MODEL,browserSpeechRecognition:false,geminiTranscribeLive:true,benchKey:BENCH_KEY});
