class PfcLivePcmPlayer extends AudioWorkletProcessor {
  constructor(options={}){
    super();
    const opts=options.processorOptions||{};
    const target=Number(opts.targetBufferSec);
    this.targetBufferSec=Number.isFinite(target)&&target>0?target:0.30;
    this.queue=[];
    this.headOffset=0;
    this.queuedSamples=0;
    this.sourceRate=24000;
    this.phase=0;
    this.playing=false;
    this.flushRequested=false;
    this.fadeFrames=Math.max(1,Math.round(sampleRate*0.004));
    this.fadePos=this.fadeFrames;
    this.port.onmessage=e=>this._onMessage(e.data||{});
  }

  _onMessage(message){
    const type=String(message.type||'');
    if(type==='push'){
      this._push(message.samples,message.rate);
      return;
    }
    if(type==='flush'){
      this.flushRequested=true;
      return;
    }
    if(type==='reset')this._reset();
  }

  _reset(){
    this.queue=[];
    this.headOffset=0;
    this.queuedSamples=0;
    this.phase=0;
    this.playing=false;
    this.flushRequested=false;
    this.fadePos=this.fadeFrames;
  }

  _push(samples,rate){
    const chunk=samples instanceof Float32Array?samples:new Float32Array(samples||[]);
    if(!chunk.length)return;
    const nextRate=Math.max(8000,Number(rate)||24000);
    if(this.queuedSamples===0&&!this.playing){
      this.sourceRate=nextRate;
    }else if(nextRate!==this.sourceRate){
      this._reset();
      this.sourceRate=nextRate;
      this.port.postMessage({type:'rate-reset',sourceRate:nextRate});
    }
    this.queue.push(chunk);
    this.queuedSamples+=chunk.length;
  }

  _currentSample(){
    const head=this.queue[0];
    return head?head[this.headOffset]||0:0;
  }

  _nextSample(){
    const head=this.queue[0];
    if(!head)return 0;
    if(this.headOffset+1<head.length)return head[this.headOffset+1]||0;
    return this.queue.length>1?(this.queue[1][0]||0):(head[this.headOffset]||0);
  }

  _consumeOne(){
    if(!this.queue.length||this.queuedSamples<=0)return;
    this.headOffset++;
    this.queuedSamples--;
    if(this.headOffset>=this.queue[0].length){
      this.queue.shift();
      this.headOffset=0;
    }
  }

  _startIfReady(){
    if(this.playing)return true;
    const threshold=Math.max(2,Math.round(this.sourceRate*this.targetBufferSec));
    if(this.queuedSamples<threshold&&!(this.flushRequested&&this.queuedSamples>0))return false;
    this.playing=true;
    this.fadePos=0;
    this.port.postMessage({type:'started',bufferedSamples:this.queuedSamples,sourceRate:this.sourceRate});
    return true;
  }

  _finishPlayback(normalDrain){
    this.playing=false;
    this.phase=0;
    this.fadePos=0;
    if(normalDrain){
      this.flushRequested=false;
      this.port.postMessage({type:'drain'});
    }else{
      this.port.postMessage({type:'underflow'});
    }
  }

  process(_inputs,outputs){
    const output=outputs?.[0]?.[0];
    if(!output)return true;
    output.fill(0);
    if(!this._startIfReady())return true;

    const step=this.sourceRate/sampleRate;
    for(let i=0;i<output.length;i++){
      if(this.queuedSamples<=0){
        this._finishPlayback(this.flushRequested);
        break;
      }

      const a=this._currentSample();
      const b=this._nextSample();
      let value=a+(b-a)*this.phase;
      if(this.fadePos<this.fadeFrames){
        value*=this.fadePos/this.fadeFrames;
        this.fadePos++;
      }
      output[i]=value;

      this.phase+=step;
      while(this.phase>=1&&this.queuedSamples>0){
        this._consumeOne();
        this.phase-=1;
      }
    }

    if(this.playing&&this.queuedSamples===0)this._finishPlayback(this.flushRequested);
    return true;
  }
}

registerProcessor('pfc-live-pcm-player',PfcLivePcmPlayer);
