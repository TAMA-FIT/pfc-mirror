import { issueLiveToken, decodeWebSocketMessage } from './transport-v170.js?v=1.7.8';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe-live';
export const TRANSCRIBE_LANGUAGE = 'ja-JP';
export const TRANSCRIBE_MODE = 'SMART';
export const TRANSCRIBE_CUSTOM_VOCABULARY = [
  'たまフィット',
  'PFC',
  '鶏むね',
  '鶏胸肉',
  '鶏もも',
  '鶏もも肉',
  'ささみ',
  '納豆',
  '白米',
  '玄米',
  '味噌汁',
  'サバ缶',
  'オートミール',
  'プロテイン',
  'ホエイ',
  'カゼイン',
  'MCTオイル',
  'サラダチキン',
  'オイコス',
  'ゆで卵'
];

function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s='';
  const CHUNK=0x8000;
  for (let i=0;i<u8.length;i+=CHUNK) s += String.fromCharCode(...u8.subarray(i,i+CHUNK));
  return btoa(s);
}

export function buildTranscribeSetupMessage() {
  return {
    setup: {
      model: `models/${TRANSCRIBE_MODEL}`,
      generationConfig: {
        responseModalities: ['TEXT']
      },
      inputAudioTranscription: {
        languageCodes: [TRANSCRIBE_LANGUAGE],
        customVocabulary: [...TRANSCRIBE_CUSTOM_VOCABULARY],
        mode: TRANSCRIBE_MODE
      }
    }
  };
}

export class GeminiLiveTranscriber {
  constructor({
    onState=()=>{},
    onFinal=()=>{},
    onInterim=()=>{},
    onError=()=>{},
    onDiagnostic=()=>{}
  }={}) {
    Object.assign(this,{onState,onFinal,onInterim,onError,onDiagnostic});
    this.ws=null;
    this.ready=false;
  }

  sendObject(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('Transcribe socket is not open');
    this.ws.send(JSON.stringify(obj));
  }

  async connect() {
    this.onState('token');
    let tokenResult;
    try {
      tokenResult=await issueLiveToken();
      this.onDiagnostic({stage:'transcribe-token',ok:true,...tokenResult.diagnostic});
    } catch (error) {
      if (error?.liveDiagnostic) this.onDiagnostic({stage:'transcribe-token',ok:false,...error.liveDiagnostic});
      throw error;
    }

    this.onState('connecting');
    const token=tokenResult.token;

    await new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>{
        if (settled) return;
        settled=true;
        reject(new Error('文字起こし接続がタイムアウトしました'));
        try{this.ws?.close()}catch{}
      },15000);

      const ws=new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(token)}`);
      this.ws=ws;

      ws.onopen=()=>{
        try{
          this.onDiagnostic({stage:'transcribe-websocket',ok:true,message:'WebSocket open'});
          this.onState('setup');
          this.sendObject(buildTranscribeSetupMessage());
        }catch(e){
          clearTimeout(timer);
          if(!settled){settled=true;reject(e)}
        }
      };

      ws.onmessage=async event=>{
        try{
          const msg=await decodeWebSocketMessage(event.data);
          if(msg.setupComplete){
            this.ready=true;
            this.onDiagnostic({stage:'transcribe-setup',ok:true,message:`${TRANSCRIBE_MODEL} ready`});
            this.onState('ready');
            if(!settled){settled=true;clearTimeout(timer);resolve()}
            return;
          }
          const content=msg.serverContent;
          if(content?.interimInputTranscription?.text) this.onInterim(content.interimInputTranscription.text);
          if(content?.inputTranscription?.text) this.onFinal(content.inputTranscription.text);
        }catch(e){
          this.onError(e);
        }
      };

      ws.onerror=()=>{
        const e=new Error('Gemini 3.5 Transcribe Live WebSocket error');
        this.onDiagnostic({stage:'transcribe-websocket',ok:false,message:e.message});
        this.onError(e);
        if(!settled){settled=true;clearTimeout(timer);reject(e)}
      };

      ws.onclose=e=>{
        this.ready=false;
        this.onDiagnostic({stage:'transcribe-close',ok:e.code===1000,message:`code=${e.code}${e.reason?` reason=${e.reason}`:''}`});
        this.onState('closed',{code:e.code,reason:e.reason});
        if(!settled){
          settled=true;
          clearTimeout(timer);
          reject(new Error(`Transcribe Live closed before ready (${e.code})${e.reason?`: ${e.reason}`:''}`));
        }
      };
    });
  }

  sendAudio(bytes) {
    if(!this.ready || !bytes?.byteLength) return;
    this.sendObject({realtimeInput:{audio:{data:bytesToBase64(bytes),mimeType:'audio/pcm;rate=16000'}}});
  }

  endAudioStream() {
    if(!this.ready) return;
    this.sendObject({realtimeInput:{audioStreamEnd:true}});
  }

  close() {
    try{if(this.ready)this.endAudioStream()}catch{}
    this.ready=false;
    const ws=this.ws;
    this.ws=null;
    try{ws?.close(1000,'client-stop')}catch{}
  }
}
