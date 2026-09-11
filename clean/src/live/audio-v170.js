function downsample(input,inputRate,outputRate=16000){
  if(inputRate===outputRate)return new Float32Array(input);
  if(inputRate<outputRate)return new Float32Array(input);
  const ratio=inputRate/outputRate;
  const length=Math.max(1,Math.round(input.length/ratio));
  const out=new Float32Array(length);
  let outIndex=0,inputIndex=0;
  while(outIndex<length){
    const nextInput=Math.min(input.length,Math.round((outIndex+1)*ratio));
    let sum=0,count=0;
    for(let i=inputIndex;i<nextInput;i++){sum+=input[i];count++}
    out[outIndex]=count?sum/count:0;
    outIndex++;
    inputIndex=nextInput;
  }
  return out;
}

function floatToPcm16(float32){
  const buffer=new ArrayBuffer(float32.length*2);
  const view=new DataView(buffer);
  for(let i=0;i<float32.length;i++){
    const s=Math.max(-1,Math.min(1,float32[i]));
    view.setInt16(i*2,s<0?s*0x8000:s*0x7fff,true);
  }
  return new Uint8Array(buffer);
}

function base64ToInt16(base64){
  const bin=atob(base64);
  const evenLength=bin.length-(bin.length%2);
  const buffer=new ArrayBuffer(evenLength);
  const u8=new Uint8Array(buffer);
  for(let i=0;i<evenLength;i++)u8[i]=bin.charCodeAt(i);
  return new Int16Array(buffer);
}

function mimeRate(mime){
  const m=String(mime||'').match(/rate=(\d+)/i);
  return m?Number(m[1]):24000;
}

function int16ToFloat32(pcm){
  const floats=new Float32Array(pcm.length);
  for(let i=0;i<pcm.length;i++)floats[i]=pcm[i]/32768;
  return floats;
}

function concatInt16(chunks){
  const length=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
  const out=new Int16Array(length);
  let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length}
  return out;
}

export const LIVE_AUDIO_TARGET_BUFFER_SEC=0.30;
export const LIVE_AUDIO_REBUFFER_THRESHOLD_SEC=0.06;
export const LIVE_AUDIO_START_DELAY_SEC=0.02;

export function shouldStartBufferedPlayback(pendingDuration,target=LIVE_AUDIO_TARGET_BUFFER_SEC){
  return Number(pendingDuration)>=Number(target);
}

export function shouldRebuffer(now,playAt,threshold=LIVE_AUDIO_REBUFFER_THRESHOLD_SEC){
  const current=Number.isFinite(Number(now))?Number(now):0;
  const queued=Number.isFinite(Number(playAt))?Number(playAt):0;
  return queued<=current+Number(threshold);
}

export class LiveAudioIO{
  constructor(){
    this.ctx=null;this.stream=null;this.source=null;this.processor=null;this.silentGain=null;
    this.onPcm=null;this.outputNodes=new Set();this.playAt=0;
    this.pending=[];this.pendingDuration=0;this.playbackActive=false;
    this.rawCurrent=[];this.lastRawTurn=null;this.diagnosticReplayActive=false;
  }

