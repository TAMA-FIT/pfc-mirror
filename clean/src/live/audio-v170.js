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

export const LIVE_AUDIO_PREROLL_SEC=0.12;
export const LIVE_AUDIO_REBUFFER_THRESHOLD_SEC=0.035;

export function nextPlaybackStart(now,playAt,lead=LIVE_AUDIO_PREROLL_SEC,threshold=LIVE_AUDIO_REBUFFER_THRESHOLD_SEC){
  const current=Number.isFinite(Number(now))?Number(now):0;
  const queued=Number.isFinite(Number(playAt))?Number(playAt):0;
  return queued>current+threshold?queued:current+lead;
}

export class LiveAudioIO{
  constructor(){
    this.ctx=null;this.stream=null;this.source=null;this.processor=null;this.silentGain=null;
    this.onPcm=null;this.outputNodes=new Set();this.playAt=0;
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
      if(!this.onPcm)return;
      const input=e.inputBuffer.getChannelData(0);
      const samples=downsample(input,this.ctx.sampleRate,16000);
      this.onPcm(floatToPcm16(samples));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.ctx.destination);
  }

  play(base64,mimeType='audio/pcm;rate=24000'){
    if(!this.ctx||!base64)return;
    const pcm=base64ToInt16(base64);
    if(!pcm.length)return;
    const floats=new Float32Array(pcm.length);
    for(let i=0;i<pcm.length;i++)floats[i]=pcm[i]/32768;
    const rate=mimeRate(mimeType);
    const buffer=this.ctx.createBuffer(1,floats.length,rate);
    buffer.copyToChannel(floats,0);
    const node=this.ctx.createBufferSource();
    node.buffer=buffer;
    node.connect(this.ctx.destination);
    const now=this.ctx.currentTime;
    const start=nextPlaybackStart(now,this.playAt);
    node.start(start);
    this.playAt=start+buffer.duration;
    this.outputNodes.add(node);
    node.onended=()=>this.outputNodes.delete(node);
  }

  interruptOutput(){
    for(const node of this.outputNodes){try{node.stop()}catch{}}
    this.outputNodes.clear();
    this.playAt=this.ctx?.currentTime||0;
  }

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
    this.interruptOutput();
    this.stopCapture();
    const ctx=this.ctx;
    this.ctx=null;
    try{await ctx?.close()}catch{}
  }
}
