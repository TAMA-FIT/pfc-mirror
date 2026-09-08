import { VoiceInput } from './input.js';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRNfeijUEwXwoFgBYbS60S5zn2fcuqHSm4TAbRePUzjTjqInXu10ZmK4cUvxoJ-dCAxw/exec';
const TRANSCRIBE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
const SILENCE_MS = 3200;
const POLL_MS = 120;
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const MAX_RECORDING_MS = 35000;
const NO_SPEECH_TIMEOUT_MS = 12000;
const PATCH_FLAG = Symbol.for('pfc.voice.mic-stability.v2');

const isAndroid = () => /Android/i.test(navigator.userAgent || '');

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
  return text
    .replace(/^```(?:text|txt)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^[\'\"「]+|[\'\"」]+$/g, '')
    .trim();
}

async function transcribeWithGemini(blob, mimeType) {
  if (!blob || blob.size < 300) throw new Error('no-audio');
  if (blob.size > MAX_AUDIO_BYTES) throw new Error('audio-too-large');

  const audioBase64 = await blobToBase64(blob);
  const prompt = `この音声を日本語で忠実に文字起こししてください。
食事記録アプリの入力なので、食品名・数量・数字・単位（g、個、杯、パック、本など）を特に正確に残してください。
言っていない食品や量を推測して追加しないでください。
説明、Markdown、前置きは不要です。文字起こし本文だけ返してください。`;

  let lastError = null;
  for (const model of TRANSCRIBE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const payload = {
        taskType: 'voice',
        modelPreference: model,
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || blob.type || 'audio/webm', data: audioBase64 } }
        ] }]
      };
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`gemini-http-${response.status}`);
      const text = extractText(await response.json());
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
    const value = (buffer[i] - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, buffer.length));
}

if (!VoiceInput.prototype[PATCH_FLAG]) {
  const nativeStart = VoiceInput.prototype.start;
  const nativeStop = VoiceInput.prototype.stop;
  const nativeCommitNow = VoiceInput.prototype.commitNow;
  const nativeSpeak = VoiceInput.prototype.speak;

  function installStateFeedback(instance) {
    if (instance.__pfcStateFeedbackInstalled) return;
    instance.__pfcStateFeedbackInstalled = true;
    const originalOnState = instance.onState;
    instance.onState = state => {
      originalOnState(state);
      if (state !== 'connecting') return;
      queueMicrotask(() => {
        const status = document.querySelector('.sv4-listen-status');
        if (status) status.textContent = isAndroid() ? 'マイクを準備しています…' : '音声AIへ接続しています…';
        const button = document.querySelector('.sv4-mic');
        if (button) button.disabled = true;
      });
    };
  }

  function clearLiveSilenceWatch(instance) {
    if (instance.__pfcSilenceWatch) clearInterval(instance.__pfcSilenceWatch);
    instance.__pfcSilenceWatch = null;
    instance.__pfcLastSpeechEnd = 0;
  }

  function startLiveSilenceWatch(instance) {
    clearLiveSilenceWatch(instance);
    instance.__pfcSilenceWatch = setInterval(() => {
      if (!instance.active || instance.processing || instance.__pfcFallback) return;
      const speechEnd = Number(instance.profile?.t?.speechEnd || 0);
      if (speechEnd > 0) instance.__pfcLastSpeechEnd = speechEnd;
      if (!instance.__pfcLastSpeechEnd) return;
      if (performance.now() - instance.__pfcLastSpeechEnd < SILENCE_MS) return;
      clearLiveSilenceWatch(instance);
      nativeCommitNow.call(instance);
    }, POLL_MS);
  }

  function cleanupFallback(instance, { cancelRecorder = true } = {}) {
    const f = instance.__pfcFallback;
    if (!f) return;
    clearInterval(f.meterTimer);
    clearTimeout(f.hardTimer);
    clearTimeout(f.noSpeechTimer);
    f.meterTimer = null;
    f.hardTimer = null;
    f.noSpeechTimer = null;

    if (cancelRecorder && f.recorder && f.recorder.state !== 'inactive') {
      f.recorder.onstop = null;
      try { f.recorder.stop(); } catch (_) {}
    }
    try { f.source?.disconnect(); } catch (_) {}
    try { f.analyser?.disconnect(); } catch (_) {}
    try { f.stream?.getTracks().forEach(track => track.stop()); } catch (_) {}
    try { f.audioContext?.close(); } catch (_) {}
    f.source = null;
    f.analyser = null;
    f.stream = null;
    f.audioContext = null;
    f.recorder = null;
  }

  async function startFallbackMeter(instance, f) {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx || !f.stream) return;
    try {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) {}
      }
      const source = ctx.createMediaStreamSource(f.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.1;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      f.audioContext = ctx;
      f.source = source;
      f.analyser = analyser;
      let calibrationSamples = 0;
      let calibrationTotal = 0;

      f.meterTimer = setInterval(() => {
        if (instance.__pfcFallback !== f || !instance.active || instance.processing) return;
        const rms = rmsFromAnalyser(analyser, buffer);
        if (!f.speechDetected && calibrationSamples < 5) {
          calibrationSamples += 1;
          calibrationTotal += rms;
          if (calibrationSamples === 5) {
            f.noiseFloor = Math.max(0.004, Math.min(0.02, calibrationTotal / calibrationSamples));
          }
        }
        const threshold = Math.max(0.014, f.noiseFloor * 2.7);
        const now = performance.now();
        if (rms >= threshold) {
          f.speechDetected = true;
          f.lastSpeechAt = now;
        } else if (f.speechDetected && now - f.lastSpeechAt >= SILENCE_MS) {
          instance.commitNow('silence');
        }
      }, 100);
    } catch (error) {
      console.warn('[Voice fallback] level meter unavailable', error);
    }
  }

  async function transcribeFallback(instance, f, blob, mimeType) {
    try {
      const text = await transcribeWithGemini(blob, mimeType);
      if (instance.__pfcFallback !== f || f.cancelled || !instance.processing) return;
      instance.transcript = text;
      instance.interim = '';
      instance.onText(text, text);
      instance.onInterim('', text);
      queueMicrotask(() => instance.onUtterance(text, 'gemini-recorder-fallback'));
    } catch (error) {
      if (instance.__pfcFallback !== f || f.cancelled) return;
      console.warn('[Voice fallback] transcription failed', error);
      instance.processing = false;
      instance.onState('idle');
      instance.onError(error?.name === 'AbortError' ? 'gemini-timeout' : 'gemini-transcribe-failed');
    }
  }

  async function startRecorderFallback(instance, { clear = true } = {}) {
    if (!(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder)) {
      instance.onError('unsupported');
      return false;
    }
    if (instance.__pfcFallback?.starting || instance.__pfcFallback?.active) return true;

    nativeStop.call(instance, false, false);
    clearLiveSilenceWatch(instance);
    if (clear) instance.resetBuffer();
    instance.processing = false;
    instance.pendingSpeakEnd = null;
    instance.serverTurnComplete = false;
    instance.liveResult = null;
    instance.emitted = false;
    instance.onState('connecting');

    const f = {
      id: (instance.__pfcFallbackSeq || 0) + 1,
      starting: true,
      active: false,
      cancelled: false,
      stream: null,
      recorder: null,
      chunks: [],
      mimeType: '',
      speechDetected: false,
      lastSpeechAt: 0,
      noiseFloor: 0.006,
      meterTimer: null,
      hardTimer: null,
      noSpeechTimer: null,
      audioContext: null,
      source: null,
      analyser: null
    };
    instance.__pfcFallbackSeq = f.id;
    instance.__pfcFallback = f;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      if (instance.__pfcFallback !== f || f.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      f.stream = stream;
      f.mimeType = chooseMimeType();
      const options = f.mimeType
        ? { mimeType: f.mimeType, audioBitsPerSecond: 64000 }
        : { audioBitsPerSecond: 64000 };
      const recorder = new MediaRecorder(stream, options);
      f.recorder = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) f.chunks.push(event.data);
      };
      recorder.onerror = event => {
        if (instance.__pfcFallback !== f || f.cancelled) return;
        instance.onError(event.error?.name || 'recorder-error');
      };
      recorder.onstop = () => {
        if (instance.__pfcFallback !== f || f.cancelled) return;
        const type = f.mimeType || recorder.mimeType || f.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(f.chunks, { type });
        f.chunks = [];
        cleanupFallback(instance, { cancelRecorder: false });
        if (!instance.processing) return;
        transcribeFallback(instance, f, blob, type);
      };

      recorder.start(250);
      f.starting = false;
      f.active = true;
      instance.active = true;
      instance.onState('listening');
      startFallbackMeter(instance, f);

      f.hardTimer = setTimeout(() => {
        if (instance.__pfcFallback === f && instance.active && !instance.processing) instance.commitNow('max-duration');
      }, MAX_RECORDING_MS);
      f.noSpeechTimer = setTimeout(() => {
        if (instance.__pfcFallback !== f || !instance.active || instance.processing || f.speechDetected) return;
        f.cancelled = true;
        instance.active = false;
        cleanupFallback(instance);
        instance.__pfcFallback = null;
        instance.onState('idle');
        instance.onError('no-speech');
      }, NO_SPEECH_TIMEOUT_MS);
      return true;
    } catch (error) {
      if (instance.__pfcFallback !== f) return false;
      f.cancelled = true;
      instance.active = false;
      instance.processing = false;
      cleanupFallback(instance);
      instance.__pfcFallback = null;
      instance.onState('idle');
      const name = String(error?.name || error?.message || 'mic-failed');
      instance.onError(name === 'NotAllowedError' ? 'permission-denied' : name);
      return false;
    }
  }

  VoiceInput.prototype.start = function startStable(options = {}) {
    installStateFeedback(this);
    if (this.active) return Promise.resolve(true);
    if (this.__pfcStartPromise) return this.__pfcStartPromise;

    const epoch = (this.__pfcStartEpoch || 0) + 1;
    this.__pfcStartEpoch = epoch;
    const run = async () => {
      if (isAndroid()) return startRecorderFallback(this, options);

      const originalOnError = this.onError;
      let liveError = null;
      this.onError = error => { liveError = error; };
      let ok = false;
      try {
        ok = await nativeStart.call(this, options);
      } finally {
        this.onError = originalOnError;
      }
      if (epoch !== this.__pfcStartEpoch) {
        if (ok || this.active) nativeStop.call(this, true, true);
        return false;
      }
      if (ok) {
        startLiveSilenceWatch(this);
        return true;
      }
      console.warn('[Voice Live] falling back to recorder', liveError);
      return startRecorderFallback(this, options);
    };

    const promise = Promise.resolve()
      .then(run)
      .finally(() => {
        if (this.__pfcStartPromise === promise) this.__pfcStartPromise = null;
      });
    this.__pfcStartPromise = promise;
    return promise;
  };

  VoiceInput.prototype.commitNow = function commitStable(reason = 'manual') {
    const f = this.__pfcFallback;
    if (!f) {
      clearLiveSilenceWatch(this);
      return nativeCommitNow.call(this, reason);
    }
    if (!this.active || this.processing || !f.recorder) return this.getText();

    this.active = false;
    this.processing = true;
    f.active = false;
    clearInterval(f.meterTimer);
    clearTimeout(f.hardTimer);
    clearTimeout(f.noSpeechTimer);
    this.onState('processing');

    try {
      if (f.recorder.state === 'recording') f.recorder.requestData();
      f.recorder.stop();
    } catch (error) {
      f.cancelled = true;
      cleanupFallback(this);
      this.__pfcFallback = null;
      this.processing = false;
      this.onState('idle');
      this.onError(error?.message || 'stop-failed');
    }
    return reason;
  };

  VoiceInput.prototype.stop = function stopStable(manual = true, emitState = true) {
    this.__pfcStartEpoch = (this.__pfcStartEpoch || 0) + 1;
    clearLiveSilenceWatch(this);
    const f = this.__pfcFallback;
    if (f) {
      f.cancelled = true;
      cleanupFallback(this);
      this.__pfcFallback = null;
      this.active = false;
      this.processing = false;
      if (emitState) this.onState('idle');
      return;
    }
    return nativeStop.call(this, manual, emitState);
  };

  VoiceInput.prototype.speak = function speakStable(text, onEnd) {
    if (!isAndroid() && !this.__pfcFallback) return nativeSpeak.call(this, text, onEnd);
    const value = String(text || '').trim();
    if (!value || !('speechSynthesis' in globalThis)) {
      onEnd?.();
      return;
    }
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(value);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.94;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onEnd?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      speechSynthesis.speak(utterance);
      setTimeout(finish, Math.max(3500, value.length * 180));
    } catch (_) {
      onEnd?.();
    }
  };

  Object.defineProperty(VoiceInput.prototype, PATCH_FLAG, { value: true });
}
