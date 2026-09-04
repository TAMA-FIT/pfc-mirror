const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const TRANSCRIBE_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const MAX_RECORDING_MS = 35000;
const NO_SPEECH_TIMEOUT_MS = 12000;

function chooseMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  if (!globalThis.MediaRecorder?.isTypeSupported) return '';
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  let text = Array.isArray(parts)
    ? parts.map(part => String(part?.text || '')).join('').trim()
    : String(data?.text || data?.output_text || '').trim();
  text = text
    .replace(/^```(?:text|txt)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^['\"「]+|['\"」]+$/g, '')
    .trim();
  return text;
}

async function transcribeWithGemini(blob, mimeType) {
  if (!blob || blob.size < 300) throw new Error('no-audio');
  if (blob.size > MAX_AUDIO_BYTES) throw new Error('audio-too-large');

  const audioBase64 = await blobToBase64(blob);
  const prompt = `この音声を日本語で忠実に文字起こししてください。
食事記録アプリの入力なので、食品名・数量・数字・単位（g、個、杯、パック、本など）を特に正確に残してください。
例: 鶏むね、鶏もも、白米、納豆、味噌汁、オートミール、プロテイン、皮あり、皮なし。
言っていない食品や量を推測して追加しないでください。
聞き取れない部分だけ無理に補完せず、聞こえた内容を自然な日本語に整えてください。
説明、Markdown、前置きは不要です。文字起こし本文だけ返してください。`;

  let lastError = null;
  for (const model of TRANSCRIBE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const payload = {
        taskType: 'voice',
        modelPreference: model,
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || blob.type || 'audio/webm', data: audioBase64 } }
          ]
        }]
      };
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`gemini-http-${response.status}`);
      const data = await response.json();
      const text = extractText(data);
      if (!text) throw new Error('empty-transcript');
      return text;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('gemini-transcribe-failed');
}

function rmsFromAnalyser(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

export class VoiceInput {
  constructor({ onText, onInterim, onState, onError, onUtterance, silenceMs = 3200 } = {}) {
    this.onText = onText || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.onUtterance = onUtterance || (() => {});
    this.silenceMs = silenceMs;

    this.active = false;
    this.processing = false;
    this.manualStop = false;
    this.transcript = '';
    this.session = 0;

    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.mimeType = '';
    this.audioContext = null;
    this.analyser = null;
    this.analyserBuffer = null;
    this.meterTimer = null;
    this.hardTimer = null;
    this.noSpeechTimer = null;
    this.speechDetected = false;
    this.lastSpeechAt = 0;
    this.noiseFloor = 0.006;
  }

  supported() {
    return !!(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
  }

  getText() { return this.transcript.trim(); }
  resetBuffer() { this.transcript = ''; }

  _clearTimers() {
    clearInterval(this.meterTimer);
    clearTimeout(this.hardTimer);
    clearTimeout(this.noSpeechTimer);
    this.meterTimer = null;
    this.hardTimer = null;
    this.noSpeechTimer = null;
  }

  _closeAudioGraph() {
    try { this.analyser?.disconnect(); } catch (_) {}
    this.analyser = null;
    this.analyserBuffer = null;
    const ctx = this.audioContext;
    this.audioContext = null;
    if (ctx) {
      try { ctx.close(); } catch (_) {}
    }
  }

  _stopTracks() {
    const stream = this.stream;
    this.stream = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch (_) {}
      }
    }
  }

  _cleanupCapture() {
    this._clearTimers();
    this._closeAudioGraph();
    this._stopTracks();
  }

  async _startMeter(stream, session) {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.1;
      source.connect(analyser);
      this.audioContext = ctx;
      this.analyser = analyser;
      this.analyserBuffer = new Uint8Array(analyser.fftSize);

      let calibrationSamples = 0;
      let calibrationTotal = 0;
      this.meterTimer = setInterval(() => {
        if (session !== this.session || !this.active || this.processing || !this.analyser) return;
        const rms = rmsFromAnalyser(this.analyser, this.analyserBuffer);

        if (!this.speechDetected && calibrationSamples < 5) {
          calibrationSamples += 1;
          calibrationTotal += rms;
          if (calibrationSamples === 5) {
            this.noiseFloor = Math.max(0.004, Math.min(0.02, calibrationTotal / calibrationSamples));
          }
        }

        const threshold = Math.max(0.014, this.noiseFloor * 2.7);
        const now = performance.now();
        if (rms >= threshold) {
          this.speechDetected = true;
          this.lastSpeechAt = now;
        } else if (this.speechDetected && now - this.lastSpeechAt >= this.silenceMs) {
          this.commitNow('silence');
        }
      }, 100);
    } catch (error) {
      console.warn('[Gemini Voice] level meter unavailable', error);
    }
  }

  async start({ clear = true } = {}) {
    if (!this.supported()) {
      this.onError('unsupported');
      return false;
    }

    this.stop(false, false);
    if (clear) this.resetBuffer();
    this.manualStop = false;
    this.processing = false;
    this.active = true;
    this.speechDetected = false;
    this.lastSpeechAt = 0;
    const session = ++this.session;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      if (session !== this.session || !this.active) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }

      this.stream = stream;
      this.mimeType = chooseMimeType();
      this.chunks = [];
      const options = this.mimeType ? { mimeType: this.mimeType, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 };
      const recorder = new MediaRecorder(stream, options);
      this.recorder = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) this.chunks.push(event.data);
      };
      recorder.onerror = event => {
        if (session !== this.session) return;
        this.onError(event.error?.name || 'recorder-error');
      };
      recorder.onstop = () => {
        if (session !== this.session) return;
        const type = this.mimeType || recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        this.chunks = [];
        this._cleanupCapture();
        if (!this.processing) return;
        this._transcribeAndEmit(blob, type, session);
      };

      recorder.start(250);
      this.onState('listening');
      this._startMeter(stream, session);

      this.hardTimer = setTimeout(() => {
        if (session === this.session && this.active && !this.processing) this.commitNow('max-duration');
      }, MAX_RECORDING_MS);

      this.noSpeechTimer = setTimeout(() => {
        if (session !== this.session || !this.active || this.processing || this.speechDetected) return;
        this._cancelCapture();
        this.onState('idle');
        this.onError('no-speech');
      }, NO_SPEECH_TIMEOUT_MS);

      return true;
    } catch (error) {
      if (session !== this.session) return false;
      this.active = false;
      this.processing = false;
      this._cleanupCapture();
      this.onState('idle');
      const name = String(error?.name || error?.message || 'mic-failed');
      this.onError(name === 'NotAllowedError' ? 'permission-denied' : name);
      return false;
    }
  }

  _cancelCapture() {
    this._clearTimers();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try { recorder.stop(); } catch (_) {}
    }
    this.chunks = [];
    this._cleanupCapture();
  }

  commitNow(reason = 'manual') {
    if (!this.active || this.processing) return this.getText();
    this.processing = true;
    this.manualStop = true;
    this.active = false;
    this._clearTimers();
    this.onState('processing');

    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this._cleanupCapture();
      this.processing = false;
      this.onState('idle');
      this.onError('no-audio');
      return '';
    }

    try {
      if (recorder.state === 'recording') recorder.requestData();
      recorder.stop();
    } catch (error) {
      this._cleanupCapture();
      this.processing = false;
      this.onState('idle');
      this.onError(error?.message || 'stop-failed');
      return '';
    }
    return reason;
  }

  async _transcribeAndEmit(blob, mimeType, session) {
    try {
      const text = await transcribeWithGemini(blob, mimeType);
      if (session !== this.session || !this.processing) return;
      this.transcript = text;
      this.onText(text, text);
      this.onInterim('', text);
      queueMicrotask(() => this.onUtterance(text, 'gemini'));
    } catch (error) {
      if (session !== this.session) return;
      console.warn('[Gemini Voice] transcription failed', error);
      this.processing = false;
      this.onState('idle');
      this.onError(error?.name === 'AbortError' ? 'gemini-timeout' : 'gemini-transcribe-failed');
    }
  }

  finishProcessing() {
    this.processing = false;
    this.manualStop = true;
    this.active = false;
    this.onState('idle');
  }

  stop(manual = true, emitState = true) {
    this.manualStop = manual;
    this.active = false;
    this.processing = false;
    this.session += 1;
    this._cancelCapture();
    if (emitState) this.onState('idle');
  }
}

export function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || !text) { if (onEnd) onEnd(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    u.rate = 0.94;
    u.pitch = 1;
    let done = false;
    const finish = () => { if (done) return; done = true; if (onEnd) onEnd(); };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, Math.max(3500, String(text).length * 180));
  } catch (_) { if (onEnd) onEnd(); }
}

export const VOICE_INFO = Object.freeze({
  input: 'Gemini audio transcription via GAS',
  primaryModel: TRANSCRIBE_MODELS[0],
  fallbackModel: TRANSCRIBE_MODELS[1],
  browserSpeechRecognition: false,
  geminiTranscribeLive: false
});
