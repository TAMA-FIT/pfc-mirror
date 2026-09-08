const TARGET_RATE = 16000;
const DEFAULT_SILENCE_MS = 3200;
const DEFAULT_NO_SPEECH_MS = 12000;
const DEFAULT_MAX_MS = 35000;

const now = () => performance.now();

function downsample(float32, inputRate) {
  const ratio = inputRate / TARGET_RATE;
  const len = Math.max(1, Math.floor(float32.length / ratio));
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const a = Math.floor(i * ratio);
    const z = Math.min(float32.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < z; j++) sum += float32[j];
    const v = sum / Math.max(1, z - a);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return out;
}

function bytesToBase64(bytes) {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s);
}

function rmsOf(float32) {
  let sum = 0;
  for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
  return Math.sqrt(sum / Math.max(1, float32.length));
}

export class MicCapture {
  constructor({
    silenceMs = DEFAULT_SILENCE_MS,
    noSpeechMs = DEFAULT_NO_SPEECH_MS,
    maxMs = DEFAULT_MAX_MS,
    onChunk,
    onVoice,
    onSilence,
    onStarted,
    onError
  } = {}) {
    this.silenceMs = silenceMs;
    this.noSpeechMs = noSpeechMs;
    this.maxMs = maxMs;
    this.onChunk = onChunk || (() => {});
    this.onVoice = onVoice || (() => {});
    this.onSilence = onSilence || (() => {});
    this.onStarted = onStarted || (() => {});
    this.onError = onError || (() => {});

    this.active = false;
    this.cancelled = false;
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.node = null;
    this.mute = null;
    this.noSpeechTimer = null;
    this.hardTimer = null;
    this.speechDetected = false;
    this.lastSpeechAt = 0;
    this.noiseFloor = 0.006;
    this.calibrationSamples = 0;
    this.calibrationTotal = 0;
    this.silenceFired = false;
  }

  async start() {
    this.cancelled = false;
    this.speechDetected = false;
    this.lastSpeechAt = 0;
    this.silenceFired = false;
    this.calibrationSamples = 0;
    this.calibrationTotal = 0;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      if (this.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) throw new Error('audio-context-unsupported');
      const ctx = new AC();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) {}
      }
      if (this.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        try { await ctx.close(); } catch (_) {}
        return false;
      }

      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;

      source.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);

      this.stream = stream;
      this.ctx = ctx;
      this.source = source;
      this.node = node;
      this.mute = mute;
      this.active = true;

      node.onaudioprocess = event => {
        if (!this.active || this.cancelled) return;
        const f = event.inputBuffer.getChannelData(0);
        const t = now();
        const rms = rmsOf(f);

        if (!this.speechDetected && this.calibrationSamples < 5) {
          this.calibrationSamples += 1;
          this.calibrationTotal += rms;
          if (this.calibrationSamples === 5) {
            this.noiseFloor = Math.max(
              0.004,
              Math.min(0.02, this.calibrationTotal / this.calibrationSamples)
            );
          }
        }

        const threshold = Math.min(0.025, Math.max(0.010, this.noiseFloor * 2.4));
        if (rms >= threshold) {
          this.speechDetected = true;
          this.lastSpeechAt = t;
          this.silenceFired = false;
          this.onVoice(t);
        } else if (
          this.speechDetected &&
          !this.silenceFired &&
          t - this.lastSpeechAt >= this.silenceMs
        ) {
          this.silenceFired = true;
          queueMicrotask(() => {
            if (this.active && !this.cancelled) this.onSilence(t);
          });
        }

        const pcm = downsample(f, ctx.sampleRate);
        this.onChunk({
          b64: bytesToBase64(new Uint8Array(pcm.buffer)),
          durationMs: (pcm.length / TARGET_RATE) * 1000,
          bytes: pcm.byteLength
        });
      };

      this.noSpeechTimer = setTimeout(() => {
        if (!this.active || this.cancelled || this.speechDetected) return;
        this.onError(new Error('no-speech'));
      }, this.noSpeechMs);

      this.hardTimer = setTimeout(() => {
        if (!this.active || this.cancelled) return;
        this.onSilence(now(), 'max-duration');
      }, this.maxMs);

      this.onStarted(now());
      return true;
    } catch (error) {
      if (stream && !this.stream) {
        try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
      }
      this.stop();
      if (!this.cancelled) this.onError(error);
      throw error;
    }
  }

  stop() {
    this.cancelled = true;
    this.active = false;
    clearTimeout(this.noSpeechTimer);
    clearTimeout(this.hardTimer);
    this.noSpeechTimer = null;
    this.hardTimer = null;

    if (this.node) this.node.onaudioprocess = null;
    try { this.node?.disconnect(); } catch (_) {}
    try { this.source?.disconnect(); } catch (_) {}
    try { this.mute?.disconnect(); } catch (_) {}
    try { this.stream?.getTracks().forEach(track => track.stop()); } catch (_) {}
    try { this.ctx?.close(); } catch (_) {}

    this.node = null;
    this.source = null;
    this.mute = null;
    this.stream = null;
    this.ctx = null;
  }
}

export const MIC_CAPTURE_INFO = Object.freeze({
  sampleRate: TARGET_RATE,
  silenceMs: DEFAULT_SILENCE_MS,
  noSpeechMs: DEFAULT_NO_SPEECH_MS,
  maxMs: DEFAULT_MAX_MS
});
