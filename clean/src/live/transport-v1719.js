import { GAS_URL, buildSetupMessage, buildOpeningMessage } from './config-v1719.js?v=1.7.19';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s='';
  const CHUNK=0x8000;
  for (let i=0;i<u8.length;i+=CHUNK) s += String.fromCharCode(...u8.subarray(i,i+CHUNK));
  return btoa(s);
}

export async function decodeWebSocketMessage(data) {
  let text;
  if (typeof data === 'string') text=data;
  else if (typeof Blob !== 'undefined' && data instanceof Blob) text=await data.text();
  else if (data instanceof ArrayBuffer) text=new TextDecoder().decode(data);
  else if (ArrayBuffer.isView(data)) text=new TextDecoder().decode(data);
  else throw new TypeError(`Unsupported WebSocket message type: ${Object.prototype.toString.call(data)}`);
  return JSON.parse(text);
}

function safeDiagnostic(body={}) {
  return {
    gasBuild:String(body?.gasBuild||'').trim(),
    phase:String(body?.phase||'').trim(),
    message:String(body?.message||'').trim(),
    httpStatus:Number.isFinite(Number(body?.httpStatus))?Number(body.httpStatus):null,
    googleStatus:String(body?.googleStatus||'').trim()
  };
}

function diagnosticMessage(diagnostic) {
  if (!diagnostic) return '';
  const parts=[];
  if (diagnostic.gasBuild) parts.push(diagnostic.gasBuild);
  if (diagnostic.phase) parts.push(diagnostic.phase);
  if (diagnostic.httpStatus) parts.push(`HTTP ${diagnostic.httpStatus}`);
  if (diagnostic.googleStatus) parts.push(diagnostic.googleStatus);
  if (diagnostic.message && diagnostic.message!==diagnostic.gasBuild) parts.push(diagnostic.message);
  return parts.join(' | ');
}

export async function issueLiveToken() {
  const response = await fetch(GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({taskType:'liveToken'}),
    redirect:'follow'
  });
  if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
  const raw=await response.text();
  let body;
  try { body=JSON.parse(raw); }
  catch { throw new Error(`GAS応答をJSON解析できません (HTTP ${response.status})`); }
  const diagnostic=safeDiagnostic(body);
  const token=String(body?.token || '').trim();
  if (!token) {
    const msg=body?.candidates?.[0]?.content?.parts?.[0]?.text || body?.message || diagnosticMessage(diagnostic) || 'Live tokenが返りませんでした';
    const error=new Error(String(msg));
    error.liveDiagnostic=diagnostic;
    throw error;
  }
  return {token,diagnostic};
}

export class GeminiLiveTransport {
  constructor({
    onState=()=>{},onAudio=()=>{},onInputTranscript=()=>{},onOutputTranscript=()=>{},
    onToolCall=()=>{},onToolCancellation=()=>{},onInterrupted=()=>{},onError=()=>{},onDiagnostic=()=>{},onTrace=()=>{}
  }={}) {
    Object.assign(this,{onState,onAudio,onInputTranscript,onOutputTranscript,onToolCall,onToolCancellation,onInterrupted,onError,onDiagnostic,onTrace});
    this.ws=null;
    this.ready=false;
  }

  sendObject(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('Live socket is not open');
    this.ws.send(JSON.stringify(obj));
  }