  async prepare(){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)throw new Error('このブラウザはWeb Audioに対応していません');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('このブラウザではマイクを利用できません');
    if(!this.ctx)this.ctx=new Ctx({latencyHint:'interactive'});
    if(this.ctx.state==='suspended')await this.ctx.resume();
    if(!this.stream){
      this.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    }
  }

  async startCapture(onPcm){
    await this.prepare();
    this.onPcm=onPcm;
    if(this.processor)return;
    this.source=this.ctx.createMediaStreamSource(this.stream);
    this.processor=this.ctx.createScriptProcessor(4096,1,1);
    this.silentGain=this.ctx.createGain();
    this.silentGain.gain.value=0;
    this.processor.onaudioprocess=e=>{
      if(!this.onPcm||this.diagnosticReplayActive)return;
      const input=e.inputBuffer.getChannelData(0);
      const samples=downsample(input,this.ctx.sampleRate,16000);
      this.onPcm(floatToPcm16(samples));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.ctx.destination);
  }

  _createBuffer(pcm,rate){
    const floats=int16ToFloat32(pcm);
    const buffer=this.ctx.createBuffer(1,floats.length,rate);
    buffer.copyToChannel(floats,0);
    return buffer;
  }

  _scheduleChunk(chunk,start){
    const node=this.ctx.createBufferSource();
    node.buffer=this._createBuffer(chunk.pcm,chunk.rate);
    node.connect(this.ctx.destination);
    node.start(start);
    this.playAt=start+chunk.duration;
    this.outputNodes.add(node);
    node.onended=()=>this.outputNodes.delete(node);
  }

  _startBufferedPlayback(force=false){
    if(!this.ctx||!this.pending.length)return false;
    if(!force&&!shouldStartBufferedPlayback(this.pendingDuration))return false;
    const now=this.ctx.currentTime;
    let start=Math.max(now+LIVE_AUDIO_START_DELAY_SEC,this.playAt>now?this.playAt:0);
    const queued=this.pending;
    this.pending=[];
    this.pendingDuration=0;
    for(const chunk of queued){
      this._scheduleChunk(chunk,start);
      start=this.playAt;
    }
    this.playbackActive=true;
    return true;
  }

  _queuePcmChunk(pcm,rate,{captureRaw=true}={}){
    if(!this.ctx||!pcm?.length)return;
    const chunk={pcm:new Int16Array(pcm),rate,duration:pcm.length/rate};
    if(captureRaw)this.rawCurrent.push({pcm:new Int16Array(pcm),rate});

    const now=this.ctx.currentTime;
    if(this.playbackActive&&!shouldRebuffer(now,this.playAt)){
      this._scheduleChunk(chunk,this.playAt);
      return;
    }

    this.playbackActive=false;
    this.pending.push(chunk);
    this.pendingDuration+=chunk.duration;
    this._startBufferedPlayback(false);
  }

  play(base64,mimeType='audio/pcm;rate=24000'){
    if(!this.ctx||!base64)return;
    const pcm=base64ToInt16(base64);
    if(!pcm.length)return;
    this._queuePcmChunk(pcm,mimeRate(mimeType),{captureRaw:true});
  }

  completeModelTurn(){
    this._startBufferedPlayback(true);
    if(!this.rawCurrent.length)return this.getLastTurnRawInfo();
    const segments=this.rawCurrent;
    this.rawCurrent=[];
    const rates=[...new Set(segments.map(x=>x.rate))];
    const durationSec=segments.reduce((sum,x)=>sum+x.pcm.length/x.rate,0);
    this.lastRawTurn={
      segments:segments.map(x=>({pcm:new Int16Array(x.pcm),rate:x.rate})),
      rate:rates.length===1?rates[0]:null,
      chunkCount:segments.length,
      durationSec
    };
    return this.getLastTurnRawInfo();
  }

  getLastTurnRawInfo(){
    const turn=this.lastRawTurn;
    if(!turn)return null;
    return {rate:turn.rate,chunkCount:turn.chunkCount,durationSec:turn.durationSec};
  }

  hasLastTurnRaw(){return !!this.lastRawTurn?.segments?.length}

  async replayLastTurnRaw(){
    if(!this.ctx||!this.hasLastTurnRaw())throw new Error('再生できる直前AI音声がありません');
    this._stopOutput({clearPending:true,discardCapture:false});
    this.diagnosticReplayActive=true;
    try{
      const turn=this.lastRawTurn;
      if(turn.rate){
        const pcm=concatInt16(turn.segments.map(x=>x.pcm));
        const buffer=this._createBuffer(pcm,turn.rate);
        await new Promise((resolve,reject)=>{
          try{
            const node=this.ctx.createBufferSource();
            node.buffer=buffer;
            node.connect(this.ctx.destination);
            this.outputNodes.add(node);
            node.onended=()=>{this.outputNodes.delete(node);resolve()};
            node.start(this.ctx.currentTime+LIVE_AUDIO_START_DELAY_SEC);
          }catch(e){reject(e)}
        });
      }else{
        let start=this.ctx.currentTime+LIVE_AUDIO_START_DELAY_SEC;
        await new Promise((resolve,reject)=>{
          try{
            let remaining=turn.segments.length;
            for(const segment of turn.segments){
              const node=this.ctx.createBufferSource();
              const buffer=this._createBuffer(segment.pcm,segment.rate);
              node.buffer=buffer;
              node.connect(this.ctx.destination);
              this.outputNodes.add(node);
              node.onended=()=>{this.outputNodes.delete(node);remaining--;if(remaining===0)resolve()};
              node.start(start);
              start+=buffer.duration;
            }
          }catch(e){reject(e)}
        });
      }
      return this.getLastTurnRawInfo();
    }finally{
      this.diagnosticReplayActive=false;
    }
  }

  async replayLastTurnChunked(){
    if(!this.ctx||!this.hasLastTurnRaw())throw new Error('再生できる直前AI音声がありません');
    this._stopOutput({clearPending:true,discardCapture:false});
    this.diagnosticReplayActive=true;
    try{
      const segments=this.lastRawTurn.segments.map(x=>({pcm:new Int16Array(x.pcm),rate:x.rate}));
      for(const segment of segments)this._queuePcmChunk(segment.pcm,segment.rate,{captureRaw:false});
      this._startBufferedPlayback(true);
      const endAt=this.playAt;
      const waitMs=Math.max(0,(endAt-this.ctx.currentTime)*1000)+80;
      await new Promise(resolve=>setTimeout(resolve,waitMs));
      return this.getLastTurnRawInfo();
    }finally{
      this.diagnosticReplayActive=false;
    }
  }

  _stopOutput({clearPending=true,discardCapture=true}={}){
    for(const node of this.outputNodes){try{node.stop()}catch{}}
    this.outputNodes.clear();
    if(clearPending){this.pending=[];this.pendingDuration=0}
    if(discardCapture)this.rawCurrent=[];
    this.playAt=this.ctx?.currentTime||0;
    this.playbackActive=false;
  }

  interruptOutput(){this._stopOutput({clearPending:true,discardCapture:true})}

  stopCapture(){
    this.onPcm=null;
    try{this.source?.disconnect()}catch{}
    try{this.processor?.disconnect()}catch{}
    try{this.silentGain?.disconnect()}catch{}
    if(this.processor)this.processor.onaudioprocess=null;
    this.source=null;this.processor=null;this.silentGain=null;
    for(const track of this.stream?.getTracks?.()||[]){try{track.stop()}catch{}}
    this.stream=null;
  }

  async close(){
    this._stopOutput({clearPending:true,discardCapture:true});
    this.stopCapture();
    this.lastRawTurn=null;
    const ctx=this.ctx;
    this.ctx=null;
    try{await ctx?.close()}catch{}
  }
}
