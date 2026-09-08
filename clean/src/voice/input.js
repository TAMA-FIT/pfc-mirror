let activeInstance = null;
let lifecycleInstalled = false;

const CONTINUATION_GRACE_MS = 2800;
const CONTINUATION_RESTART_MS = 120;

function cancelSpeech() {
  try { globalThis.speechSynthesis?.cancel(); } catch (_) {}
}

function installLifecycle() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;
  globalThis.addEventListener('pagehide', () => activeInstance?.stop(true, false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activeInstance?.stop(true, false);
  });
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Ported from the stable TAMA-FIT/PFC- microphone path.
// Android SpeechRecognition can repeat a food token in one final transcript.
// Collapse only obvious adjacent duplicates; never invent or rewrite nutrition data.
export function normalizeSpeechTranscript(text) {
  let out = String(text || '')
    .normalize('NFKC')
    .replace(/[、。]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const foodWords = [
    '鶏胸肉', '鶏むね肉', '鶏むね', '鶏胸', '鳥胸肉', '胸肉', '鶏肉',
    '白米', 'ご飯', 'ごはん', '米', 'ライス',
    '納豆', '味噌汁', 'みそ汁', 'ブロッコリー'
  ];

  foodWords.sort((a, b) => b.length - a.length).forEach(word => {
    const amountUnit = '(g|ｇ|グラム|ぐらむ|杯|パック|P|p|個)?';
    const amountRepeat = new RegExp(
      `(${escapeRegExp(word)}\\s*([0-9]+(?:\\.[0-9]+)?)\\s*${amountUnit})\\s*${escapeRegExp(word)}\\s*\\2\\s*\\3`,
      'g'
    );
    let prev = '';
    while (prev !== out) {
      prev = out;
      out = out.replace(amountRepeat, '$1');
    }
    const repeated = new RegExp(`(?:${escapeRegExp(word)}\\s*){2,}`, 'g');
    out = out.replace(repeated, `${word} `);
  });

  return out.replace(/\s+/g, ' ').trim();
}

function mergeVoiceInput(existingText, newText) {
  const existing = String(existingText || '').trim();
  const incoming = String(newText || '').trim();
  if (!existing) return incoming;
  if (!incoming) return existing;
  if (existing.includes(incoming)) return existing;
  if (incoming.includes(existing)) return incoming;
  return `${existing} ${incoming}`.trim();
}

export class VoiceInput {
  constructor({ onText, onInterim, onState, onError, onUtterance } = {}) {
    this.onText = onText || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.onUtterance = onUtterance || (() => {});
    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.active = false;
    this.processing = false;
    this.manualStop = false;
    this.finalBuffer = '';
    this.interimBuffer = '';
    this.session = 0;
    this.finalizeTimer = null;
    this.restartTimer = null;
    activeInstance = this;
    installLifecycle();
  }

  supported() { return !!this.Recognition; }
  getText() { return this.finalBuffer.trim(); }

  resetBuffer() {
    this.finalBuffer = '';
    this.interimBuffer = '';
  }

  _clearTimers() {
    clearTimeout(this.finalizeTimer);
    clearTimeout(this.restartTimer);
    this.finalizeTimer = null;
    this.restartTimer = null;
  }

  _clearFinalizeTimer() {
    clearTimeout(this.finalizeTimer);
    this.finalizeTimer = null;
  }

  _abortRecognition() {
    const r = this.recognition;
    this.recognition = null;
    if (!r) return;
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    r.onspeechstart = null;
    r.onsoundstart = null;
    try { r.abort(); } catch (_) {
      try { r.stop(); } catch (_) {}
    }
  }

  _scheduleFinalize(session) {
    this._clearFinalizeTimer();
    if (session !== this.session || !this.active || this.processing || !this.getText()) return;
    this.finalizeTimer = setTimeout(() => {
      if (session === this.session && this.active && !this.processing) {
        this.commitNow('pause-grace');
      }
    }, CONTINUATION_GRACE_MS);
  }

  _startCycle(session) {
    if (session !== this.session || !this.active || this.processing || this.manualStop) return false;
    this._abortRecognition();
    const r = this._build(session);
    this.recognition = r;
    try {
      r.start();
      return true;
    } catch (error) {
      this.recognition = null;
      if (this.getText()) {
        this._scheduleFinalize(session);
        return false;
      }
      this.active = false;
      this.onState('idle');
      this.onError(error?.message || 'start-failed');
      return false;
    }
  }

  _acceptFinal(text, session) {
    if (session !== this.session || this.processing || !this.active) return '';
    const clean = normalizeSpeechTranscript(text);
    if (!clean) return '';

    this.finalBuffer = mergeVoiceInput(this.finalBuffer, clean);
    this.interimBuffer = '';
    this.onText(clean, this.finalBuffer);

    // Do not send immediately. Android may finalise on a short thinking pause.
    // Keep the proven one-shot recognizer, but chain a fresh one-shot session
    // during a short grace window. New speech cancels the pending send.
    this._abortRecognition();
    this._scheduleFinalize(session);
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      if (session === this.session && this.active && !this.processing && !this.manualStop) {
        this._startCycle(session);
      }
    }, CONTINUATION_RESTART_MS);
    return this.finalBuffer;
  }

  _build(session) {
    const r = new this.Recognition();
    let delivered = false;
    r.lang = 'ja-JP';

    // Keep the stable production contract: each recognizer is one-shot.
    // Multiple phrases are handled by creating a fresh recognizer, not by
    // continuous=true or by reusing the same Android recognition instance.
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    const speechStarted = () => {
      if (session !== this.session || this.processing || !this.active) return;
      // The user resumed speaking inside the grace window, so do not commit yet.
      this._clearFinalizeTimer();
      this.onState('listening');
    };
    r.onspeechstart = speechStarted;
    r.onsoundstart = speechStarted;

    r.onstart = () => {
      if (session !== this.session) {
        try { r.abort(); } catch (_) {}
        return;
      }
      this.active = true;
      try { localStorage.setItem('tf_mic_permission_ready', 'true'); } catch (_) {}
      this.onState('listening');
    };

    r.onresult = event => {
      if (delivered || session !== this.session || this.processing || !this.active) return;
      let text = '';
      for (let i = event.resultIndex || 0; i < (event.results?.length || 0); i++) {
        const part = String(event.results[i]?.[0]?.transcript || '').trim();
        if (part) text = mergeVoiceInput(text, part);
      }
      if (!text) return;
      delivered = true;
      this._acceptFinal(text, session);
    };

    r.onerror = event => {
      if (session !== this.session) return;
      const code = String(event.error || 'unknown');
      if (code === 'aborted') return;
      this.recognition = null;

      if (code === 'no-speech') {
        if (this.getText()) this._scheduleFinalize(session);
        else {
          this.active = false;
          this.onState('idle');
        }
        return;
      }

      this.active = false;
      this._clearTimers();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        try { localStorage.removeItem('tf_mic_permission_ready'); } catch (_) {}
      }
      this.onState('idle');
      this.onError(code);
    };

    r.onend = () => {
      if (session !== this.session || this.processing || delivered) return;
      if (this.recognition === r) this.recognition = null;
      if (!this.active || this.manualStop) return;

      if (this.getText()) {
        // If speechstart cancelled the timer but this cycle ended without a final,
        // restore the grace countdown rather than leaving the mic stuck forever.
        if (!this.finalizeTimer) this._scheduleFinalize(session);
      } else {
        this.active = false;
        this.onState('idle');
      }
    };

    return r;
  }

  start({ clear = true } = {}) {
    if (!this.supported()) {
      this.onError('unsupported');
      return false;
    }

    this.stop(false, false);
    if (clear) this.resetBuffer();
    this.manualStop = false;
    this.processing = false;
    this.active = true;
    const session = ++this.session;
    return this._startCycle(session);
  }

  commitNow(reason = 'manual') {
    const text = normalizeSpeechTranscript(this.getText());
    if (this.processing) return '';
    if (!text) {
      this.stop(true, true);
      return '';
    }

    this.processing = true;
    this.manualStop = true;
    this.active = false;
    this._clearTimers();
    this._abortRecognition();
    this.onState('processing');
    const session = this.session;
    queueMicrotask(() => {
      if (session === this.session) this.onUtterance(text, reason);
    });
    return text;
  }

  finishProcessing() {
    this.processing = false;
    this.manualStop = true;
    this.active = false;
    this._clearTimers();
    this._abortRecognition();
    this.onState('idle');
  }

  stop(manual = true, emitState = true) {
    this.manualStop = manual;
    this.active = false;
    this.processing = false;
    this._clearTimers();
    this.session += 1;
    this._abortRecognition();
    cancelSpeech();
    if (emitState) this.onState('idle');
  }
}

export function speak(text, onEnd) {
  const modal = document.getElementById('voice-modal');
  if (modal?.hidden || !('speechSynthesis' in window) || !text) {
    if (onEnd) onEnd();
    return;
  }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    u.rate = 0.94;
    u.pitch = 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (onEnd) onEnd();
    };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, Math.max(3500, String(text).length * 180));
  } catch (_) {
    if (onEnd) onEnd();
  }
}

export const VOICE_INFO = Object.freeze({
  input: 'Browser SpeechRecognition one-shot chained core',
  source: 'TAMA-FIT/PFC- stable microphone contract',
  browserSpeechRecognition: true,
  continuous: false,
  interimResults: false,
  continuationGraceMs: CONTINUATION_GRACE_MS,
  liveApi: false
});