  async connect() {
    this.onState('token');
    let tokenResult;
    try {
      tokenResult=await issueLiveToken();
      this.onDiagnostic({stage:'token',ok:true,...tokenResult.diagnostic});
    } catch (error) {
      if (error?.liveDiagnostic) this.onDiagnostic({stage:'token',ok:false,...error.liveDiagnostic});
      throw error;
    }
    const token=tokenResult.token;
    this.onState('connecting');
    await new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>{
        if (settled) return;
        settled=true;
        reject(new Error('Gemini Live接続がタイムアウトしました'));
        try{this.ws?.close()}catch{}
      },15000);
      const ws=new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(token)}`);
      this.ws=ws;
      ws.onopen=()=>{
        try {
          this.onDiagnostic({stage:'websocket',ok:true,message:'WebSocket open'});
          this.onTrace({type:'websocket-open'});
          this.onState('setup');
          this.sendObject(buildSetupMessage());
        } catch (e) {
          clearTimeout(timer);
          if (!settled) { settled=true; reject(e); }
        }
      };
      ws.onmessage=async event=>{
        try{
          const msg=await decodeWebSocketMessage(event.data);
          if (msg.setupComplete) {
            this.ready=true;
            this.onDiagnostic({stage:'setup',ok:true,message:'setupComplete'});
            this.onTrace({type:'setup-complete'});
            this.onState('ready');
            if (!settled) {
              settled=true;
              clearTimeout(timer);
              resolve();
            }
            return;
          }
          await this.handleMessage(msg);
        }catch(e){ this.onError(e); }
      };
      ws.onerror=()=>{
        const e=new Error('Gemini Live WebSocket error');
        this.onDiagnostic({stage:'websocket',ok:false,message:e.message});
        this.onTrace({type:'websocket-error'});
        this.onError(e);
        if (!settled) {
          settled=true;
          clearTimeout(timer);
          reject(e);
        }
      };
      ws.onclose=e=>{
        this.ready=false;
        this.onDiagnostic({stage:'websocket-close',ok:e.code===1000,message:`code=${e.code}${e.reason?` reason=${e.reason}`:''}`});
        this.onTrace({type:'websocket-close',detail:`code=${e.code}`});
        this.onState('closed',{code:e.code,reason:e.reason});
        if (!settled) {
          settled=true;
          clearTimeout(timer);
          reject(new Error(`Gemini Live closed before ready (${e.code})${e.reason?`: ${e.reason}`:''}`));
        }
      };
    });
  }

  async handleMessage(msg) {
    if (msg.toolCall?.functionCalls) {
      this.onTrace({type:'tool-call',detail:`count=${msg.toolCall.functionCalls.length}`});
      await this.onToolCall(msg.toolCall.functionCalls);
    }
    if (msg.toolCallCancellation?.ids) {
      this.onTrace({type:'tool-cancel',detail:`count=${msg.toolCallCancellation.ids.length}`});
      this.onToolCancellation(msg.toolCallCancellation.ids);
    }
    if (msg.serverContent) {
      const s=msg.serverContent;
      if (s.inputTranscription?.text) this.onInputTranscript(s.inputTranscription.text);
      if (s.outputTranscription?.text) this.onOutputTranscript(s.outputTranscription.text);
      let audioChunks=0;
      for (const part of s.modelTurn?.parts || []) {
        if (part?.inlineData?.data) {
          audioChunks++;
          this.onAudio(part.inlineData.data,part.inlineData.mimeType || 'audio/pcm;rate=24000');
        }
      }
      if (audioChunks) this.onTrace({type:'audio',detail:`chunks=${audioChunks}`});
      if (s.interrupted) {
        this.onTrace({type:'interrupted'});
        this.onInterrupted();
      }
      if (s.turnComplete) {
        this.onTrace({type:'turn-complete'});
        this.onState('turn-complete');
      }
    }
    if (msg.goAway) {
      this.onTrace({type:'go-away'});
      this.onState('go-away',msg.goAway);
    }
  }

  sendOpening() { this.sendObject(buildOpeningMessage()); }
  sendAudio(bytes) {
    if (!this.ready || !bytes?.byteLength) return;
    this.sendObject({realtimeInput:{audio:{data:bytesToBase64(bytes),mimeType:'audio/pcm;rate=16000'}}});
  }
  sendText(text) {
    if (!this.ready) return;
    this.sendObject({realtimeInput:{text:String(text||'')}});
  }
  sendToolResponses(functionResponses) { this.sendObject({toolResponse:{functionResponses}}); }
  endAudioStream() {
    if (!this.ready) return;
    this.sendObject({realtimeInput:{audioStreamEnd:true}});
  }
  close() {
    try { if (this.ready) this.endAudioStream(); } catch {}
    this.ready=false;
    const ws=this.ws;
    this.ws=null;
    try { ws?.close(1000,'client-stop'); } catch {}
  }
}
