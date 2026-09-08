let activeInstance = null;
let lifecycleInstalled = false;

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
    this.resultDelivered = false;
    activeInstance = this;
    installLifecycle();
  }

  supported() { return !!this.Recognition; }
  getText() { return this.finalBuffer.trim(); }
  resetBuffer() {
    this.finalBuffer = '';
    this.interimBuffer = '';
    this.resultDelivered = false;
  }

  _abortRecognition() {
    const r = this.recognition;
    this.recognition = null;
    if (!r) return;
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    try { r.abort(); } catch (_) {
      try { r.stop(); } catch (_) {}
    }
  }

  _deliver(text, session) {
    if (session !== this.session || this.processing || this.resultDelivered) return '';
    const clean = normalizeSpeechTranscript(text);
    if (!clean) return '';
    this.resultDelivered = true;
    this.finalBuffer = mergeVoiceInput(this.finalBuffer, clean);
    this.interimBuffer = '';
    this.onText(clean, this.finalBuffer);
    this.processing = true;
    this.manualStop = true;
    this.active = false;
    this._abortRecognition();
    this.onState('processing');
    const finalText = this.finalBuffer;
    queueMicrotask(() => {
      if (session === this.session) this.onUtterance(finalText, 'recognition-result');
    });
    return finalText;
  }

  _build(session) {
    const r = new this.Recognition();
    r.lang = 'ja-JP';

    // Stable production path from TAMA-FIT/PFC-:
    // one recognition session -> one final result -> hard stop.
    // No continuous restart loop and no interim append buffer.
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

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
      if (session !== this.session || this.processing || this.resultDelivered) return;
      let text = '';
      for (let i = event.resultIndex || 0; i < (event.results?.length || 0); i++) {
        const part = String(event.results[i]?.[0]?.transcript || '').trim();
        if (part) text = mergeVoiceInput(text, part);
      }
      this._deliver(text, session);
    };

    r.onerror = event => {
      if (session !== this.session) return;
      const code = String(event.error || 'unknown');
      if (code === 'aborted') return;
      this.active = false;
      this._abortRecognition();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        try { localStorage.removeItem('tf_mic_permission_ready'); } catch (_) {}
      }
      this.onState('idle');
      this.onError(code);
    };

    r.onend = () => {
      if (session !== this.session || this.processing || this.resultDelivered) return;
      this.active = false;
      this.recognition = null;
      this.onState('idle');
      // Do not auto-restart. Reusing one recognizer across Android onend cycles
      // was the source of duplicated final transcripts in the Clean rewrite.
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
    this.resultDelivered = false;
    const session = ++this.session;
    this.recognition = this._build(session);

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      this.active = false;
      this._abortRecognition();
      this.onState('idle');
      this.onError(error?.message || 'start-failed');
      return false;
    }
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
    this.resultDelivered = true;
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
    this._abortRecognition();
    this.onState('idle');
  }

  stop(manual = true, emitState = true) {
    this.manualStop = manual;
    this.active = false;
    this.processing = false;
    this.resultDelivered = false;
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
  input: 'Browser SpeechRecognition one-shot stable core',
  source: 'TAMA-FIT/PFC- stable microphone contract',
  browserSpeechRecognition: true,
  continuous: false,
  interimResults: false,
  liveApi: false
});
