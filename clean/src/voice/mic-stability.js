import { VoiceInput } from './input.js';

const SILENCE_MS = 3200;
const POLL_MS = 120;
const PATCH_FLAG = Symbol.for('pfc.voice.mic-stability.v1');

if (!VoiceInput.prototype[PATCH_FLAG]) {
  const nativeStart = VoiceInput.prototype.start;
  const nativeStop = VoiceInput.prototype.stop;
  const nativeCommitNow = VoiceInput.prototype.commitNow;

  function clearSilenceWatch(instance) {
    if (instance.__pfcSilenceWatch) {
      clearInterval(instance.__pfcSilenceWatch);
      instance.__pfcSilenceWatch = null;
    }
    instance.__pfcLastSpeechEnd = 0;
  }

  function startSilenceWatch(instance) {
    clearSilenceWatch(instance);
    instance.__pfcSilenceWatch = setInterval(() => {
      if (!instance.active || instance.processing) return;
      const speechEnd = Number(instance.profile?.t?.speechEnd || 0);
      if (speechEnd > 0) instance.__pfcLastSpeechEnd = speechEnd;
      if (!instance.__pfcLastSpeechEnd) return;
      if (performance.now() - instance.__pfcLastSpeechEnd < SILENCE_MS) return;
      clearSilenceWatch(instance);
      nativeCommitNow.call(instance);
    }, POLL_MS);
  }

  function installStateFeedback(instance) {
    if (instance.__pfcStateFeedbackInstalled) return;
    instance.__pfcStateFeedbackInstalled = true;
    const originalOnState = instance.onState;
    instance.onState = state => {
      originalOnState(state);
      if (state !== 'connecting') return;
      queueMicrotask(() => {
        const status = document.querySelector('.sv4-listen-status');
        if (status) status.textContent = 'マイクを準備しています…';
        const button = document.querySelector('.sv4-mic');
        if (button) button.disabled = true;
      });
    };
  }

  function prewarmAudioContext() {
    const key = globalThis.AudioContext ? 'AudioContext' : (globalThis.webkitAudioContext ? 'webkitAudioContext' : null);
    if (!key) return null;
    const NativeAudioContext = globalThis[key];
    try {
      const ctx = new NativeAudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return { ctx, NativeAudioContext, key };
    } catch (_) {
      return null;
    }
  }

  VoiceInput.prototype.start = function startStable(options) {
    installStateFeedback(this);
    if (this.active) return Promise.resolve(true);
    if (this.__pfcStartPromise) return this.__pfcStartPromise;

    const epoch = (this.__pfcStartEpoch || 0) + 1;
    this.__pfcStartEpoch = epoch;
    const warm = prewarmAudioContext();
    let usedWarmContext = false;
    let restoreAudioContext = null;

    if (warm?.ctx && warm.NativeAudioContext && warm.key && globalThis[warm.key] === warm.NativeAudioContext) {
      const NativeAudioContext = warm.NativeAudioContext;
      const audioContextKey = warm.key;
      function WarmAudioContext(...args) {
        if (!usedWarmContext) {
          usedWarmContext = true;
          return warm.ctx;
        }
        return new NativeAudioContext(...args);
      }
      WarmAudioContext.prototype = NativeAudioContext.prototype;
      Object.setPrototypeOf(WarmAudioContext, NativeAudioContext);
      try { globalThis[audioContextKey] = WarmAudioContext; } catch (_) {}
      restoreAudioContext = () => {
        try { if (globalThis[audioContextKey] === WarmAudioContext) globalThis[audioContextKey] = NativeAudioContext; } catch (_) {}
      };
    }

    const promise = Promise.resolve()
      .then(() => nativeStart.call(this, options))
      .then(ok => {
        if (epoch !== this.__pfcStartEpoch) {
          if (ok || this.active) nativeStop.call(this, true, true);
          return false;
        }
        if (ok) startSilenceWatch(this);
        return ok;
      })
      .catch(error => {
        console.warn('[Voice mic stability]', error);
        throw error;
      })
      .finally(() => {
        restoreAudioContext?.();
        if (!usedWarmContext) {
          try { warm?.ctx?.close(); } catch (_) {}
        }
        if (this.__pfcStartPromise === promise) this.__pfcStartPromise = null;
      });

    this.__pfcStartPromise = promise;
    return promise;
  };

  VoiceInput.prototype.commitNow = function commitStable(...args) {
    clearSilenceWatch(this);
    return nativeCommitNow.apply(this, args);
  };

  VoiceInput.prototype.stop = function stopStable(...args) {
    this.__pfcStartEpoch = (this.__pfcStartEpoch || 0) + 1;
    clearSilenceWatch(this);
    return nativeStop.apply(this, args);
  };

  Object.defineProperty(VoiceInput.prototype, PATCH_FLAG, { value: true });
}
